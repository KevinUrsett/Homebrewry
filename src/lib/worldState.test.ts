import { describe, expect, it } from 'vitest';
import type { WorldEvent } from '../types';
import { projectCurrentState } from './worldState';

const event = (overrides: Partial<WorldEvent>): WorldEvent => ({
  id: 'event-1',
  campaignId: 'campaign-1',
  entityId: 'npc-1',
  type: 'npc.status.changed',
  source: { kind: 'combat', encounterId: 'encounter-1' },
  changes: [{ field: 'status', previousValue: 'alive', nextValue: 'dead' }],
  occurredAt: '2026-07-28T10:00:00.000Z',
  recordedAt: '2026-07-28T10:00:00.000Z',
  ...overrides
});

describe('current world-state projection', () => {
  it('projects structured events without changing authored content', () => {
    const state = projectCurrentState([event({})]);
    expect(state[0]?.fields.status).toMatchObject({ value: 'dead', authority: 'structured' });
  });

  it('lets a later manual DM edit override current state while retaining history', () => {
    const death = event({});
    const override = event({
      id: 'event-2',
      source: { kind: 'manual' },
      changes: [{ field: 'status', previousValue: 'dead', nextValue: 'undead' }],
      recordedAt: '2026-07-28T11:00:00.000Z'
    });

    expect(projectCurrentState([override, death])[0]?.fields.status).toMatchObject({
      value: 'undead',
      eventId: 'event-2',
      authority: 'manual'
    });
    expect([death, override]).toHaveLength(2);
  });
});
