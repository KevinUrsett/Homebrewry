import type { CampaignDataSnapshot, CampaignDataSyncMetadata, DriveMetadata, SyncState } from '../types';
import { campaignDataChangedLocally, hasCampaignData, keepBothCampaignData, parseCampaignDataSnapshot } from './campaignData';
import { listRemoteCampaignData, uploadCampaignData } from './googleDrive';

type DriveFile = { id: string; headRevisionId?: string };

export type CampaignDataSyncResult = {
  data: CampaignDataSnapshot;
  metadata: CampaignDataSyncMetadata;
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

function asSynced(metadata: CampaignDataSyncMetadata, file: DriveFile): CampaignDataSyncMetadata {
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
  metadata: CampaignDataSyncMetadata,
  remoteData: CampaignDataSnapshot,
  file: DriveFile
): CampaignDataSyncMetadata {
  return {
    ...metadata,
    drive: {
      fileId: file.id,
      revisionId: metadata.drive?.revisionId ?? '',
      lastSyncedAt: metadata.drive?.lastSyncedAt ?? new Date(0).toISOString()
    },
    syncState: 'conflict',
    conflict: {
      remoteData,
      remoteRevisionId: file.headRevisionId ?? ''
    }
  };
}

function conflictResult(data: CampaignDataSnapshot, metadata: CampaignDataSyncMetadata): CampaignDataSyncResult {
  return {
    data,
    metadata,
    state: 'conflict',
    detail: 'Campaign data changed on both devices. Nothing was overwritten.'
  };
}

/**
 * Syncs the one versioned campaign-data companion file. The function never
 * merges conflicting records silently; callers must ask the user to decide.
 */
export async function syncCampaignData(
  accessToken: string,
  data: CampaignDataSnapshot,
  metadata: CampaignDataSyncMetadata
): Promise<CampaignDataSyncResult> {
  if (metadata.conflict) return conflictResult(data, metadata);

  const remoteFiles = await listRemoteCampaignData(accessToken);
  if (remoteFiles.length > 1) {
    throw new Error('More than one Homebrewry campaign data file exists in Drive. Resolve this before syncing.');
  }

  const remote = remoteFiles[0];
  if (!remote) {
    if (!hasCampaignData(data) && !metadata.drive) {
      return {
        data,
        metadata: { ...metadata, syncState: 'local' },
        state: 'local',
        detail: 'No campaign data to sync yet'
      };
    }
    const file = await uploadCampaignData(accessToken, data);
    const syncedMetadata = asSynced(metadata, file);
    return { data, metadata: syncedMetadata, state: 'synced', detail: 'Campaign data backed up to Drive' };
  }

  const remoteData = parseCampaignDataSnapshot(remote.data);
  const localChanged = campaignDataChangedLocally(metadata);

  if (!metadata.drive) {
    if (!hasCampaignData(data)) {
      const syncedMetadata = asSynced(metadata, remote.file);
      return { data: remoteData, metadata: syncedMetadata, state: 'synced', detail: 'Campaign data loaded from Drive' };
    }
    return conflictResult(data, withConflict(metadata, remoteData, remote.file));
  }

  if (metadata.drive.fileId !== remote.file.id) {
    if (localChanged) return conflictResult(data, withConflict(metadata, remoteData, remote.file));
    const syncedMetadata = asSynced(metadata, remote.file);
    return { data: remoteData, metadata: syncedMetadata, state: 'synced', detail: 'Campaign data loaded from Drive' };
  }

  if (metadata.drive.revisionId !== (remote.file.headRevisionId ?? '')) {
    if (localChanged) return conflictResult(data, withConflict(metadata, remoteData, remote.file));
    const syncedMetadata = asSynced(metadata, remote.file);
    return { data: remoteData, metadata: syncedMetadata, state: 'synced', detail: 'Campaign data updated from Drive' };
  }

  if (!localChanged) {
    const syncedMetadata = asSynced(metadata, remote.file);
    return { data, metadata: syncedMetadata, state: 'synced', detail: 'Campaign data is up to date' };
  }

  const file = await uploadCampaignData(accessToken, data, metadata.drive, metadata.drive.revisionId);
  const syncedMetadata = asSynced(metadata, file);
  return { data, metadata: syncedMetadata, state: 'synced', detail: 'Campaign data synced to Drive' };
}

export function keepDriveCampaignData(metadata: CampaignDataSyncMetadata): CampaignDataSyncResult | null {
  if (!metadata.conflict || !metadata.drive) return null;
  const timestamp = now();
  const resolvedMetadata: CampaignDataSyncMetadata = {
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
    data: metadata.conflict.remoteData,
    metadata: resolvedMetadata,
    state: 'synced',
    detail: 'Kept the Drive campaign data'
  };
}

export function keepBothCampaignDataVersions(
  local: CampaignDataSnapshot,
  metadata: CampaignDataSyncMetadata
): CampaignDataSyncResult | null {
  if (!metadata.conflict || !metadata.drive) return null;
  const timestamp = now();
  const data = keepBothCampaignData(local, metadata.conflict.remoteData, timestamp);
  const resolvedMetadata: CampaignDataSyncMetadata = {
    ...metadata,
    drive: {
      ...metadata.drive,
      revisionId: metadata.conflict.remoteRevisionId,
      lastSyncedAt: timestamp
    },
    // Mark the merged result as a deliberate new local change.
    lastLocalChangeAt: new Date(Date.now() + 1).toISOString(),
    syncState: 'pending',
    conflict: undefined
  };
  return { data, metadata: resolvedMetadata, state: 'pending', detail: 'Kept both campaign-data copies locally' };
}

export async function overwriteDriveCampaignData(
  accessToken: string,
  data: CampaignDataSnapshot,
  metadata: CampaignDataSyncMetadata
): Promise<CampaignDataSyncResult> {
  if (!metadata.drive) throw new Error('This device has no Drive campaign data to replace.');
  const file = await uploadCampaignData(accessToken, data, metadata.drive);
  const syncedMetadata = asSynced(metadata, file);
  return { data, metadata: syncedMetadata, state: 'synced', detail: 'Drive campaign data replaced with this device copy' };
}
