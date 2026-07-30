import { describe, expect, it } from 'vitest';
import type { Brew, CampaignEntity, EntityReference, TimelineEntry, WorldbuildingEntry } from '../types';
import { createCampaignMapFromReferenceMap, deriveReferenceMap } from './campaignMap';

const timestamp = '2026-07-30T12:00:00.000Z';
const queen: CampaignEntity = {
  id: 'worldbuilding:a1111111-1111-4111-8111-111111111111', campaignId: 'default-campaign', kind: 'npc', name: 'Queen Elisiel', aliases: [],
  source: { kind: 'worldbuilding', id: 'a1111111-1111-4111-8111-111111111111' }, createdAt: timestamp, updatedAt: timestamp, version: 1
};
const general: CampaignEntity = {
  id: 'worldbuilding:b2222222-2222-4222-8222-222222222222', campaignId: 'default-campaign', kind: 'npc', name: 'General Starsky', aliases: [],
  source: { kind: 'worldbuilding', id: 'b2222222-2222-4222-8222-222222222222' }, createdAt: timestamp, updatedAt: timestamp, version: 1
};
const entries: WorldbuildingEntry[] = [
  { id: 'a1111111-1111-4111-8111-111111111111', name: 'Queen Elisiel', kind: 'npc', aliases: [], notes: '[[world:b2222222-2222-4222-8222-222222222222|General Starsky]] threatens the border.', createdAt: timestamp, updatedAt: timestamp, version: 1 },
  { id: 'b2222222-2222-4222-8222-222222222222', name: 'General Starsky', kind: 'npc', aliases: [], notes: '', createdAt: timestamp, updatedAt: timestamp, version: 1 }
];
const brew: Brew = { id: 'brew-1', title: 'Border War', content: '', createdAt: timestamp, updatedAt: timestamp, version: 1, rendererSettings: { accentColor: '#000', parchmentTone: 'warm' } };
const references: EntityReference[] = [{ id: 'ref-1', campaignId: 'default-campaign', entityId: queen.id, source: { kind: 'brew', brewId: brew.id, start: 0, end: 0 }, label: 'Queen Elisiel', createdAt: timestamp }];
const timeline: TimelineEntry = { id: 'timeline-1', campaignId: 'default-campaign', lane: 'main', status: 'current', title: 'Border crisis', when: '641 AA', order: 1, notes: '', entityIds: [general.id], brewId: brew.id, createdAt: timestamp, updatedAt: timestamp };

describe('campaign map', () => {
  it('derives only confirmed links and can copy them into an editable board', () => {
    const reference = deriveReferenceMap([queen, general], entries, references, [timeline], [brew], [], new Map());

    expect(reference.nodes.map((node) => node.label)).toEqual(expect.arrayContaining(['Queen Elisiel', 'General Starsky', 'Border War', 'Border crisis']));
    expect(reference.links).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: queen.id, targetId: general.id, label: 'links to' }),
      expect.objectContaining({ sourceId: queen.id, targetId: `brew:${brew.id}`, label: 'referenced in' }),
      expect.objectContaining({ sourceId: 'timeline:timeline-1', targetId: general.id, label: 'involves' })
    ]));

    const board = createCampaignMapFromReferenceMap(reference, timestamp);
    expect(board.nodes).toHaveLength(reference.nodes.length);
    expect(board.links).toHaveLength(reference.links.length);
    expect(board.nodes.find((node) => node.entityId === queen.id)).toMatchObject({ label: queen.name, kind: 'entity' });
  });
});
