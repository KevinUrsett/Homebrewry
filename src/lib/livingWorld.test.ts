import { describe, expect, it } from 'vitest';
import type { WorldEvent } from '../types';
import { appendWorldEvent, createCampaignEntity } from './livingWorld';

describe('Living World entities and events', () => {
  it('creates stable campaign-scoped identities without touching brew content', () => {
    const entity = createCampaignEntity({
      campaignId: 'campaign-1',
      kind: 'npc',
      name: ' Talon Bloodwing ',
      aliases: ['Talon', 'Talon'],
      source: { kind: 'worldbuilding', id: 'worldbuilding-1' }
    }, '2026-07-28T10:00:00.000Z', () => 'entity-1');

    expect(entity).toMatchObject({
      id: 'entity-1',
      campaignId: 'campaign-1',
      name: 'Talon Bloodwing',
      aliases: ['Talon']
    });
  });

  it('appends provenance without mutating or replacing history', () => {
    const first: WorldEvent = {
      id: 'event-1',
      campaignId: 'campaign-1',
      type: 'npc.status.changed',
      source: { kind: 'manual' },
      changes: [],
      occurredAt: '2026-07-28T10:00:00.000Z',
      recordedAt: '2026-07-28T10:00:00.000Z'
    };
    const original = [first] as const;
    const second = { ...first, id: 'event-2' };

    expect(appendWorldEvent(original, second).map(({ id }) => id)).toEqual(['event-1', 'event-2']);
    expect(original).toHaveLength(1);
    expect(() => appendWorldEvent(original, first)).toThrow('already exists');
  });
});
