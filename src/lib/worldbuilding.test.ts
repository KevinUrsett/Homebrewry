import { describe, expect, it } from 'vitest';
import { createWorldbuildingEntry, normalizeWorldbuildingName, touchWorldbuildingEntry } from './worldbuilding';

describe('worldbuilding records', () => {
  it('normalizes selected source text into a safe entry name', () => {
    expect(normalizeWorldbuildingName('  **Talon\nBloodwing**  ')).toBe('Talon Bloodwing');
  });

  it('keeps entry records versioned and removes duplicate aliases', () => {
    const entry = createWorldbuildingEntry('Sund', 'town');
    const updated = touchWorldbuildingEntry(entry, { aliases: ['City of Worship', 'city of worship', 'Old Sund'] });

    expect(updated).toMatchObject({ name: 'Sund', kind: 'town', aliases: ['City of Worship', 'Old Sund'], version: 2 });
  });
});
