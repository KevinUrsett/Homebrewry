import { describe, expect, it } from 'vitest';
import {
  catalogueReferenceAt,
  catalogueReferenceFromUrl,
  catalogueReferenceMatches,
  catalogueUrl,
  findCatalogueEntryByName,
  formatCatalogueReference,
  remarkCatalogueReferences
} from './references';
import type { CatalogueEntry } from './types';

const aboleth: CatalogueEntry = {
  id: 'c674b91f-94c8-5c80-9d1d-31bef50bc779',
  category: 'monster',
  name: 'Aboleth',
  description: '',
  data: {},
  source: 'SRD-521',
  ruleset: '5.5e'
};

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

describe('catalogue references', () => {
  it('formats and finds a stable entry reference', () => {
    const source = `The party encounters ${formatCatalogueReference(aboleth)}.`;
    const [match] = catalogueReferenceMatches(source);

    expect(match).toMatchObject({ category: 'monster', id: aboleth.id, label: 'Aboleth' });
    expect(catalogueReferenceAt(source, match.from + 4)).toEqual(match);
    expect(catalogueUrl(match)).toBe(`catalogue://monster/${aboleth.id}`);
    expect(catalogueReferenceFromUrl(catalogueUrl(match))).toMatchObject({ category: 'monster', id: aboleth.id });
  });

  it('resolves selected text only when it identifies one entry in the chosen category', () => {
    const spell: CatalogueEntry = { ...aboleth, id: 'spell-id', category: 'spell', name: 'Aboleth' };
    const duplicate: CatalogueEntry = { ...aboleth, id: 'duplicate-id' };

    expect(findCatalogueEntryByName([aboleth, spell], 'monster', '  aboleth  ')).toEqual(aboleth);
    expect(findCatalogueEntryByName([aboleth, spell], 'spell', 'Aboleth')).toEqual(spell);
    expect(findCatalogueEntryByName([aboleth, duplicate], 'monster', 'Aboleth')).toBeUndefined();
  });

  it('converts references in prose but leaves code untouched', () => {
    const reference = formatCatalogueReference(aboleth);
    const tree: MarkdownNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: `Meet ${reference}.` }] },
        { type: 'code', value: reference }
      ]
    };

    remarkCatalogueReferences()(tree);

    expect(tree.children?.[0].children).toEqual([
      { type: 'text', value: 'Meet ' },
      { type: 'link', url: `catalogue://monster/${aboleth.id}`, children: [{ type: 'text', value: 'Aboleth' }] },
      { type: 'text', value: '.' }
    ]);
    expect(tree.children?.[1].value).toBe(reference);
  });

  it('leaves encounter and Worldbuilding namespaces to their dedicated renderer plugins', () => {
    expect(catalogueReferenceMatches('[[encounter:c674b91f-94c8-5c80-9d1d-31bef50bc779|Ambush]]')).toEqual([]);
    expect(catalogueReferenceMatches('[[world:c674b91f-94c8-5c80-9d1d-31bef50bc779|Sund]]')).toEqual([]);
  });
});
