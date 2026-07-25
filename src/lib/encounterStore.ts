import type { Encounter, PartyMember } from '../types';
import { ENCOUNTER_STORE_NAME, getDatabase, PARTY_STORE_NAME } from './brewStore';

export async function listEncounters(): Promise<Encounter[]> {
  const database = await getDatabase();
  const encounters = await database.getAll(ENCOUNTER_STORE_NAME) as Encounter[];
  return encounters.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveEncounter(encounter: Encounter): Promise<void> {
  const database = await getDatabase();
  await database.put(ENCOUNTER_STORE_NAME, encounter);
}

export async function deleteEncounter(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(ENCOUNTER_STORE_NAME, id);
}

export async function listPartyMembers(): Promise<PartyMember[]> {
  const database = await getDatabase();
  const members = await database.getAll(PARTY_STORE_NAME) as PartyMember[];
  return members.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function savePartyMember(member: PartyMember): Promise<void> {
  const database = await getDatabase();
  await database.put(PARTY_STORE_NAME, member);
}

export async function deletePartyMember(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(PARTY_STORE_NAME, id);
}
