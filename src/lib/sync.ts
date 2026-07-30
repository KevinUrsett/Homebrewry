import { listRemoteBrews, DriveConflictError, uploadBrew } from './googleDrive';
import type { Brew, SyncState } from '../types';

export type SyncResult = {
  brews: Brew[];
  state: SyncState;
  detail: string;
};

const asSynced = (brew: Brew, file: { id: string; headRevisionId?: string }): Brew => ({
  ...brew,
  drive: {
    fileId: file.id,
    revisionId: file.headRevisionId ?? '',
    lastSyncedAt: new Date().toISOString()
  },
  syncState: 'synced',
  conflict: undefined
});

const withConflict = (local: Brew, remote: { brew: Brew; file: { headRevisionId?: string } }): Brew => ({
  ...local,
  syncState: 'conflict',
  conflict: {
    remoteBrew: {
      title: remote.brew.title,
      content: remote.brew.content,
      createdAt: remote.brew.createdAt,
      createdOn: remote.brew.createdOn,
      updatedAt: remote.brew.updatedAt,
      version: remote.brew.version,
      rendererSettings: remote.brew.rendererSettings
    },
    remoteRevisionId: remote.file.headRevisionId ?? ''
  }
});

export async function syncBrews(accessToken: string, brews: Brew[]): Promise<SyncResult> {
  const remoteBrews = await listRemoteBrews(accessToken);
  const remoteById = new Map(remoteBrews.map((remote) => [remote.file.id, remote]));
  const synced: Brew[] = [];
  let conflicts = 0;
  let changes = 0;

  for (const local of brews) {
    const remote = local.drive ? remoteById.get(local.drive.fileId) : undefined;
    if (remote) remoteById.delete(remote.file.id);

    if (remote && local.drive && remote.file.headRevisionId !== local.drive.revisionId) {
      const localChanged = local.updatedAt > local.drive.lastSyncedAt;
      if (localChanged) {
        synced.push(withConflict(local, remote));
        conflicts += 1;
        continue;
      }
      synced.push(asSynced({ ...remote.brew, id: local.id }, remote.file));
      changes += 1;
      continue;
    }

    try {
      const file = await uploadBrew(accessToken, local, local.drive?.revisionId);
      synced.push(asSynced(local, file));
      changes += 1;
    } catch (error) {
      if (error instanceof DriveConflictError) {
        const latest = local.drive ? remoteById.get(local.drive.fileId) : undefined;
        synced.push(latest ? withConflict(local, latest) : { ...local, syncState: 'error' });
        conflicts += 1;
      } else {
        throw error;
      }
    }
  }

  for (const remote of remoteById.values()) {
    const imported: Brew = {
      ...remote.brew,
      id: crypto.randomUUID(),
      drive: {
        fileId: remote.file.id,
        revisionId: remote.file.headRevisionId ?? '',
        lastSyncedAt: new Date().toISOString()
      },
      syncState: 'synced'
    };
    synced.push(imported);
    changes += 1;
  }

  if (conflicts) return { brews: synced, state: 'conflict', detail: `${conflicts} sync conflict${conflicts === 1 ? '' : 's'} need attention` };
  return { brews: synced, state: 'synced', detail: changes ? `Drive synced (${changes} updated)` : 'Drive is up to date' };
}

export async function overwriteDriveBrew(accessToken: string, brew: Brew): Promise<Brew> {
  if (!brew.drive) throw new Error('This brew has no Drive copy to overwrite.');
  const file = await uploadBrew(accessToken, brew);
  return asSynced(brew, file);
}
