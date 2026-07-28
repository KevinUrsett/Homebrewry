const ignoredSingleNames = new Set([
  'After', 'Also', 'Although', 'Before', 'But', 'Chapter', 'During', 'Each', 'Encounter',
  'Every', 'Finally', 'First', 'For', 'From', 'However', 'If', 'Later', 'Meanwhile',
  'Next', 'Notes', 'Once', 'Only', 'Other', 'Otherwise', 'Party', 'Preview', 'Second',
  'Section', 'Since', 'Some', 'Then', 'There', 'These', 'They', 'This', 'Those', 'Through',
  'Until', 'When', 'Where', 'While', 'With', 'Worldbuilding'
]);

const connectorWords = new Set(['and', 'at', 'de', 'del', 'for', 'in', 'of', 'on', 'the', 'to']);
const wordPattern = /[\p{L}][\p{L}\p{M}'’\-]*/gu;

export type UnresolvedName = {
  name: string;
  count: number;
};

function normaliseName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function stripNonProse(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\r\n]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ')
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}

function isCapitalised(word: string): boolean {
  const first = [...word][0];
  return Boolean(first && first === first.toLocaleUpperCase() && first !== first.toLocaleLowerCase());
}

function candidatesFromSource(source: string): string[] {
  const prose = stripNonProse(source);
  const words = [...prose.matchAll(wordPattern)].map((match) => ({ value: match[0], index: match.index ?? 0 }));
  const candidates: string[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const current = words[index];
    if (!isCapitalised(current.value)) continue;

    const phrase = [current.value];
    let cursor = index + 1;
    while (cursor < words.length && phrase.length < 6) {
      const previous = words[cursor - 1];
      const next = words[cursor];
      const gap = prose.slice(previous.index + previous.value.length, next.index);
      if (!/^\s+$/.test(gap)) break;
      const lower = next.value.toLocaleLowerCase();
      if (!isCapitalised(next.value) && !connectorWords.has(lower)) break;
      phrase.push(next.value);
      cursor += 1;
    }

    while (phrase.length > 1 && connectorWords.has(phrase.at(-1)!.toLocaleLowerCase())) phrase.pop();
    const name = phrase.join(' ');
    if (name.length < 4) continue;
    if (phrase.length === 1 && ignoredSingleNames.has(name)) continue;
    if (phrase.length === 1 && name === name.toLocaleUpperCase()) continue;
    candidates.push(name);
  }

  return candidates;
}

/**
 * Finds probable proper names without AI or source rewriting. The detector is
 * intentionally conservative: it ignores markup and existing references, and
 * known names/aliases are removed before results are shown for review.
 */
export function findUnresolvedNames(sources: readonly string[], knownNames: Iterable<string>): UnresolvedName[] {
  const known = new Set([...knownNames].map(normaliseName).filter(Boolean));
  const counts = new Map<string, { name: string; count: number }>();

  for (const source of sources) {
    for (const candidate of candidatesFromSource(source)) {
      const key = normaliseName(candidate);
      if (!key || known.has(key)) continue;
      const existing = counts.get(key);
      counts.set(key, existing ? { ...existing, count: existing.count + 1 } : { name: candidate, count: 1 });
    }
  }

  return [...counts.values()]
    .filter((item) => item.name.includes(' ') || item.count > 1)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}
