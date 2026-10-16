import { describe, expect, it } from 'vitest';
import type { BrewReferenceReview } from '../types';
import { mergeReferenceReviews, pendingBrewReferences, referenceNameKey, referenceScanSection, scanNewBrewReferences } from './brewReferenceScan';

const brew = {
  id: 'brew-1', title: 'Campaign notes',
  content: '# Arrival\nWe meet Mara Quill at the inn.\n## Side room\nWe meet Orren Vey there.\n# Departure\nWe meet Talon Bloodwing outside.'
};
const timestamp = '2026-10-16T08:00:00.000Z';

describe('manual brew reference discovery', () => {
  it('checks only the chosen section and its descendants, not sibling sections', () => {
    expect(scanNewBrewReferences(brew, 'arrival', [], [], timestamp).map((item) => item.name)).toEqual(['Mara Quill', 'Orren Vey']);
    expect(scanNewBrewReferences(brew, 'side-room', [], [], timestamp).map((item) => item.name)).toEqual(['Orren Vey']);
    expect(referenceScanSection(brew.content, null).content).toBe(brew.content);
    expect(() => referenceScanSection(brew.content, 'removed-heading')).toThrow('no longer exists');
  });

  it('distinguishes repeated heading IDs and works at the end of the document', () => {
    const repeated = { ...brew, content: '# Hall\nWe meet Mara Quill.\n# Hall\nWe meet Orren Vey.' };
    expect(scanNewBrewReferences(repeated, 'hall-2', [], [], timestamp).map((item) => item.name)).toEqual(['Orren Vey']);
  });

  it('skips existing names and aliases and records context for new candidates', () => {
    const found = scanNewBrewReferences(brew, null, ['  MARA   QUILL ', 'Talon Bloodwing'], [], timestamp);
    expect(found).toEqual([expect.objectContaining({ name: 'Orren Vey', id: 'orren vey', status: 'pending', brewId: brew.id, sectionTitle: 'Whole brew', context: 'We meet Orren Vey there.' })]);
    expect(brew.content).toContain('Mara Quill');
  });

  it('ignores all previously seen names while retaining pending items for review', () => {
    const seen = scanNewBrewReferences(brew, null, [], [], timestamp);
    const reviewed = seen.map((item, i) => ({ ...item, status: (['pending', 'created', 'dismissed'] as const)[i] }));
    expect(scanNewBrewReferences(brew, null, [], reviewed, timestamp)).toEqual([]);
    expect(pendingBrewReferences(reviewed, [])).toHaveLength(1);
    const updated = { ...brew, content: `${brew.content}\nWe meet Hester Flinn at dusk.` };
    expect(scanNewBrewReferences(updated, null, [], reviewed, timestamp).map((item) => item.name)).toEqual(['Hester Flinn']);
    expect(pendingBrewReferences(reviewed, [reviewed[0].name])).toEqual([]);
  });

  it('does not cap discovery at the old thirty-result limit', () => {
    const content = Array.from({ length: 45 }, (_, i) => `We meet Person${String.fromCharCode(65 + i % 26)} Family${String.fromCharCode(65 + Math.floor(i / 26))}.`).join('\n');
    expect(scanNewBrewReferences({ ...brew, content }, null, [], [], timestamp)).toHaveLength(45);
  });

  it('merges by normalised name without resurrecting dismissed or created candidates', () => {
    const first = scanNewBrewReferences(brew, null, [], [], timestamp)[0];
    const dismissed: BrewReferenceReview = { ...first, status: 'dismissed' };
    const stalePending = { ...first, name: `  ${first.name.toLocaleUpperCase()}  `, updatedAt: '2026-10-17T08:00:00.000Z' };
    expect(mergeReferenceReviews([dismissed], [stalePending])).toEqual([dismissed]);
    expect(mergeReferenceReviews([stalePending], [dismissed])).toEqual([dismissed]);
    expect(referenceNameKey('Ｍara  Quill')).toBe('mara quill');
  });
});
