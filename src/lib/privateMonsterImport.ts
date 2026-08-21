import { unzipSync } from 'fflate';
import type { CatalogueColumn, CatalogueEntry } from '../catalogue/types';
import { MAX_PRIVATE_MONSTERS } from './privateMonsterData';

const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP64_U16 = 0xffff;
const ZIP64_U32 = 0xffffffff;

export const MAX_MONSTER_ARCHIVE_BYTES = 32 * 1024 * 1024;
export const MAX_MONSTER_ARCHIVE_ENTRIES = 64;
export const MAX_MONSTER_JSON_BYTES = 8 * 1024 * 1024;
export const MAX_MONSTER_ARCHIVE_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;

type UnknownRecord = Record<string, unknown>;

type ZipEntry = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  isDirectory: boolean;
};

export type PrivateMonsterImportReport = {
  entries: CatalogueEntry[];
  importedCount: number;
  skippedExistingCount: number;
  skippedInvalidCount: number;
  imageFileCount: number;
};


function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, maximum = 32_000): string | null {
  if (typeof value !== 'string') return null;
  return value.length <= maximum ? value : null;
}

function readU16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) throw new Error('The ZIP archive is truncated.');
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) throw new Error('The ZIP archive is truncated.');
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(view: DataView): number {
  const earliest = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= earliest; offset -= 1) {
    if (readU32(view, offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error('This file is not a supported ZIP archive.');
}

function decodeZipPath(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('The ZIP archive contains an invalid file name.');
  }
}

function isSafeArchivePath(name: string): boolean {
  return Boolean(name)
    && !name.includes('\\')
    && !name.startsWith('/')
    && !name.split('/').some((segment) => segment === '..' || segment === '.');
}

function isAllowedArchiveFile(name: string): boolean {
  return name === 'monsters.json'
    || name === 'monsters/'
    || /^monsters\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i.test(name);
}

function inspectMonsterArchive(archive: Uint8Array): ZipEntry[] {
  if (archive.byteLength < 22) throw new Error('This file is not a supported ZIP archive.');
  if (archive.byteLength > MAX_MONSTER_ARCHIVE_BYTES) {
    throw new Error('Monster archives must be 32 MB or smaller.');
  }

  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const endOffset = findEndOfCentralDirectory(view);
  const diskNumber = readU16(view, endOffset + 4);
  const centralDirectoryDisk = readU16(view, endOffset + 6);
  const entriesOnDisk = readU16(view, endOffset + 8);
  const entryCount = readU16(view, endOffset + 10);
  const centralDirectorySize = readU32(view, endOffset + 12);
  const centralDirectoryOffset = readU32(view, endOffset + 16);

  if (
    diskNumber !== 0
    || centralDirectoryDisk !== 0
    || entriesOnDisk !== entryCount
    || entryCount === ZIP64_U16
    || centralDirectorySize === ZIP64_U32
    || centralDirectoryOffset === ZIP64_U32
  ) {
    throw new Error('Only single-disk, non-ZIP64 monster archives are supported.');
  }
  if (!entryCount || entryCount > MAX_MONSTER_ARCHIVE_ENTRIES) {
    throw new Error(`Monster archives may contain up to ${MAX_MONSTER_ARCHIVE_ENTRIES} files.`);
  }
  if (centralDirectoryOffset + centralDirectorySize > endOffset) {
    throw new Error('The ZIP archive directory is invalid.');
  }

  const seenNames = new Set<string>();
  const entries: ZipEntry[] = [];
  let totalUncompressedSize = 0;
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (readU32(view, offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('The ZIP archive directory is invalid.');
    }

    const madeBy = readU16(view, offset + 4);
    const flags = readU16(view, offset + 8);
    const compressionMethod = readU16(view, offset + 10);
    const compressedSize = readU32(view, offset + 20);
    const uncompressedSize = readU32(view, offset + 24);
    const nameLength = readU16(view, offset + 28);
    const extraLength = readU16(view, offset + 30);
    const commentLength = readU16(view, offset + 32);
    const externalAttributes = readU32(view, offset + 38);
    const nameStart = offset + 46;
    const nextOffset = nameStart + nameLength + extraLength + commentLength;

    if (nextOffset > centralDirectoryOffset + centralDirectorySize || nextOffset > view.byteLength) {
      throw new Error('The ZIP archive directory is invalid.');
    }
    if ((flags & 0x1) !== 0) throw new Error('Encrypted monster archives are not supported.');
    if (compressedSize === ZIP64_U32 || uncompressedSize === ZIP64_U32) {
      throw new Error('ZIP64 monster archives are not supported.');
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new Error('Monster archives may only use stored or deflated files.');
    }

    const name = decodeZipPath(archive.slice(nameStart, nameStart + nameLength));
    const unixFileType = (externalAttributes >>> 16) & 0o170000;
    const isUnixSymlink = (madeBy >>> 8) === 3 && unixFileType === 0o120000;
    if (isUnixSymlink || !isSafeArchivePath(name) || !isAllowedArchiveFile(name)) {
      throw new Error('The archive contains an unsupported file path.');
    }
    if (seenNames.has(name)) throw new Error('The archive contains duplicate file names.');
    seenNames.add(name);

    totalUncompressedSize += uncompressedSize;
    if (totalUncompressedSize > MAX_MONSTER_ARCHIVE_UNCOMPRESSED_BYTES) {
      throw new Error('The uncompressed monster archive is too large.');
    }
    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      isDirectory: name.endsWith('/')
    });
    offset = nextOffset;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) {
    throw new Error('The ZIP archive directory is invalid.');
  }

  const monsterJson = entries.find((entry) => entry.name === 'monsters.json');
  if (!monsterJson || monsterJson.isDirectory) {
    throw new Error('The archive must contain a monsters.json file.');
  }
  if (monsterJson.uncompressedSize > MAX_MONSTER_JSON_BYTES) {
    throw new Error('The monsters.json file is too large.');
  }

  return entries;
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

