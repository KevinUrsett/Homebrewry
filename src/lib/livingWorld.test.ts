import { describe, expect, it } from 'vitest';
import type { WorldEvent } from '../types';
import { appendWorldEvent, createCampaignEntity, recordManualStateChange, synchroniseLivingWorld, synchroniseWorldbuildingEntities } from './livingWorld';
import { createWorldbuildingEntry } from './worldbuilding';

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

  it('turns confirmed Worldbuilding records into stable campaign entities', () => {
    const entry = createWorldbuildingEntry('Sund', 'town');
    const first = synchroniseWorldbuildingEntities('campaign-1', [entry]);
    const renamed = synchroniseWorldbuildingEntities('campaign-1', [{ ...entry, name: 'Sundholm', version: 2 }], first);

    expect(first[0]).toMatchObject({
      id: `worldbuilding:${entry.id}`,
      campaignId: 'campaign-1',
      kind: 'settlement',
      name: 'Sund'
    });
    expect(renamed[0]).toMatchObject({ id: first[0]?.id, name: 'Sundholm' });
  });

  it('records manual NPC status overrides as append-only provenance', () => {
    const entry = createWorldbuildingEntry('Talon', 'character');
    const base = synchroniseLivingWorld({
      id: 'living-world',
      campaignId: 'campaign-1',
      entities: [],
      entityReferences: [],
      worldEvents: []
    }, [entry]);
    const entityId = base.entities[0]!.id;
    const dead = recordManualStateChange(base, entityId, 'status', 'dead', '2026-07-28T10:00:00.000Z', () => 'event-1');
    const alive = recordManualStateChange(dead, entityId, 'status', 'alive', '2026-07-28T11:00:00.000Z', () => 'event-2');

    expect(alive.worldEvents).toHaveLength(2);
    expect(alive.worldEvents[0]?.changes[0]).toMatchObject({ previousValue: null, nextValue: 'dead' });
    expect(alive.worldEvents[1]?.changes[0]).toMatchObject({ previousValue: 'dead', nextValue: 'alive' });
  });
});
