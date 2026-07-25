import { describe, expect, it } from 'vitest';
import { keepBothVersions, resolveWithDriveVersion } from './conflicts';
import type { Brew } from '../types';

const conflictBrew: Brew = {
  id: 'local-id',
  title: 'Local title',
  content: '# Local version',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-25T10:00:00.000Z',
  version: 3,
  rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' },
  drive: { fileId: 'drive-id', revisionId: 'old-revision', lastSyncedAt: '2026-07-24T10:00:00.000Z' },
  syncState: 'conflict',
  conflict: {
    remoteRevisionId: 'new-revision',
    remoteBrew: {
      title: 'Drive title',
      content: '# Drive version',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-25T11:00:00.000Z',
      version: 4,
      rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' }
    }
  }
};

describe('conflict resolution', () => {
  it('adopts the Drive document while retaining the local document identity', () => {
    const resolved = resolveWithDriveVersion(conflictBrew);

    expect(resolved).toMatchObject({ id: 'local-id', title: 'Drive title', content: '# Drive version', syncState: 'synced' });
    expect(resolved.drive?.revisionId).toBe('new-revision');
    expect(resolved.conflict).toBeUndefined();
  });

  it('preserves both versions without sharing a Drive file ID', () => {
    const [remote, localCopy] = keepBothVersions(conflictBrew);

    expect(remote.content).toBe('# Drive version');
    expect(localCopy.content).toBe('# Local version');
    expect(localCopy.drive).toBeUndefined();
    expect(localCopy.id).not.toBe(conflictBrew.id);
  });
});
