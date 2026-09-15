import { describe, expect, it } from 'vitest';
import type { WorldbuildingEntry } from '../types';
import { searchSocialNpcs, socialNpcCandidates } from './socialNpcSearch';

const entry = (id: string, name: string, kind: WorldbuildingEntry['kind'] = 'npc'): WorldbuildingEntry => ({
  id, name, kind, aliases: [], notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1
});

describe('social NPC search', () => {
  it('includes saved NPC, character, and historical-figure entries', () => {
    const results = socialNpcCandidates([entry('npc', 'Talon'), entry('character', 'Orren', 'character'), entry('historical', 'Hujin', 'historical-figure'), entry('town', 'Sund', 'town')]);
    expect(results.map((result) => result.entry.name)).toEqual(['Talon', 'Orren', 'Hujin']);
  });

  it('matches words across names, aliases, and notes', () => {
    const talon = { ...entry('talon', 'Talon Bloodwing'), aliases: ['The Falcon'], notes: 'Sky Guard leader' };
    const results = searchSocialNpcs(socialNpcCandidates([talon]), 'falcon guard');
    expect(results).toHaveLength(1);
    expect(results[0]?.entry.name).toBe('Talon Bloodwing');
  });
});
