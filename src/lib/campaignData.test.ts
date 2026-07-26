import { describe, expect, it } from 'vitest';
import { createCampaignDataSnapshot, keepBothCampaignData, parseCampaignDataSnapshot } from './campaignData';
import { createCustomCatalogueEntry } from '../catalogue/customEntries';
import { createEncounter, createPartyMember } from './encounters';
import { createWorldbuildingEntry } from './worldbuilding';

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
    expect(() => parseCampaignDataSnapshot({ schemaVersion: 3 })).toThrow('not a supported Homebrewry backup');
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
