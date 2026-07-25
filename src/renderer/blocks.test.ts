import { describe, expect, it } from 'vitest';
import { parseRendererBlocks, splitRendererPages } from './blocks';

describe('renderer block parser', () => {
  it('extracts supported blocks without treating their contents as raw HTML', () => {
    const blocks = parseRendererBlocks('# Intro\n\n:::note Remember\nKeep it safe.\n:::\n\n```statblock\nAsh Scout\n```');

    expect(blocks).toEqual([
      { type: 'markdown', content: '# Intro' },
      { type: 'callout', variant: 'note', title: 'Remember', content: 'Keep it safe.' },
      { type: 'statblock', content: 'Ash Scout' }
    ]);
  });

  it('creates explicit preview pages only at pagebreak directives', () => {
    const pages = splitRendererPages(parseRendererBlocks('First\n\n:::pagebreak\n\nSecond'));
    expect(pages).toHaveLength(2);
    expect(pages[1][0]).toMatchObject({ content: 'Second' });
  });
});
