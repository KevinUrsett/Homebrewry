import { describe, expect, it } from 'vitest';
import { getOutline, insertAtOutlineSectionEnd } from './outline';

describe('getOutline', () => {
  it('returns nested headings with stable ids', () => {
    expect(getOutline('# Intro\n## Rules\n## Rules\n##### Ignore me')).toEqual([
      { id: 'intro', level: 1, text: 'Intro' },
      { id: 'rules', level: 2, text: 'Rules' },
      { id: 'rules-2', level: 2, text: 'Rules' }
    ]);
  });

  it('inserts content at the end of a selected section before its next peer', () => {
    const source = '# First\n\n## Child\nDetails\n\n# Second\nLater';

    expect(insertAtOutlineSectionEnd(source, 'first', '[[encounter:id|Bridge ambush]]')).toBe(
      '# First\n\n## Child\nDetails\n\n[[encounter:id|Bridge ambush]]\n\n# Second\nLater'
    );
    expect(insertAtOutlineSectionEnd(source, 'child', 'Nested note')).toBe(
      '# First\n\n## Child\nDetails\n\nNested note\n\n# Second\nLater'
    );
    expect(insertAtOutlineSectionEnd(source, null, 'Tail note')).toBe(
      '# First\n\n## Child\nDetails\n\n# Second\nLater\n\nTail note'
    );
  });
});
