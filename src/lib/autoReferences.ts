import { catalogueUrl } from '../catalogue/references';
import type { CatalogueEntry } from '../catalogue/types';
import { encounterUrl } from './encounterReferences';
import { worldbuildingUrl } from './worldbuildingReferences';
import type { Encounter, WorldbuildingEntry } from '../types';

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

type AutoReference = {
  label: string;
  normalised: string;
  url: string;
};

type AutoReferenceSources = {
  catalogue?: ReadonlyMap<string, CatalogueEntry>;
  encounters?: ReadonlyMap<string, Encounter>;
  worldbuilding?: ReadonlyMap<string, WorldbuildingEntry>;
};

const skippedNodeTypes = new Set([
  'code',
  'inlineCode',
  'link',
  'html',
  'heading',
  'definition',
  'image',
  'imageReference',
  'linkReference'
]);

function normalise(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function isUsefulLabel(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 3 && /[\p{L}\p{N}]/u.test(trimmed);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds one deterministic index. A label is only eligible when it resolves to
 * exactly one entity across Worldbuilding, encounters, and the catalogue.
 * Longer labels are matched first so "Temple of Sund" wins over "Sund".
 */
export function createAutoReferenceIndex({ catalogue, encounters, worldbuilding }: AutoReferenceSources): AutoReference[] {
  const candidates = new Map<string, AutoReference[]>();
  const add = (label: string, url: string) => {
    if (!isUsefulLabel(label)) return;
    const normalised = normalise(label);
    const list = candidates.get(normalised) ?? [];
    if (!list.some((candidate) => candidate.url === url)) list.push({ label: label.trim(), normalised, url });
    candidates.set(normalised, list);
  };

  // Priority is only relevant for duplicate aliases that point to the same
  // entity. Ambiguous labels across distinct entities are excluded entirely.
  worldbuilding?.forEach((entry) => {
    const url = worldbuildingUrl({ id: entry.id });
    add(entry.name, url);
    entry.aliases.forEach((alias) => add(alias, url));
  });
  encounters?.forEach((encounter) => add(encounter.name, encounterUrl({ id: encounter.id })));
  catalogue?.forEach((entry) => add(entry.name, catalogueUrl(entry)));

  return [...candidates.values()]
    .filter((matches) => matches.length === 1)
    .map(([match]) => match)
    .sort((left, right) => right.label.length - left.label.length || left.label.localeCompare(right.label));
}

function referenceNodes(value: string, index: readonly AutoReference[]): MarkdownNode[] | null {
  if (!value.trim() || index.length === 0) return null;

  const pattern = index.map((entry) => escapeRegExp(entry.label)).join('|');
  if (!pattern) return null;
  const expression = new RegExp(`(?<![\\p{L}\\p{N}_])(${pattern})(?![\\p{L}\\p{N}_])`, 'giu');
  const byName = new Map(index.map((entry) => [entry.normalised, entry]));
  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(value))) {
    const reference = byName.get(normalise(match[0]));
    if (!reference) continue;
    if (match.index > cursor) nodes.push({ type: 'text', value: value.slice(cursor, match.index) });
    nodes.push({ type: 'link', url: reference.url, children: [{ type: 'text', value: match[0] }] });
    cursor = match.index + match[0].length;
  }

  if (cursor === 0) return null;
  if (cursor < value.length) nodes.push({ type: 'text', value: value.slice(cursor) });
  return nodes;
}

function transformNode(node: MarkdownNode, index: readonly AutoReference[]): void {
  if (!node.children || skippedNodeTypes.has(node.type)) return;
  const transformed: MarkdownNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      const nodes = referenceNodes(child.value, index);
      transformed.push(...(nodes ?? [child]));
      continue;
    }
    transformNode(child, index);
    transformed.push(child);
  }
  node.children = transformed;
}

export function remarkAutoReferences(options: AutoReferenceSources) {
  const index = createAutoReferenceIndex(options);
  return () => (tree: MarkdownNode) => transformNode(tree, index);
}
