import { describe, expect, it } from 'vitest';
import { encounterReferenceFromUrl, encounterUrl, formatEncounterReference, remarkEncounterReferences } from './encounterReferences';
import type { Encounter } from '../types';

const encounter: Encounter = {
  id: 'c674b91f-94c8-5c80-9d1d-31bef50bc779',
  name: 'The flooded vault',
  status: 'not-started',
  optional: false,
  participants: [],
  activeCombatantId: null,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
  version: 1
};

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

describe('encounter references', () => {
  it('formats a stable encounter reference and allows only its internal URL', () => {
    const source = formatEncounterReference(encounter);

    expect(source).toBe('[[encounter:c674b91f-94c8-5c80-9d1d-31bef50bc779|The flooded vault]]');
    expect(encounterUrl({ id: encounter.id })).toBe('encounter://c674b91f-94c8-5c80-9d1d-31bef50bc779');
    expect(encounterReferenceFromUrl(encounterUrl({ id: encounter.id }))).toMatchObject({ id: encounter.id });
    expect(encounterReferenceFromUrl('encounter://not-a-valid-id')).toBeNull();
  });

  it('converts encounter references in prose without changing code', () => {
    const source = formatEncounterReference(encounter);
    const tree: MarkdownNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: `Run ${source}.` }] },
        { type: 'code', value: source }
      ]
    };

    remarkEncounterReferences()(tree);

    expect(tree.children?.[0].children?.[1]).toEqual({
      type: 'link',
      url: encounterUrl({ id: encounter.id }),
      children: [{ type: 'text', value: encounter.name }]
    });
    expect(tree.children?.[1].value).toBe(source);
  });
});
