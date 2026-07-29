import { describe, expect, it } from 'vitest';
import { findBrewReferenceCandidates } from './brewReferenceCandidates';
import type { Brew } from '../types';

const brew: Brew = {
  id: 'brew-1', title: 'Pilot', content: '# Chapter 1\n## Gyrro\n### Princess Caelinia\n### The Ridge Road\n### Encounters', createdAt: '', updatedAt: '', version: 1, rendererSettings: { accentColor: '#000', parchmentTone: 'warm' }
};

describe('brew reference candidates', () => {
  it('creates deduplicated, heading-based identity candidates without generic sections', () => {
    expect(findBrewReferenceCandidates([brew], []).map(({ name, kind }) => ({ name, kind }))).toEqual([
      { name: 'Gyrro', kind: 'town' },
      { name: 'Princess Caelinia', kind: 'character' },
      { name: 'The Ridge Road', kind: 'road' }
    ]);
  });

  it('does not recreate an existing Worldbuilding name or alias', () => {
    expect(findBrewReferenceCandidates([brew], [{ id: 'gyrro', name: 'Gyrro', kind: 'town', aliases: [], notes: '', createdAt: '', updatedAt: '', version: 1 }]).map(({ name }) => name)).not.toContain('Gyrro');
  });
});