const omittedAssetKeys = new Set(['image', 'images', 'imageurl', 'token', 'tokenurl', 'portrait', 'avatar']);

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

function sourceHasSrd521(value: unknown): boolean {
  return Array.isArray(value) && value.some((source) => isRecord(source) && source.name === 'SRD-521');
}

function sourceNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((source) => isRecord(source) && typeof source.name === 'string' && source.name.trim() ? [source.name.trim()] : []);
}

function normalizePrivateMonsters(records: unknown[], existingMonsterIds: ReadonlySet<string>): Omit<PrivateMonsterImportReport, 'imageFileCount'> {
  const entries: CatalogueEntry[] = [];
  const seenIds = new Set<string>();
  let skippedExistingCount = 0;
  let skippedInvalidCount = 0;

  for (const candidate of records.slice(0, MAX_PRIVATE_MONSTERS)) {
    if (!isRecord(candidate)) {
      skippedInvalidCount += 1;
      continue;
    }
    const id = stringValue(candidate.id, 180)?.trim();
    const name = stringValue(candidate.name, 240)?.replace(/[\r\n]/g, ' ').trim();
    const rawData = candidate.data === undefined ? {} : sanitizeValue(candidate.data);
    if (!id || !name || !isRecord(rawData)) {
      skippedInvalidCount += 1;
      continue;
    }
    if (existingMonsterIds.has(id) || seenIds.has(id)) {
      skippedExistingCount += 1;
      continue;
    }

    const attributes = isRecord(candidate.attributes) ? candidate.attributes : {};
    const ruleset = stringValue(attributes.ruleset, 80)?.trim() || 'Imported';
    const description = stringValue(candidate.descr)?.trim() ?? '';
    seenIds.add(id);
    entries.push({
      id,
      category: 'monster',
      name,
      description,
      data: { ...rawData, sources: sourceNames(candidate.sources) },
      source: sourceHasSrd521(candidate.sources) ? 'SRD-521 (private import)' : 'Private import',
      ruleset,
      type: stringValue(candidate.type, 120) ?? undefined,
      columns: normalizeColumns(candidate.columns),
      rows: normalizeRows(candidate.rows)
    });
  }

  if (records.length > MAX_PRIVATE_MONSTERS) {
    skippedInvalidCount += records.length - MAX_PRIVATE_MONSTERS;
  }

  return {
    entries,
    importedCount: entries.length,
    skippedExistingCount,
    skippedInvalidCount
  };
}

/**
 * Parses an Encounter+-style monster archive without extracting its artwork.
 * Imported records are deliberately normalized into plain catalogue data so
 * the renderer never executes archive-provided markup or scripts.
 */
export function parsePrivateMonsterArchive(
  archive: Uint8Array,
  existingMonsterIds: ReadonlySet<string>
): PrivateMonsterImportReport {
  const entries = inspectMonsterArchive(archive);
  const monsterJson = entries.find((entry) => entry.name === 'monsters.json');
  if (!monsterJson) throw new Error('The archive must contain a monsters.json file.');

  let extracted: Uint8Array;
  try {
    extracted = unzipSync(archive, {
      filter: (file) => file.name === 'monsters.json'
    })['monsters.json'] ?? new Uint8Array();
  } catch {
    throw new Error('The monsters.json file could not be read.');
  }

  if (extracted.byteLength !== monsterJson.uncompressedSize || extracted.byteLength > MAX_MONSTER_JSON_BYTES) {
    throw new Error('The extracted monsters.json file is invalid.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(extracted));
  } catch {
    throw new Error('The monsters.json file is not valid UTF-8 JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error('The monsters.json file must contain a list of monsters.');
  if (parsed.length > MAX_PRIVATE_MONSTERS) {
    throw new Error(`Monster archives may contain up to ${MAX_PRIVATE_MONSTERS.toLocaleString()} records.`);
  }

  const normalized = normalizePrivateMonsters(parsed, existingMonsterIds);
  return {
    ...normalized,
    imageFileCount: entries.filter((entry) => entry.name.startsWith('monsters/') && !entry.isDirectory).length
  };
}

export async function importPrivateMonsterArchive(
  file: File,
  existingMonsterIds: ReadonlySet<string>
): Promise<PrivateMonsterImportReport> {
  if (file.size > MAX_MONSTER_ARCHIVE_BYTES) {
    throw new Error('Monster archives must be 32 MB or smaller.');
  }
  return parsePrivateMonsterArchive(new Uint8Array(await file.arrayBuffer()), existingMonsterIds);
}
