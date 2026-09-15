import type { WorldbuildingEntry } from '../types';
import { entityKindForWorldbuilding } from './livingWorld';

export type SocialNpcDetails = Pick<WorldbuildingEntry, 'kind' | 'aliases' | 'notes'>;

export type SocialNpcSearchResult =
  | { source: 'worldbuilding'; key: string; entry: WorldbuildingEntry };

function normalizeSearch(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

/** Search only saved Worldbuilding identities; creation is offered separately when no result matches. */
export function socialNpcCandidates(entries: readonly WorldbuildingEntry[]): SocialNpcSearchResult[] {
  return entries
    .filter((entry) => entityKindForWorldbuilding(entry.kind) === 'npc')
    .map((entry): SocialNpcSearchResult => ({ source: 'worldbuilding', key: entry.id, entry }));
}

export function searchSocialNpcs(candidates: readonly SocialNpcSearchResult[], query: string): SocialNpcSearchResult[] {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  return candidates.filter(({ entry }) => {
    const text = normalizeSearch([entry.name, ...entry.aliases, entry.notes].join(' '));
    return words.every((word) => text.includes(word));
  });
}
