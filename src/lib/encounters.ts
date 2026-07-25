import { dataRecord, dataString } from '../catalogue/presentation';
import type { CatalogueEntry } from '../catalogue/types';
import type { Encounter, EncounterParticipant, PartyMember } from '../types';

const now = () => new Date().toISOString();

function named(value: string, fallback: string): string {
  return value.replace(/[\r\n]/g, ' ').trim() || fallback;
}

function firstNumber(value: string | undefined): number | null {
  const match = value?.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function monsterInitiativeBonus(monster: CatalogueEntry): number {
  const listedBonus = firstNumber(dataString(monster, 'initiativeBonus'));
  if (listedBonus !== null) return listedBonus;

  const dexterity = Number(dataRecord(monster, 'abilities').dex);
  return Number.isFinite(dexterity) ? Math.floor((dexterity - 10) / 2) : 0;
}

export function rollMonsterInitiative(monster: CatalogueEntry, random: () => number = Math.random): number {
  const roll = Math.floor(Math.min(Math.max(random(), 0), 0.999999) * 20) + 1;
  return roll + monsterInitiativeBonus(monster);
}

export function createPartyMember(name = 'New character', armorClass: number | null = null, maxHitPoints: number | null = null): PartyMember {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    name: named(name, 'New character'),
    armorClass,
    maxHitPoints,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function partyMemberToParticipant(member: PartyMember): EncounterParticipant {
  return {
    id: crypto.randomUUID(),
    kind: 'player',
    name: named(member.name, 'Unnamed character'),
    partyMemberId: member.id,
    armorClass: member.armorClass,
    maxHitPoints: member.maxHitPoints,
    currentHitPoints: member.maxHitPoints,
    initiative: null
  };
}

export function createEncounter(name = 'New encounter', party: PartyMember[] = []): Encounter {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    name: named(name, 'New encounter'),
    status: 'prepared',
    participants: party.map(partyMemberToParticipant),
    activeCombatantId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}

export function touchEncounter(encounter: Encounter, updates: Partial<Omit<Encounter, 'id' | 'createdAt'>>): Encounter {
  return {
    ...encounter,
    ...updates,
    updatedAt: now(),
    version: encounter.version + 1
  };
}

export function addPartyMembersToEncounter(encounter: Encounter, party: PartyMember[]): Encounter {
  const included = new Set(encounter.participants.flatMap((participant) => participant.partyMemberId ? [participant.partyMemberId] : []));
  const additions = party.filter((member) => !included.has(member.id)).map(partyMemberToParticipant);
  if (!additions.length) return encounter;
  return touchEncounter(encounter, { participants: [...encounter.participants, ...additions] });
}

export function addMonsterToEncounter(encounter: Encounter, monster: CatalogueEntry, random: () => number = Math.random): Encounter {
  if (monster.category !== 'monster') throw new Error('Only monster catalogue entries can be added to encounters.');
  const duplicateCount = encounter.participants.filter((participant) => participant.source?.id === monster.id).length;
  const maxHitPoints = firstNumber(dataString(monster, 'hp'));
  const participant: EncounterParticipant = {
    id: crypto.randomUUID(),
    kind: 'monster',
    name: duplicateCount ? `${monster.name} ${duplicateCount + 1}` : monster.name,
    source: { category: 'monster', id: monster.id },
    armorClass: firstNumber(dataString(monster, 'ac')),
    maxHitPoints,
    currentHitPoints: maxHitPoints,
    initiative: rollMonsterInitiative(monster, random)
  };
  return touchEncounter(encounter, { participants: [...encounter.participants, participant] });
}

export function patchEncounterParticipant(
  encounter: Encounter,
  participantId: string,
  changes: Partial<Omit<EncounterParticipant, 'id' | 'kind' | 'source' | 'partyMemberId'>>
): Encounter {
  return touchEncounter(encounter, {
    participants: encounter.participants.map((participant) => participant.id === participantId ? { ...participant, ...changes } : participant)
  });
}

/**
 * Applies a signed HP change: positive values are damage and negative values
 * are healing. Current HP stays within 0 and the known maximum.
 */
export function adjustEncounterParticipantHitPoints(encounter: Encounter, participantId: string, change: number): Encounter {
  if (!Number.isFinite(change) || change === 0) return encounter;
  const participant = encounter.participants.find((item) => item.id === participantId);
  if (!participant) return encounter;

  const currentHitPoints = participant.currentHitPoints ?? participant.maxHitPoints;
  if (currentHitPoints === null) return encounter;
  const maximum = participant.maxHitPoints ?? Number.POSITIVE_INFINITY;
  const nextHitPoints = Math.max(0, Math.min(maximum, currentHitPoints - change));
  return patchEncounterParticipant(encounter, participantId, { currentHitPoints: nextHitPoints });
}

export function removeEncounterParticipant(encounter: Encounter, participantId: string): Encounter {
  const participants = encounter.participants.filter((participant) => participant.id !== participantId);
  return touchEncounter(encounter, {
    participants,
    activeCombatantId: encounter.activeCombatantId === participantId ? null : encounter.activeCombatantId
  });
}

export function sortCombatants(participants: EncounterParticipant[]): EncounterParticipant[] {
  return participants
    .map((participant, index) => ({ participant, index }))
    .sort((left, right) => {
      const leftInitiative = left.participant.initiative ?? Number.NEGATIVE_INFINITY;
      const rightInitiative = right.participant.initiative ?? Number.NEGATIVE_INFINITY;
      return rightInitiative - leftInitiative || left.index - right.index;
    })
    .map(({ participant }) => participant);
}

export function advanceCombatTurn(encounter: Encounter): Encounter {
  const ordered = sortCombatants(encounter.participants);
  if (!ordered.length) return encounter;
  const currentIndex = ordered.findIndex((participant) => participant.id === encounter.activeCombatantId);
  const next = ordered[(currentIndex + 1) % ordered.length];
  return touchEncounter(encounter, { activeCombatantId: next.id, status: 'active' });
}
