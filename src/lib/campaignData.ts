import type {
  Brew,
  CampaignDataSnapshot,
  CampaignDataSyncMetadata,
  CampaignEntity,
  EntityReference,
  Encounter,
  IdeaDraft,
  EncounterParticipant,
  PartyMember,
  TimelineEntry,
  WorldbuildingEntry,
  WorldbuildingType,
  WorldEvent
} from '../types';
import { worldbuildingKinds } from '../types';
import { isCatalogueCategory, type CustomCatalogueCategory, type CustomCatalogueEntry } from '../catalogue/types';
import { normaliseCustomCatalogueEntry } from '../catalogue/customEntries';
import { isBelentorDate } from './belentorCalendar';
import { synchroniseEntityReferences, synchroniseWorldbuildingEntities } from './livingWorld';

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
  if (kind !== 'player' && kind !== 'monster' && kind !== 'npc') throw new Error('Campaign data has an invalid combatant kind.');

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
    ...(value.entityId === undefined ? {} : { entityId: requiredString(value.entityId, 'combatant entity ID') }),
    ...(value.availabilityOverride === 'flashback' || value.availabilityOverride === 'temporary' ? { availabilityOverride: value.availabilityOverride } : {}),
    ...(source ? { source } : {}),
    armorClass: nullableNumber(value.armorClass, 'combatant armor class'),
    maxHitPoints: nullableNumber(value.maxHitPoints, 'combatant maximum hit points'),
    currentHitPoints: nullableNumber(value.currentHitPoints, 'combatant current hit points'),
    initiative: nullableNumber(value.initiative, 'combatant initiative')
  };
}

function parseEncounter(value: unknown): Encounter {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid encounter.');
  const legacyStatus = value.status;
  const status = legacyStatus === 'prepared' ? 'not-started' : legacyStatus === 'complete' ? 'completed' : legacyStatus;
  if (status !== 'not-started' && status !== 'active' && status !== 'completed' && status !== 'skipped') {
    throw new Error('Campaign data has an invalid encounter status.');
  }
  if (!Array.isArray(value.participants)) throw new Error('Campaign data has invalid encounter participants.');

  return {
    id: requiredString(value.id, 'encounter ID'),
    name: requiredString(value.name, 'encounter name'),
    status,
    optional: value.optional === true,
    participants: value.participants.map(parseParticipant),
    activeCombatantId: value.activeCombatantId === null ? null : requiredString(value.activeCombatantId, 'active combatant ID'),
    createdAt: requiredString(value.createdAt, 'encounter creation time'),
    updatedAt: requiredString(value.updatedAt, 'encounter update time'),
    version: nullableNumber(value.version, 'encounter version') ?? 1
  };
}

