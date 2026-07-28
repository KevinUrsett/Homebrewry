import type { CampaignEntity, CampaignEntityKind, LivingWorldData, WorldbuildingEntry, WorldEvent, WorldStateValue } from '../types';
import { projectCurrentState } from './worldState';

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

const locationKinds = new Set(['town', 'road', 'landmark', 'region']);

export function entityKindForWorldbuilding(kind: string): CampaignEntityKind {
  if (kind === 'character' || kind === 'historical-figure') return 'npc';
  if (kind === 'faction' || kind === 'organization') return 'faction';
  if (kind === 'town') return 'settlement';
  if (locationKinds.has(kind)) return 'location';
  return 'other';
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
