import { describe, expect, it } from 'vitest';
import type { Encounter, WorldEvent } from '../types';
import { appendWorldEvent, createCampaignEntity, createTimelineEntry, recordCombatCompletion, recordManualStateChange, saveTimelineEntry, synchroniseLivingWorld, synchroniseWorldbuildingEntities } from './livingWorld';
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

  it('treats an NPC Worldbuilding entry as a campaign NPC', () => {
    const entry = createWorldbuildingEntry('Talon', 'npc');
    const entities = synchroniseWorldbuildingEntities('campaign-1', [entry]);

    expect(entities[0]).toMatchObject({ kind: 'npc', name: 'Talon' });
  });

  it('keeps a planned story node attached to its chosen parent', () => {
    const base = { id: 'living-world' as const, campaignId: 'campaign-1', entities: [], entityReferences: [], worldEvents: [], timelineEntries: [] };
    const root = createTimelineEntry(base, { lane: 'main', status: 'planned', title: 'Reach Sund', when: '', notes: '', entityIds: [] }, '2026-07-30T12:00:00.000Z', () => 'root');
    const withRoot = saveTimelineEntry(base, root);
    const branch = createTimelineEntry(withRoot, { lane: 'quest', status: 'planned', title: 'Find the hidden tunnel', when: '', notes: '', entityIds: [], parentId: root.id }, '2026-07-30T12:01:00.000Z', () => 'branch');

    expect(branch).toMatchObject({ id: 'branch', parentId: 'root', order: 1 });
  });

  it('records a linked NPC at 0 HP as dead when combat ends', () => {
    const entry = createWorldbuildingEntry('Talon', 'character');
    const base = synchroniseLivingWorld({
      id: 'living-world',
      campaignId: 'campaign-1',
      entities: [],
      entityReferences: [],
      worldEvents: []
    }, [entry]);
    const encounter: Encounter = {
      id: 'encounter-1',
      name: 'North Tower',
      status: 'completed',
      optional: false,
      participants: [{
        id: 'talon-combatant',
        kind: 'npc',
        name: 'Talon',
        entityId: base.entities[0]!.id,
        armorClass: 17,
        maxHitPoints: 44,
        currentHitPoints: 0,
        initiative: 12
      }],
      activeCombatantId: null,
      createdAt: '2026-07-28T10:00:00.000Z',
      updatedAt: '2026-07-28T11:00:00.000Z',
      version: 2
    };

    const completed = recordCombatCompletion(base, encounter, encounter.updatedAt, () => 'event-1');
    expect(completed.worldEvents).toEqual([
      expect.objectContaining({
        id: 'event-1',
        entityId: base.entities[0]!.id,
        type: 'npc.died',
        source: { kind: 'combat', encounterId: encounter.id, participantId: 'talon-combatant' },
        changes: [{ field: 'status', previousValue: null, nextValue: 'dead' }]
      })
    ]);

    const overridden = recordManualStateChange(completed, base.entities[0]!.id, 'status', 'alive', '2026-07-28T12:00:00.000Z', () => 'event-2');
    expect(overridden.worldEvents.at(-1)?.changes[0]?.nextValue).toBe('alive');
  });
});
