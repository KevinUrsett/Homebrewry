const ignoredSingleNames = new Set([
  'After', 'Also', 'Although', 'Armor', 'Before', 'But', 'Chapter', 'During', 'Each', 'Encounter',
  'Every', 'Finally', 'First', 'For', 'From', 'However', 'If', 'Later', 'Meanwhile',
  'Next', 'Notes', 'Once', 'Only', 'Other', 'Otherwise', 'Party', 'Preview', 'Second',
  'Section', 'Since', 'Some', 'Speed', 'Tactics', 'Then', 'There', 'These', 'They', 'This',
  'Those', 'Through', 'Until', 'When', 'Where', 'While', 'With', 'Worldbuilding'
]);

const genericSingleNames = new Set([
  'Abbey', 'Armor', 'Army', 'Ash', 'Bell', 'Blight', 'Bridge', 'Camp', 'Castle', 'Cave',
  'City', 'Cover', 'Cult', 'Door', 'East', 'Empire', 'Encounter', 'Forest', 'Fort', 'Gate',
  'Guild', 'Harbor', 'Hill', 'House', 'Inn', 'Island', 'Keep', 'King', 'Lake', 'Lord',
  'Marsh', 'Mountain', 'North', 'Order', 'Palace', 'Queen', 'River', 'Road', 'Room',
  'Scout', 'Sea', 'South', 'Temple', 'Tower', 'Town', 'Valley', 'Village', 'Water', 'West',
  'Wind', 'Wood'
]);

// Lowercase words that may legitimately sit inside a proper name. Matching
// continues through these only when the phrase begins with a capitalised word;
// trailing connectors are removed if no capitalised word follows them.
const connectorWords = new Set([
  'and', 'at', 'beneath', 'beyond', 'by', 'de', 'del', 'for', 'from', 'in', 'near',
  'of', 'on', 'the', 'to', 'under', 'upon', 'within', 'without'
]);
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

function isSentenceStart(prose: string, index: number): boolean {
  const prefix = prose.slice(0, index);
  const previous = prefix.match(/[^\s](?=\s*$)/)?.[0];
  return !previous || /[.!?;:]|[“”"'‘’()[\]{}]/u.test(previous);
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
    let finalCapitalisedIndex = index;

    while (cursor < words.length && phrase.length < 10) {
      const previous = words[cursor - 1];
      const next = words[cursor];
      const gap = prose.slice(previous.index + previous.value.length, next.index);
      if (!/^\s+$/.test(gap)) break;

      const lower = next.value.toLocaleLowerCase();
      if (!isCapitalised(next.value) && !connectorWords.has(lower)) break;

      phrase.push(next.value);
      if (isCapitalised(next.value)) finalCapitalisedIndex = cursor;
      cursor += 1;
    }

    // A connector is part of the name only when another capitalised word follows
    // it. This captures “Temple of the Dark Ones” but not “Temple of the”.
    const retainedLength = finalCapitalisedIndex - index + 1;
    phrase.splice(retainedLength);

    const name = phrase.join(' ');
    if (name.length < 4) continue;

    if (phrase.length === 1) {
      if (ignoredSingleNames.has(name) || genericSingleNames.has(name)) continue;
      if (name === name.toLocaleUpperCase()) continue;
      if (isSentenceStart(prose, current.index)) candidates.push(`${name}\u0000sentence-start`);
      else candidates.push(name);
      continue;
    }

    candidates.push(name);
    // Do not also suggest nested fragments such as “Dark Ones” after already
    // detecting the complete “Temple of the Dark Ones”.
    index = finalCapitalisedIndex;
  }

  return candidates;
}

/**
 * Finds probable proper names without AI or source rewriting. Capitalised words
 * inside prose are eligible immediately when they are not generic terms. Words
 * seen only at sentence starts still need repetition, while complete connector
 * phrases such as “Temple of the Dark Ones” are treated as one candidate.
 */
export function findUnresolvedNames(sources: readonly string[], knownNames: Iterable<string>): UnresolvedName[] {
  const known = new Set([...knownNames].map(normaliseName).filter(Boolean));
  const counts = new Map<string, { name: string; count: number; sentenceStarts: number }>();

  for (const source of sources) {
    for (const rawCandidate of candidatesFromSource(source)) {
      const sentenceStart = rawCandidate.endsWith('\u0000sentence-start');
      const candidate = rawCandidate.replace(/\u0000sentence-start$/, '');
      const key = normaliseName(candidate);
      if (!key || known.has(key)) continue;
      const existing = counts.get(key);
      counts.set(key, existing
        ? { ...existing, count: existing.count + 1, sentenceStarts: existing.sentenceStarts + (sentenceStart ? 1 : 0) }
        : { name: candidate, count: 1, sentenceStarts: sentenceStart ? 1 : 0 });
    }
  }

  return [...counts.values()]
    .filter((item) => {
      if (item.name.includes(' ')) return true;
      // A capitalised term used mid-sentence is deliberate enough to review on
      // first use. Sentence-start-only terms require repetition to avoid noise.
      if (item.sentenceStarts < item.count) return true;
      return item.count >= 3;
    })
    .map(({ name, count }) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}
