import { describe, expect, it } from 'vitest';
import { createCustomCatalogueCategory, createCustomCatalogueEntry, createCustomMonster, normaliseCustomCatalogueEntry } from './customEntries';
import type { CatalogueEntry } from './types';

describe('custom catalogue entries', () => {
  it('creates a safe, campaign-owned entry from selected editor text', () => {
    expect(createCustomCatalogueEntry('  The Old   Road  ', 'background', '2026-07-26T12:00:00.000Z', 'road-id')).toEqual({
      id: 'road-id',
      category: 'background',
      name: 'The Old Road',
      description: '',
      data: {},
      source: 'Custom',
      ruleset: 'Homebrewry',
      createdAt: '2026-07-26T12:00:00.000Z',
      updatedAt: '2026-07-26T12:00:00.000Z',
      version: 1
    });
  });

  it('copies a selected monster into an editable custom monster template', () => {
    const template: CatalogueEntry = {
      id: 'srd-monster',
      category: 'monster',
      name: 'Ash Scout',
      description: 'A scout from the ash road.',
      data: { ac: '14', hp: '27 (5d8 + 5)', speed: { walk: 30 }, actions: [{ name: 'Crossbow', text: 'Ranged Weapon Attack.' }] },
      source: 'SRD-521',
      ruleset: '5.5e'
    };

    expect(createCustomMonster(template, '2026-07-26T12:00:00.000Z', 'custom-monster')).toMatchObject({
      id: 'custom-monster',
      category: 'monster',
      name: 'Ash Scout copy',
      source: 'Custom',
      ruleset: 'Homebrewry',
      data: template.data,
      version: 1
    });
  });

  it('rejects unsafe nested data before it can be stored or synced', () => {
    const unsafe = JSON.parse('{"id":"custom","category":"monster","name":"Unsafe","description":"","data":{"__proto__":{"polluted":true}},"source":"Custom","createdAt":"2026-07-26T12:00:00.000Z","updatedAt":"2026-07-26T12:00:00.000Z","version":1}');

    expect(() => normaliseCustomCatalogueEntry(unsafe)).toThrow('invalid data');
  });

  it('creates a stable campaign category and reserves renderer namespaces', () => {
    expect(createCustomCatalogueCategory('Deities', '2026-07-26T12:00:00.000Z', 'deity')).toMatchObject({
      id: 'deity',
      name: 'Deities',
      version: 1
    });
    expect(() => createCustomCatalogueCategory('Encounters', '2026-07-26T12:00:00.000Z', 'encounter')).toThrow('reserved');
  });
});
