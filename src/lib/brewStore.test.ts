import { describe, expect, it } from 'vitest';
import { createBrew } from './brewStore';

describe('createBrew', () => {
  it('creates a versioned local brew with renderer settings', () => {
    const brew = createBrew('Road Notes');

    expect(brew.title).toBe('Road Notes');
    expect(brew.version).toBe(1);
    expect(brew.id).toBeTruthy();
    expect(brew.rendererSettings.parchmentTone).toBe('warm');
  });
});
