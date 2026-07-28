import type { Brew, Encounter, WorldbuildingEntry } from '../types';
import { worldbuildingReferenceMatches } from './worldbuildingReferences';

export type WorldbuildingConnection = {
  kind: 'brew' | 'encounter' | 'worldbuilding';
  id: string;
  label: string;
  count: number;
  direction?: 'incoming' | 'outgoing' | 'mutual';
};

function proseOnly(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\r\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ');
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentionCount(source: string, names: readonly string[]): number {
  const candidates = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  if (!candidates.length) return 0;
  const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(?:${candidates.map(escaped).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  return [...proseOnly(source).matchAll(expression)].length;
}

function sourceCount(source: string, entry: WorldbuildingEntry): number {
  const references = worldbuildingReferenceMatches(source);
  const explicit = references.filter((reference) => reference.id === entry.id.toLowerCase()).length;
  const withoutReferences = references.reduceRight(
    (content, reference) => content.slice(0, reference.from) + content.slice(reference.to),
    source
  );
  return explicit + mentionCount(withoutReferences, [entry.name, ...entry.aliases]);
}

/** Derived backlinks only. Finding a mention never changes entity state or source text. */
export function findWorldbuildingConnections(
  entry: WorldbuildingEntry,
  brews: readonly Brew[],
  encounters: readonly Encounter[],
  entries: readonly WorldbuildingEntry[]
): WorldbuildingConnection[] {
  const connections: WorldbuildingConnection[] = [];

  for (const brew of brews) {
    const count = sourceCount(brew.content, entry);
    if (count) connections.push({ kind: 'brew', id: brew.id, label: brew.title || 'Untitled brew', count });
  }
  for (const encounter of encounters) {
    const count = mentionCount(
      [encounter.name, ...encounter.participants.map((participant) => participant.name)].join('\n'),
      [entry.name, ...entry.aliases]
    );
    if (count) connections.push({ kind: 'encounter', id: encounter.id, label: encounter.name || 'Untitled encounter', count });
  }
  for (const related of entries) {
    if (related.id === entry.id) continue;
    const incoming = sourceCount(related.notes, entry);
    const outgoing = sourceCount(entry.notes, related);
    if (incoming || outgoing) {
      connections.push({
        kind: 'worldbuilding',
        id: related.id,
        label: related.name || 'Untitled entry',
        count: incoming + outgoing,
        direction: incoming && outgoing ? 'mutual' : incoming ? 'incoming' : 'outgoing'
      });
    }
  }

  return connections.sort((left, right) =>
    left.kind.localeCompare(right.kind) || right.count - left.count || left.label.localeCompare(right.label)
  );
}
