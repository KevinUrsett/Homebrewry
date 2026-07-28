import type { EntityCurrentState, WorldEvent } from '../types';

/**
 * Rebuilds present state from immutable events. Later events win field-by-field;
 * a manual edit is not permanently privileged over a later explicit structured
 * action, because the DM can always make a newer manual edit.
 */
export function projectCurrentState(events: readonly WorldEvent[]): EntityCurrentState[] {
  const ordered = [...events].sort((left, right) =>
    left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id)
  );
  const projections = new Map<string, EntityCurrentState>();

  for (const event of ordered) {
    if (!event.entityId) continue;
    const key = `${event.campaignId}:${event.entityId}`;
    const current = projections.get(key) ?? {
      campaignId: event.campaignId,
      entityId: event.entityId,
      fields: {}
    };
    for (const change of event.changes) {
      current.fields[change.field] = {
        value: change.nextValue,
        eventId: event.id,
        updatedAt: event.recordedAt,
        authority: event.source.kind === 'manual' ? 'manual' : 'structured'
      };
    }
    projections.set(key, current);
  }

  return [...projections.values()];
}
