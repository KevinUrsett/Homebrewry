import type { Brew, CampaignEntity, CampaignEntityKind, Encounter, EntityReference, LivingWorldData, TimelineEntry, TimelineLane, TimelineStatus, WorldbuildingEntry, WorldEvent, WorldStateValue } from '../types';
import { projectCurrentState } from './worldState';
import { worldbuildingReferenceMatches } from './worldbuildingReferences';

type CreateEntityInput = {
  campaignId: string;
  kind: CampaignEntityKind;
  name: string;
  aliases?: string[];
  source: CampaignEntity['source'];
};

export function createCampaignEntity(
  input: CreateEntityInput,
  timestamp = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID()
): CampaignEntity {
  return {
    id: createId(),
    campaignId: input.campaignId,
    kind: input.kind,
    name: input.name.trim() || 'Untitled entity',
    aliases: [...new Set((input.aliases ?? []).map((alias) => alias.trim()).filter(Boolean))],
    source: input.source,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}

/** Append-only by design: existing events are never replaced or removed. */
export function appendWorldEvent(events: readonly WorldEvent[], event: WorldEvent): WorldEvent[] {
  if (events.some((existing) => existing.id === event.id)) {
    throw new Error(`World event ${event.id} already exists.`);
  }
  return [...events, event];
}

const locationKinds = new Set(['town', 'road', 'landmark', 'region', 'location', 'settlement']);

export function entityKindForWorldbuilding(kind: string): CampaignEntityKind {
  if (kind === 'character' || kind === 'historical-figure') return 'npc';
  if (kind === 'faction' || kind === 'organization') return 'faction';
  if (kind === 'town') return 'settlement';
  if (locationKinds.has(kind)) return 'location';
  if (kind === 'item' || kind === 'quest' || kind === 'creature' || kind === 'vehicle') return kind;
  return 'other';
}

export const partyEntityId = 'party:default';

export function createTimelineEntry(
  data: LivingWorldData,
  input: Pick<TimelineEntry, 'lane' | 'status' | 'title' | 'when' | 'notes' | 'entityIds' | 'date' | 'worldbuildingId' | 'encounterId' | 'brewId' | 'sectionId'>,
  timestamp = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID()
): TimelineEntry {
  const order = Math.max(-1, ...(data.timelineEntries ?? []).map((entry) => entry.order)) + 1;
  return { id: createId(), campaignId: data.campaignId, order, createdAt: timestamp, updatedAt: timestamp, ...input, title: input.title.trim() || 'Untitled timeline event', when: input.when.trim(), notes: input.notes.trim(), entityIds: [...new Set(input.entityIds)] };
}

export function saveTimelineEntry(data: LivingWorldData, entry: TimelineEntry): LivingWorldData {
  if (entry.campaignId !== data.campaignId) throw new Error('Timeline entry belongs to another campaign.');
  const updated = { ...entry, updatedAt: new Date().toISOString() };
  return { ...data, timelineEntries: [updated, ...(data.timelineEntries ?? []).filter((item) => item.id !== entry.id)] };
}

export function deleteTimelineEntry(data: LivingWorldData, entryId: string): LivingWorldData {
  return { ...data, timelineEntries: (data.timelineEntries ?? []).filter((entry) => entry.id !== entryId) };
}

/** The party is a campaign-level subject, kept as an event stream rather than authored prose. */
export function recordPartyLocation(
  data: LivingWorldData,
  locationEntityId: string,
  timestamp = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID(),
  source: WorldEvent['source'] = { kind: 'manual' }
): LivingWorldData {
  const current = projectCurrentState(data.worldEvents).find((state) => state.entityId === partyEntityId);
  const previousValue = current?.fields.location?.value ?? null;
  if (previousValue === locationEntityId) return data;
  const event: WorldEvent = {
    id: createId(), campaignId: data.campaignId, entityId: partyEntityId,
    type: 'party.location.changed', source,
    changes: [{ field: 'location', previousValue, nextValue: locationEntityId }],
    occurredAt: timestamp, recordedAt: timestamp
  };
  return { ...data, worldEvents: appendWorldEvent(data.worldEvents, event) };
}

/**
 * Confirmed Worldbuilding entries are authoritative entity classifications.
 * IDs are derived from the existing stable record IDs; no brew content changes.
 */
export function synchroniseWorldbuildingEntities(
  campaignId: string,
  entries: readonly WorldbuildingEntry[],
  existing: readonly CampaignEntity[] = []
): CampaignEntity[] {
  const entryIds = new Set(entries.map((entry) => entry.id));
  const retained = existing.filter((entity) =>
    entity.source.kind !== 'worldbuilding' || !entryIds.has(entity.source.id)
  );
  const bySourceId = new Map(
    existing.flatMap((entity) => entity.source.kind === 'worldbuilding' ? [[entity.source.id, entity] as const] : [])
  );
  const worldbuildingEntities = entries.map((entry) => {
    const current = bySourceId.get(entry.id);
    return {
      id: current?.id ?? `worldbuilding:${entry.id}`,
      campaignId,
      kind: entityKindForWorldbuilding(entry.kind),
      name: entry.name,
      aliases: [...entry.aliases],
      source: { kind: 'worldbuilding' as const, id: entry.id },
      createdAt: current?.createdAt ?? entry.createdAt,
      updatedAt: entry.updatedAt,
      version: current && current.updatedAt === entry.updatedAt ? current.version : (current?.version ?? 0) + 1
    };
  });
  return [...retained, ...worldbuildingEntities];
}

export function synchroniseLivingWorld(data: LivingWorldData, entries: readonly WorldbuildingEntry[]): LivingWorldData {
  return {
    ...data,
    entities: synchroniseWorldbuildingEntities(data.campaignId, entries, data.entities)
  };
}

/** Rebuilds only explicit, stable links. Free prose never creates a reference or world state. */
export function synchroniseEntityReferences(
  campaignId: string,
  entities: readonly CampaignEntity[],
  brews: readonly Brew[],
  encounters: readonly Encounter[]
): EntityReference[] {
  const entityByWorldbuildingId = new Map(entities.flatMap((entity) => entity.source.kind === 'worldbuilding' ? [[entity.source.id, entity] as const] : []));
  const references: EntityReference[] = [];
  for (const brew of brews) {
    for (const match of worldbuildingReferenceMatches(brew.content)) {
      const entity = entityByWorldbuildingId.get(match.id);
      if (!entity) continue;
      references.push({
        id: `brew:${brew.id}:${match.from}:${entity.id}`, campaignId, entityId: entity.id,
        source: { kind: 'brew', brewId: brew.id, start: match.from, end: match.to }, label: match.label,
        createdAt: brew.updatedAt
      });
    }
  }
  for (const encounter of encounters) {
    for (const participant of encounter.participants) {
      if (!participant.entityId || !entities.some((entity) => entity.id === participant.entityId)) continue;
      references.push({
        id: `encounter:${encounter.id}:${participant.entityId}`, campaignId, entityId: participant.entityId,
        source: { kind: 'encounter', encounterId: encounter.id }, label: participant.name,
        createdAt: encounter.updatedAt
      });
    }
  }
  return references;
}

export function recordManualStateChange(
  data: LivingWorldData,
  entityId: string,
  field: string,
  nextValue: WorldStateValue,
  timestamp = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID()
): LivingWorldData {
  const entity = data.entities.find((candidate) => candidate.id === entityId);
  if (!entity) throw new Error('Cannot update state for an unknown campaign entity.');
  const current = projectCurrentState(data.worldEvents)
    .find((state) => state.campaignId === data.campaignId && state.entityId === entityId);
  const previousValue = current?.fields[field]?.value ?? null;
  if (previousValue === nextValue) return data;
  const event: WorldEvent = {
    id: createId(),
    campaignId: data.campaignId,
    entityId,
    type: `${entity.kind}.${field}.changed`,
    source: { kind: 'manual' },
    changes: [{ field, previousValue, nextValue }],
    occurredAt: timestamp,
    recordedAt: timestamp
  };
  return { ...data, worldEvents: appendWorldEvent(data.worldEvents, event) };
}

/**
 * Ending combat is an authoritative structured action. Only confirmed NPC
 * entities linked to combatants at 0 HP become dead; unlinked monsters, party
 * members, and prose mentions never establish World State.
 */
export function recordCombatCompletion(
  data: LivingWorldData,
  encounter: Encounter,
  timestamp = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID()
): LivingWorldData {
  const entities = new Map(data.entities.map((entity) => [entity.id, entity]));
  const currentState = new Map(projectCurrentState(data.worldEvents).map((state) => [state.entityId, state]));
  let worldEvents = data.worldEvents;

  for (const participant of encounter.participants) {
    if (!participant.entityId || participant.currentHitPoints === null || participant.currentHitPoints > 0) continue;
    const entity = entities.get(participant.entityId);
    if (!entity || entity.kind !== 'npc') continue;
    const previousValue = currentState.get(entity.id)?.fields.status?.value ?? null;
    if (previousValue === 'dead') continue;
    const event: WorldEvent = {
      id: createId(),
      campaignId: data.campaignId,
      entityId: entity.id,
      type: 'npc.died',
      source: { kind: 'combat', encounterId: encounter.id, participantId: participant.id },
      changes: [{ field: 'status', previousValue, nextValue: 'dead' }],
      occurredAt: timestamp,
      recordedAt: timestamp
    };
    worldEvents = appendWorldEvent(worldEvents, event);
  }

  return worldEvents === data.worldEvents ? data : { ...data, worldEvents };
}
