import { describe, expect, it } from 'vitest';
import { createCampaignDataSnapshot, keepBothCampaignData, parseCampaignDataSnapshot } from './campaignData';
import { createCustomCatalogueCategory, createCustomCatalogueEntry, createCustomMonster } from '../catalogue/customEntries';
import type { CatalogueEntry } from '../catalogue/types';
import { createEncounter, createPartyMember } from './encounters';
import { createWorldbuildingEntry, createWorldbuildingType } from './worldbuilding';
import { createBlankPlotBoard } from './plotBoard';

describe('campaign data snapshots', () => {
  it('validates a versioned Drive snapshot before it is used locally', () => {
    const partyMember = createPartyMember('Rook', 16, 42);
    const snapshot = createCampaignDataSnapshot(
      [createEncounter('Bridge ambush', [partyMember])],
      [partyMember],
      [createWorldbuildingEntry('Sund', 'town')],
      '2026-07-26T12:00:00.000Z',
      [createCustomCatalogueEntry('The Old Road', 'background', '2026-07-26T12:00:00.000Z', 'road-id')]
    );

    expect(parseCampaignDataSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
    const legacySnapshot = { ...snapshot, schemaVersion: 1 } as Record<string, unknown>;
    delete legacySnapshot.customCatalogueEntries;
    expect(parseCampaignDataSnapshot(legacySnapshot).customCatalogueEntries).toEqual([]);
    expect(() => parseCampaignDataSnapshot({ schemaVersion: 4 })).toThrow('not a supported Homebrewry backup');
  });

  it('keeps the saved current brew in campaign data for Drive sync', () => {
    const snapshot = { ...createCampaignDataSnapshot([], [], [], '2026-07-30T12:00:00.000Z'), currentBrewId: 'brew-42' };
    expect(parseCampaignDataSnapshot(JSON.parse(JSON.stringify(snapshot))).currentBrewId).toBe('brew-42');
  });

  it('keeps a manual plot board separate from legacy timeline entries', () => {
    const timestamp = '2026-07-31T08:00:00.000Z';
    const board = createBlankPlotBoard(timestamp);
    const phase = { id: 'opening', title: 'Opening', order: 0, createdAt: timestamp, updatedAt: timestamp };
    const lane = { id: 'main', title: 'Main story', tone: 'main' as const, order: 0, createdAt: timestamp, updatedAt: timestamp };
    const beat = { id: 'beat-1', laneId: lane.id, phaseId: phase.id, title: 'The party accepts the mission', notes: '', status: 'planned' as const, entityIds: [], order: 0, createdAt: timestamp, updatedAt: timestamp };
    const snapshot = { ...createCampaignDataSnapshot([], [], [], timestamp), plotBoard: { ...board, phases: [phase], lanes: [lane], beats: [beat] }, timelineEntries: [{ id: 'legacy', campaignId: 'default-campaign', lane: 'main' as const, status: 'past' as const, title: 'Existing timeline event', when: '', order: 0, notes: '', entityIds: [], createdAt: timestamp, updatedAt: timestamp }] };

    const parsed = parseCampaignDataSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed.plotBoard?.beats).toEqual([beat]);
    expect(parsed.timelineEntries).toHaveLength(1);
  });

  it('preserves structured custom monster data in schema v3 while safely migrating v2 entries', () => {
    const template: CatalogueEntry = {
      id: 'srd-monster',
      category: 'monster',
      name: 'Ash Scout',
      description: 'A scout from the ash road.',
      data: { ac: '14', hp: '27 (5d8 + 5)', speed: { walk: 30 }, actions: [{ name: 'Crossbow', text: 'Ranged Weapon Attack.' }] },
      source: 'SRD-521',
      ruleset: '5.5e'
    };
    const monster = createCustomMonster(template, '2026-07-26T12:00:00.000Z', 'custom-monster');
    const snapshot = createCampaignDataSnapshot([], [], [], '2026-07-26T12:00:00.000Z', [monster]);

    expect(parseCampaignDataSnapshot(JSON.parse(JSON.stringify(snapshot))).customCatalogueEntries[0]).toMatchObject({
      id: 'custom-monster',
      data: template.data
    });

    const legacy = { ...snapshot, schemaVersion: 2 } as Record<string, unknown>;
    expect(parseCampaignDataSnapshot(legacy).customCatalogueEntries[0]?.data).toEqual({});
  });

  it('preserves custom categories and Worldbuilding types in schema v4 while reading v3 safely', () => {
    const category = createCustomCatalogueCategory('Deities', '2026-07-26T12:00:00.000Z', 'deity');
    const type = createWorldbuildingType('Ship', '2026-07-26T12:00:00.000Z', 'ship');
    const snapshot = createCampaignDataSnapshot([], [], [], '2026-07-26T12:00:00.000Z', [], [category], [type]);

    expect(parseCampaignDataSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);

    const v3 = { ...snapshot, schemaVersion: 3 } as Record<string, unknown>;
    expect(parseCampaignDataSnapshot(v3)).toMatchObject({
      schemaVersion: 5,
      customCatalogueCategories: [],
      worldbuildingTypes: []
    });
  });

  it('migrates legacy encounter progress without rewriting authored brew data', () => {
    const snapshot = createCampaignDataSnapshot([], [], [], '2026-07-26T12:00:00.000Z');
    const legacy = {
      ...snapshot,
      schemaVersion: 4,
      encounters: [
        { ...createEncounter('First'), status: 'prepared', optional: undefined },
        { ...createEncounter('Second'), status: 'complete', optional: undefined }
      ]
    } as Record<string, unknown>;
    delete legacy.campaignId;
    delete legacy.entities;
    delete legacy.entityReferences;
    delete legacy.worldEvents;

    const migrated = parseCampaignDataSnapshot(legacy);
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.campaignId).toMatch(/^legacy-/);
    expect(migrated.encounters.map(({ status, optional }) => ({ status, optional }))).toEqual([
      { status: 'not-started', optional: false },
      { status: 'completed', optional: false }
    ]);
    expect(migrated.entities).toEqual([]);
    expect(migrated.worldEvents).toEqual([]);
  });

  it('preserves stable NPC entity links on encounter combatants', () => {
    const linked = {
      ...createEncounter('North Tower'),
      participants: [{
        id: 'participant-1',
        kind: 'npc' as const,
        name: 'Talon Bloodwing',
        entityId: 'worldbuilding:talon',
        armorClass: 17,
        maxHitPoints: 44,
        currentHitPoints: 44,
        initiative: 12
      }]
    };
    const snapshot = createCampaignDataSnapshot([linked], [], [], '2026-07-28T10:00:00.000Z');

    expect(parseCampaignDataSnapshot(JSON.parse(JSON.stringify(snapshot))).encounters[0]?.participants[0]).toMatchObject({
      kind: 'npc',
      entityId: 'worldbuilding:talon',
      name: 'Talon Bloodwing'
    });
  });

  it('keeps conflicting records as separately named local copies', () => {
    const localEntry = { ...createWorldbuildingEntry('Sund', 'town'), notes: 'Local note' };
    const remoteEntry = { ...localEntry, notes: 'Drive note' };
    const local = createCampaignDataSnapshot([], [], [localEntry], '2026-07-26T12:00:00.000Z');
    const remote = createCampaignDataSnapshot([], [], [remoteEntry], '2026-07-26T12:01:00.000Z');

    const kept = keepBothCampaignData(local, remote, '2026-07-26T12:02:00.000Z', () => 'local-copy');

    expect(kept.worldbuildingEntries).toEqual([
      expect.objectContaining({ id: localEntry.id, notes: 'Drive note' }),
      expect.objectContaining({ id: 'local-copy', name: 'Sund (local copy)', notes: 'Local note' })
    ]);
  });
});
