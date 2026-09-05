import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Brew, CampaignDataSnapshot, CampaignDataSyncMetadata, LivingWorldData } from '../types';

const store = vi.hoisted(() => ({
  getCampaignDataSyncMetadata: vi.fn(),
  getLivingWorldData: vi.fn(),
  replaceCampaignData: vi.fn(),
  saveCampaignDataSyncMetadata: vi.fn(),
  listCustomCatalogueCategories: vi.fn(),
  listCustomCatalogueEntries: vi.fn(),
  listEncounters: vi.fn(),
  listPartyMembers: vi.fn(),
  listWorldbuildingEntries: vi.fn(),
  listWorldbuildingTypes: vi.fn(),
  listRemoteCampaignData: vi.fn(),
  uploadCampaignData: vi.fn()
}));

vi.mock('./brewStore', () => ({
  getCampaignDataSyncMetadata: store.getCampaignDataSyncMetadata,
  getLivingWorldData: store.getLivingWorldData,
  replaceCampaignData: store.replaceCampaignData,
  saveCampaignDataSyncMetadata: store.saveCampaignDataSyncMetadata
}));
vi.mock('./customCatalogueStore', () => ({
  listCustomCatalogueCategories: store.listCustomCatalogueCategories,
  listCustomCatalogueEntries: store.listCustomCatalogueEntries
}));
vi.mock('./encounterStore', () => ({
  listEncounters: store.listEncounters,
  listPartyMembers: store.listPartyMembers
}));
vi.mock('./worldbuildingStore', () => ({
  listWorldbuildingEntries: store.listWorldbuildingEntries,
  listWorldbuildingTypes: store.listWorldbuildingTypes
}));
vi.mock('./googleDrive', () => ({
  listRemoteCampaignData: store.listRemoteCampaignData,
  uploadCampaignData: store.uploadCampaignData
}));

import { refreshCampaignDataFromDrive } from './workspaceDriveSync';

const brew: Brew = {
  id: 'brew-1',
  title: 'Belentor',
  content: '',
  createdAt: '2026-09-05T08:00:00.000Z',
  updatedAt: '2026-09-05T08:00:00.000Z',
  version: 1,
  rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' }
};

const livingWorld: LivingWorldData = {
  id: 'living-world',
  campaignId: 'default-campaign',
  entities: [],
  entityReferences: [],
  worldEvents: [],
  timelineEntries: [],
  ideaDrafts: []
};

const metadata: CampaignDataSyncMetadata = {
  id: 'campaign-data',
  lastLocalChangeAt: '2026-09-05T08:00:00.000Z',
  drive: {
    fileId: 'campaign-file',
    revisionId: 'phone-revision-1',
    lastSyncedAt: '2026-09-05T08:00:00.000Z'
  },
  syncState: 'error'
};

const remoteData: CampaignDataSnapshot = {
  schemaVersion: 6,
  campaignId: 'default-campaign',
  updatedAt: '2026-09-05T09:00:00.000Z',
  encounters: [{
    id: 'encounter-1',
    name: 'Golem at the gate',
    status: 'not-started',
    optional: false,
    participants: [{
      id: 'golem-1',
      kind: 'monster',
      name: 'Clay Golem',
      source: { category: 'monster', id: 'monster:clay-golem' },
      encounterEquipment: [{ itemId: 'item:+2-battleaxe', actionIndexes: [] }],
      armorClass: 17,
      maxHitPoints: 133,
      currentHitPoints: 133,
      initiative: null
    }],
    activeCombatantId: null,
    createdAt: '2026-09-05T09:00:00.000Z',
    updatedAt: '2026-09-05T09:00:00.000Z',
    version: 2
  }],
  partyMembers: [],
  worldbuildingEntries: [],
  customCatalogueEntries: [],
  customCatalogueCategories: [],
  worldbuildingTypes: [],
  entities: [],
  entityReferences: [],
  worldEvents: []
};

describe('workspace Drive bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getCampaignDataSyncMetadata.mockResolvedValue(metadata);
    store.getLivingWorldData.mockResolvedValue(livingWorld);
    store.listCustomCatalogueCategories.mockResolvedValue([]);
    store.listCustomCatalogueEntries.mockResolvedValue([]);
    store.listEncounters.mockResolvedValue([]);
    store.listPartyMembers.mockResolvedValue([]);
    store.listWorldbuildingEntries.mockResolvedValue([]);
    store.listWorldbuildingTypes.mockResolvedValue([]);
    store.listRemoteCampaignData.mockResolvedValue([{
      file: {
        id: 'campaign-file',
        name: 'Homebrewry campaign data.homebrewry.json',
        modifiedTime: remoteData.updatedAt,
        headRevisionId: 'phone-revision-2'
      },
      data: remoteData
    }]);
  });

  it('restores phone encounters and their equipped treasure before opening the workspace', async () => {
    const result = await refreshCampaignDataFromDrive('drive-token', [brew]);

    expect(result.detail).toBe('Campaign data updated from Drive');
    expect(result.data.encounters[0]?.participants[0]?.encounterEquipment).toEqual([
      { itemId: 'item:+2-battleaxe', actionIndexes: [] }
    ]);
    expect(result.metadata.syncState).toBe('synced');
    expect(store.replaceCampaignData).toHaveBeenCalledWith(result.data, result.metadata);
    expect(store.saveCampaignDataSyncMetadata).not.toHaveBeenCalled();
    expect(store.uploadCampaignData).not.toHaveBeenCalled();
  });
});
