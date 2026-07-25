import type { Encounter } from '../types';

const referenceExpression = /\[\[encounter:([0-9a-f-]+)(?:\|([^\]\r\n]+))?\]\]/gi;
const encounterUrlExpression = /^encounter:\/\/([0-9a-f-]+)$/i;

export type EncounterReferenceMatch = {
  id: string;
  label: string;
  from: number;
  to: number;
};

export function formatEncounterReference(encounter: Encounter, label = encounter.name): string {
  const display = label.replace(/[\]|\r\n]/g, ' ').trim() || encounter.name;
  return `[[encounter:${encounter.id}|${display}]]`;
}

export function encounterReferenceMatches(source: string): EncounterReferenceMatch[] {
  const matches: EncounterReferenceMatch[] = [];
  referenceExpression.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = referenceExpression.exec(source))) {
    matches.push({
      id: match[1].toLowerCase(),
      label: match[2]?.trim() || 'Combat encounter',
      from: match.index,
      to: match.index + match[0].length
    });
  }
  return matches;
}

export function encounterUrl(reference: Pick<EncounterReferenceMatch, 'id'>): string {
  return `encounter://${reference.id}`;
}

export function encounterReferenceFromUrl(value: string | undefined): Pick<EncounterReferenceMatch, 'id' | 'label'> | null {
  if (!value) return null;
  const match = value.match(encounterUrlExpression);
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
  const matches = encounterReferenceMatches(value);
  if (!matches.length) return null;

  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.from > cursor) nodes.push({ type: 'text', value: value.slice(cursor, match.from) });
    nodes.push({ type: 'link', url: encounterUrl(match), children: [{ type: 'text', value: match.label }] });
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

export function remarkEncounterReferences() {
  return (tree: MarkdownNode) => transformNode(tree);
}
