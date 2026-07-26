import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parsePrivateMonsterArchive } from './privateMonsterImport';

function monster(overrides: Record<string, unknown> = {}) {
  return {
    id: 'private-monster-id',
    name: 'Private Monster',
    attributes: { ruleset: '5e' },
    data: {
      ac: '14',
      hp: '44 (8d8 + 8)',
      abilities: { dex: 16 },
      image: 'monsters/private-monster.jpg',
      actions: [{ name: 'Claw', text: 'A safe text action.' }]
    },
    ...overrides
  };
}

function archiveWith(records: unknown[], additionalFiles: Record<string, Uint8Array> = {}) {
  return zipSync({
    'monsters.json': strToU8(JSON.stringify(records)),
    ...additionalFiles
  });
}

describe('private monster archive import', () => {
  it('imports normalized private monsters without copying archive artwork', () => {
    const archive = archiveWith(
      [monster()],
      { 'monsters/private-monster.jpg': new Uint8Array([0xff, 0xd8, 0xff]) }
    );

    const report = parsePrivateMonsterArchive(archive, new Set());

    expect(report.importedCount).toBe(1);
    expect(report.imageFileCount).toBe(1);
    expect(report.entries[0]).toMatchObject({
      id: 'private-monster-id',
      name: 'Private Monster',
      category: 'monster',
      ruleset: '5e',
      source: 'Private import'
    });
    expect(report.entries[0].data).toMatchObject({ ac: '14', hp: '44 (8d8 + 8)' });
    expect(report.entries[0].data).not.toHaveProperty('image');
  });

  it('keeps bundled catalogue records authoritative', () => {
    const archive = archiveWith([
      monster({ id: 'srd-id', sources: [{ name: 'SRD-521' }] }),
      monster({ id: 'private-id', name: 'New private monster' })
    ]);

    const report = parsePrivateMonsterArchive(archive, new Set(['srd-id']));

    expect(report.importedCount).toBe(1);
    expect(report.skippedExistingCount).toBe(1);
    expect(report.entries[0]?.id).toBe('private-id');
  });

  it('rejects path traversal in a ZIP archive', () => {
    const archive = zipSync({ '../monsters.json': strToU8(JSON.stringify([monster()])) });

    expect(() => parsePrivateMonsterArchive(archive, new Set())).toThrow('unsupported file path');
  });

  it('rejects malformed monster records while retaining valid records', () => {
    const unsafeRecord = JSON.parse('{"id":"unsafe","name":"Unsafe data","data":{"__proto__":{"polluted":true}}}');
    const archive = archiveWith([
      monster(),
      { id: '', name: 'Missing id', data: {} },
      unsafeRecord
    ]);

    const report = parsePrivateMonsterArchive(archive, new Set());

    expect(report.importedCount).toBe(1);
    expect(report.skippedInvalidCount).toBe(2);
  });
});
