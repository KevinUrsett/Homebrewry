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
  source: 'worldbuilding' | 'encounter' | 'catalogue';
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

function isCapitalised(value: string) {
  const firstLetter = [...value].find((character) => /\p{L}/u.test(character));
  return Boolean(firstLetter && firstLetter === firstLetter.toLocaleUpperCase() && firstLetter !== firstLetter.toLocaleLowerCase());
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
  const add = (label: string, url: string, source: AutoReference['source']) => {
    if (!isUsefulLabel(label)) return;
    const normalised = normalise(label);
    const list = candidates.get(normalised) ?? [];
    if (!list.some((candidate) => candidate.url === url)) list.push({ label: label.trim(), normalised, url, source });
    candidates.set(normalised, list);
  };

  worldbuilding?.forEach((entry) => {
    const url = worldbuildingUrl({ id: entry.id });
    add(entry.name, url, 'worldbuilding');
    entry.aliases.forEach((alias) => add(alias, url, 'worldbuilding'));
  });
  encounters?.forEach((encounter) => add(encounter.name, encounterUrl({ id: encounter.id }), 'encounter'));
  catalogue?.forEach((entry) => add(entry.name, catalogueUrl(entry), 'catalogue'));

  return [...candidates.values()]
    .filter((matches) => matches.length === 1)
    .map(([match]) => match)
    .sort((left, right) => right.label.length - left.label.length || left.label.localeCompare(right.label));
}

function shouldLinkOccurrence(reference: AutoReference, occurrence: string): boolean {
  if (reference.source !== 'catalogue') return true;

  // Catalogue names include many ordinary words (bell, scout, cover, blight).
  // Never turn a lower-case single common word into a reference merely because
  // it happens to share a catalogue entry name. Explicit Markdown references
  // remain available for intentional lower-case uses.
  const isSingleWord = !reference.label.trim().includes(' ');
  if (isSingleWord && !isCapitalised(occurrence)) return false;

  return true;
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
    if (!reference || !shouldLinkOccurrence(reference, match[0])) continue;
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
