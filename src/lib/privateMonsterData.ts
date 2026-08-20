import type { CatalogueColumn, CatalogueEntry } from '../catalogue/types';
import type { PrivateMonsterCatalogueSnapshot } from '../types';

export const MAX_PRIVATE_MONSTERS = 2_500;

type UnknownRecord = Record<string, unknown>;

function isPrivateMonsterSource(source: string): boolean {
  return source === 'Private import'
    || source === 'SRD-521 (private import)'
    || source.startsWith('Private import · ');
}
const omittedAssetKeys = new Set(['image', 'images', 'imageurl', 'token', 'tokenurl', 'portrait', 'avatar']);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, maximum = 32_000): string | null {
  if (typeof value !== 'string') return null;
  return value.length <= maximum ? value : null;
}

function normalizeColumns(value: unknown): CatalogueColumn[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const columns = value.flatMap((column) => {
    if (!isRecord(column)) return [];
    const name = stringValue(column.name, 240);
    if (!name) return [];
    const align = stringValue(column.align, 40);
    return [{ name, align }];
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

function sanitizeValue(value: unknown, depth = 0): unknown | undefined {
  if (depth > 10) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return value.length <= 32_000 ? value : undefined;
  if (Array.isArray(value)) {
    if (value.length > 500) return undefined;
    const sanitized = value.map((item) => sanitizeValue(item, depth + 1));
    return sanitized.every((item) => item !== undefined) ? sanitized : undefined;
  }
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length > 160) return undefined;

  const sanitized: UnknownRecord = {};
  for (const key of keys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    if (omittedAssetKeys.has(key.toLowerCase())) continue;
    const nested = sanitizeValue(value[key], depth + 1);
    if (nested === undefined) return undefined;
    sanitized[key] = nested;
  }
  return sanitized;
}

function normalizeSyncedPrivateMonster(value: unknown): CatalogueEntry | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id, 180)?.trim();
  const name = stringValue(value.name, 240)?.replace(/[\r\n]/g, ' ').trim();
  const description = stringValue(value.description);
  const ruleset = stringValue(value.ruleset, 80)?.trim();
  const source = stringValue(value.source, 120)?.trim();
  const rawData = sanitizeValue(value.data);
  const type = value.type === undefined ? undefined : stringValue(value.type, 120);

  if (
    value.category !== 'monster'
    || !id
    || !name
    || description === null
    || !ruleset
    || !source
    || !isPrivateMonsterSource(source)
    || !isRecord(rawData)
    || (value.type !== undefined && type === null)
  ) {
    return null;
  }

  return {
    id,
    category: 'monster',
    name,
    description,
    data: rawData,
    source,
    ruleset,
    type: type ?? undefined,
    columns: normalizeColumns(value.columns),
    rows: normalizeRows(value.rows)
  };
}

/** Validates user-owned Drive JSON before it can replace a local private catalogue. */
export function parsePrivateMonsterCatalogueSnapshot(value: unknown): PrivateMonsterCatalogueSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
    throw new Error('This Drive private monster catalogue is not a supported Homebrewry backup.');
  }
  const updatedAt = stringValue(value.updatedAt, 80);
  if (!updatedAt) throw new Error('This Drive private monster catalogue has an invalid update time.');
  if (value.entries.length > MAX_PRIVATE_MONSTERS) {
    throw new Error(`Private monster catalogues may contain up to ${MAX_PRIVATE_MONSTERS.toLocaleString()} records.`);
  }

  const entries: CatalogueEntry[] = [];
  const seenIds = new Set<string>();
  for (const candidate of value.entries) {
    const entry = normalizeSyncedPrivateMonster(candidate);
    if (!entry || seenIds.has(entry.id)) {
      throw new Error('This Drive private monster catalogue contains an invalid record.');
    }
    seenIds.add(entry.id);
    entries.push(entry);
  }

  return {
    schemaVersion: 1,
    updatedAt,
    entries: entries.sort((left, right) => left.name.localeCompare(right.name))
  };
}

export function createPrivateMonsterCatalogueSnapshot(
  entries: CatalogueEntry[],
  updatedAt = new Date().toISOString()
): PrivateMonsterCatalogueSnapshot {
  if (entries.length > MAX_PRIVATE_MONSTERS || entries.some((entry) => !isPrivateMonsterSource(entry.source) || entry.category !== 'monster')) {
    throw new Error('Only normalized private monster entries can be synced.');
  }
  return parsePrivateMonsterCatalogueSnapshot({
    schemaVersion: 1,
    updatedAt,
    entries
  });
}
