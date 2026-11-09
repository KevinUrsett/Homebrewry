import { describe, expect, it } from 'vitest';
import { parseRendererBlocks } from '../renderer/blocks';
import type { Brew, CampaignMapRecord } from '../types';
import { createCampaignDataSnapshot, parseCampaignDataSnapshot } from './campaignData';
import { campaignDungeons, updateDungeonProgress } from './dungeons';
import { dungeonRoomMoves, moveDungeonRooms, prepareInlineDungeonMove } from './dungeonBrewMigration';
import { formatDungeonReference } from './dungeonReferences';
import { getOutline, insertAtOutlineSectionEnd } from './outline';

const now = '2026-11-09T12:00:00Z';
const legacyMap: CampaignMapRecord = {
  id: 'a001', name: 'The Crypt', version: 1, createdAt: now, updatedAt: now,
  imageSource: 'asset://a002', markers: [{ roomId: 'a003', x: 50, y: 35 }], linkedBrewIds: ['brew-1'],
  rooms: [{ id: 'a003', number: 1, name: 'Gate', readAloud: 'A cold wind rises.', notes: 'Original note.', encounterIds: ['a004'], brewSectionId: 'brew-1:1-gate', updatedAt: now }]
};
const brew: Brew = {
  id: 'brew-1', title: 'Sund', version: 1, createdAt: now, updatedAt: now,
  content: '# The Crypt\n\n:::map a001\n\n## 1. Gate\n\n> The gate creaks.\n\nEdited notes.\n\n[[encounter:a005|Gate guards]]\n\n# Beyond\n\nKeep this.',
  rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' }
};

describe('dungeons', () => {
  it('recovers legacy map identities and round-trips the dungeon and its checkpoint', () => {
    const original = createCampaignDataSnapshot([], [], [], now);
    const legacy = parseCampaignDataSnapshot({ ...original, maps: [legacyMap] });
    const [dungeon] = campaignDungeons(legacy);
    expect(dungeon.id).toBe(legacyMap.id);
    expect(dungeon.areas[0]).toMatchObject({ imageSource: legacyMap.imageSource, markers: legacyMap.markers, rooms: legacyMap.rooms });

    const progressed = updateDungeonProgress(dungeon, { areaId: dungeon.areas[0].id, roomId: 'a003' }, 'visited');
    const next = createCampaignDataSnapshot([], [], [], now, [], [], [], [], { ...original, dungeons: [progressed] });
    expect(next.schemaVersion).toBe(7);
    expect(campaignDungeons(parseCampaignDataSnapshot(JSON.parse(JSON.stringify(next))))).toEqual([progressed]);
    expect(campaignDungeons({ ...legacy, dungeons: [] })).toEqual([]);
  });

  it('places one reference in the outline and treats a code example as text', () => {
    const [dungeon] = campaignDungeons({ maps: [legacyMap] });
    const reference = formatDungeonReference(dungeon);
    const content = insertAtOutlineSectionEnd('# Crypt\n\n# Next', 'crypt', reference);
    expect(getOutline(content).map((heading) => heading.text)).toEqual(['Crypt', 'Next']);
    expect(parseRendererBlocks(content).filter((block) => block.type === 'dungeon-card')).toEqual([
      { type: 'dungeon-card', dungeonId: 'a001', label: 'The Crypt' }
    ]);
    expect(parseRendererBlocks(['```markdown', reference, '```'].join('\n'))[0].type).toBe('markdown');
  });

  it('moves reviewed brew rooms and keeps the existing map card and encounter references connected', () => {
    const [dungeon] = campaignDungeons({ maps: [legacyMap] });
    const review = dungeonRoomMoves(brew, dungeon);
    expect(review).toHaveLength(1);
    const moved = moveDungeonRooms(brew, dungeon, review, now);
    expect(moved.content).toBe('# The Crypt\n\n[[dungeon:a001|The Crypt]]\n\n# Beyond\n\nKeep this.');
    expect(moved.dungeon.areas[0].rooms[0]).toMatchObject({ readAloud: 'The gate creaks.', notes: 'Edited notes.', encounterIds: ['a004', 'a005'] });
    expect(() => moveDungeonRooms({ ...brew, content: brew.content.replace('Edited notes.', 'New edit.') }, dungeon, review, now)).toThrow(/changed/);
  });

  it('converts an inline map with numbered pins and preserves its other prose', () => {
    const original = { ...brew, content: '# Descent\n\n:::dungeon Vault\n![Map](asset://a002)\n1A | Gate\n::map-marker 1A 50 25\nBrass hinges.\n:::\n\n## 1A. Gate\nA locked door.' };
    const block = parseRendererBlocks(original.content).find((item) => item.type === 'dungeon')!;
    const moved = prepareInlineDungeonMove(original, block);
    expect(moved.dungeon.areas[0].rooms[0]).toMatchObject({ numberLabel: '1A', name: 'Gate' });
    expect(moved.dungeon.areas[0].rooms[1].notes).toBe('Brass hinges.');
    expect(moved.dungeon.areas[0].markers[0]).toEqual({ roomId: moved.dungeon.areas[0].rooms[0].id, x: 50, y: 25 });
    expect(moved.content).toBe(`# Descent\n\n${formatDungeonReference(moved.dungeon)}\n\n## 1A. Gate\nA locked door.`);
  });
});
