import { describe, expect, it } from 'vitest';
import { getOutline } from './outline';

describe('getOutline', () => {
  it('returns nested headings with stable ids', () => {
    expect(getOutline('# Intro\n## Rules\n## Rules\n##### Ignore me')).toEqual([
      { id: 'intro', level: 1, text: 'Intro' },
      { id: 'rules', level: 2, text: 'Rules' },
      { id: 'rules-2', level: 2, text: 'Rules' }
    ]);
  });
});
