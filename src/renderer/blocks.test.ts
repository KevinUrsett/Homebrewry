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

  it('parses descriptive callouts as a separate rendered box', () => {
    const blocks = parseRendererBlocks('Before\n\n:::descriptive\nRead this aloud.\n:::\n\nAfter');

    expect(blocks).toEqual([
      { type: 'markdown', content: 'Before' },
      { type: 'callout', variant: 'descriptive', content: 'Read this aloud.' },
      { type: 'markdown', content: 'After' }
    ]);
  });

  it('supports titled dungeon shorthand and uses the last image as its map', () => {
    const blocks = parseRendererBlocks(':::Temple of Silvin\n![Placeholder](asset://missing)\n![Temple map](asset://map-2638)\n1 | Room one\n2 | Room two\n:::');

    expect(blocks).toEqual([
      {
        type: 'dungeon',
        title: 'Temple of Silvin',
        mapSource: 'asset://map-2638',
        rooms: [
          { number: '1', title: 'Room one' },
          { number: '2', title: 'Room two' }
        ],
        markers: []
      }
    ]);
  });

  it('parses placed dungeon room markers', () => {
    const [block] = parseRendererBlocks(':::dungeon Temple\n![Map](asset://map)\n1 | Gate\n::map-marker 1 42.5 61\n:::');
    expect(block).toMatchObject({ type: 'dungeon', markers: [{ number: '1', x: 42.5, y: 61 }] });
  });
});
