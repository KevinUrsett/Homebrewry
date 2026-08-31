import { monsterMetadataForCatalogueEntry } from './monsterMetadata';
import { dataString } from './presentation';
import type { CatalogueEntry } from './types';

export type CompendiumMetadata = {
  sources: string[];
  edition: string;
  types: string[];
};

export type CompendiumFilterFields = {
  source: string;
  edition: string;
  type: string;
};

export const emptyCompendiumMetadata: CompendiumMetadata = {
  sources: [],
  edition: '',
  types: []
};

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function stringValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' || typeof value === 'number' ? [value] : [];
  return values
    .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
    .map((item) => normalise(String(item)))
    .filter(Boolean);
}

function sourceValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function entryTypes(entry: CatalogueEntry): string[] {
  switch (entry.category) {
    case 'background': return stringValues(entry.data.abilities);
    case 'class': return stringValues(entry.data.ability);
    case 'feat': return stringValues(entry.data.category);
    case 'item': return stringValues(dataString(entry, 'type') ?? entry.type);
    case 'monster': return stringValues(monsterMetadataForCatalogueEntry(entry).type);
    case 'rule': return stringValues(entry.type);
    case 'species': return stringValues(dataString(entry, 'creatureType'));
    case 'spell': return stringValues(dataString(entry, 'school'));
    case 'subclass': return stringValues((dataString(entry, 'class') ?? '').split('|')[0]);
    default: return stringValues(entry.type);
  }
}

export function compendiumMetadataForCatalogueEntry(entry: CatalogueEntry): CompendiumMetadata {
  const sources = new Set(sourceValues(entry.data.sources));
  if (entry.category === 'monster') monsterMetadataForCatalogueEntry(entry).sources.forEach((source) => sources.add(source));
  if (entry.source === 'Custom') sources.add('Homebrewry');

  return {
    sources: Array.from(sources),
    edition: (entry.ruleset ?? '').trim(),
    types: Array.from(new Set(entryTypes(entry)))
  };
}

export function compendiumMatchesFilters(metadata: CompendiumMetadata, filters: CompendiumFilterFields): boolean {
  if (filters.source && !metadata.sources.includes(filters.source)) return false;
  if (filters.edition && metadata.edition !== filters.edition) return false;
  if (filters.type && !metadata.types.includes(filters.type)) return false;
  return true;
}

export function titleCaseCompendiumValue(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLocaleLowerCase()
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}
