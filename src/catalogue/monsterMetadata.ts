import { dataString } from './presentation';
import type { CatalogueEntry } from './types';

export type MonsterSort = 'name-asc' | 'name-desc' | 'cr-asc' | 'cr-desc' | 'size-asc' | 'size-desc' | 'type-asc';

export type MonsterMetadata = {
  sources: string[];
  edition: string;
  importSource: string;
  type: string;
  cr: string;
  crValue: number | null;
  size: string;
  environments: string[];
};

export type MonsterFilterFields = {
  source: string;
  edition?: string;
  importSource: string;
  type: string;
  cr: string;
  size: string;
  environment: string;
};

export const emptyMonsterMetadata: MonsterMetadata = {
  sources: [],
  edition: '',
  importSource: '',
  type: '',
  cr: '',
  crValue: null,
  size: '',
  environments: []
};

const monsterSizeDefinitions = [
  { id: 'T', label: 'Tiny', rank: 1 },
  { id: 'S', label: 'Small', rank: 2 },
  { id: 'M', label: 'Medium', rank: 3 },
  { id: 'L', label: 'Large', rank: 4 },
  { id: 'H', label: 'Huge', rank: 5 },
  { id: 'G', label: 'Gargantuan', rank: 6 }
] as const;
const monsterMetadataCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function titleCaseMonsterValue(value: string): string {
  return value
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

export function monsterSizeLabel(value: string): string {
  return monsterSizeDefinitions.find((item) => item.id === value)?.label ?? titleCaseMonsterValue(value);
}

export function monsterSortLabel(value: MonsterSort): string {
  const labels: Record<MonsterSort, string> = {
    'name-asc': 'Name A–Z',
    'name-desc': 'Name Z–A',
    'cr-asc': 'CR: low to high',
    'cr-desc': 'CR: high to low',
    'size-asc': 'Size: small to large',
    'size-desc': 'Size: large to small',
    'type-asc': 'Type A–Z'
  };
  return labels[value];
}

export function challengeRatingValue(value: string): number | null {
  const normalised = value.trim();
  const fraction = normalised.match(/^(\d+)\s*\/\s*(\d+)/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator ? numerator / denominator : null;
  }
  const number = normalised.match(/^\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : null;
}

export function monsterSizeRank(value: string): number | null {
  return monsterSizeDefinitions.find((item) => item.id === value)?.rank ?? null;
}

export function compareOptionalNumbers(left: number | null, right: number | null, direction = 1): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * direction;
}

function monsterTypeParts(value: string): { source: string; type: string } {
  const [rawType = '', ...sourceParts] = value.trim().split(',');
  return {
    type: rawType.split(/[[()]/)[0]?.trim().toLocaleLowerCase() ?? '',
    source: sourceParts.join(',').trim()
  };
}

function normaliseMonsterSize(value: string): string {
  const normalised = value.trim().toLocaleUpperCase();
  return monsterSizeDefinitions.find((item) => item.id === normalised || item.label.toLocaleUpperCase() === normalised)?.id ?? normalised;
}

function environmentValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[;,]/) : [];
  return values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLocaleLowerCase())
    .filter(Boolean);
}

function sourceValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return Array.from(new Set(values.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)));
}

export function monsterMetadataForCatalogueEntry(entry: CatalogueEntry): MonsterMetadata {
  if (entry.category !== 'monster') return emptyMonsterMetadata;
  const typeParts = monsterTypeParts(dataString(entry, 'type') ?? '');
  const bookSources = sourceValues(typeParts.source);
  if (entry.source === 'Custom') bookSources.push('Homebrewry');
  const cr = (dataString(entry, 'cr') ?? '').trim();
  const size = normaliseMonsterSize(dataString(entry, 'size') ?? '');
  return {
    sources: Array.from(new Set(bookSources)),
    edition: (entry.ruleset ?? '').trim(),
    // Content created here is selected through Source: Homebrewry, not the
    // imported-data provenance control.
    importSource: entry.source === 'Custom' ? '' : (entry.source ?? '').trim(),
    type: typeParts.type,
    cr,
    crValue: challengeRatingValue(cr),
    size,
    environments: environmentValues(entry.data.environments ?? entry.data.environment)
  };
}

export function monsterMatchesFilters(metadata: MonsterMetadata, filters: MonsterFilterFields): boolean {
  if (filters.source && !metadata.sources.includes(filters.source)) return false;
  if (filters.edition && metadata.edition !== filters.edition) return false;
  if (filters.importSource && metadata.importSource !== filters.importSource) return false;
  if (filters.type && metadata.type !== filters.type) return false;
  if (filters.cr && metadata.cr !== filters.cr) return false;
  if (filters.size && metadata.size !== filters.size) return false;
  if (filters.environment && !metadata.environments.includes(filters.environment)) return false;
  return true;
}

export function compareMonsterMetadata(left: MonsterMetadata, right: MonsterMetadata, sort: MonsterSort): number {
  if (sort === 'name-asc' || sort === 'name-desc') return 0;
  if (sort === 'cr-asc') return compareOptionalNumbers(left.crValue, right.crValue);
  if (sort === 'cr-desc') return compareOptionalNumbers(left.crValue, right.crValue, -1);
  if (sort === 'size-asc') return compareOptionalNumbers(monsterSizeRank(left.size), monsterSizeRank(right.size));
  if (sort === 'size-desc') return compareOptionalNumbers(monsterSizeRank(left.size), monsterSizeRank(right.size), -1);
  return monsterMetadataCollator.compare(left.type, right.type);
}
