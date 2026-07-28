import { describe, expect, it } from 'vitest';
import {
  addMonsterToEncounter,
  addNpcToEncounter,
  adjustEncounterParticipantHitPoints,
  advanceCombatTurn,
  createEncounter,
  createPartyMember,
  moveEncounterParticipant,
  reorderEncounterParticipants,
  rollMonsterInitiative,
  sortCombatants
} from './encounters';
import type { CatalogueEntry } from '../catalogue/types';
import type { CampaignEntity } from '../types';

const aboleth: CatalogueEntry = {
  id: 'c674b91f-94c8-5c80-9d1d-31bef50bc779',
  category: 'monster',
  name: 'Aboleth',
  description: '',
  data: { ac: '17 (Natural Armor)', hp: '135 (18d10 + 36)', initiativeBonus: 7 },
  source: 'SRD-521',
  ruleset: '5.5e'
};
const talon: CampaignEntity = {
  id: 'worldbuilding:talon',
  campaignId: 'campaign-1',
  kind: 'npc',
  name: 'Talon Bloodwing',
  aliases: ['Talon'],
  source: { kind: 'worldbuilding', id: 'talon' },
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
  version: 1
};

const initiativeParticipants = [
  { id: 'a', kind: 'player' as const, name: 'A', armorClass: null, maxHitPoints: null, currentHitPoints: null, initiative: 12 },
  { id: 'b', kind: 'monster' as const, name: 'B', armorClass: null, maxHitPoints: null, currentHitPoints: null, initiative: 18 },
  { id: 'c', kind: 'monster' as const, name: 'C', armorClass: null, maxHitPoints: null, currentHitPoints: null, initiative: 12 }
];

describe('encounter logic', () => {
  it('snapshots the current party into a new encounter', () => {
    const party = [createPartyMember('Rook', 16, 42)];
    const encounter = createEncounter('Bridge ambush', party);

    expect(encounter.name).toBe('Bridge ambush');
    expect(encounter.participants).toEqual([expect.objectContaining({
      kind: 'player',
      name: 'Rook',
      armorClass: 16,
      maxHitPoints: 42,
      currentHitPoints: 42,
      initiative: null,
      partyMemberId: party[0].id
    })]);
  });

  it('adds independently trackable monster copies from the catalogue', () => {
    const encounter = createEncounter('Depths');
    const withFirst = addMonsterToEncounter(encounter, aboleth, () => 0);
    const withSecond = addMonsterToEncounter(withFirst, aboleth, () => 0);

    expect(withSecond.participants.map((participant) => participant.name)).toEqual(['Aboleth', 'Aboleth 2']);
    expect(withSecond.participants[0]).toMatchObject({ armorClass: 17, maxHitPoints: 135, currentHitPoints: 135, initiative: 8 });
    expect(rollMonsterInitiative(aboleth, () => 0.45)).toBe(17);
  });

  it('links a confirmed NPC entity to one stable encounter participant', () => {
    const encounter = createEncounter('North Tower');
    const linked = addNpcToEncounter(encounter, talon);

    expect(linked.participants).toEqual([
      expect.objectContaining({ kind: 'npc', name: 'Talon Bloodwing', entityId: talon.id })
    ]);
    expect(addNpcToEncounter(linked, talon)).toBe(linked);
  });

  it('orders initiative descending and advances through a stable turn order', () => {
    const encounter = createEncounter('Initiative');
    const prepared = { ...encounter, participants: initiativeParticipants };

    expect(sortCombatants(prepared.participants).map((participant) => participant.id)).toEqual(['b', 'a', 'c']);
    expect(advanceCombatTurn(prepared).activeCombatantId).toBe('b');
    expect(advanceCombatTurn({ ...prepared, activeCombatantId: 'b' }).activeCombatantId).toBe('a');
  });

  it('applies signed damage and healing without exceeding known HP bounds', () => {
    const encounter = createEncounter('Hit points', [createPartyMember('Rook', 16, 42)]);
    const participant = encounter.participants[0];
    const damaged = adjustEncounterParticipantHitPoints(encounter, participant.id, 15);
    const healed = adjustEncounterParticipantHitPoints(damaged, participant.id, -99);
    const defeated = adjustEncounterParticipantHitPoints(healed, participant.id, 99);

    expect(damaged.participants[0].currentHitPoints).toBe(27);
    expect(healed.participants[0].currentHitPoints).toBe(42);
    expect(defeated.participants[0].currentHitPoints).toBe(0);
  });

  it('reorders combatants and recalculates descending initiative values', () => {
    const encounter = { ...createEncounter('Manual order'), participants: initiativeParticipants };
    const reordered = reorderEncounterParticipants(encounter, ['c', 'b', 'a']);

    expect(reordered.participants.map((participant) => participant.id)).toEqual(['c', 'b', 'a']);
    expect(reordered.participants.map((participant) => participant.initiative)).toEqual([18, 17, 16]);
    expect(sortCombatants(reordered.participants).map((participant) => participant.id)).toEqual(['c', 'b', 'a']);
  });

  it('ignores duplicate and unknown reorder IDs and appends omitted combatants', () => {
    const encounter = { ...createEncounter('Safe order'), participants: initiativeParticipants };
    const reordered = reorderEncounterParticipants(encounter, ['c', 'missing', 'c']);

    expect(reordered.participants.map((participant) => participant.id)).toEqual(['c', 'a', 'b']);
    expect(reordered.participants.map((participant) => participant.initiative)).toEqual([18, 17, 16]);
  });

  it('moves a combatant through the currently sorted initiative order', () => {
    const encounter = { ...createEncounter('Keyboard order'), participants: initiativeParticipants };
    const movedUp = moveEncounterParticipant(encounter, 'c', -1);
    const movedDown = moveEncounterParticipant(movedUp, 'b', 1);

    expect(sortCombatants(movedUp.participants).map((participant) => participant.id)).toEqual(['b', 'c', 'a']);
    expect(sortCombatants(movedDown.participants).map((participant) => participant.id)).toEqual(['c', 'b', 'a']);
  });

  it('leaves boundary keyboard moves unchanged', () => {
    const encounter = { ...createEncounter('Keyboard boundary'), participants: initiativeParticipants };

    expect(moveEncounterParticipant(encounter, 'b', -1)).toBe(encounter);
    expect(moveEncounterParticipant(encounter, 'c', 1)).toBe(encounter);
  });
});
