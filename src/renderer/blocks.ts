export type RendererBlock =
  | { type: 'markdown'; content: string }
  | { type: 'callout'; variant: 'note' | 'warning' | 'tip' | 'descriptive'; title?: string; content: string }
  | { type: 'statblock' | 'item' | 'spell'; content: string }
  | { type: 'columns'; content: string }
  | { type: 'pagebreak' };

const calloutTypes = new Set(['note', 'warning', 'tip', 'descriptive']);
export function parseRendererBlocks(source: string): RendererBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: RendererBlock[] = [];
  let markdown: string[] = [];

  const flushMarkdown = () => {
    const content = markdown.join('\n').trim();
    if (content) blocks.push({ type: 'markdown', content });
    markdown = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const directive = lines[index].match(/^:::(note|warning|tip|descriptive|columns|pagebreak)(?:\s+(.+))?\s*$/i);
    if (directive) {
      flushMarkdown();
      const kind = directive[1].toLowerCase();
      if (kind === 'pagebreak') {
        blocks.push({ type: 'pagebreak' });
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
      if (kind === 'columns') blocks.push({ type: 'columns', content: content.join('\n').trim() });
      if (calloutTypes.has(kind)) blocks.push({ type: 'callout', variant: kind as 'note' | 'warning' | 'tip' | 'descriptive', title: directive[2]?.trim(), content: content.join('\n').trim() });
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
