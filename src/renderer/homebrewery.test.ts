import { describe, expect, it } from 'vitest';
import { normaliseHomebrewerySource } from './homebrewery';
import { parseRendererBlocks } from './blocks';

describe('Homebrewery compatibility', () => {
  it('converts page, column, and vertical spacing commands without changing stored source', () => {
    const source = 'First\n\n\\page\n\nSecond\n\n\\column\n\n::';
    const normalised = normaliseHomebrewerySource(source);

    expect(normalised).toContain(':::pagebreak');
    expect(normalised).toContain(':::columnbreak');
    expect(normalised).toContain(':::spacer 2');
    expect(source).toContain('\\page');
  });

  it('parses common v3 callout and monster wrappers', () => {
    const blocks = parseRendererBlocks('{{note\n##### Remember\nKeep the key safe.\n}}\n\n{{monster,frame\nAsh Scout\n\n**Armor Class** 15\n}}');

    expect(blocks).toEqual([
      { type: 'callout', variant: 'note', content: '##### Remember\nKeep the key safe.' },
      { type: 'statblock', classes: ['frame'], content: 'Ash Scout\n\n**Armor Class** 15' }
    ]);
  });

  it('retains safe generic classes while discarding ids and inline style declarations', () => {
    const blocks = parseRendererBlocks('{{purple,#book,text-align:center,background:#aa88aa55\nMy favorite book.\n}}');

    expect(blocks).toEqual([
      { type: 'homebrewery', classes: ['purple'], content: 'My favorite book.' }
    ]);
  });

  it('leaves incomplete Homebrewery blocks verbatim', () => {
    const source = '{{descriptive\nThe source is unfinished.';
    expect(normaliseHomebrewerySource(source)).toBe(source);
  });
});
