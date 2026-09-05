/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import { beginLocalDatabaseRecovery, createBrew, isRecoverableLocalDatabaseError, rollbackLocalDatabaseRecovery } from './brewStore';

afterEach(() => localStorage.clear());

describe('createBrew', () => {
  it('creates a versioned local brew with renderer settings', () => {
    const brew = createBrew('Road Notes');

    expect(brew.title).toBe('Road Notes');
    expect(brew.version).toBe(1);
    expect(brew.id).toBeTruthy();
    expect(brew.rendererSettings.parchmentTone).toBe('warm');
  });
});

describe('local database recovery', () => {
  it('recognises only the browser storage error reported by Firefox', () => {
    expect(isRecoverableLocalDatabaseError({ name: 'UnknownError' })).toBe(true);
    expect(isRecoverableLocalDatabaseError({ name: 'QuotaExceededError' })).toBe(false);
    expect(isRecoverableLocalDatabaseError(new Error('Drive failed'))).toBe(false);
  });

  it('uses a new cache name without deleting the unreadable database', () => {
    const recovery = beginLocalDatabaseRecovery();

    expect(recovery.previousName).toBe('homebrewry');
    expect(recovery.recoveryName).toMatch(/^homebrewry-recovered-/);
    expect(localStorage.getItem('homebrewry-active-local-database')).toBe(recovery.recoveryName);

    rollbackLocalDatabaseRecovery(recovery);
    expect(localStorage.getItem('homebrewry-active-local-database')).toBeNull();
  });
});
