import type { Brew } from '../types';
import { listRemoteBrews, uploadBrew } from './googleDrive';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

function asSynced(brew: Brew, file: { id: string; headRevisionId?: string }): Brew {
  return {
    ...brew,
    drive: {
      fileId: file.id,
      revisionId: file.headRevisionId ?? '',
      lastSyncedAt: new Date().toISOString()
    },
    syncState: 'synced',
    conflict: undefined
  };
}

/**
 * Loads Drive as the source of truth. Brew IDs come from the stored document,
 * rather than being regenerated on every device.
 */
export async function loadBrewsFromDrive(accessToken: string): Promise<Brew[]> {
  const remote = await listRemoteBrews(accessToken);
  const seenFileIds = new Set<string>();
  const loaded: Brew[] = [];

  for (const item of remote) {
    if (seenFileIds.has(item.file.id)) continue;
    seenFileIds.add(item.file.id);
    loaded.push(asSynced({
      ...item.brew,
      id: item.brew.id || item.file.id
    }, item.file));
  }

  return loaded.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveBrewToDrive(accessToken: string, brew: Brew): Promise<Brew> {
  const looksLikeDuplicate = Boolean(
    brew.drive
      && brew.version === 1
      && new Date(brew.createdAt).getTime() > new Date(brew.drive.lastSyncedAt).getTime()
  );
  const candidate: Brew = looksLikeDuplicate
    ? { ...brew, drive: undefined, conflict: undefined, syncState: 'pending' }
    : brew;
  const file = await uploadBrew(accessToken, candidate, candidate.drive?.revisionId);
  return asSynced(candidate, file);
}

export async function deleteBrewFromDrive(accessToken: string, brew: Brew): Promise<void> {
  if (!brew.drive?.fileId) return;
  const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(brew.drive.fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Google Drive deletion failed (${response.status}).`);
  }
}
