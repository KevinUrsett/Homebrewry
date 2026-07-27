import { normaliseHomebrewerySource } from './homebrewery';

export type RendererBlock =
  | { type: 'markdown'; content: string }
  | { type: 'callout'; variant: 'note' | 'warning' | 'tip' | 'descriptive'; title?: string; content: string }
  | { type: 'statblock' | 'item' | 'spell'; content: string; classes?: string[] }
  | { type: 'columns' | 'wide'; content: string }
  | { type: 'homebrewery'; content: string; classes: string[] }
  | { type: 'spacer'; size: number }
  | { type: 'pagebreak' | 'columnbreak' };

const calloutTypes = new Set(['note', 'warning', 'tip', 'descriptive']);
const characterTypes = new Set(['statblock', 'item', 'spell']);
const safeClassPattern = /^[a-z][a-z0-9_-]*$/i;

function parseClasses(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => safeClassPattern.test(token));
}

export function parseRendererBlocks(source: string): RendererBlock[] {
  const lines = normaliseHomebrewerySource(source).split('\n');
  const blocks: RendererBlock[] = [];
  let markdown: string[] = [];

  const flushMarkdown = () => {
    const content = markdown.join('\n').trim();
    if (content) blocks.push({ type: 'markdown', content });
    markdown = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const directive = lines[index].match(/^:::(note|warning|tip|descriptive|columns|wide|homebrewery|statblock|item|spell|pagebreak|columnbreak|spacer)(?:\s+(.+))?\s*$/i);
    if (directive) {
      flushMarkdown();
      const kind = directive[1].toLowerCase();
      const argument = directive[2]?.trim();

      if (kind === 'pagebreak' || kind === 'columnbreak') {
        blocks.push({ type: kind });
        continue;
      }
      if (kind === 'spacer') {
        const size = Number.parseInt(argument ?? '1', 10);
        blocks.push({ type: 'spacer', size: Number.isFinite(size) ? Math.max(1, Math.min(size, 8)) : 1 });
        continue;
      }

      const content: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== ':::') {
        content.push(lines[index]);
        index += 1;
      }
      if (index >= lines.length) {
        markdown.push(lines.slice(index - content.length - 1).join('\n'));
        break;
      }

      const blockContent = content.join('\n').trim();
      if (kind === 'columns' || kind === 'wide') blocks.push({ type: kind, content: blockContent });
      if (kind === 'homebrewery') blocks.push({ type: 'homebrewery', classes: parseClasses(argument), content: blockContent });
      if (characterTypes.has(kind)) blocks.push({ type: kind as 'statblock' | 'item' | 'spell', classes: parseClasses(argument), content: blockContent });
      if (calloutTypes.has(kind)) blocks.push({ type: 'callout', variant: kind as 'note' | 'warning' | 'tip' | 'descriptive', title: argument, content: blockContent });
      continue;
    }

    const fence = lines[index].match(/^```(statblock|item|spell)\s*$/i);
    if (fence) {
      flushMarkdown();
      const type = fence[1].toLowerCase() as 'statblock' | 'item' | 'spell';
      const content: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '```') {
        content.push(lines[index]);
        index += 1;
      }
      if (index >= lines.length) {
        markdown.push(`\`\`\`${type}\n${content.join('\n')}`);
        break;
      }
      blocks.push({ type, content: content.join('\n').trim() });
      continue;
    }

    markdown.push(lines[index]);
  }

  flushMarkdown();
  return blocks;
}

/**
 * Retained for older callers and tests. The live preview now renders a single
 * continuous document and does not use this pagination helper.
 */
export function splitRendererPages(blocks: RendererBlock[]): RendererBlock[][] {
  const pages: RendererBlock[][] = [[]];
  for (const block of blocks) {
    if (block.type === 'pagebreak') {
      if (pages.at(-1)?.length) pages.push([]);
      continue;
    }
    pages.at(-1)?.push(block);
  }
  return pages.filter((page) => page.length > 0);
}
