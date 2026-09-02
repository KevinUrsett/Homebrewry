import type { CatalogueEntry } from './types';
import { dataRecord, dataRecords, isRecord } from './presentation';

export type MagicWeapon = {
  shortDescription: string;
  effectText: string;
  attackBonus: number;
  damageBonus: number;
  extraDamageDice: string;
  extraDamageType: string;
};

export type MonsterEquipment = {
  itemId: string;
  actionIndexes: number[];
};

export const monsterStatChangeDefinitions = [
  { field: 'armorClass', label: 'Armor Class', valueType: 'number', canAdd: true },
  { field: 'hitPoints', label: 'Hit Points', valueType: 'number', canAdd: true },
  { field: 'speed', label: 'Walking speed', valueType: 'number', canAdd: true },
  { field: 'burrowSpeed', label: 'Burrow speed', valueType: 'number', canAdd: true },
  { field: 'climbSpeed', label: 'Climb speed', valueType: 'number', canAdd: true },
  { field: 'flySpeed', label: 'Fly speed', valueType: 'number', canAdd: true },
  { field: 'swimSpeed', label: 'Swim speed', valueType: 'number', canAdd: true },
  { field: 'strength', label: 'Strength', valueType: 'number', canAdd: true },
  { field: 'dexterity', label: 'Dexterity', valueType: 'number', canAdd: true },
  { field: 'constitution', label: 'Constitution', valueType: 'number', canAdd: true },
  { field: 'intelligence', label: 'Intelligence', valueType: 'number', canAdd: true },
  { field: 'wisdom', label: 'Wisdom', valueType: 'number', canAdd: true },
  { field: 'charisma', label: 'Charisma', valueType: 'number', canAdd: true },
  { field: 'initiativeBonus', label: 'Initiative bonus', valueType: 'number', canAdd: true },
  { field: 'challengeRating', label: 'Challenge rating', valueType: 'text', canAdd: false },
  { field: 'size', label: 'Size', valueType: 'text', canAdd: false },
  { field: 'type', label: 'Creature type', valueType: 'text', canAdd: false },
  { field: 'alignment', label: 'Alignment', valueType: 'text', canAdd: false }
] as const;

export type MonsterStatField = typeof monsterStatChangeDefinitions[number]['field'];
export type MonsterStatChangeDefinition = typeof monsterStatChangeDefinitions[number];
export type MonsterStatChange = {
  field: MonsterStatField;
  operation: 'add' | 'set';
  value: number | string;
};

export type MonsterStatBlockModifiers = {
  changes: MonsterStatChange[];
  traits: Array<{ name: string; text: string }>;
};

export type MonsterWeaponAction = {
  id: string;
  name: string;
  attackBonus: number;
  damageDice: string;
  damageModifier: number;
  damageType: string;
  reach: string;
  range: string;
  text: string;
  equipmentId: string;
};

export type ResolvedMonsterWeaponAction = MonsterWeaponAction & {
  item: CatalogueEntry | null;
  magicWeapon: MagicWeapon | null;
  resolvedAttackBonus: number;
  resolvedDamageModifier: number;
};

function text(value: unknown, maximum = 8_000): string {
  return typeof value === 'string' && value.length <= maximum ? value.trim() : '';
}

function wholeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) ? value : 0;
}

function dataArray(entry: CatalogueEntry, key: string): unknown[] {
  const value = entry.data[key];
  return Array.isArray(value) ? value : [];
}

function statDefinition(field: unknown): MonsterStatChangeDefinition | null {
  return monsterStatChangeDefinitions.find((definition) => definition.field === field) ?? null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const number = numberFromValue(candidate);
      if (number !== null) return number;
    }
    return null;
  }
  if (isRecord(value)) {
    for (const key of ['ac', 'average', 'hp', 'value']) {
      const number = numberFromValue(value[key]);
      if (number !== null) return number;
    }
  }
  return null;
}

/** Modifiers are authored on custom Items but only read when that item is
 * equipped by an encounter combatant. */
