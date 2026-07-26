import type { WorldbuildingEntry } from '../types';

const referenceExpression = /\[\[world:([0-9a-f-]+)(?:\|([^\]\r\n]+))?\]\]/gi;
const worldbuildingUrlExpression = /^world:\/\/([0-9a-f-]+)$/i;

export type WorldbuildingReferenceMatch = {
  id: string;
  label: string;
  from: number;
  to: number;
};

export function formatWorldbuildingReference(entry: WorldbuildingEntry, label = entry.name): string {
  const display = label.replace(/[\]|\r\n]/g, ' ').trim() || entry.name;
  return `[[world:${entry.id}|${display}]]`;
}

export function worldbuildingReferenceMatches(source: string): WorldbuildingReferenceMatch[] {
  const matches: WorldbuildingReferenceMatch[] = [];
  referenceExpression.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = referenceExpression.exec(source))) {
    matches.push({
      id: match[1].toLowerCase(),
      label: match[2]?.trim() || 'Worldbuilding reference',
      from: match.index,
      to: match.index + match[0].length
    });
  }
  return matches;
}

export function worldbuildingUrl(reference: Pick<WorldbuildingReferenceMatch, 'id'>): string {
  return `world://${reference.id}`;
}

export function worldbuildingReferenceFromUrl(value: string | undefined): Pick<WorldbuildingReferenceMatch, 'id' | 'label'> | null {
  if (!value) return null;
  const match = value.match(worldbuildingUrlExpression);
  if (!match) return null;
  return { id: match[1].toLowerCase(), label: '' };
}

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

function referenceNodes(value: string): MarkdownNode[] | null {
  const matches = worldbuildingReferenceMatches(value);
  if (!matches.length) return null;

  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.from > cursor) nodes.push({ type: 'text', value: value.slice(cursor, match.from) });
    nodes.push({ type: 'link', url: worldbuildingUrl(match), children: [{ type: 'text', value: match.label }] });
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

export function remarkWorldbuildingReferences() {
  return (tree: MarkdownNode) => transformNode(tree);
}
