import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueEntry } from '../catalogue/types';
import type { PrivateMonsterSyncMetadata } from '../types';

vi.mock('./googleDrive', () => ({
  listRemotePrivateMonsterCatalogues: vi.fn(),
  uploadPrivateMonsterCatalogue: vi.fn()
}));

import { listRemotePrivateMonsterCatalogues, uploadPrivateMonsterCatalogue } from './googleDrive';
import { syncPrivateMonsterCatalogue } from './privateMonsterSync';

const monster: CatalogueEntry = {
  id: 'private-monster-id',
  category: 'monster',
  name: 'Private Monster',
  description: 'A private creature.',
  data: { ac: '14', hp: '44' },
  source: 'Private import',
  ruleset: '5e'
};

const metadata: PrivateMonsterSyncMetadata = {
  id: 'private-monster-catalogue',
  lastLocalChangeAt: '2026-07-26T10:00:00.000Z',
  drive: {
    fileId: 'private-monster-file',
    revisionId: 'revision-1',
    lastSyncedAt: '2026-07-25T10:00:00.000Z'
  },
  syncState: 'pending'
};

describe('private monster catalogue sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads a private monster catalogue onto a clean second device', async () => {
    const remoteData = {
      schemaVersion: 1,
      updatedAt: '2026-07-26T11:00:00.000Z',
      entries: [monster]
    };
    const freshMetadata: PrivateMonsterSyncMetadata = {
      id: 'private-monster-catalogue',
      lastLocalChangeAt: '2026-07-26T10:00:00.000Z',
      syncState: 'local'
    };
    vi.mocked(listRemotePrivateMonsterCatalogues).mockResolvedValue([{
      file: { id: 'private-monster-file', name: 'Homebrewry private monster catalogue.homebrewry.json', modifiedTime: '2026-07-26T11:00:00.000Z', headRevisionId: 'revision-2' },
      data: remoteData
    }]);

    const result = await syncPrivateMonsterCatalogue('token', [], freshMetadata);

    expect(result.state).toBe('synced');
    expect(result.detail).toBe('Private monster catalogue loaded from Drive');
    expect(result.entries).toEqual([monster]);
    expect(uploadPrivateMonsterCatalogue).not.toHaveBeenCalled();
  });

  it('creates a private Drive companion file when local imported monsters exist', async () => {
    vi.mocked(listRemotePrivateMonsterCatalogues).mockResolvedValue([]);
    vi.mocked(uploadPrivateMonsterCatalogue).mockResolvedValue({
      id: 'private-monster-file',
      name: 'Homebrewry private monster catalogue.homebrewry.json',
      modifiedTime: '2026-07-26T10:00:00.000Z',
      headRevisionId: 'revision-1'
    });
    const freshMetadata: PrivateMonsterSyncMetadata = {
      id: 'private-monster-catalogue',
      lastLocalChangeAt: '2026-07-26T10:00:00.000Z',
      syncState: 'local'
    };

    const result = await syncPrivateMonsterCatalogue('token', [monster], freshMetadata);

    expect(uploadPrivateMonsterCatalogue).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ entries: [monster] })
    );
    expect(result.metadata.drive).toMatchObject({ fileId: 'private-monster-file', revisionId: 'revision-1' });
  });

  it('stops when both private catalogues changed before syncing', async () => {
    const remoteData = {
      schemaVersion: 1,
      updatedAt: '2026-07-26T11:00:00.000Z',
      entries: [{ ...monster, name: 'Drive Monster' }]
    };
    vi.mocked(listRemotePrivateMonsterCatalogues).mockResolvedValue([{
      file: { id: 'private-monster-file', name: 'Homebrewry private monster catalogue.homebrewry.json', modifiedTime: '2026-07-26T11:00:00.000Z', headRevisionId: 'revision-2' },
      data: remoteData
    }]);

    const result = await syncPrivateMonsterCatalogue('token', [monster], metadata);

    expect(result.state).toBe('conflict');
    expect(result.metadata.conflict?.remoteEntries[0]?.name).toBe('Drive Monster');
    expect(uploadPrivateMonsterCatalogue).not.toHaveBeenCalled();
  });
});
