import { describe, expect, it } from 'vitest';
import { createWorldbuildingEntry, createWorldbuildingType, findWorldbuildingEntryByName, normalizeWorldbuildingName, touchWorldbuildingEntry, worldbuildingKindLabel } from './worldbuilding';

describe('worldbuilding records', () => {
  it('normalizes selected source text into a safe entry name', () => {
    expect(normalizeWorldbuildingName('  **Talon\nBloodwing**  ')).toBe('Talon Bloodwing');
  });

  it('keeps entry records versioned and removes duplicate aliases', () => {
    const entry = createWorldbuildingEntry('Sund', 'town');
    const updated = touchWorldbuildingEntry(entry, { aliases: ['City of Worship', 'city of worship', 'Old Sund'] });

    expect(updated).toMatchObject({ name: 'Sund', kind: 'town', aliases: ['City of Worship', 'Old Sund'], version: 2 });
  });

  it('supports custom types and reuses a matching name or alias for links', () => {
    const type = createWorldbuildingType('Deity', '2026-07-26T12:00:00.000Z', 'deity');
    const entry = { ...createWorldbuildingEntry('The Lantern Queen', type.id), aliases: ['Lady of Lanterns'] };

    expect(worldbuildingKindLabel(type.id, [type])).toBe('Deity');
    expect(findWorldbuildingEntryByName([entry], 'lady of lanterns')).toBe(entry);
  });

  it('keeps NPC as a built-in Worldbuilding type', () => {
    expect(worldbuildingKindLabel('npc')).toBe('NPC');
  });
});
