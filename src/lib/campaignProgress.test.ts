import { describe, expect, it } from 'vitest';
import type { Brew, CampaignEntity, Encounter } from '../types';
import { deriveCampaignPosition, derivePartyLocation } from './campaignProgress';

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

  it('chooses an active encounter across brews instead of whichever brew is first', () => {
    const inactive = encounter('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'not-started');
    const active = encounter('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active');
    const first = { ...brew(`[[encounter:${inactive.id}|First]]`), id: 'first' };
    const second = { ...brew(`# Sund\n[[encounter:${active.id}|Second]]`), id: 'second' };
    expect(deriveCampaignPosition([first, second], [inactive, active])).toMatchObject({ brewId: 'second', activeEncounterId: active.id, headingPath: ['Sund'] });
  });

  it('honors the saved current brew over encounters in other brews', () => {
    const firstEncounter = encounter('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'not-started');
    const activeElsewhere = encounter('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active');
    const first = { ...brew(`[[encounter:${firstEncounter.id}|First]]`), id: 'first' };
    const second = { ...brew(`[[encounter:${activeElsewhere.id}|Second]]`), id: 'second' };
    expect(deriveCampaignPosition([first, second], [firstEncounter, activeElsewhere], 'first')).toMatchObject({
      brewId: 'first',
      activeEncounterId: null,
      nextEncounterId: firstEncounter.id
    });
  });

  it('inherits a linked location from the selected encounter section', () => {
    const active = encounter('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active');
    const locationId = 'c674b91f-94c8-5c80-9d1d-31bef50bc779';
    const source = `# Sund\n[[world:${locationId}|Sund]]\n[[encounter:${active.id}|Fight]]`;
    const document = brew(source);
    const entity: CampaignEntity = { id: `worldbuilding:${locationId}`, campaignId: 'default-campaign', kind: 'settlement', name: 'Sund', aliases: [], source: { kind: 'worldbuilding', id: locationId }, createdAt: document.createdAt, updatedAt: document.updatedAt, version: 1 };
    const position = deriveCampaignPosition([document], [active]);
    expect(derivePartyLocation(position, [document], [entity], new Map())).toEqual({ entityId: entity.id, name: 'Sund', source: 'section' });
  });
});
