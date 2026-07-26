import { describe, expect, it } from 'vitest';
import { campaignStoragePresentation } from './campaignStorageStatus';

describe('campaignStoragePresentation', () => {
  it('keeps a known Drive backup visible after the browser session ends', () => {
    expect(campaignStoragePresentation('synced', true)).toMatchObject({
      label: 'Drive backed up',
      tone: 'synced'
    });
  });

  it('does not claim cloud storage before the first campaign backup', () => {
    expect(campaignStoragePresentation('local', false)).toMatchObject({
      label: 'Not yet backed up',
      tone: 'local'
    });
  });

  it('keeps an unsent edit visible even when a Drive file exists', () => {
    expect(campaignStoragePresentation('pending', true)).toMatchObject({
      label: 'Drive sync pending',
      tone: 'pending'
    });
  });
});
