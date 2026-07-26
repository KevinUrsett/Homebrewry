import { describe, expect, it } from 'vitest';
import { createCustomCatalogueEntry } from './customEntries';

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
});
