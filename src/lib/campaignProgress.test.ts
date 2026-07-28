import { describe, expect, it } from 'vitest';
import type { Brew, Encounter } from '../types';
import { deriveCampaignPosition } from './campaignProgress';

const encounter = (id: string, status: Encounter['status'], optional = false): Encounter => ({
  id,
  name: id,
  status,
  optional,
  participants: [],
  activeCombatantId: null,
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
  version: 1
});
const brew = (content: string): Brew => ({
  id: 'brew-1',
  title: 'Campaign',
  content,
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
  version: 1,
  rendererSettings: { accentColor: '#000', parchmentTone: 'warm' }
});

describe('derived campaign position', () => {
  it('places Now after the last completed encounter and before the next required encounter', () => {
    const encounters = [encounter('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'completed'), encounter('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'not-started')];
    const source = encounters.map((item) => `[[encounter:${item.id}|${item.name}]]`).join('\n');
    expect(deriveCampaignPosition([brew(source)], encounters)).toMatchObject({
      previousEncounterId: encounters[0].id,
      nextEncounterId: encounters[1].id,
      activeEncounterId: null
    });
  });

  it('skips unresolved optional encounters when choosing the next campaign step', () => {
    const optional = encounter('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'not-started', true);
    const required = encounter('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'not-started');
    const source = [optional, required].map((item) => `[[encounter:${item.id}|${item.name}]]`).join('\n');
    expect(deriveCampaignPosition([brew(source)], [optional, required])?.nextEncounterId).toBe(required.id);
  });
});
