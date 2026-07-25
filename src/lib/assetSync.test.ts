import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrewAsset } from '../types';

vi.mock('./googleDrive', () => ({
  listRemoteAssets: vi.fn(),
  uploadAsset: vi.fn()
}));

import { listRemoteAssets, uploadAsset } from './googleDrive';
import { syncAssets } from './assetSync';

const localAsset: BrewAsset = {
  id: 'asset-id',
  name: 'road.png',
  alt: 'Ashen road',
  mimeType: 'image/png',
  size: 6,
  blob: new Blob(['pixels'], { type: 'image/png' }),
  createdAt: '2026-07-25T10:00:00.000Z',
  updatedAt: '2026-07-25T10:00:00.000Z',
  syncState: 'local'
};

describe('syncAssets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads a new local asset and saves its Drive identity', async () => {
    vi.mocked(listRemoteAssets).mockResolvedValue([]);
    vi.mocked(uploadAsset).mockResolvedValue({ id: 'drive-file', name: 'road.png', modifiedTime: '2026-07-25T10:01:00.000Z', headRevisionId: 'revision-1' });

    const result = await syncAssets('token', [localAsset]);

    expect(uploadAsset).toHaveBeenCalledWith('token', localAsset);
    expect(result.assets[0]).toMatchObject({ syncState: 'synced', drive: { fileId: 'drive-file', revisionId: 'revision-1' } });
  });
});
