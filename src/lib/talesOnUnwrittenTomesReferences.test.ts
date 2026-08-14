import { describe, expect, it } from 'vitest';
import { remainingTalesOnUnwrittenTomesReferences, talesOnUnwrittenTomesReferences } from './talesOnUnwrittenTomesReferences';
import type { WorldbuildingEntry } from '../types';

describe('Tales on Unwritten Tomes curated references', () => {
  it('contains the reviewed campaign subjects rather than deriving headings', () => {
    expect(talesOnUnwrittenTomesReferences.length).toBeGreaterThan(200);
    expect(talesOnUnwrittenTomesReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Gyrro', kind: 'town' }),
      expect.objectContaining({ name: 'Talon Bloodwing', kind: 'character' }),
      expect.objectContaining({ name: 'Eldorin', kind: 'deity' }),
      expect.objectContaining({ name: 'Vorrak', kind: 'deity', aliases: ['Varrak'] }),
      expect.objectContaining({ name: 'The Contingency', kind: 'item' }),
      expect.objectContaining({ name: 'Sky-Guard', kind: 'faction' })
    ]));
  });

  it('does not offer a record already represented by a name or alias', () => {
    const existing: WorldbuildingEntry = {
      id: 'existing', name: 'Hujin Juunit', kind: 'historical-figure', aliases: [], notes: '',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', version: 1
    };
    expect(remainingTalesOnUnwrittenTomesReferences([existing]).map((item) => item.name)).not.toContain('Hujin Juunat');
  });
});