export function monsterStatBlockModifiersForItem(entry: CatalogueEntry | null | undefined): MonsterStatBlockModifiers | null {
  if (!entry || entry.category !== 'item') return null;
  const data = dataRecord(entry, 'monsterStatBlock');
  const candidates = Array.isArray(data.changes) ? data.changes : [];
  const changes: MonsterStatChange[] = [];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const definition = statDefinition(candidate.field);
    if (!definition) continue;
    const operation = candidate.operation === 'set' || (candidate.operation === 'add' && definition.canAdd)
      ? candidate.operation
      : null;
    if (!operation) continue;
    if (definition.valueType === 'number') {
      const value = finiteNumber(candidate.value);
      if (value !== null) changes.push({ field: definition.field, operation, value });
      continue;
    }
    const value = text(candidate.value, 240);
    if (value) changes.push({ field: definition.field, operation: 'set', value });
  }
  const traits = (Array.isArray(data.traits) ? data.traits : []).flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const name = text(candidate.name, 240);
    const traitText = text(candidate.text);
    return name && traitText ? [{ name, text: traitText }] : [];
  });
  return changes.length || traits.length ? { changes, traits } : null;
}

/** Returns campaign-owned items that can affect a monster in an encounter. */
export function encounterEquipmentItems(entries: readonly CatalogueEntry[]): CatalogueEntry[] {
  return entries
    .filter((entry) => entry.source === 'Custom' && entry.category === 'item' && (Boolean(magicWeaponForItem(entry)) || Boolean(monsterStatBlockModifiersForItem(entry))))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function magicWeaponForItem(entry: CatalogueEntry | null | undefined): MagicWeapon | null {
  if (!entry || entry.category !== 'item') return null;
  const data = dataRecord(entry, 'magicWeapon');
  if (!Object.keys(data).length) return null;
  return {
    shortDescription: text(data.shortDescription),
    effectText: text(data.effectText),
    attackBonus: wholeNumber(data.attackBonus),
    damageBonus: wholeNumber(data.damageBonus),
    extraDamageDice: text(data.extraDamageDice, 80),
    extraDamageType: text(data.extraDamageType, 80)
  };
}

/** Safely reads equipment stored either on a catalogue monster or on an
 * encounter participant. Encounter data is user-authored and may predate the
 * current schema, so it is intentionally treated as untrusted input. */
export function normaliseMonsterEquipment(value: unknown): MonsterEquipment[] {
  const seen = new Set<string>();
  const candidates = Array.isArray(value) ? value : [];
  return candidates.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const itemId = text(candidate.itemId, 180);
    if (!itemId || seen.has(itemId) || seen.size >= 50) return [];
    seen.add(itemId);
    const actionIndexes = Array.isArray(candidate.actionIndexes)
      ? [...new Set(candidate.actionIndexes.filter((index): index is number => typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < 100))]
      : [];
    return [{ itemId, actionIndexes }];
  });
}

export function monsterEquipment(entry: CatalogueEntry): MonsterEquipment[] {
  return normaliseMonsterEquipment(dataArray(entry, 'equipment'));
}

/**
 * Encounter equipment is an overlay, never a mutation of the source monster.
 * If a temporary weapon targets an Action, it replaces any source weapon that
 * targeted that same Action for this encounter's rendered stat block.
 */
export function resolvedMonsterEquipment(entry: CatalogueEntry, encounterEquipment?: readonly MonsterEquipment[]): MonsterEquipment[] {
  const temporary = normaliseMonsterEquipment(encounterEquipment);
  if (!temporary.length) return monsterEquipment(entry);

  const temporaryActionIndexes = new Set(temporary.flatMap((item) => item.actionIndexes));
  const source = monsterEquipment(entry).flatMap((item) => {
    const actionIndexes = item.actionIndexes.filter((index) => !temporaryActionIndexes.has(index));
    return actionIndexes.length || !item.actionIndexes.length ? [{ ...item, actionIndexes }] : [];
  });
  const sourceIds = new Set(source.map((item) => item.itemId));
  return [...source, ...temporary.filter((item) => !sourceIds.has(item.itemId))];
}

function nextNumber(current: number | null, change: MonsterStatChange): number {
  const value = Number(change.value);
  return change.operation === 'set' ? value : (current ?? 0) + value;
}

function updatedNumberValue(current: unknown, next: number, unit = ''): number | string {
  if (typeof current === 'number') return next;
  if (typeof current === 'string') {
    return /-?\d+(?:\.\d+)?/.test(current)
      ? current.replace(/-?\d+(?:\.\d+)?/, String(next))
      : `${next}${unit}`;
  }
  return unit ? `${next}${unit}` : next;
}

