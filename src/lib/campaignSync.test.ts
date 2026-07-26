import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CampaignDataSnapshot, CampaignDataSyncMetadata } from '../types';

vi.mock('./googleDrive', () => ({
  listRemoteCampaignData: vi.fn(),
  uploadCampaignData: vi.fn()
}));

import { listRemoteCampaignData, uploadCampaignData } from './googleDrive';
import { syncCampaignData } from './campaignSync';

const snapshot: CampaignDataSnapshot = {
  schemaVersion: 2,
  updatedAt: '2026-07-26T10:00:00.000Z',
  encounters: [],
  partyMembers: [],
  worldbuildingEntries: [],
  customCatalogueEntries: []
};

const metadata: CampaignDataSyncMetadata = {
  id: 'campaign-data',
  lastLocalChangeAt: '2026-07-25T10:00:00.000Z',
  drive: {
    fileId: 'campaign-file',
    revisionId: 'revision-1',
    lastSyncedAt: '2026-07-24T10:00:00.000Z'
  },
  syncState: 'pending'
};

describe('campaign data sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stops on simultaneous edits without uploading either copy', async () => {
    const remote = { ...snapshot, updatedAt: '2026-07-26T11:00:00.000Z' };
    vi.mocked(listRemoteCampaignData).mockResolvedValue([{ file: { id: 'campaign-file', name: 'Homebrewry campaign data.homebrewry.json', modifiedTime: '2026-07-26T11:00:00.000Z', headRevisionId: 'revision-2' }, data: remote }]);

    const result = await syncCampaignData('token', snapshot, metadata);

    expect(result.state).toBe('conflict');
    expect(result.metadata.conflict?.remoteData.updatedAt).toBe(remote.updatedAt);
    expect(uploadCampaignData).not.toHaveBeenCalled();
  });

  it('downloads a remote revision when this device has not changed it', async () => {
    const unchangedMetadata = {
      ...metadata,
      lastLocalChangeAt: '2026-07-23T10:00:00.000Z',
      syncState: 'synced' as const
    };
    const remote = { ...snapshot, updatedAt: '2026-07-26T11:00:00.000Z' };
    vi.mocked(listRemoteCampaignData).mockResolvedValue([{ file: { id: 'campaign-file', name: 'Homebrewry campaign data.homebrewry.json', modifiedTime: '2026-07-26T11:00:00.000Z', headRevisionId: 'revision-2' }, data: remote }]);

    const result = await syncCampaignData('token', snapshot, unchangedMetadata);

    expect(result.state).toBe('synced');
    expect(result.data).toEqual(remote);
    expect(uploadCampaignData).not.toHaveBeenCalled();
  });

  it('loads existing campaign data on a newly connected device with no local records', async () => {
    const remote = {
      ...snapshot,
      updatedAt: '2026-07-26T11:00:00.000Z',
      partyMembers: [{
        id: 'party-1',
        name: 'Rook',
        armorClass: 16,
        maxHitPoints: 42,
        createdAt: '2026-07-26T10:00:00.000Z',
        updatedAt: '2026-07-26T10:00:00.000Z'
      }]
    };
    const freshMetadata: CampaignDataSyncMetadata = {
      id: 'campaign-data',
      lastLocalChangeAt: '2026-07-26T10:00:00.000Z',
      syncState: 'local'
    };
    vi.mocked(listRemoteCampaignData).mockResolvedValue([{ file: { id: 'campaign-file', name: 'Homebrewry campaign data.homebrewry.json', modifiedTime: '2026-07-26T11:00:00.000Z', headRevisionId: 'revision-2' }, data: remote }]);

    const result = await syncCampaignData('token', snapshot, freshMetadata);

    expect(result.state).toBe('synced');
    expect(result.detail).toBe('Campaign data loaded from Drive');
    expect(result.data.partyMembers).toEqual(remote.partyMembers);
    expect(uploadCampaignData).not.toHaveBeenCalled();
  });

  it('creates a Drive companion file when local campaign data exists', async () => {
    const local = { ...snapshot, partyMembers: [{ id: 'party-1', name: 'Rook', armorClass: 16, maxHitPoints: 42, createdAt: '2026-07-26T10:00:00.000Z', updatedAt: '2026-07-26T10:00:00.000Z' }] };
    const initialMetadata: CampaignDataSyncMetadata = {
      id: 'campaign-data',
      lastLocalChangeAt: '2026-07-26T10:00:00.000Z',
      syncState: 'local'
    };
    vi.mocked(listRemoteCampaignData).mockResolvedValue([]);
    vi.mocked(uploadCampaignData).mockResolvedValue({ id: 'campaign-file', name: 'Homebrewry campaign data.homebrewry.json', modifiedTime: '2026-07-26T10:00:00.000Z', headRevisionId: 'revision-1' });

    const result = await syncCampaignData('token', local, initialMetadata);

    expect(uploadCampaignData).toHaveBeenCalledWith('token', local);
    expect(result.metadata.drive).toMatchObject({ fileId: 'campaign-file', revisionId: 'revision-1' });
  });
});
