import { describe, expect, it } from 'vitest';
import { loadCatalogue, normalizeCatalogueEntries, toCatalogueMap } from './catalogueData';

describe('catalogue data', () => {
  it('keeps only SRD 5.2.1 records and normalizes safe fields', () => {
    const entries = normalizeCatalogueEntries('monster', [
      {
        id: 'aboleth-id',
        name: 'Aboleth',
        descr: 'A deep horror.',
        sources: [{ name: 'SRD-521' }],
        attributes: { ruleset: '5.5e' },
        data: { ac: '17' }
      },
      {
        id: 'excluded-id',
        name: 'Excluded',
        sources: [{ name: 'Unverified source' }]
      }
    ]);

    expect(entries).toEqual([expect.objectContaining({
      id: 'aboleth-id',
      category: 'monster',
      source: 'SRD-521',
      ruleset: '5.5e',
      data: expect.objectContaining({ ac: '17', sources: ['SRD-521'] })
    })]);
    expect(toCatalogueMap(entries).get('monster:aboleth-id')?.name).toBe('Aboleth');
  });

  it('loads the complete bundled SRD catalogue', async () => {
    const entries = await loadCatalogue();

    expect(entries).toHaveLength(2232);
    expect(entries.find((entry) => entry.name === 'Aboleth' && entry.category === 'monster')).toBeDefined();
    expect(entries.every((entry) => entry.source === 'SRD-521')).toBe(true);
  });
});
