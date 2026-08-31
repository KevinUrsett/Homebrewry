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

export function monsterEquipment(entry: CatalogueEntry): MonsterEquipment[] {
  const seen = new Set<string>();
  return dataArray(entry, 'equipment').flatMap((candidate) => {
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

export function resolvedMonsterActions(entry: CatalogueEntry, catalogue: ReadonlyMap<string, CatalogueEntry>): Record<string, unknown>[] {
  const equipped = monsterEquipment(entry);
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

export function resolvedMonsterWeaponActions(entry: CatalogueEntry, catalogue: ReadonlyMap<string, CatalogueEntry>): ResolvedMonsterWeaponAction[] {
  const equipmentIds = new Set(monsterEquipment(entry).map((item) => item.itemId));
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
