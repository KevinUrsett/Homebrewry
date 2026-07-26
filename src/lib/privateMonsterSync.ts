import type { CatalogueEntry } from '../catalogue/types';
import type { DriveMetadata, PrivateMonsterSyncMetadata, SyncState } from '../types';
import { createPrivateMonsterCatalogueSnapshot, parsePrivateMonsterCatalogueSnapshot } from './privateMonsterData';
import { listRemotePrivateMonsterCatalogues, uploadPrivateMonsterCatalogue } from './googleDrive';

type DriveFile = { id: string; headRevisionId?: string };

export type PrivateMonsterSyncResult = {
  entries: CatalogueEntry[];
  metadata: PrivateMonsterSyncMetadata;
  state: SyncState;
  detail: string;
};

function now() {
  return new Date().toISOString();
}

function driveMetadata(file: DriveFile, timestamp = now()): DriveMetadata {
  return {
    fileId: file.id,
    revisionId: file.headRevisionId ?? '',
    lastSyncedAt: timestamp
  };
}

function localChanged(metadata: PrivateMonsterSyncMetadata): boolean {
  return !metadata.drive || metadata.syncState === 'pending' || metadata.lastLocalChangeAt > metadata.drive.lastSyncedAt;
}

function asSynced(metadata: PrivateMonsterSyncMetadata, file: DriveFile): PrivateMonsterSyncMetadata {
  const timestamp = now();
  return {
    ...metadata,
    drive: driveMetadata(file, timestamp),
    lastLocalChangeAt: timestamp,
    syncState: 'synced',
    conflict: undefined
  };
}

function withConflict(
  metadata: PrivateMonsterSyncMetadata,
  remoteEntries: CatalogueEntry[],
  file: DriveFile
): PrivateMonsterSyncMetadata {
  return {
    ...metadata,
    drive: {
      fileId: file.id,
      revisionId: metadata.drive?.revisionId ?? '',
      lastSyncedAt: metadata.drive?.lastSyncedAt ?? new Date(0).toISOString()
    },
    syncState: 'conflict',
    conflict: {
      remoteEntries,
      remoteRevisionId: file.headRevisionId ?? ''
    }
  };
}

function conflictResult(entries: CatalogueEntry[], metadata: PrivateMonsterSyncMetadata): PrivateMonsterSyncResult {
  return {
    entries,
    metadata,
    state: 'conflict',
    detail: 'Private monster catalogues changed on both devices. Nothing was overwritten.'
  };
}

/**
 * Syncs imported monsters through a private Drive companion file. The archive
 * remains outside brews, GitHub, and the public bundle, while still being
 * available on the user's other signed-in devices.
 */
export async function syncPrivateMonsterCatalogue(
  accessToken: string,
  entries: CatalogueEntry[],
  metadata: PrivateMonsterSyncMetadata
): Promise<PrivateMonsterSyncResult> {
  if (metadata.conflict) return conflictResult(entries, metadata);

  const remoteFiles = await listRemotePrivateMonsterCatalogues(accessToken);
  if (remoteFiles.length > 1) {
    throw new Error('More than one Homebrewry private monster catalogue exists in Drive. Resolve this before syncing.');
  }

  const remote = remoteFiles[0];
  if (!remote) {
    if (!entries.length && !metadata.drive) {
      return {
        entries,
        metadata: { ...metadata, syncState: 'local' },
        state: 'local',
        detail: 'No private monsters to sync yet'
      };
    }
    const file = await uploadPrivateMonsterCatalogue(accessToken, createPrivateMonsterCatalogueSnapshot(entries));
    const syncedMetadata = asSynced(metadata, file);
    return { entries, metadata: syncedMetadata, state: 'synced', detail: 'Private monster catalogue backed up to Drive' };
  }

  const remoteEntries = parsePrivateMonsterCatalogueSnapshot(remote.data).entries;

  if (!metadata.drive) {
    if (!entries.length) {
      const syncedMetadata = asSynced(metadata, remote.file);
      return { entries: remoteEntries, metadata: syncedMetadata, state: 'synced', detail: 'Private monster catalogue loaded from Drive' };
    }
    return conflictResult(entries, withConflict(metadata, remoteEntries, remote.file));
  }

  if (metadata.drive.fileId !== remote.file.id) {
    if (localChanged(metadata)) return conflictResult(entries, withConflict(metadata, remoteEntries, remote.file));
    const syncedMetadata = asSynced(metadata, remote.file);
    return { entries: remoteEntries, metadata: syncedMetadata, state: 'synced', detail: 'Private monster catalogue loaded from Drive' };
  }

  if (metadata.drive.revisionId !== (remote.file.headRevisionId ?? '')) {
    if (localChanged(metadata)) return conflictResult(entries, withConflict(metadata, remoteEntries, remote.file));
    const syncedMetadata = asSynced(metadata, remote.file);
    return { entries: remoteEntries, metadata: syncedMetadata, state: 'synced', detail: 'Private monster catalogue updated from Drive' };
  }

  if (!localChanged(metadata)) {
    const syncedMetadata = asSynced(metadata, remote.file);
    return { entries, metadata: syncedMetadata, state: 'synced', detail: 'Private monster catalogue is up to date' };
  }

  const file = await uploadPrivateMonsterCatalogue(accessToken, createPrivateMonsterCatalogueSnapshot(entries), metadata.drive, metadata.drive.revisionId);
  const syncedMetadata = asSynced(metadata, file);
  return { entries, metadata: syncedMetadata, state: 'synced', detail: 'Private monster catalogue synced to Drive' };
}

export function keepDrivePrivateMonsterCatalogue(metadata: PrivateMonsterSyncMetadata): PrivateMonsterSyncResult | null {
  if (!metadata.conflict || !metadata.drive) return null;
  const timestamp = now();
  const resolvedMetadata: PrivateMonsterSyncMetadata = {
    ...metadata,
    drive: {
      ...metadata.drive,
      revisionId: metadata.conflict.remoteRevisionId,
      lastSyncedAt: timestamp
    },
    lastLocalChangeAt: timestamp,
    syncState: 'synced',
    conflict: undefined
  };
  return {
    entries: metadata.conflict.remoteEntries,
    metadata: resolvedMetadata,
    state: 'synced',
    detail: 'Kept the Drive private monster catalogue'
  };
}

export async function overwriteDrivePrivateMonsterCatalogue(
  accessToken: string,
  entries: CatalogueEntry[],
  metadata: PrivateMonsterSyncMetadata
): Promise<PrivateMonsterSyncResult> {
  if (!metadata.drive) throw new Error('This device has no Drive private monster catalogue to replace.');
  const file = await uploadPrivateMonsterCatalogue(accessToken, createPrivateMonsterCatalogueSnapshot(entries), metadata.drive);
  const syncedMetadata = asSynced(metadata, file);
  return {
    entries,
    metadata: syncedMetadata,
    state: 'synced',
    detail: 'Drive private monster catalogue replaced with this device copy'
  };
}
