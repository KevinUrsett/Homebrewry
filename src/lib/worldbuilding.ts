import { worldbuildingKinds, type WorldbuildingEntry, type WorldbuildingKind } from '../types';

export const worldbuildingKindLabels: Record<WorldbuildingKind, string> = {
  town: 'Town',
  road: 'Road',
  'historical-figure': 'Historical figure',
  character: 'Character',
  faction: 'Faction',
  landmark: 'Landmark',
  region: 'Region',
  organization: 'Organisation',
  event: 'Event',
  custom: 'Custom'
};

export { worldbuildingKinds };

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
