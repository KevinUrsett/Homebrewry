import type { SyncState } from '../types';

export type CampaignStoragePresentation = {
  label: string;
  title: string;
  tone: SyncState;
};

/**
 * Presents the shared campaign-data backup honestly. Google access tokens are
 * intentionally memory-only, so a page reload can require a reconnect even
 * though a versioned Drive backup already exists.
 */
export function campaignStoragePresentation(
  syncState: SyncState,
  hasDriveBackup: boolean
): CampaignStoragePresentation {
  if (syncState === 'conflict') {
    return {
      label: 'Drive conflict',
      title: 'Both this device and the Drive campaign backup changed. Choose how to resolve it before syncing again.',
      tone: 'conflict'
    };
  }

  if (syncState === 'error') {
    return {
      label: hasDriveBackup ? 'Backup error' : 'Backup error',
      title: hasDriveBackup
        ? 'The existing Drive campaign backup could not be refreshed. Reconnect Drive and try again.'
        : 'The campaign data has not yet been backed up to Drive. Reconnect Drive and try again.',
      tone: 'error'
    };
  }

  if (syncState === 'pending') {
    return {
      label: hasDriveBackup ? 'Drive sync pending' : 'Backup pending',
      title: hasDriveBackup
        ? 'This device has changes waiting to be copied to its Drive campaign backup.'
        : 'Campaign data is waiting for its first Google Drive backup.',
      tone: 'pending'
    };
  }

  if (hasDriveBackup || syncState === 'synced') {
    return {
      label: 'Drive backed up',
      title: 'Encounters, party, Worldbuilding, and campaign-owned catalogue records are stored in the versioned Google Drive campaign backup. Reconnect Drive after a page reload to refresh it.',
      tone: 'synced'
    };
  }

  return {
    label: 'Not yet backed up',
    title: 'This campaign data is safe on this device, but it has not yet been copied to Google Drive. Connect Drive to create its campaign backup.',
    tone: 'local'
  };
}
