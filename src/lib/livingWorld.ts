import type { CampaignEntity, CampaignEntityKind, WorldEvent } from '../types';

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
