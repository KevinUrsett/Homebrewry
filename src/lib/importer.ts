export type ImportReport = {
  content: string;
  notices: string[];
};

type HomebreweryBlockKind = 'descriptive' | 'note';

/**
 * Converts only complete, line-based Homebrewery wrappers. Incomplete source
 * is retained verbatim so import never drops a paragraph while guessing.
 */
function convertHomebreweryBlocks(source: string): { content: string; converted: Record<HomebreweryBlockKind, number>; incomplete: HomebreweryBlockKind[] } {
  const lines = source.split('\n');
  const output: string[] = [];
  const converted: Record<HomebreweryBlockKind, number> = { descriptive: 0, note: 0 };
  const incomplete: HomebreweryBlockKind[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^\s*\{\{\s*(descriptive|note)\b[^}]*$/i);
    if (!opening) {
      output.push(lines[index]);
      continue;
    }

    const kind = opening[1].toLowerCase() as HomebreweryBlockKind;
    const closingIndex = lines.findIndex((line, candidateIndex) => candidateIndex > index && /^\s*\}\}\s*$/.test(line));
    if (closingIndex === -1) {
      incomplete.push(kind);
      output.push(lines[index]);
      continue;
    }

    output.push(`:::${kind}`);
    output.push(...lines.slice(index + 1, closingIndex));
    output.push(':::');
    converted[kind] += 1;
    index = closingIndex;
  }

  return { content: output.join('\n'), converted, incomplete };
}

export function importHomebrewerySource(source: string): ImportReport {
  const notices: string[] = [];
  let content = source.replace(/\r\n/g, '\n');

  if (/<script\b/i.test(content)) {
    content = content.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    notices.push('Removed script tags for safety.');
  }
  if (/^\s*\\page\s*$/m.test(content)) {
    content = content.replace(/^\s*\\page\s*$/gm, ':::pagebreak');
    notices.push('Converted \\page commands to page breaks.');
  }
  const convertedBlocks = convertHomebreweryBlocks(content);
  content = convertedBlocks.content;
  if (convertedBlocks.converted.descriptive) {
    notices.push(`Converted ${convertedBlocks.converted.descriptive} descriptive block${convertedBlocks.converted.descriptive === 1 ? '' : 's'} to read-aloud callouts.`);
  }
  if (convertedBlocks.converted.note) {
    notices.push(`Converted ${convertedBlocks.converted.note} note block${convertedBlocks.converted.note === 1 ? '' : 's'} to note callouts.`);
  }
  if (/^\s*\\column\s*$/m.test(content)) notices.push('Column commands were retained as source; review them after import.');
  if (convertedBlocks.incomplete.includes('descriptive')) notices.push('An incomplete descriptive block was retained as source for review.');
  if (convertedBlocks.incomplete.includes('note')) notices.push('An incomplete note block was retained as source for review.');
  if (/<style\b/i.test(content)) notices.push('Style tags were retained as source but are not executed or rendered.');

  return { content: content.trim(), notices };
}

export function titleFromImportedSource(content: string, fallback = 'Imported Brew') {
  const heading = content.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1];
  return heading?.replace(/[*_`]/g, '').trim() || fallback;
}
