import { describe, expect, it } from 'vitest';
import { cataloguePlainText, entrySummary } from './presentation';
import type { CatalogueEntry } from './types';

describe('catalogue presentation', () => {
  it('keeps source text inert while making it readable', () => {
    expect(cataloguePlainText('Use [Shield](item) with **care**.')).toBe('Use Shield with care.');
  });

  it('creates a compact stat line for monsters', () => {
    const entry: CatalogueEntry = {
      id: 'id',
      category: 'monster',
      name: 'Scout',
      description: '',
      data: { size: 'M', type: 'humanoid', alignment: 'NG', ac: '14', hp: '27', cr: '1/2' },
      source: 'SRD-521',
      ruleset: '5.5e'
    };

    expect(entrySummary(entry)).toEqual(['M humanoid NG', 'AC 14 · HP 27 · CR 1/2']);
  });
});
