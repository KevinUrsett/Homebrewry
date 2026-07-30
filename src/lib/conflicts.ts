import { creationDeviceLabel } from './brewStore';
import type { Brew } from '../types';

const now = () => new Date().toISOString();

export function resolveWithDriveVersion(brew: Brew): Brew {
  if (!brew.conflict || !brew.drive) return brew;
  const remote = brew.conflict.remoteBrew;

  return {
    ...remote,
    id: brew.id,
    drive: {
      ...brew.drive,
      revisionId: brew.conflict.remoteRevisionId,
      lastSyncedAt: now()
    },
    syncState: 'synced',
    conflict: undefined
  };
}

export function keepBothVersions(brew: Brew): Brew[] {
  if (!brew.conflict || !brew.drive) return [brew];
  const remote = resolveWithDriveVersion(brew);
  const localCopy: Brew = {
    ...brew,
    id: crypto.randomUUID(),
    title: `${brew.title || 'Untitled Brew'} (local copy)`,
    createdAt: now(),
    createdOn: creationDeviceLabel(),
    updatedAt: now(),
    version: 1,
    drive: undefined,
    syncState: 'local',
    conflict: undefined
  };

  return [remote, localCopy];
}
