import { describe, expect, it } from 'vitest';
import { compendiumMatchesFilters, compendiumMetadataForCatalogueEntry } from './compendiumMetadata';
import type { CatalogueEntry } from './types';

describe('compendiumMetadataForCatalogueEntry', () => {
  it('derives source, edition, and a category-specific type from existing records', () => {
    const spell: CatalogueEntry = {
      id: 'ember-ladder',
      category: 'spell',
      name: 'Ember Ladder',
      description: '',
      data: { sources: ["Player's Handbook"], school: 'evocation' },
      source: 'SRD-521',
      ruleset: '5.5e'
    };

    expect(compendiumMetadataForCatalogueEntry(spell)).toEqual({
      sources: ["Player's Handbook"],
      edition: '5.5e',
      types: ['evocation']
    });
  });

  it('makes earlier Custom entries discoverable through Source: Homebrewry', () => {
    const copiedMonster: CatalogueEntry = {
      id: 'ember-wolf',
      category: 'monster',
      name: 'Ember Wolf',
      description: '',
      data: { type: 'beast, Monster Manual' },
      source: 'Custom',
      ruleset: 'Homebrewry'
    };

    const metadata = compendiumMetadataForCatalogueEntry(copiedMonster);
    expect(metadata.sources).toEqual(expect.arrayContaining(['Monster Manual', 'Homebrewry']));
    expect(compendiumMatchesFilters(metadata, { source: 'Homebrewry', edition: 'Homebrewry', type: 'beast' })).toBe(true);
  });
});
