import type { Brew, BrewReferenceReview } from '../types';
import { getOutlineLocations } from './outline';
import { findUnresolvedNames } from './unresolvedReferences';

export function referenceNameKey(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export function referenceScanSection(content: string, sectionId: string | null): { content: string; title: string } {
  if (!sectionId) return { content, title: 'Whole brew' };
  const outline = getOutlineLocations(content);
  const index = outline.findIndex((item) => item.id === sectionId);
  if (index < 0) throw new Error('This section no longer exists. Choose another place to check.');
  const heading = outline[index];
  const next = outline.slice(index + 1).find((item) => item.level <= heading.level);
  return { content: content.slice(heading.from, next?.from ?? content.length), title: heading.text };
}

function referenceContext(content: string, name: string): string {
  const pattern = name.split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const match = new RegExp(pattern, 'iu').exec(content);
  if (!match) return '';
  const from = Math.max(content.lastIndexOf('\n', match.index) + 1, match.index - 65);
  const lineEnd = content.indexOf('\n', match.index + match[0].length);
  const to = Math.min(lineEnd < 0 ? content.length : lineEnd, match.index + match[0].length + 130);
  return `${from > 0 && content[from - 1] !== '\n' ? '…' : ''}${content.slice(from, to).replace(/\s+/g, ' ').trim()}${to < content.length && content[to] !== '\n' ? '…' : ''}`;
}

/** Called only by the explicit scan action. Pending candidates remain in the inbox. */
export function scanNewBrewReferences(
  brew: Pick<Brew, 'id' | 'title' | 'content'>,
  sectionId: string | null,
  knownNames: readonly string[],
  reviews: readonly BrewReferenceReview[],
  timestamp = new Date().toISOString()
): BrewReferenceReview[] {
  const section = referenceScanSection(brew.content, sectionId);
  const ignored = new Set([...knownNames, ...reviews.map((review) => review.name)].map(referenceNameKey));
  return findUnresolvedNames([section.content], ignored)
    .filter((candidate) => !ignored.has(referenceNameKey(candidate.name)))
    .map((candidate) => ({
      id: referenceNameKey(candidate.name), name: candidate.name, status: 'pending',
      brewId: brew.id, brewTitle: brew.title, sectionId, sectionTitle: section.title,
      count: candidate.count, context: referenceContext(section.content, candidate.name), updatedAt: timestamp
    }));
}

export function pendingBrewReferences(reviews: readonly BrewReferenceReview[], knownNames: readonly string[]): BrewReferenceReview[] {
  const known = new Set(knownNames.map(referenceNameKey));
  return reviews.filter((review) => review.status === 'pending' && !known.has(referenceNameKey(review.name)));
}

/** Merge by name, never clone a reviewed candidate into a second pending item. */
export function mergeReferenceReviews(left: readonly BrewReferenceReview[], right: readonly BrewReferenceReview[]): BrewReferenceReview[] {
  const merged = new Map<string, BrewReferenceReview>();
  for (const review of [...left, ...right]) {
    const key = referenceNameKey(review.name);
    const previous = merged.get(key);
    const alreadyReviewed = previous && previous.status !== 'pending';
    const incomingReviewed = review.status !== 'pending';
    if (!previous || (!alreadyReviewed && incomingReviewed)
      || (alreadyReviewed === incomingReviewed && review.updatedAt > previous.updatedAt)) {
      merged.set(key, { ...review, id: key });
    }
  }
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
}
