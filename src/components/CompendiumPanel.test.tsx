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
  data: {
    size: 'L',
    type: 'aberration',
    cr: '10',
    environments: ['underdark', 'underwater']
  },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const wolf: CatalogueEntry = {
  id: 'wolf',
  category: 'monster',
  name: 'Wolf',
  description: 'A hunting beast.',
  data: {
    size: 'M',
    type: 'beast',
    cr: '1/4',
    environments: ['forest', 'grassland']
  },
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

async function renderCompendium(onCreateWorldbuilding = vi.fn(), catalogueSelection: CatalogueEntry | null = null) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      <CompendiumPanel
        catalogueEntries={[monster, wolf]}
        catalogueError={null}
        catalogueLoading={false}
        catalogueSelection={catalogueSelection}
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

    expect(container.textContent).not.toContain('Rules & monsters');
    const categoryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Category'));
    await act(async () => categoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const monsterCategory = Array.from(container.querySelectorAll('.compendium-category-list button')).find((button) => button.textContent?.includes('Monsters'));
    await act(async () => monsterCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const results = Array.from(container.querySelectorAll('.compendium-result')).map((item) => item.textContent);
    expect(results.join(' ')).toContain('Aboleth');
    expect(results.join(' ')).toContain('Ashling');
  });

  it('filters catalogue monsters by type, CR, size, and environment', async () => {
    const container = await renderCompendium();
    const categoryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Category'));
    await act(async () => categoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const monsterCategory = Array.from(container.querySelectorAll('.compendium-category-list button')).find((button) => button.textContent?.includes('Monsters'));
    await act(async () => monsterCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const type = container.querySelector('select[aria-label="Filter monsters by type"]') as HTMLSelectElement;
    const challenge = container.querySelector('select[aria-label="Filter monsters by challenge rating"]') as HTMLSelectElement;
    const size = container.querySelector('select[aria-label="Filter monsters by size"]') as HTMLSelectElement;
    const environment = container.querySelector('select[aria-label="Filter monsters by environment"]') as HTMLSelectElement;
    expect(type).toBeTruthy();
    expect(challenge).toBeTruthy();
    expect(size).toBeTruthy();
    expect(environment).toBeTruthy();

    await act(async () => {
      type.value = 'beast';
      type.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.compendium-results')?.textContent).toContain('Wolf');
    expect(container.querySelector('.compendium-results')?.textContent).not.toContain('Aboleth');

    await act(async () => {
      type.value = '';
      type.dispatchEvent(new Event('change', { bubbles: true }));
      challenge.value = '10';
      challenge.dispatchEvent(new Event('change', { bubbles: true }));
      size.value = 'L';
      size.dispatchEvent(new Event('change', { bubbles: true }));
      environment.value = 'underdark';
      environment.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const filtered = container.querySelector('.compendium-results')?.textContent ?? '';
    expect(filtered).toContain('Aboleth');
    expect(filtered).not.toContain('Wolf');
  });

  it('sorts monsters by challenge rating', async () => {
    const container = await renderCompendium();
    const categoryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Category'));
    await act(async () => categoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const monsterCategory = Array.from(container.querySelectorAll('.compendium-category-list button')).find((button) => button.textContent?.includes('Monsters'));
    await act(async () => monsterCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const sort = container.querySelector('select[aria-label="Sort monsters"]') as HTMLSelectElement;
    await act(async () => {
      sort.value = 'cr-asc';
      sort.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const names = Array.from(container.querySelectorAll('.compendium-result')).map((result) => result.textContent);
    expect(names[0]).toContain('Wolf');
    expect(names[1]).toContain('Aboleth');
  });

  it('creates a campaign Monster when Monsters is the selected category', async () => {
    const onCreateWorldbuilding = vi.fn().mockReturnValue('new-monster');
    const container = await renderCompendium(onCreateWorldbuilding);
    const categoryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Category'));
    await act(async () => categoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const monsterCategory = Array.from(container.querySelectorAll('.compendium-category-list button')).find((button) => button.textContent?.includes('Monsters'));
    await act(async () => monsterCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const addButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '+ Add');
    await act(async () => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const newCampaignEntry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'New campaign entry');
    await act(async () => newCampaignEntry?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onCreateWorldbuilding).toHaveBeenCalledWith('creature');
  });

  it('opens a tapped entry as a full-page detail view', async () => {
    const container = await renderCompendium();
    const aboleth = Array.from(container.querySelectorAll('.compendium-result')).find((button) => button.textContent?.includes('Aboleth'));
    await act(async () => aboleth?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.querySelector('.compendium-detail-shell')?.textContent).toContain('Aboleth');
    expect(container.textContent).toContain('Insert reference into brew');
  });
});
