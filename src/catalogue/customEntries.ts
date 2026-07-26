import { isCatalogueCategory, type CatalogueCategory, type CatalogueColumn, type CatalogueEntry, type CustomCatalogueEntry } from './types';

type UnknownRecord = Record<string, unknown>;

type NormaliseOptions = {
  preserveStructuredData?: boolean;
};

const MAX_STRING_LENGTH = 32_000;
const MAX_DATA_DEPTH = 10;
const MAX_DATA_ARRAY_LENGTH = 500;
const MAX_DATA_OBJECT_KEYS = 160;
const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, maximum = MAX_STRING_LENGTH): string | null {
  return typeof value === 'string' && value.length <= maximum ? value : null;
}

function normaliseCustomName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeDataValue(value: unknown, depth = 0): unknown | undefined {
  if (depth > MAX_DATA_DEPTH) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return value.length <= MAX_STRING_LENGTH ? value : undefined;
  if (Array.isArray(value)) {
    if (value.length > MAX_DATA_ARRAY_LENGTH) return undefined;
    const sanitized = value.map((item) => sanitizeDataValue(item, depth + 1));
    return sanitized.every((item) => item !== undefined) ? sanitized : undefined;
  }
  if (!isRecord(value) || Object.keys(value).length > MAX_DATA_OBJECT_KEYS) return undefined;

  const sanitized: UnknownRecord = {};
  for (const key of Object.keys(value)) {
    if (unsafeKeys.has(key)) return undefined;
    const nested = sanitizeDataValue(value[key], depth + 1);
    if (nested === undefined) return undefined;
    sanitized[key] = nested;
  }
  return sanitized;
}

function normalizeColumns(value: unknown): CatalogueColumn[] | undefined {
  if (!Array.isArray(value) || value.length > 40) return undefined;
  const columns = value.flatMap((column) => {
    if (!isRecord(column)) return [];
    const name = stringValue(column.name, 240)?.trim();
    const align = column.align === undefined ? undefined : stringValue(column.align, 40)?.trim();
    return name && (column.align === undefined || align) ? [{ name, ...(align ? { align } : {}) }] : [];
  });
  return columns.length ? columns : undefined;
}

function normalizeRows(value: unknown): string[][] | undefined {
  if (!Array.isArray(value) || value.length > 400) return undefined;
  const rows = value.flatMap((row) => {
    if (!Array.isArray(row) || row.length > 40) return [];
    const cells = row.map((cell) => stringValue(cell, 4_000));
    return cells.every((cell) => cell !== null) ? [cells as string[]] : [];
  });
  return rows.length ? rows : undefined;
}

/**
 * Revalidates campaign-owned catalogue records before storage or Drive use.
 * Schema v2 data intentionally discarded custom payloads; v3 preserves only
 * bounded JSON data so custom monster templates can safely sync between devices.
 */
export function normaliseCustomCatalogueEntry(
  value: unknown,
  { preserveStructuredData = true }: NormaliseOptions = {}
): CustomCatalogueEntry {
  if (!isRecord(value) || value.source !== 'Custom') {
    throw new Error('Only custom catalogue entries can be saved.');
  }
  const id = stringValue(value.id, 180)?.trim();
  const category = stringValue(value.category, 80);
  const name = stringValue(value.name, 240);
  const description = stringValue(value.description);
  const createdAt = stringValue(value.createdAt, 80);
  const updatedAt = stringValue(value.updatedAt, 80);
  const version = value.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('This custom catalogue entry is invalid.');
  }
  if (
    !id
    || !category
    || !isCatalogueCategory(category)
    || !name
    || !normaliseCustomName(name)
    || description === null
    || !createdAt
    || !updatedAt
  ) {
    throw new Error('This custom catalogue entry is invalid.');
  }

  const rawData = preserveStructuredData ? sanitizeDataValue(value.data) : {};
  if (!isRecord(rawData)) throw new Error('This custom catalogue entry has invalid data.');
  const type = value.type === undefined ? undefined : stringValue(value.type, 120)?.trim();
  if (value.type !== undefined && !type) throw new Error('This custom catalogue entry has an invalid type.');
  const columns = normalizeColumns(value.columns);
  const rows = normalizeRows(value.rows);

  return {
    id,
    category,
    name: normaliseCustomName(name),
    description,
    data: rawData,
    source: 'Custom',
    ruleset: 'Homebrewry',
    ...(type ? { type } : {}),
    ...(columns ? { columns } : {}),
    ...(rows ? { rows } : {}),
    createdAt,
    updatedAt,
    version
  };
}

/** Creates the smallest safe campaign-owned entry for an editor reference. */
export function createCustomCatalogueEntry(
  name: string,
  category: CatalogueCategory,
  timestamp = new Date().toISOString(),
  id: string = crypto.randomUUID()
): CustomCatalogueEntry {
  return normaliseCustomCatalogueEntry({
    id,
    category,
    name,
    description: '',
    data: {},
    source: 'Custom',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  });
}

/** Starts a custom monster, optionally copying a selected catalogue monster as its template. */
export function createCustomMonster(
  template?: CatalogueEntry,
  timestamp = new Date().toISOString(),
  id: string = crypto.randomUUID()
): CustomCatalogueEntry {
  const source = template?.category === 'monster' ? template : undefined;
  return normaliseCustomCatalogueEntry({
    id,
    category: 'monster',
    name: source ? `${source.name} copy` : 'Untitled monster',
    description: source?.description ?? '',
    data: source?.data ?? {},
    source: 'Custom',
    type: source?.type,
    columns: source?.columns,
    rows: source?.rows,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  });
}

export function reviseCustomCatalogueEntry(
  entry: CustomCatalogueEntry,
  changes: Partial<Omit<CustomCatalogueEntry, 'id' | 'category' | 'source' | 'createdAt' | 'updatedAt' | 'version'>>,
  timestamp = new Date().toISOString()
): CustomCatalogueEntry {
  return normaliseCustomCatalogueEntry({
    ...entry,
    ...changes,
    createdAt: entry.createdAt,
    updatedAt: timestamp,
    version: entry.version + 1
  });
}
