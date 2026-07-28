import { describe, expect, it } from 'vitest';
import { findUnresolvedNames } from './unresolvedReferences';

describe('findUnresolvedNames', () => {
  it('recognises connector phrases as one complete reference name', () => {
    const results = findUnresolvedNames([
      'They enter Temple of the Dark Ones before dusk.'
    ], []);

    expect(results).toEqual([{ name: 'Temple of the Dark Ones', count: 1 }]);
  });

  it('does not merge separate names across lines', () => {
    const results = findUnresolvedNames([
      'Carl the Officer\nTemple of the Dark Ones'
    ], []);

    expect(results.map((item) => item.name)).toEqual([
      'Carl the Officer',
      'Temple of the Dark Ones'
    ]);
  });

  it('counts repeated names instead of joining them', () => {
    const results = findUnresolvedNames([
      'Carl the Officer Carl the Officer Carl the Officer'
    ], []);

    expect(results).toContainEqual({ name: 'Carl the Officer', count: 3 });
  });

  it('recognises a capitalised single name used mid-sentence', () => {
    const results = findUnresolvedNames([
      'The road eventually reaches Sund.'
    ], []);

    expect(results).toEqual([{ name: 'Sund', count: 1 }]);
  });

  it('does not suggest generic lowercase prose', () => {
    const results = findUnresolvedNames([
      'The scout fires from cover while a bell rings near the road.'
    ], []);

    expect(results).toEqual([]);
  });
});
