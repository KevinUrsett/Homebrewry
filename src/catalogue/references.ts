import {
  catalogueEntryKey,
  isCatalogueCategory,
  type CatalogueEntry,
  type CatalogueReference
} from './types';

const referenceExpression = /\[\[([a-z]+):([0-9a-f-]+)(?:\|([^\]\r\n]+))?\]\]/gi;
const catalogueUrlExpression = /^catalogue:\/\/([a-z]+)\/([0-9a-f-]+)$/i;

export type CatalogueReferenceMatch = CatalogueReference & {
  from: number;
  to: number;
  raw: string;
};

export function formatCatalogueReference(entry: CatalogueEntry, label = entry.name): string {
  const display = label.replace(/[\]|\r\n]/g, ' ').trim() || entry.name;
  return `[[${entry.category}:${entry.id}|${display}]]`;
}

export function catalogueReferenceMatches(source: string): CatalogueReferenceMatch[] {
  const matches: CatalogueReferenceMatch[] = [];
  referenceExpression.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = referenceExpression.exec(source))) {
    const category = match[1].toLowerCase();
    if (!isCatalogueCategory(category)) continue;
    matches.push({
      category,
      id: match[2].toLowerCase(),
      label: match[3]?.trim() || `${category} reference`,
      from: match.index,
      to: match.index + match[0].length,
      raw: match[0]
    });
  }
  return matches;
}

export function catalogueReferenceAt(source: string, position: number): CatalogueReferenceMatch | null {
  return catalogueReferenceMatches(source).find((match) => position >= match.from && position <= match.to) ?? null;
}

export function entryFromReference(
  entries: ReadonlyMap<string, CatalogueEntry>,
  reference: Pick<CatalogueReference, 'category' | 'id'>
): CatalogueEntry | undefined {
  return entries.get(catalogueEntryKey(reference));
}

export function catalogueUrl(reference: Pick<CatalogueReference, 'category' | 'id'>): string {
  return `catalogue://${reference.category}/${reference.id}`;
}

export function catalogueReferenceFromUrl(value: string | undefined): CatalogueReference | null {
  if (!value) return null;
  const match = value.match(catalogueUrlExpression);
  const category = match?.[1].toLowerCase();
  if (!match || !category || !isCatalogueCategory(category)) return null;
  return {
    category,
    id: match[2].toLowerCase(),
    label: ''
  };
}

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

function referenceNodes(value: string): MarkdownNode[] | null {
  const matches = catalogueReferenceMatches(value);
  if (!matches.length) return null;

  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.from > cursor) nodes.push({ type: 'text', value: value.slice(cursor, match.from) });
    nodes.push({
      type: 'link',
      url: catalogueUrl(match),
      children: [{ type: 'text', value: match.label }]
    });
    cursor = match.to;
  }
  if (cursor < value.length) nodes.push({ type: 'text', value: value.slice(cursor) });
  return nodes;
}

function transformNode(node: MarkdownNode): void {
  if (!node.children || ['code', 'inlineCode', 'link', 'html'].includes(node.type)) return;
  const transformed: MarkdownNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      const nodes = referenceNodes(child.value);
      if (nodes) transformed.push(...nodes);
      else transformed.push(child);
      continue;
    }
    transformNode(child);
    transformed.push(child);
  }
  node.children = transformed;
}

export function remarkCatalogueReferences() {
  return (tree: MarkdownNode) => transformNode(tree);
}
