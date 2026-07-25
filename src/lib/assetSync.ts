import { listRemoteAssets, uploadAsset } from './googleDrive';
import type { BrewAsset, SyncState } from '../types';

export type AssetSyncResult = {
  assets: BrewAsset[];
  state: SyncState;
  detail: string;
};

const asSynced = (asset: BrewAsset, file: { id: string; headRevisionId?: string }): BrewAsset => ({
  ...asset,
  drive: {
    fileId: file.id,
    revisionId: file.headRevisionId ?? '',
    lastSyncedAt: new Date().toISOString()
  },
  syncState: 'synced'
});

export async function syncAssets(accessToken: string, assets: BrewAsset[]): Promise<AssetSyncResult> {
  const remoteAssets = await listRemoteAssets(accessToken);
  const remoteById = new Map(remoteAssets.map((remote) => [remote.asset.id, remote]));
  const synced: BrewAsset[] = [];
  let changes = 0;

  for (const asset of assets) {
    const remote = remoteById.get(asset.id);
    if (remote) remoteById.delete(asset.id);

    if (remote && asset.drive?.revisionId === remote.file.headRevisionId) {
      synced.push({ ...asset, syncState: 'synced' });
      continue;
    }
    if (remote && asset.drive) {
      synced.push(remote.asset);
      changes += 1;
      continue;
    }

    const file = await uploadAsset(accessToken, asset);
    synced.push(asSynced(asset, file));
    changes += 1;
  }

  for (const remote of remoteById.values()) {
    synced.push(remote.asset);
    changes += 1;
  }

  return {
    assets: synced,
    state: 'synced',
    detail: changes ? `${changes} image${changes === 1 ? '' : 's'} updated` : 'Images are up to date'
  };
}
