import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Brew } from '../types';

vi.mock('./googleDrive', () => ({
  DriveConflictError: class DriveConflictError extends Error {},
  listRemoteBrews: vi.fn(),
  uploadBrew: vi.fn()
}));

import { listRemoteBrews, uploadBrew } from './googleDrive';
import { syncBrews } from './sync';

const localBrew: Brew = {
  id: 'local-id',
  title: 'Ashen Road',
  content: '# Local',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-24T10:00:00.000Z',
  version: 2,
  rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' },
  drive: {
    fileId: 'drive-id',
    revisionId: 'revision-1',
    lastSyncedAt: '2026-07-23T10:00:00.000Z'
  },
  syncState: 'pending'
};

describe('syncBrews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks simultaneous local and remote edits as a conflict without uploading', async () => {
    vi.mocked(listRemoteBrews).mockResolvedValue([{
      file: { id: 'drive-id', name: 'Ashen Road.homebrewry.json', modifiedTime: '2026-07-25T10:00:00.000Z', headRevisionId: 'revision-2' },
      brew: { ...localBrew, content: '# Remote' }
    }]);

    const result = await syncBrews('token', [localBrew]);

    expect(result.state).toBe('conflict');
    expect(result.brews[0].syncState).toBe('conflict');
    expect(uploadBrew).not.toHaveBeenCalled();
  });

  it('downloads a remote change when the local copy is unchanged since its last sync', async () => {
    const unchangedLocal = { ...localBrew, updatedAt: '2026-07-22T10:00:00.000Z' };
    vi.mocked(listRemoteBrews).mockResolvedValue([{
      file: { id: 'drive-id', name: 'Ashen Road.homebrewry.json', modifiedTime: '2026-07-25T10:00:00.000Z', headRevisionId: 'revision-2' },
      brew: { ...localBrew, content: '# Remote' }
    }]);

    const result = await syncBrews('token', [unchangedLocal]);

    expect(result.state).toBe('synced');
    expect(result.brews[0]).toMatchObject({ id: 'local-id', content: '# Remote', syncState: 'synced' });
    expect(uploadBrew).not.toHaveBeenCalled();
  });
});