function speedKey(field: MonsterStatField): string | null {
  switch (field) {
    case 'speed': return 'walk';
    case 'burrowSpeed': return 'burrow';
    case 'climbSpeed': return 'climb';
    case 'flySpeed': return 'fly';
    case 'swimSpeed': return 'swim';
    default: return null;
  }
}

function abilityKey(field: MonsterStatField): string | null {
  switch (field) {
    case 'strength': return 'str';
    case 'dexterity': return 'dex';
    case 'constitution': return 'con';
    case 'intelligence': return 'int';
    case 'wisdom': return 'wis';
    case 'charisma': return 'cha';
    default: return null;
  }
}

function applyStatChange(data: Record<string, unknown>, change: MonsterStatChange) {
  const ability = abilityKey(change.field);
  if (ability) {
    const abilities = isRecord(data.abilities) ? { ...data.abilities } : {};
    abilities[ability] = nextNumber(numberFromValue(abilities[ability]), change);
    data.abilities = abilities;
    return;
  }

  const speed = speedKey(change.field);
  if (speed) {
    const existing = data.speed;
    if ((typeof existing === 'string' || typeof existing === 'number') && speed === 'walk') {
      data.speed = updatedNumberValue(existing, nextNumber(numberFromValue(existing), change), ' ft.');
      return;
    }
    const speeds = isRecord(existing) ? { ...existing } : {};
    if (!isRecord(existing) && existing !== undefined) {
      const walk = numberFromValue(existing);
      if (walk !== null) speeds.walk = walk;
    }
    speeds[speed] = nextNumber(numberFromValue(speeds[speed]), change);
    data.speed = speeds;
    return;
  }

  switch (change.field) {
    case 'armorClass':
      data.ac = updatedNumberValue(data.ac, nextNumber(numberFromValue(data.ac), change));
      return;
    case 'hitPoints':
      data.hp = updatedNumberValue(data.hp, nextNumber(numberFromValue(data.hp), change));
      return;
    case 'initiativeBonus':
      data.initiativeBonus = updatedNumberValue(data.initiativeBonus, nextNumber(numberFromValue(data.initiativeBonus), change));
      return;
    case 'challengeRating': data.cr = change.value; return;
    case 'size': data.size = change.value; return;
    case 'type': data.type = change.value; return;
    case 'alignment': data.alignment = change.value; return;
  }
}

/**
 * Builds a display-only version of a monster for one Encounter. The catalogue
 * entry is never mutated, and source-monster equipment is deliberately not
 * considered here: only this encounter's overlay can change general stats.
 */
export function resolvedEncounterMonsterStatBlock(
  entry: CatalogueEntry,
  catalogue: ReadonlyMap<string, CatalogueEntry>,
  encounterEquipment?: readonly MonsterEquipment[]
): CatalogueEntry {
  const temporary = normaliseMonsterEquipment(encounterEquipment);
  if (!temporary.length) return entry;

  const data = { ...entry.data };
  for (const { itemId } of temporary) {
    const modifiers = monsterStatBlockModifiersForItem(catalogue.get(`item:${itemId}`));
    if (!modifiers) continue;
    modifiers.changes.forEach((change) => applyStatChange(data, change));
    if (modifiers.traits.length) data.traits = [...dataRecords({ ...entry, data }, 'traits'), ...modifiers.traits];
  }
  return { ...entry, data };
}

function replaceAttackModifier(value: string, bonus: number): string {
  if (!bonus) return value;
  return value.replace(
    /((?:Melee|Ranged)(?:\s+Weapon)?\s+Attack(?:\s+Roll)?\s*:?_?\s*)([+-]\s*\d+)/i,
    (_match, prefix: string, modifier: string) => `${prefix}${signedModifier(Number(modifier.replace(/\s/g, '')) + bonus)}`
  );
}

function replaceDamageModifier(value: string, bonus: number): string {
  if (!bonus) return value;
  let next = value.replace(
    /(_Hit:_\s*)(\d+)(\s*\(\s*\d+d\d+\s*[+-]\s*\d+\s*\))/i,
    (_match, prefix: string, average: string, suffix: string) => `${prefix}${Number(average) + bonus}${suffix}`
  );
  next = next.replace(
    /(\d+d\d+\s*)([+-])\s*(\d+)(?=\)?\s+(?:[A-Za-z]+\s+)?damage)/i,
    (_match, dice: string, operator: string, modifier: string) => `${dice}${signedModifier((operator === '-' ? -1 : 1) * Number(modifier) + bonus)}`
  );
  return next;
}