function legacyCampaignId(value: UnknownRecord): string {
  const ids = [
    ...(Array.isArray(value.encounters) ? value.encounters : []),
    ...(Array.isArray(value.worldbuildingEntries) ? value.worldbuildingEntries : [])
  ].flatMap((record) => isRecord(record) && typeof record.id === 'string' ? [record.id] : []).sort();
  let hash = 2166136261;
  for (const character of ids.join('|') || requiredString(value.updatedAt, 'campaign update time')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function parseCampaignEntity(value: unknown, campaignId: string): CampaignEntity {
  if (!isRecord(value) || value.campaignId !== campaignId || !isRecord(value.source)) {
    throw new Error('Campaign data has an invalid entity.');
  }
  const kinds = new Set(['npc', 'item', 'settlement', 'location', 'faction', 'quest', 'creature', 'vehicle', 'other']);
  if (typeof value.kind !== 'string' || !kinds.has(value.kind)) throw new Error('Campaign data has an invalid entity kind.');
  const sourceKind = value.source.kind;
  if (sourceKind !== 'manual' && sourceKind !== 'worldbuilding' && sourceKind !== 'catalogue') {
    throw new Error('Campaign data has an invalid entity source.');
  }
  let source: CampaignEntity['source'];
  if (sourceKind === 'manual') source = { kind: 'manual' };
  else if (sourceKind === 'worldbuilding') source = { kind: 'worldbuilding', id: requiredString(value.source.id, 'entity source ID') };
  else source = { kind: 'catalogue', id: requiredString(value.source.id, 'entity source ID') };
  return {
    id: requiredString(value.id, 'entity ID'),
    campaignId,
    kind: value.kind as CampaignEntity['kind'],
    name: requiredString(value.name, 'entity name'),
    aliases: requiredStringArray(value.aliases, 'entity aliases'),
    source,
    createdAt: requiredString(value.createdAt, 'entity creation time'),
    updatedAt: requiredString(value.updatedAt, 'entity update time'),
    version: nullableNumber(value.version, 'entity version') ?? 1
  };
}

function parseEntityReference(value: unknown, campaignId: string): EntityReference {
  if (!isRecord(value) || value.campaignId !== campaignId || !isRecord(value.source)) {
    throw new Error('Campaign data has an invalid entity reference.');
  }
  const source = value.source.kind === 'encounter'
    ? { kind: 'encounter' as const, encounterId: requiredString(value.source.encounterId, 'reference encounter ID') }
    : value.source.kind === 'brew'
      ? {
          kind: 'brew' as const,
          brewId: requiredString(value.source.brewId, 'reference brew ID'),
          start: nullableNumber(value.source.start, 'reference start') ?? 0,
          end: nullableNumber(value.source.end, 'reference end') ?? 0
        }
      : null;
  if (!source) throw new Error('Campaign data has an invalid entity reference source.');
  return {
    id: requiredString(value.id, 'entity reference ID'),
    campaignId,
    entityId: requiredString(value.entityId, 'referenced entity ID'),
    source,
    label: requiredString(value.label, 'reference label'),
    createdAt: requiredString(value.createdAt, 'reference creation time')
  };
}

function parseWorldEvent(value: unknown, campaignId: string): WorldEvent {
  if (!isRecord(value) || value.campaignId !== campaignId || !isRecord(value.source) || !Array.isArray(value.changes)) {
    throw new Error('Campaign data has an invalid world event.');
  }
  const sourceKind = value.source.kind;
  let source: WorldEvent['source'];
  if (sourceKind === 'manual') source = { kind: 'manual' };
  else if (sourceKind === 'encounter') source = { kind: 'encounter', encounterId: requiredString(value.source.encounterId, 'event encounter ID') };
  else if (sourceKind === 'combat') source = {
    kind: 'combat',
    encounterId: requiredString(value.source.encounterId, 'event encounter ID'),
    ...(value.source.participantId === undefined ? {} : { participantId: requiredString(value.source.participantId, 'event participant ID') })
  };
  else if (sourceKind === 'system-migration') source = { kind: 'system-migration', schemaVersion: nullableNumber(value.source.schemaVersion, 'migration schema version') ?? 1 };
  else throw new Error('Campaign data has an invalid world event source.');
  const changes = value.changes.map((change) => {
    if (!isRecord(change) || typeof change.field !== 'string') throw new Error('Campaign data has an invalid world-state change.');
    const validValue = (item: unknown) => item === null || ['string', 'number', 'boolean'].includes(typeof item);
    if (!validValue(change.previousValue) || !validValue(change.nextValue)) throw new Error('Campaign data has an invalid world-state value.');
    return { field: change.field, previousValue: change.previousValue as WorldEvent['changes'][number]['previousValue'], nextValue: change.nextValue as WorldEvent['changes'][number]['nextValue'] };
  });
  return {
    id: requiredString(value.id, 'world event ID'),
    campaignId,
    ...(value.entityId === undefined ? {} : { entityId: requiredString(value.entityId, 'event entity ID') }),
    type: requiredString(value.type, 'world event type'),
    source,
    changes,
    occurredAt: requiredString(value.occurredAt, 'event occurrence time'),
    recordedAt: requiredString(value.recordedAt, 'event recording time')
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

function parseTimelineEntry(value: unknown, campaignId: string): TimelineEntry {
  if (!isRecord(value) || value.campaignId !== campaignId || !Array.isArray(value.entityIds)) throw new Error('Campaign data has an invalid timeline entry.');
  if (value.lane !== 'main' && value.lane !== 'quest' && value.lane !== 'backstory') throw new Error('Campaign data has an invalid timeline lane.');
  if (value.status !== 'planned' && value.status !== 'current' && value.status !== 'past') throw new Error('Campaign data has an invalid timeline status.');
  if (value.date !== undefined && !isBelentorDate(value.date)) throw new Error('Campaign data has an invalid Belentor timeline date.');
  return { id: requiredString(value.id, 'timeline ID'), campaignId, lane: value.lane, status: value.status, title: requiredString(value.title, 'timeline title'), when: requiredString(value.when, 'timeline date'), order: nullableNumber(value.order, 'timeline order') ?? 0, notes: requiredString(value.notes, 'timeline notes'), entityIds: requiredStringArray(value.entityIds, 'timeline entity IDs'), ...(value.date === undefined ? {} : { date: value.date }), ...(value.worldbuildingId === undefined ? {} : { worldbuildingId: requiredString(value.worldbuildingId, 'timeline Worldbuilding ID') }), ...(value.encounterId === undefined ? {} : { encounterId: requiredString(value.encounterId, 'timeline encounter ID') }), ...(value.brewId === undefined ? {} : { brewId: requiredString(value.brewId, 'timeline brew ID') }), ...(value.sectionId === undefined ? {} : { sectionId: requiredString(value.sectionId, 'timeline section ID') }), createdAt: requiredString(value.createdAt, 'timeline creation time'), updatedAt: requiredString(value.updatedAt, 'timeline update time') };
}

function parseIdeaDraft(value: unknown): IdeaDraft {
  if (!isRecord(value)) throw new Error('Campaign data has an invalid idea draft.');
  return {
    id: requiredString(value.id, 'idea ID'),
    brewId: requiredString(value.brewId, 'idea brew ID'),
    text: requiredString(value.text, 'idea text'),
    createdAt: requiredString(value.createdAt, 'idea creation time'),
    updatedAt: requiredString(value.updatedAt, 'idea update time')
  };
}

/** Validates untrusted Drive JSON before it can replace any local campaign records. */
export function parseCampaignDataSnapshot(value: unknown): CampaignDataSnapshot {
  if (!isRecord(value)) {
    throw new Error('This Drive campaign data file is not a supported Homebrewry backup.');
  }
  const schemaVersion = value.schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2 && schemaVersion !== 3 && schemaVersion !== 4 && schemaVersion !== 5) {
    throw new Error('This Drive campaign data file is not a supported Homebrewry backup.');
  }
  if (!Array.isArray(value.encounters) || !Array.isArray(value.partyMembers) || !Array.isArray(value.worldbuildingEntries)) {
    throw new Error('This Drive campaign data file is not a supported Homebrewry backup: missing a required collection.');
  }
  if ((schemaVersion === 2 || schemaVersion === 3) && !Array.isArray(value.customCatalogueEntries)) {
    throw new Error('This Drive campaign data file has an invalid custom catalogue collection.');
  }
  if ((schemaVersion === 4 || schemaVersion === 5) && (!Array.isArray(value.customCatalogueEntries) || !Array.isArray(value.customCatalogueCategories) || !Array.isArray(value.worldbuildingTypes))) {
    throw new Error('This Drive campaign data file has an invalid campaign taxonomy collection.');
  }
  if (schemaVersion === 5 && (!Array.isArray(value.entities) || !Array.isArray(value.entityReferences) || !Array.isArray(value.worldEvents))) {
    throw new Error('This Drive campaign data file has an invalid Living World collection.');
  }
  const campaignId = schemaVersion >= 5 ? requiredString(value.campaignId, 'campaign ID') : legacyCampaignId(value);

  return {
    schemaVersion: 5,
    campaignId,
    updatedAt: requiredString(value.updatedAt, 'campaign update time'),
    encounters: value.encounters.map(parseEncounter),
    partyMembers: value.partyMembers.map(parsePartyMember),
    worldbuildingEntries: value.worldbuildingEntries.map(parseWorldbuildingEntry),
    customCatalogueEntries: schemaVersion === 1
      ? []
      : (value.customCatalogueEntries as unknown[]).map((entry) => parseCustomCatalogueEntry(entry, schemaVersion >= 3)),
    customCatalogueCategories: schemaVersion >= 4
      ? (value.customCatalogueCategories as unknown[]).map(parseCustomCatalogueCategory)
      : [],
    worldbuildingTypes: schemaVersion >= 4
      ? (value.worldbuildingTypes as unknown[]).map(parseWorldbuildingType)
      : [],
    entities: schemaVersion >= 5 ? (value.entities as unknown[]).map((entity) => parseCampaignEntity(entity, campaignId)) : [],
    entityReferences: schemaVersion >= 5 ? (value.entityReferences as unknown[]).map((reference) => parseEntityReference(reference, campaignId)) : [],
    worldEvents: schemaVersion >= 5 ? (value.worldEvents as unknown[]).map((event) => parseWorldEvent(event, campaignId)) : [],
    ...(Array.isArray(value.timelineEntries) ? { timelineEntries: value.timelineEntries.map((entry) => parseTimelineEntry(entry, campaignId)) } : {}),
    ...(Array.isArray(value.ideaDrafts) ? { ideaDrafts: value.ideaDrafts.map(parseIdeaDraft) } : {}),
    ...(value.currentBrewId === undefined ? {} : { currentBrewId: requiredString(value.currentBrewId, 'current brew ID') })
  };
}

export function createCampaignDataSnapshot(
  encounters: Encounter[],
  partyMembers: PartyMember[],
  worldbuildingEntries: WorldbuildingEntry[],
  timestamp = new Date().toISOString(),
  customCatalogueEntries: CustomCatalogueEntry[] = [],
  customCatalogueCategories: CustomCatalogueCategory[] = [],
  worldbuildingTypes: WorldbuildingType[] = [],
  brews: Brew[] = [],
  livingWorld: Pick<CampaignDataSnapshot, 'campaignId' | 'entities' | 'entityReferences' | 'worldEvents' | 'timelineEntries' | 'ideaDrafts' | 'currentBrewId'> = {
    // The current app has one campaign companion file per Drive account.
    // A later multi-campaign migration can replace this file-scoped identity.
    campaignId: 'default-campaign',
    entities: [],
    entityReferences: [],
    worldEvents: [], timelineEntries: [], ideaDrafts: []
  }
): CampaignDataSnapshot {
  const entities = synchroniseWorldbuildingEntities(livingWorld.campaignId, worldbuildingEntries, livingWorld.entities);
  return {
    schemaVersion: 5,
    campaignId: livingWorld.campaignId,
    updatedAt: timestamp,
    encounters: [...encounters],
    partyMembers: [...partyMembers],
    worldbuildingEntries: [...worldbuildingEntries],
    customCatalogueEntries: [...customCatalogueEntries],
    customCatalogueCategories: [...customCatalogueCategories],
    worldbuildingTypes: [...worldbuildingTypes],
    entities,
    entityReferences: synchroniseEntityReferences(livingWorld.campaignId, entities, brews, encounters),
    worldEvents: [...livingWorld.worldEvents],
    ...(livingWorld.timelineEntries?.length ? { timelineEntries: [...livingWorld.timelineEntries] } : {}),
    ...(livingWorld.ideaDrafts?.length ? { ideaDrafts: [...livingWorld.ideaDrafts] } : {}),
    ...(livingWorld.currentBrewId ? { currentBrewId: livingWorld.currentBrewId } : {})
  };
}

export function hasCampaignData(snapshot: CampaignDataSnapshot): boolean {
  return snapshot.encounters.length > 0
    || snapshot.partyMembers.length > 0
    || snapshot.worldbuildingEntries.length > 0
    || snapshot.customCatalogueEntries.length > 0
    || snapshot.customCatalogueCategories.length > 0
    || snapshot.worldbuildingTypes.length > 0
    || snapshot.entities.length > 0
    || snapshot.entityReferences.length > 0
    || snapshot.worldEvents.length > 0
    || Boolean(snapshot.timelineEntries?.length)
    || Boolean(snapshot.ideaDrafts?.length)
    || Boolean(snapshot.currentBrewId);
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
    schemaVersion: 5,
    campaignId: remote.campaignId,
    updatedAt: timestamp,
    encounters: preserveBothRecords(local.encounters, remote.encounters, timestamp, createId),
    partyMembers: preserveBothRecords(local.partyMembers, remote.partyMembers, timestamp, createId),
    worldbuildingEntries: preserveBothRecords(local.worldbuildingEntries, remote.worldbuildingEntries, timestamp, createId),
    customCatalogueEntries: preserveBothRecords(local.customCatalogueEntries, remote.customCatalogueEntries, timestamp, createId),
    customCatalogueCategories: preserveBothRecords(local.customCatalogueCategories, remote.customCatalogueCategories, timestamp, createId),
    worldbuildingTypes: preserveBothRecords(local.worldbuildingTypes, remote.worldbuildingTypes, timestamp, createId),
    entities: preserveBothRecords(local.entities, remote.entities, timestamp, createId),
    entityReferences: [...remote.entityReferences, ...local.entityReferences.filter((record) => !remote.entityReferences.some((remoteRecord) => remoteRecord.id === record.id))],
    worldEvents: [...remote.worldEvents, ...local.worldEvents.filter((event) => !remote.worldEvents.some((remoteEvent) => remoteEvent.id === event.id))],
    ...(remote.timelineEntries || local.timelineEntries ? { timelineEntries: [...(remote.timelineEntries ?? []), ...(local.timelineEntries ?? []).filter((entry) => !(remote.timelineEntries ?? []).some((remoteEntry) => remoteEntry.id === entry.id))] } : {}),
    ...(remote.ideaDrafts || local.ideaDrafts ? { ideaDrafts: [...(remote.ideaDrafts ?? []), ...(local.ideaDrafts ?? []).filter((idea) => !(remote.ideaDrafts ?? []).some((remoteIdea) => remoteIdea.id === idea.id))] } : {}),
    ...(remote.currentBrewId || local.currentBrewId ? { currentBrewId: remote.currentBrewId ?? local.currentBrewId } : {})
  };
}
