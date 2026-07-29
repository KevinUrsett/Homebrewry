const blockOpeningPattern = /^\s*\{\{\s*([#\.\w-]+(?:\s*,\s*[^,\s}]+)*)?\s*$/;
const blockClosingPattern = /^\s*\}\}\s*$/;
const safeClassPattern = /^[a-z][a-z0-9_-]*$/i;

const structuralTokens = new Set([
  'columns',
  'descriptive',
  'item',
  'monster',
  'note',
  'spell',
  'statblock',
  'wide'
]);

function safeClasses(tokens: string[], excluded: Set<string>): string[] {
  return tokens
    .map((token) => token.trim().replace(/^\./, ''))
    .filter((token) => token && !token.startsWith('#') && !token.includes(':'))
    .filter((token) => safeClassPattern.test(token) && !excluded.has(token.toLowerCase()));
}

function findClosingLine(lines: string[], openingIndex: number): number {
  let depth = 1;
  for (let index = openingIndex + 1; index < lines.length; index += 1) {
    if (blockOpeningPattern.test(lines[index])) depth += 1;
    if (blockClosingPattern.test(lines[index])) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function convertBlock(descriptor: string, content: string): string[] {
  const tokens = descriptor
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  const lowerTokens = tokens.map((token) => token.replace(/^\./, '').toLowerCase());
  const tokenSet = new Set(lowerTokens);
  const classes = safeClasses(tokens, structuralTokens);
  const suffix = classes.length ? ` ${classes.join(' ')}` : '';

  if (tokenSet.has('note')) return [':::note', content, ':::'];
  if (tokenSet.has('descriptive')) return [':::descriptive', content, ':::'];
  if (tokenSet.has('monster') || tokenSet.has('statblock')) return [`:::statblock${suffix}`, content, ':::'];
  if (tokenSet.has('item')) return [`:::item${suffix}`, content, ':::'];
  if (tokenSet.has('spell')) return [`:::spell${suffix}`, content, ':::'];
  if (tokenSet.has('columns')) return [':::columns', content, ':::'];
  if (tokenSet.has('wide')) return [`:::wide${suffix}`, content, ':::'];

  return [`:::homebrewery${suffix}`, content, ':::'];
}

/**
 * Converts common, complete Homebrewery v3 constructs into the app's safe
 * renderer directives. The stored brew source is never changed by this step.
 * Incomplete or inline curly-brace syntax is retained verbatim.
 */
export function normaliseHomebrewerySource(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (/^\\page$/i.test(trimmed)) {
      output.push(':::pagebreak');
      continue;
    }
    if (/^\\column$/i.test(trimmed)) {
      output.push(':::columnbreak');
      continue;
    }
    // `:::` closes the app's safe block directives. Preserve it for the block
    // parser instead of interpreting it as Homebrewery vertical spacing.
    if (trimmed !== ':::' && /^:+$/.test(trimmed)) {
      output.push(`:::spacer ${Math.min(trimmed.length, 8)}`);
      continue;
    }

    const opening = line.match(blockOpeningPattern);
    if (!opening) {
      output.push(line);
      continue;
    }

    const closingIndex = findClosingLine(lines, index);
    if (closingIndex === -1) {
      output.push(line);
      continue;
    }

    const descriptor = opening[1] ?? '';
    const nestedContent = normaliseHomebrewerySource(lines.slice(index + 1, closingIndex).join('\n'));
    output.push(...convertBlock(descriptor, nestedContent));
    index = closingIndex;
  }

  return output.join('\n');
}
