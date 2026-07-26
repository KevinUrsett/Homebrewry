import type {
  CampaignDataSnapshot,
  CampaignDataSyncMetadata,
  Encounter,
  EncounterParticipant,
  PartyMember,
  WorldbuildingEntry,
  WorldbuildingType
} from '../types';
import { worldbuildingKinds } from '../types';
import { isCatalogueCategory, type CustomCatalogueCategory, type CustomCatalogueEntry } from '../catalogue/types';
import { normaliseCustomCatalogueEntry } from '../catalogue/customEntries';

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

function isSafeTaxonomyId(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,179}$/.test(value);
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
  if (!worldbuildingKindSet.has(kind) && !isSafeTaxonomyId(kind)) {
    throw new Error('Campaign data has an unsupported Worldbuilding type.');
  }

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

function parseWorldbuildingType(value: unknown): WorldbuildingType {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid Worldbuilding type.');
  const id = requiredString(value.id, 'Worldbuilding type ID');
  const name = requiredString(value.name, 'Worldbuilding type name').trim();
  const createdAt = requiredString(value.createdAt, 'Worldbuilding type creation time');
  const updatedAt = requiredString(value.updatedAt, 'Worldbuilding type update time');
  const version = value.version;
  if (!isSafeTaxonomyId(id) || !name || name.length > 180 || typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('Campaign data has an invalid Worldbuilding type.');
  }
  return { id, name, createdAt, updatedAt, version };
}

function parseCustomCatalogueCategory(value: unknown): CustomCatalogueCategory {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid catalogue category.');
  const id = requiredString(value.id, 'catalogue category ID');
  const name = requiredString(value.name, 'catalogue category name').trim();
  const createdAt = requiredString(value.createdAt, 'catalogue category creation time');
  const updatedAt = requiredString(value.updatedAt, 'catalogue category update time');
  const version = value.version;
  if (!isCatalogueCategory(id) || !name || name.length > 80 || typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('Campaign data has an invalid catalogue category.');
  }
  return { id, name, createdAt, updatedAt, version };
}

function parseCustomCatalogueEntry(value: unknown, preserveStructuredData: boolean): CustomCatalogueEntry {
  try {
    return normaliseCustomCatalogueEntry(value, { preserveStructuredData });
  } catch {
    throw new Error('Campaign data has an invalid custom catalogue entry.');
  }
}

/** Validates untrusted Drive JSON before it can replace any local campaign records. */
export function parseCampaignDataSnapshot(value: unknown): CampaignDataSnapshot {
  if (!isRecord(value)) {
    throw new Error('This Drive campaign data file is not a supported Homebrewry backup.');
  }
  const schemaVersion = value.schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2 && schemaVersion !== 3 && schemaVersion !== 4) {
    throw new Error('This Drive campaign data file is not a supported Homebrewry backup.');
  }
  if (!Array.isArray(value.encounters) || !Array.isArray(value.partyMembers) || !Array.isArray(value.worldbuildingEntries)) {
    throw new Error('This Drive campaign data file is not a supported Homebrewry backup: missing a required collection.');
  }
  if ((schemaVersion === 2 || schemaVersion === 3) && !Array.isArray(value.customCatalogueEntries)) {
    throw new Error('This Drive campaign data file has an invalid custom catalogue collection.');
  }
  if (schemaVersion === 4 && (!Array.isArray(value.customCatalogueEntries) || !Array.isArray(value.customCatalogueCategories) || !Array.isArray(value.worldbuildingTypes))) {
    throw new Error('This Drive campaign data file has an invalid campaign taxonomy collection.');
  }

  return {
    schemaVersion: 4,
    updatedAt: requiredString(value.updatedAt, 'campaign update time'),
    encounters: value.encounters.map(parseEncounter),
    partyMembers: value.partyMembers.map(parsePartyMember),
    worldbuildingEntries: value.worldbuildingEntries.map(parseWorldbuildingEntry),
    customCatalogueEntries: schemaVersion === 1
      ? []
      : (value.customCatalogueEntries as unknown[]).map((entry) => parseCustomCatalogueEntry(entry, schemaVersion >= 3)),
    customCatalogueCategories: schemaVersion === 4
      ? (value.customCatalogueCategories as unknown[]).map(parseCustomCatalogueCategory)
      : [],
    worldbuildingTypes: schemaVersion === 4
      ? (value.worldbuildingTypes as unknown[]).map(parseWorldbuildingType)
      : []
  };
}

export function createCampaignDataSnapshot(
  encounters: Encounter[],
  partyMembers: PartyMember[],
  worldbuildingEntries: WorldbuildingEntry[],
  timestamp = new Date().toISOString(),
  customCatalogueEntries: CustomCatalogueEntry[] = [],
  customCatalogueCategories: CustomCatalogueCategory[] = [],
  worldbuildingTypes: WorldbuildingType[] = []
): CampaignDataSnapshot {
  return {
    schemaVersion: 4,
    updatedAt: timestamp,
    encounters: [...encounters],
    partyMembers: [...partyMembers],
    worldbuildingEntries: [...worldbuildingEntries],
    customCatalogueEntries: [...customCatalogueEntries],
    customCatalogueCategories: [...customCatalogueCategories],
    worldbuildingTypes: [...worldbuildingTypes]
  };
}

export function hasCampaignData(snapshot: CampaignDataSnapshot): boolean {
  return snapshot.encounters.length > 0
    || snapshot.partyMembers.length > 0
    || snapshot.worldbuildingEntries.length > 0
    || snapshot.customCatalogueEntries.length > 0
    || snapshot.customCatalogueCategories.length > 0
    || snapshot.worldbuildingTypes.length > 0;
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
    schemaVersion: 4,
    updatedAt: timestamp,
    encounters: preserveBothRecords(local.encounters, remote.encounters, timestamp, createId),
    partyMembers: preserveBothRecords(local.partyMembers, remote.partyMembers, timestamp, createId),
    worldbuildingEntries: preserveBothRecords(local.worldbuildingEntries, remote.worldbuildingEntries, timestamp, createId),
    customCatalogueEntries: preserveBothRecords(local.customCatalogueEntries, remote.customCatalogueEntries, timestamp, createId),
    customCatalogueCategories: preserveBothRecords(local.customCatalogueCategories, remote.customCatalogueCategories, timestamp, createId),
    worldbuildingTypes: preserveBothRecords(local.worldbuildingTypes, remote.worldbuildingTypes, timestamp, createId)
  };
}
