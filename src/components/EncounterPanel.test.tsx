/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueEntry } from '../catalogue/types';
import type { Encounter } from '../types';
import { EncounterPanel } from './EncounterPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

function monster(index: number): CatalogueEntry {
  return {
    id: `monster-${index}`,
    category: 'monster',
    name: `Monster ${index.toString().padStart(2, '0')}`,
    description: '',
    data: {},
    source: 'SRD-521',
    ruleset: '5.5e'
  };
}

const encounter: Encounter = {
  id: 'encounter-1',
  name: 'Test encounter',
  status: 'not-started',
  optional: false,
  participants: [],
  activeCombatantId: null,
  createdAt: '2026-07-26T10:00:00.000Z',
  updatedAt: '2026-07-26T10:00:00.000Z',
  version: 1
};

describe('EncounterPanel monster browser', () => {
  it('reveals more catalogue monsters instead of trapping the user in the first results', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(
        <EncounterPanel
          encounters={[encounter]}
          loading={false}
          monsters={Array.from({ length: 31 }, (_, index) => monster(index + 1))}
          onCreateEncounter={vi.fn()}
          onCreatePartyMember={vi.fn()}
          onDeleteEncounter={vi.fn()}
          onDeletePartyMember={vi.fn()}
          onInsertReference={vi.fn()}
          onSelectEncounter={vi.fn()}
          onUpdateEncounter={vi.fn()}
          onUpdatePartyMember={vi.fn()}
          partyMembers={[]}
          selectedId={encounter.id}
          syncState="synced"
        />
      );
    });

    expect(container.querySelectorAll('.encounter-monster-result')).toHaveLength(30);
    const showMore = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.startsWith('Show 1 more'));
    expect(showMore).toBeTruthy();

    await act(async () => {
      showMore?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelectorAll('.encounter-monster-result')).toHaveLength(31);
  });
});
