import {
  worldbuildingKinds,
  type BuiltInWorldbuildingKind,
  type WorldbuildingEntry,
  type WorldbuildingKind,
  type WorldbuildingType
} from '../types';

export const worldbuildingKindLabels: Record<BuiltInWorldbuildingKind, string> = {
  town: 'Town',
  road: 'Road',
  'historical-figure': 'Historical figure',
  character: 'Character',
  npc: 'NPC',
  faction: 'Faction',
  landmark: 'Landmark',
  region: 'Region',
  organization: 'Organisation',
  event: 'Event',
  deity: 'Deity',
  item: 'Item',
  // Keep the stored `creature` kind stable for existing brews and Drive data,
  // but present it as the clearer, player-facing "Monster" everywhere.
  creature: 'Monster',
  custom: 'Custom'
};

export { worldbuildingKinds };

export function isBuiltInWorldbuildingKind(value: string): value is BuiltInWorldbuildingKind {
  return (worldbuildingKinds as readonly string[]).includes(value);
}

export function worldbuildingKindLabel(kind: WorldbuildingKind, customTypes: readonly WorldbuildingType[] = []): string {
  if (isBuiltInWorldbuildingKind(kind)) return worldbuildingKindLabels[kind];
  return customTypes.find((type) => type.id === kind)?.name ?? 'Custom type';
}

export function normalizeWorldbuildingName(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replaceAll('[', '')
    .replaceAll(']', '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export function createWorldbuildingEntry(name = 'Untitled entry', kind: WorldbuildingKind = 'custom'): WorldbuildingEntry {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: normalizeWorldbuildingName(name) || 'Untitled entry',
    kind,
    aliases: [],
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}

export function createWorldbuildingType(
  name: string,
  timestamp = new Date().toISOString(),
  id: string = `world-type-${crypto.randomUUID()}`
): WorldbuildingType {
  const normalized = normalizeWorldbuildingName(name);
  if (!normalized) throw new Error('Enter a Worldbuilding type name.');
  return {
    id,
    name: normalized,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}

export function findWorldbuildingEntryByName(
  entries: readonly WorldbuildingEntry[],
  name: string
): WorldbuildingEntry | undefined {
  const normalized = normalizeWorldbuildingName(name).toLocaleLowerCase();
  if (!normalized) return undefined;
  return entries.find((entry) => (
    entry.name.toLocaleLowerCase() === normalized
    || entry.aliases.some((alias) => alias.toLocaleLowerCase() === normalized)
  ));
}

export function touchWorldbuildingEntry(entry: WorldbuildingEntry, changes: Partial<Omit<WorldbuildingEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>>): WorldbuildingEntry {
  return {
    ...entry,
    ...changes,
    name: normalizeWorldbuildingName(changes.name ?? entry.name) || 'Untitled entry',
    aliases: (changes.aliases ?? entry.aliases)
      .map(normalizeWorldbuildingName)
      .filter(Boolean)
      .filter((alias, index, aliases) => aliases.findIndex((item) => item.toLocaleLowerCase() === alias.toLocaleLowerCase()) === index),
    updatedAt: new Date().toISOString(),
    version: entry.version + 1
  };
}