export function applyMagicWeaponToActionText(value: string, weapon: MagicWeapon): string {
  let next = replaceAttackModifier(value, weapon.attackBonus);
  next = replaceDamageModifier(next, weapon.damageBonus);
  if (weapon.extraDamageDice && !next.includes(`${weapon.extraDamageDice}${weapon.extraDamageType ? ` ${weapon.extraDamageType}` : ''} damage`)) {
    next = next.replace(
      /(\b(?:[A-Za-z]+\s+)?damage)([.!])/i,
      `$1 plus ${weapon.extraDamageDice}${weapon.extraDamageType ? ` ${weapon.extraDamageType}` : ''} damage$2`
    );
  }
  return next;
}

export function resolvedMonsterActions(entry: CatalogueEntry, catalogue: ReadonlyMap<string, CatalogueEntry>, equipment = monsterEquipment(entry)): Record<string, unknown>[] {
  const equipped = normaliseMonsterEquipment(equipment);
  return dataRecords(entry, 'actions').map((action, actionIndex) => {
    const itemId = equipped.find((item) => item.actionIndexes.includes(actionIndex))?.itemId;
    const weapon = magicWeaponForItem(itemId ? catalogue.get(`item:${itemId}`) : null);
    const text = typeof action.text === 'string' ? action.text : '';
    return weapon && text ? { ...action, text: applyMagicWeaponToActionText(text, weapon) } : action;
  });
}

export function monsterWeaponActions(entry: CatalogueEntry): MonsterWeaponAction[] {
  const seen = new Set<string>();
  return dataArray(entry, 'weaponActions').flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const id = text(candidate.id, 180);
    if (!id || seen.has(id) || seen.size >= 100) return [];
    seen.add(id);
    return [{
      id,
      name: text(candidate.name, 240) || 'Weapon attack',
      attackBonus: wholeNumber(candidate.attackBonus),
      damageDice: text(candidate.damageDice, 80),
      damageModifier: wholeNumber(candidate.damageModifier),
      damageType: text(candidate.damageType, 80),
      reach: text(candidate.reach, 80),
      range: text(candidate.range, 80),
      text: text(candidate.text),
      equipmentId: text(candidate.equipmentId, 180)
    }];
  });
}

export function magicWeaponItems(entries: readonly CatalogueEntry[]): CatalogueEntry[] {
  return entries
    .filter((entry) => entry.source === 'Custom' && Boolean(magicWeaponForItem(entry)))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function resolvedMonsterWeaponActions(entry: CatalogueEntry, catalogue: ReadonlyMap<string, CatalogueEntry>, equipment = monsterEquipment(entry)): ResolvedMonsterWeaponAction[] {
  const equipmentIds = new Set(normaliseMonsterEquipment(equipment).map((item) => item.itemId));
  return monsterWeaponActions(entry).map((action) => {
    const item = equipmentIds.has(action.equipmentId) ? catalogue.get(`item:${action.equipmentId}`) ?? null : null;
    const magicWeapon = magicWeaponForItem(item);
    return {
      ...action,
      item,
      magicWeapon,
      resolvedAttackBonus: action.attackBonus + (magicWeapon?.attackBonus ?? 0),
      resolvedDamageModifier: action.damageModifier + (magicWeapon?.damageBonus ?? 0)
    };
  });
}

export function signedModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export function weaponActionText(action: ResolvedMonsterWeaponAction): string {
  const range = action.range ? `range ${action.range}` : action.reach ? `reach ${action.reach}` : '';
  const hit = [
    action.damageDice && `${action.damageDice} ${signedModifier(action.resolvedDamageModifier)}`.trim(),
    action.damageType && `${action.damageType} damage`
  ].filter(Boolean).join(' ');
  const extra = action.magicWeapon?.extraDamageDice
    ? ` plus ${action.magicWeapon.extraDamageDice}${action.magicWeapon.extraDamageType ? ` ${action.magicWeapon.extraDamageType}` : ''} damage`
    : '';
  const suffix = action.text ? ` ${action.text}` : '';
  return `_${action.range ? 'Ranged' : 'Melee'} Weapon Attack:_ ${signedModifier(action.resolvedAttackBonus)} to hit${range ? `, ${range}` : ''}. _Hit:_ ${hit || 'damage'}${extra}.${suffix}`;
}
