import { describe, expect, it } from 'vitest';
import type { Brew, CampaignMapRecord, Encounter } from '../types';
import { getOutline, getOutlineLocations } from './outline';
import { placeMapInBrew } from './mapBrewPlacement';
import { parseRendererBlocks } from '../renderer/blocks';

const brew: Brew = { id: 'brew-1', title: 'Sund', content: '# Tower\nApproach.\n\n# Crypt\nExisting text.', createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1, rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' } };
const encounter: Encounter = { id: 'abcd-1234', name: 'Guards', status: 'not-started', optional: false, participants: [], activeCombatantId: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1 };
const map: CampaignMapRecord = {
  id: 'abcd-5678', name: 'Watchtower', markers: [], linkedBrewIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1,
  rooms: [
    { id: 'upper', number: 2, name: 'Upper hall', readAloud: '', notes: 'Hidden latch.', encounterIds: [], updatedAt: '2026-01-01' },
    { id: 'gate', number: 1, name: 'Gate', readAloud: 'The gate creaks.\nDust falls.', notes: 'A concealed trap.', encounterIds: [encounter.id, 'missing'], updatedAt: '2026-01-01' }
  ]
};

describe('map placement into a brew', () => {
  it('adds the map and numbered room sections in the selected section, including prose and encounters', () => {
    const result = placeMapInBrew(brew, map, 'tower', [encounter]);
    expect(getOutline(result.content).map((heading) => heading.text)).toEqual(['Tower', 'Watchtower', '1. Gate', '2. Upper hall', 'Crypt']);
    expect(result.content).toContain('> The gate creaks.\n> Dust falls.');
    expect(result.content).toContain('A concealed trap.');
    expect(result.content).toContain('[[encounter:abcd-1234|Guards]]');
    expect(result.content).toContain('Hidden latch.');
    expect(result.content).not.toContain('encounter:missing');
    expect(result.content).toContain('# Crypt\nExisting text.');
    expect(result.map.linkedBrewIds).toEqual([brew.id]);
    for (const room of result.map.rooms) expect(getOutline(result.content).some((heading) => `${brew.id}:${heading.id}` === room.brewSectionId)).toBe(true);
    expect(parseRendererBlocks(result.content)).toContainEqual({ type: 'map', mapId: map.id });
    expect(result.roomsAdded).toBe(2);
  });

  it('works in an empty brew and at the document end without an outline selection', () => {
    const empty = placeMapInBrew({ ...brew, content: '' }, { ...map, rooms: [] }, null, []);
    expect(getOutline(empty.content)).toEqual([{ id: 'watchtower', text: 'Watchtower', level: 1 }]);
    expect(empty.content).toContain(`:::map ${map.id}`);
    const tail = placeMapInBrew(brew, map, null, []);
    expect(tail.content.indexOf('Watchtower')).toBeGreaterThan(tail.content.indexOf('Existing text.'));
  });

  it('creates navigable room sections under a deeply nested outline heading', () => {
    const deep = placeMapInBrew({ ...brew, content: '#### Tower' }, map, 'tower', []);
    expect(getOutline(deep.content).map((heading) => heading.level)).toEqual([4, 5, 6, 6]);
    expect(deep.map.rooms.find((room) => room.number === 1)?.brewSectionId).toBe('brew-1:1-gate');
  });

  it('uses the actual generated heading IDs when room names already exist elsewhere', () => {
    const duplicate = placeMapInBrew({ ...brew, content: '# Earlier\n### 1. Gate\n# Tower' }, map, 'tower', []);
    expect(duplicate.map.rooms.find((room) => room.number === 1)?.brewSectionId).toBe('brew-1:1-gate-2');
  });

  it('repairs old map-only placements, adds missing rooms, and preserves authored linked sections on repeat', () => {
    const old = { ...brew, content: `# Tower\n:::map ${map.id}\n\n# Crypt\nExisting text.` };
    const repaired = placeMapInBrew(old, map, 'tower', []);
    expect(repaired.content.match(/:::map/g)).toHaveLength(1);
    expect(repaired.roomsAdded).toBe(2);
    const authored = repaired.content.replace('Hidden latch.', 'My edited room notes.');
    const repeated = placeMapInBrew({ ...brew, content: authored }, repaired.map, 'crypt', []);
    expect(repeated.content).toBe(authored);
    expect(repeated.roomsAdded).toBe(0);
    const extraRoom = { ...map.rooms[0], id: 'roof', number: 3, name: 'Roof' };
    const extended = placeMapInBrew({ ...brew, content: authored }, { ...repaired.map, rooms: [...repaired.map.rooms, extraRoom] }, 'tower', []);
    expect(extended.roomsAdded).toBe(1);
    expect(extended.content).toContain('My edited room notes.');
    expect(getOutlineLocations(extended.content).find((heading) => heading.text === '3. Roof')?.id).toBe(extended.map.rooms.find((room) => room.id === 'roof')?.brewSectionId?.split(':')[1]);
  });

  it('rejects a stale outline target instead of silently appending to the wrong place', () => {
    expect(() => placeMapInBrew(brew, map, 'removed-heading', [])).toThrow('no longer exists');
    expect(map.linkedBrewIds).toEqual([]);
    expect(map.rooms[0].brewSectionId).toBeUndefined();
  });
});
