import { dataString } from './presentation';
import type { CatalogueEntry } from './types';

export type ItemAttunement = 'required' | 'not-required' | 'unknown';

export type ItemMetadata = {
  sources: string[];
  edition: string;
  type: string;
  rarity: string;
  attunement: ItemAttunement;
};

export type ItemFilterFields = {
  source: string;
  edition: string;
  type: string;
  rarity: string;
  attunement: '' | Exclude<ItemAttunement, 'unknown'>;
};

export const emptyItemMetadata: ItemMetadata = {
  sources: [],
  edition: '',
  type: '',
  rarity: '',
  attunement: 'unknown'
};

function normaliseValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function sourceValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return Array.from(new Set(values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)));
}

function attunementValue(value: unknown): ItemAttunement {
  if (typeof value === 'boolean') return value ? 'required' : 'not-required';
  if (typeof value === 'string') {
    const normalised = normaliseValue(value);
    if (['true', 'yes', 'required', 'requires attunement'].includes(normalised)) return 'required';
    if (['false', 'no', 'none', 'not required', 'does not require attunement'].includes(normalised)) return 'not-required';
  }
  return 'unknown';
}

export function titleCaseItemValue(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLocaleLowerCase()
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

export function itemMetadataForCatalogueEntry(entry: CatalogueEntry): ItemMetadata {
  if (entry.category !== 'item') return emptyItemMetadata;

  const declaredAttunement = attunementValue(entry.data.attunement);
  const sources = new Set(sourceValues(entry.data.sources));
  // Custom entries can be copied from a published item. Keep that published
  // source, but also make the entry discoverable as Homebrewry content.
  if (entry.source === 'Custom') sources.add('Homebrewry');
  return {
    sources: Array.from(sources),
    edition: (entry.ruleset ?? '').trim(),
    type: normaliseValue(dataString(entry, 'type') ?? entry.type ?? ''),
    rarity: normaliseValue(dataString(entry, 'rarity') ?? ''),
    // The bundled rules data only declares this field when it is required.
    attunement: declaredAttunement === 'unknown' ? 'not-required' : declaredAttunement
  };
}

export function itemMatchesFilters(metadata: ItemMetadata, filters: ItemFilterFields): boolean {
  if (filters.source && !metadata.sources.includes(filters.source)) return false;
  if (filters.edition && metadata.edition !== filters.edition) return false;
  if (filters.type && metadata.type !== filters.type) return false;
  if (filters.rarity && metadata.rarity !== filters.rarity) return false;
  if (filters.attunement && metadata.attunement !== filters.attunement) return false;
  return true;
}
