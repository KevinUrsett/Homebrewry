import type {
  CampaignDataSnapshot,
  CampaignDataSyncMetadata,
  Encounter,
  EncounterParticipant,
  PartyMember,
  WorldbuildingEntry
} from '../types';
import { worldbuildingKinds } from '../types';
import { isCatalogueCategory, type CustomCatalogueEntry } from '../catalogue/types';

type UnknownRecord = Record<string, unknown>;

const worldbuildingKindSet = new Set<string>(worldbuildingKinds);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Campaign data has an invalid ${field}.`);
  return value;
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Campaign data has an invalid ${field}.`);
  }
  return value;
}

function requiredStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Campaign data has an invalid ${field}.`);
  }
  return value;
}

function parseParticipant(value: unknown): EncounterParticipant {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid combatant.');
  const kind = value.kind;
  if (kind !== 'player' && kind !== 'monster') throw new Error('Campaign data has an invalid combatant kind.');

  let source: EncounterParticipant['source'];
  if (value.source !== undefined) {
    if (!isRecord(value.source) || value.source.category !== 'monster') {
      throw new Error('Campaign data has an invalid combatant source.');
    }
    source = { category: 'monster', id: requiredString(value.source.id, 'combatant source ID') };
  }

  return {
    id: requiredString(value.id, 'combatant ID'),
    kind,
    name: requiredString(value.name, 'combatant name'),
    ...(value.partyMemberId === undefined ? {} : { partyMemberId: requiredString(value.partyMemberId, 'party member ID') }),
    ...(source ? { source } : {}),
    armorClass: nullableNumber(value.armorClass, 'combatant armor class'),
    maxHitPoints: nullableNumber(value.maxHitPoints, 'combatant maximum hit points'),
    currentHitPoints: nullableNumber(value.currentHitPoints, 'combatant current hit points'),
    initiative: nullableNumber(value.initiative, 'combatant initiative')
  };
}

function parseEncounter(value: unknown): Encounter {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid encounter.');
  if (value.status !== 'prepared' && value.status !== 'active' && value.status !== 'complete') {
    throw new Error('Campaign data has an invalid encounter status.');
  }
  if (!Array.isArray(value.participants)) throw new Error('Campaign data has invalid encounter participants.');

  return {
    id: requiredString(value.id, 'encounter ID'),
    name: requiredString(value.name, 'encounter name'),
    status: value.status,
    participants: value.participants.map(parseParticipant),
    activeCombatantId: value.activeCombatantId === null ? null : requiredString(value.activeCombatantId, 'active combatant ID'),
    createdAt: requiredString(value.createdAt, 'encounter creation time'),
    updatedAt: requiredString(value.updatedAt, 'encounter update time'),
    version: nullableNumber(value.version, 'encounter version') ?? 1
  };
}

function parsePartyMember(value: unknown): PartyMember {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid party member.');
  return {
    id: requiredString(value.id, 'party member ID'),
    name: requiredString(value.name, 'party member name'),
    armorClass: nullableNumber(value.armorClass, 'party member armor class'),
    maxHitPoints: nullableNumber(value.maxHitPoints, 'party member maximum hit points'),
    createdAt: requiredString(value.createdAt, 'party member creation time'),
    updatedAt: requiredString(value.updatedAt, 'party member update time')
  };
}

function parseWorldbuildingEntry(value: unknown): WorldbuildingEntry {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid Worldbuilding entry.');
  const kind = requiredString(value.kind, 'Worldbuilding type');
  if (!worldbuildingKindSet.has(kind)) throw new Error('Campaign data has an unsupported Worldbuilding type.');

  return {
    id: requiredString(value.id, 'Worldbuilding entry ID'),
    name: requiredString(value.name, 'Worldbuilding entry name'),
    kind: kind as WorldbuildingEntry['kind'],
    aliases: requiredStringArray(value.aliases, 'Worldbuilding aliases'),
    notes: requiredString(value.notes, 'Worldbuilding notes'),
    createdAt: requiredString(value.createdAt, 'Worldbuilding creation time'),
    updatedAt: requiredString(value.updatedAt, 'Worldbuilding update time'),
    version: nullableNumber(value.version, 'Worldbuilding version') ?? 1
  };
}

function parseCustomCatalogueEntry(value: unknown): CustomCatalogueEntry {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid custom catalogue entry.');
  const category = requiredString(value.category, 'custom catalogue category');
  if (!isCatalogueCategory(category) || value.source !== 'Custom') {
    throw new Error('Campaign data has an invalid custom catalogue entry.');
  }

  return {
    id: requiredString(value.id, 'custom catalogue entry ID'),
    category,
    name: requiredString(value.name, 'custom catalogue entry name'),
    description: requiredString(value.description, 'custom catalogue entry description'),
    data: {},
    source: 'Custom',
    ruleset: 'Homebrewry',
    createdAt: requiredString(value.createdAt, 'custom catalogue entry creation time'),
    updatedAt: requiredString(value.updatedAt, 'custom catalogue entry update time'),
    version: nullableNumber(value.version, 'custom catalogue entry version') ?? 1
  };
}

/** Validates untrusted Drive JSON before it can replace any local campaign records. */
export function parseCampaignDataSnapshot(value: unknown): CampaignDataSnapshot {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) {
    throw new Error('This Drive campaign data file is not a supported Homebrewry backup.');
  }
  if (!Array.isArray(value.encounters) || !Array.isArray(value.partyMembers) || !Array.isArray(value.worldbuildingEntries)) {
    throw new Error('This Drive campaign data file is missing a required collection.');
  }
  if (value.schemaVersion === 2 && !Array.isArray(value.customCatalogueEntries)) {
    throw new Error('This Drive campaign data file has an invalid custom catalogue collection.');
  }

  return {
    schemaVersion: 2,
    updatedAt: requiredString(value.updatedAt, 'campaign update time'),
    encounters: value.encounters.map(parseEncounter),
    partyMembers: value.partyMembers.map(parsePartyMember),
    worldbuildingEntries: value.worldbuildingEntries.map(parseWorldbuildingEntry),
    customCatalogueEntries: value.schemaVersion === 1
      ? []
      : (value.customCatalogueEntries as unknown[]).map(parseCustomCatalogueEntry)
  };
}

export function createCampaignDataSnapshot(
  encounters: Encounter[],
  partyMembers: PartyMember[],
  worldbuildingEntries: WorldbuildingEntry[],
  timestamp = new Date().toISOString(),
  customCatalogueEntries: CustomCatalogueEntry[] = []
): CampaignDataSnapshot {
  return {
    schemaVersion: 2,
    updatedAt: timestamp,
    encounters: [...encounters],
    partyMembers: [...partyMembers],
    worldbuildingEntries: [...worldbuildingEntries],
    customCatalogueEntries: [...customCatalogueEntries]
  };
}

export function hasCampaignData(snapshot: CampaignDataSnapshot): boolean {
  return snapshot.encounters.length > 0
    || snapshot.partyMembers.length > 0
    || snapshot.worldbuildingEntries.length > 0
    || snapshot.customCatalogueEntries.length > 0;
}

export function campaignDataChangedLocally(metadata: CampaignDataSyncMetadata): boolean {
  return !metadata.drive || metadata.syncState === 'pending' || metadata.lastLocalChangeAt > metadata.drive.lastSyncedAt;
}

type NamedRecord = { id: string; name: string; createdAt: string; updatedAt: string; version?: number };

function preserveBothRecords<T extends NamedRecord>(
  local: T[],
  remote: T[],
  timestamp: string,
  createId: () => string
): T[] {
  const output = [...remote];
  const byId = new Map(remote.map((record) => [record.id, record]));

  for (const record of local) {
    const remoteRecord = byId.get(record.id);
    if (!remoteRecord) {
      output.push(record);
      continue;
    }
    if (JSON.stringify(remoteRecord) === JSON.stringify(record)) continue;
    output.push({
      ...record,
      id: createId(),
      name: `${record.name || 'Untitled'} (local copy)`,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(record.version === undefined ? {} : { version: 1 })
    });
  }
  return output;
}

/** Preserves every record when the user explicitly chooses to keep both copies. */
export function keepBothCampaignData(
  local: CampaignDataSnapshot,
  remote: CampaignDataSnapshot,
  timestamp = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID()
): CampaignDataSnapshot {
  return {
    schemaVersion: 2,
    updatedAt: timestamp,
    encounters: preserveBothRecords(local.encounters, remote.encounters, timestamp, createId),
    partyMembers: preserveBothRecords(local.partyMembers, remote.partyMembers, timestamp, createId),
    worldbuildingEntries: preserveBothRecords(local.worldbuildingEntries, remote.worldbuildingEntries, timestamp, createId),
    customCatalogueEntries: preserveBothRecords(local.customCatalogueEntries, remote.customCatalogueEntries, timestamp, createId)
  };
}
