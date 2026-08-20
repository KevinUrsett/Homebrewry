/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueEntry } from '../catalogue/types';
import type { WorldbuildingEntry } from '../types';
import { CompendiumPanel } from './CompendiumPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const monster: CatalogueEntry = {
  id: 'aboleth',
  category: 'monster',
  name: 'Aboleth',
  description: 'An ancient aberration.',
  data: { type: 'aberration' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const campaignMonster: WorldbuildingEntry = {
  id: 'ashling',
  name: 'Ashling',
  kind: 'creature',
  aliases: [],
  notes: 'A local monster shaped by the furnace vents.',
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
  version: 1
};

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

async function renderCompendium(onCreateWorldbuilding = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      <CompendiumPanel
        catalogueEntries={[monster]}
        catalogueError={null}
        catalogueLoading={false}
        catalogueSelection={monster}
        customCatalogueCategories={[]}
        customEntryCount={0}
        onCreateCatalogueReference={vi.fn()}
        onCreateCustomCategory={vi.fn()}
        onCreateType={vi.fn()}
        onCreateWorldbuilding={onCreateWorldbuilding}
        onCreateWorldbuildingReference={vi.fn()}
        onDeleteCustomEntry={vi.fn().mockResolvedValue(undefined)}
        onDeleteCustomMonster={vi.fn().mockResolvedValue(undefined)}
        onDeleteWorldbuilding={vi.fn()}
        onInsertReference={vi.fn()}
        onOpenPrivateMonsterImport={vi.fn()}
        onSaveCustomEntry={vi.fn().mockResolvedValue(undefined)}
        onSaveCustomMonster={vi.fn().mockResolvedValue(undefined)}
        onSelectCatalogue={vi.fn()}
        onSelectWorldbuilding={vi.fn()}
        onUpdateWorldbuilding={vi.fn()}
        privateMonsterCount={0}
        selectedWorldbuildingId={null}
        syncState="synced"
        types={[]}
        worldbuildingEntries={[campaignMonster]}
        worldbuildingMap={new Map([[campaignMonster.id, campaignMonster]])}
      />
    );
  });
  return container;
}

describe('CompendiumPanel', () => {
  it('merges campaign creatures and SRD monsters in the Monsters category', async () => {
    const container = await renderCompendium();

    expect(container.textContent).toContain('Monsters');
    expect(container.textContent).not.toContain('Rules & monsters');
    const monsterCategory = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Monsters'));
    await act(async () => monsterCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const results = Array.from(container.querySelectorAll('.compendium-result')).map((item) => item.textContent);
    expect(results.join(' ')).toContain('Aboleth');
    expect(results.join(' ')).toContain('Ashling');
  });

  it('creates a campaign Monster when Monsters is the selected category', async () => {
    const onCreateWorldbuilding = vi.fn().mockReturnValue('new-monster');
    const container = await renderCompendium(onCreateWorldbuilding);
    const monsterCategory = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Monsters'));
    await act(async () => monsterCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const newCampaignEntry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'New campaign entry');
    await act(async () => newCampaignEntry?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onCreateWorldbuilding).toHaveBeenCalledWith('creature');
  });
});
