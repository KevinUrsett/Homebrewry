import {
  catalogueEntryKey,
  type CatalogueCategory,
  type CatalogueColumn,
  type CatalogueEntry
} from './types';

type RawCatalogueEntry = {
  id?: unknown;
  name?: unknown;
  descr?: unknown;
  data?: unknown;
  type?: unknown;
  attributes?: unknown;
  sources?: unknown;
  columns?: unknown;
  rows?: unknown;
};

type DataLoader = {
  category: CatalogueCategory;
  load: () => Promise<{ default: unknown }>;
};

export const catalogueDataset = {
  version: 'SRD 5.2.1',
  source: 'Encounter+ dnd5e v0.9.14',
  sourceCommit: '03d67ee7c13c114bc4a9e907438bf3fd9b7cea00'
} as const;

const dataLoaders: DataLoader[] = [
  { category: 'background', load: () => import('./data/backgrounds.json') },
  { category: 'class', load: () => import('./data/classes.json') },
  { category: 'feat', load: () => import('./data/feats.json') },
  { category: 'item', load: () => import('./data/items-a.json') },
  { category: 'item', load: () => import('./data/items-b.json') },
  { category: 'monster', load: () => import('./data/monsters.json') },
  { category: 'rule', load: () => import('./data/rules.json') },
  { category: 'species', load: () => import('./data/species.json') },
  { category: 'spell', load: () => import('./data/spells.json') },
  { category: 'subclass', load: () => import('./data/subclasses.json') },
  { category: 'table', load: () => import('./data/tables.json') }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function hasSrdSource(value: unknown): boolean {
  return Array.isArray(value) && value.some((source) => isRecord(source) && source.name === 'SRD-521');
}

function normalizeColumns(value: unknown): CatalogueColumn[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const columns = value.flatMap((column) => {
    if (!isRecord(column) || typeof column.name !== 'string') return [];
    return [{ name: column.name, align: stringValue(column.align) ?? null }];
  });
  return columns.length ? columns : undefined;
}

function normalizeRows(value: unknown): string[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? '')));
  return rows.length ? rows : undefined;
}

export function normalizeCatalogueEntries(category: CatalogueCategory, records: unknown[]): CatalogueEntry[] {
  return records.flatMap((candidate) => {
    const record = candidate as RawCatalogueEntry;
    if (!isRecord(candidate) || typeof record.id !== 'string' || typeof record.name !== 'string' || !hasSrdSource(record.sources)) {
      return [];
    }
    const attributes = isRecord(record.attributes) ? record.attributes : {};
    return [{
      id: record.id,
      category,
      name: record.name,
      description: stringValue(record.descr) ?? '',
      data: isRecord(record.data) ? record.data : {},
      source: 'SRD-521',
      ruleset: stringValue(attributes.ruleset) ?? '5.5e',
      type: stringValue(record.type),
      columns: normalizeColumns(record.columns),
      rows: normalizeRows(record.rows)
    }];
  });
}

export async function loadCatalogue(): Promise<CatalogueEntry[]> {
  const loaded = await Promise.all(dataLoaders.map(async ({ category, load }) => {
    const module = await load();
    return normalizeCatalogueEntries(category, Array.isArray(module.default) ? module.default : []);
  }));

  return loaded.flat().sort((left, right) => {
    const byCategory = left.category.localeCompare(right.category);
    return byCategory || left.name.localeCompare(right.name);
  });
}

export function toCatalogueMap(entries: CatalogueEntry[]): ReadonlyMap<string, CatalogueEntry> {
  return new Map(entries.map((entry) => [catalogueEntryKey(entry), entry]));
}
