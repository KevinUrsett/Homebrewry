import { describe, expect, it } from 'vitest';
import { formatWorldbuildingReference, remarkWorldbuildingReferences, worldbuildingReferenceFromUrl, worldbuildingUrl } from './worldbuildingReferences';
import type { WorldbuildingEntry } from '../types';

const entry: WorldbuildingEntry = {
  id: 'c674b91f-94c8-5c80-9d1d-31bef50bc779',
  name: 'Sund',
  kind: 'town',
  aliases: ['City of Worship'],
  notes: 'A city built around the old road.',
  createdAt: '2026-07-26T12:00:00.000Z',
  updatedAt: '2026-07-26T12:00:00.000Z',
  version: 1
};

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

describe('Worldbuilding references', () => {
  it('formats a stable internal link and rejects other URL schemes', () => {
    const source = formatWorldbuildingReference(entry);

    expect(source).toBe('[[world:c674b91f-94c8-5c80-9d1d-31bef50bc779|Sund]]');
    expect(worldbuildingReferenceFromUrl(worldbuildingUrl({ id: entry.id }))).toMatchObject({ id: entry.id });
    expect(worldbuildingReferenceFromUrl('https://example.test/world')).toBeNull();
  });

  it('converts prose without changing source inside code blocks', () => {
    const source = formatWorldbuildingReference(entry);
    const tree: MarkdownNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: `Visit ${source}.` }] },
        { type: 'code', value: source }
      ]
    };

    remarkWorldbuildingReferences()(tree);

    expect(tree.children?.[0].children?.[1]).toEqual({
      type: 'link',
      url: worldbuildingUrl({ id: entry.id }),
      children: [{ type: 'text', value: entry.name }]
    });
    expect(tree.children?.[1].value).toBe(source);
  });
});
