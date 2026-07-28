import { describe, expect, it } from 'vitest';
import type { Brew, Encounter, WorldbuildingEntry } from '../types';
import { findWorldbuildingConnections } from './worldbuildingConnections';

const entry: WorldbuildingEntry = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Sund',
  kind: 'town',
  aliases: ['City of Worship'],
  notes: '',
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
  version: 1
};
const brew: Brew = {
  id: 'brew-1',
  title: 'Plots of Unwritten Tomes',
  content: `The party returns to Sund.\n[[world:${entry.id}|Sund]]\n\`Sund\``,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  version: 1,
  rendererSettings: { accentColor: '#000', parchmentTone: 'warm' }
};
const encounter: Encounter = {
  id: 'encounter-1',
  name: 'Ambush outside Sund',
  status: 'not-started',
  optional: false,
  participants: [],
  activeCombatantId: null,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  version: 1
};

describe('Worldbuilding connections', () => {
  it('derives explicit references and plain mentions without treating code as a connection', () => {
    const related = { ...entry, id: 'related', name: 'Talon', notes: 'Talon departed the City of Worship.' };
    expect(findWorldbuildingConnections(entry, [brew], [encounter], [entry, related])).toEqual([
      { kind: 'brew', id: brew.id, label: brew.title, count: 2 },
      { kind: 'encounter', id: encounter.id, label: encounter.name, count: 1 },
      { kind: 'worldbuilding', id: related.id, label: related.name, count: 1, direction: 'incoming' }
    ]);
  });

  it('shows a Worldbuilding relationship from both entries when only one mentions the other', () => {
    const talon = { ...entry, id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Talon', notes: 'Talon came from Sund.' };
    const sund = { ...entry, notes: '' };

    expect(findWorldbuildingConnections(talon, [], [], [talon, sund])).toEqual([
      { kind: 'worldbuilding', id: sund.id, label: sund.name, count: 1, direction: 'outgoing' }
    ]);
    expect(findWorldbuildingConnections(sund, [], [], [talon, sund])).toEqual([
      { kind: 'worldbuilding', id: talon.id, label: talon.name, count: 1, direction: 'incoming' }
    ]);
  });

  it('never creates state or connections from partial word matches', () => {
    expect(findWorldbuildingConnections(entry, [{ ...brew, content: 'Sunday' }], [], [entry])).toEqual([]);
  });
});
