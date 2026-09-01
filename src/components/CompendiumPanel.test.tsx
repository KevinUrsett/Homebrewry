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
    type: 'aberration, Monster Manual',
    cr: '10',
    environments: ['underdark', 'underwater']
  },
  source: 'Private import',
  ruleset: '5.5e'
};

const wolf: CatalogueEntry = {
  id: 'wolf',
  category: 'monster',
  name: 'Wolf',
  description: 'A hunting beast.',
  data: {
    size: 'M',
    type: "beast, Mordenkainen's Tome Of Foes",
    cr: '1/4',
    environments: ['forest', 'grassland']
  },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const staffOfSparks: CatalogueEntry = {
  id: 'staff-of-sparks',
  category: 'item',
  name: 'Staff of Sparks',
  description: 'A staff that flashes with contained lightning.',
  data: {
    sources: ["Dungeon Master's Guide"],
    type: 'staff',
    rarity: 'rare',
    attunement: true
  },
  source: 'Private import',
  ruleset: '5.5e'
};

const cloakOfFeathers: CatalogueEntry = {
  id: 'cloak-of-feathers',
  category: 'item',
  name: 'Cloak of Feathers',
  description: 'A cloak that always falls slowly.',
  data: {
    sources: ["Player's Handbook"],
    type: 'wondrousItem',
    rarity: 'uncommon'
  },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const sunshardBlade: CatalogueEntry = {
  id: 'sunshard-blade',
  category: 'item',
  name: 'Sunshard Blade',
  description: 'A weapon created in Homebrewry.',
  data: { type: 'meleeWeapon' },
  source: 'Custom',
  ruleset: 'Homebrewry'
};

const genericDagger: CatalogueEntry = {
  id: 'dagger',
  category: 'item',
  name: 'Dagger',
  description: 'A standard dagger.',
  data: { type: 'meleeWeapon' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const plusOneDagger: CatalogueEntry = {
  id: 'plus-one-dagger',
  category: 'item',
  name: '+1 Dagger',
  description: 'A standard dagger with a +1 bonus.',
  data: { type: 'meleeWeapon', rarity: 'uncommon' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const explorerPack: CatalogueEntry = {
  id: 'explorers-pack',
  category: 'item',
  name: "Explorer's Pack",
  description: 'A collection of ordinary adventuring supplies.',
  data: { type: 'adventuringGear' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const silentImage: CatalogueEntry = {
  id: 'silent-image',
  category: 'spell',
  name: 'Silent Image',
  description: 'A convincing visual illusion.',
  data: { sources: ["Player's Handbook"], school: 'illusion' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const emberLadder: CatalogueEntry = {
  id: 'ember-ladder',
  category: 'spell',
  name: 'Ember Ladder',
  description: 'A custom spell created in Homebrewry.',
  data: { school: 'evocation' },
  source: 'Custom',
  ruleset: 'Homebrewry'
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
        catalogueEntries={[monster, wolf, staffOfSparks, cloakOfFeathers, sunshardBlade, genericDagger, plusOneDagger, explorerPack, silentImage, emberLadder]}
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
    const source = container.querySelector('select[aria-label="Filter monsters by source"]') as HTMLSelectElement;
    const challenge = container.querySelector('select[aria-label="Filter monsters by challenge rating"]') as HTMLSelectElement;
    const size = container.querySelector('select[aria-label="Filter monsters by size"]') as HTMLSelectElement;
    const environment = container.querySelector('select[aria-label="Filter monsters by environment"]') as HTMLSelectElement;
    expect(type).toBeTruthy();
    expect(source).toBeTruthy();
    expect(Array.from(source.options).map((option) => option.textContent)).not.toContain('Private import');
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
      source.value = 'Monster Manual';
      source.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.compendium-results')?.textContent).not.toContain('Wolf');
    expect(container.querySelector('.compendium-results')?.textContent).not.toContain('Aboleth');

    await act(async () => {
      type.value = '';
      type.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.compendium-results')?.textContent).toContain('Aboleth');
    expect(container.querySelector('.compendium-results')?.textContent).not.toContain('Wolf');

    await act(async () => {
      source.value = '';
      source.dispatchEvent(new Event('change', { bubbles: true }));
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

  it('keeps mobile monster filters behind a compact, dismissible drawer', async () => {
    const container = await renderCompendium();
    const categoryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Category'));
    await act(async () => categoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const monsterCategory = Array.from(container.querySelectorAll('.compendium-category-list button')).find((button) => button.textContent?.includes('Monsters'));
    await act(async () => monsterCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const filterTrigger = container.querySelector('button[aria-controls="monster-filter-dialog"]') as HTMLButtonElement;
    expect(filterTrigger.textContent).toContain('Filter & sort');
    expect(container.querySelector('details.monster-advanced-filters')?.textContent).toContain('Import source');

    await act(async () => filterTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const drawer = container.querySelector('#monster-filter-dialog') as HTMLElement;
    expect(drawer).toBeTruthy();
    expect(filterTrigger.getAttribute('aria-expanded')).toBe('true');

    const source = drawer.querySelector('select[aria-label="Filter monsters by source"]') as HTMLSelectElement;
    await act(async () => {
      source.value = 'Monster Manual';
      source.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('button[aria-label="Clear Source filter"]')?.textContent).toContain('Monster Manual');

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('#monster-filter-dialog')).toBeNull();
  });

  it('filters items by source, type, rarity, and attunement', async () => {
    const container = await renderCompendium();
    const categoryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Category'));
    await act(async () => categoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const itemCategory = Array.from(container.querySelectorAll('.compendium-category-list button')).find((button) => button.textContent?.includes('Items'));
    await act(async () => itemCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const source = container.querySelector('select[aria-label="Filter items by source"]') as HTMLSelectElement;
    const type = container.querySelector('select[aria-label="Filter items by type"]') as HTMLSelectElement;
    const rarity = container.querySelector('select[aria-label="Filter items by rarity"]') as HTMLSelectElement;
    const attunement = container.querySelector('select[aria-label="Filter items by attunement"]') as HTMLSelectElement;
    expect(Array.from(source.options).map((option) => option.textContent)).toContain("Dungeon Master's Guide");
    expect(Array.from(source.options).map((option) => option.textContent)).not.toContain('Private import');

    await act(async () => {
      source.value = "Dungeon Master's Guide";
      source.dispatchEvent(new Event('change', { bubbles: true }));
      type.value = 'staff';
      type.dispatchEvent(new Event('change', { bubbles: true }));
      rarity.value = 'rare';
      rarity.dispatchEvent(new Event('change', { bubbles: true }));
      attunement.value = 'required';
      attunement.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.compendium-results')?.textContent).toContain('Staff of Sparks');
    expect(container.querySelector('.compendium-results')?.textContent).not.toContain('Cloak of Feathers');

    await act(async () => {
      source.value = '';
      source.dispatchEvent(new Event('change', { bubbles: true }));
      type.value = '';
      type.dispatchEvent(new Event('change', { bubbles: true }));
      rarity.value = '';
      rarity.dispatchEvent(new Event('change', { bubbles: true }));
      attunement.value = 'not-required';
      attunement.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.compendium-results')?.textContent).toContain('Cloak of Feathers');
    expect(container.querySelector('.compendium-results')?.textContent).not.toContain('Staff of Sparks');

    await act(async () => {
      attunement.value = '';
      attunement.dispatchEvent(new Event('change', { bubbles: true }));
      source.value = 'Homebrewry';
      source.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.compendium-results')?.textContent).toContain('Sunshard Blade');
    expect(container.querySelector('.compendium-results')?.textContent).not.toContain('Cloak of Feathers');
    expect(container.querySelector('.compendium-results')?.textContent).not.toContain('Staff of Sparks');

    const filterTrigger = container.querySelector('button[aria-controls="item-filter-dialog"]') as HTMLButtonElement;
    await act(async () => filterTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('#item-filter-dialog')).toBeTruthy();
    expect(filterTrigger.getAttribute('aria-expanded')).toBe('true');

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('#item-filter-dialog')).toBeNull();
  });

  it('keeps mundane gear and bare numeric enchantments out of the magic-loot browser', async () => {
    const container = await renderCompendium();
    const categoryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Category'));
    await act(async () => categoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const itemCategory = Array.from(container.querySelectorAll('.compendium-category-list button')).find((button) => button.textContent?.includes('Items'));
    await act(async () => itemCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const results = container.querySelector('.compendium-results')?.textContent ?? '';
    expect(results).toContain('Staff of Sparks');
    expect(results).toContain('Sunshard Blade');
    expect(results).not.toContain('Dagger');
    expect(results).not.toContain('+1 Dagger');
    expect(results).not.toContain("Explorer's Pack");
  });

  it('uses the same source, type, and edition filters for other compendium categories', async () => {
    const container = await renderCompendium();
    const categoryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Category'));
    await act(async () => categoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const spellCategory = Array.from(container.querySelectorAll('.compendium-category-list button')).find((button) => button.textContent?.includes('Spells'));
    await act(async () => spellCategory?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const source = container.querySelector('select[aria-label="Filter compendium by source"]') as HTMLSelectElement;
    const school = container.querySelector('select[aria-label="Filter compendium by school"]') as HTMLSelectElement;
    const edition = container.querySelector('select[aria-label="Filter compendium by edition"]') as HTMLSelectElement;
    expect(Array.from(source.options).map((option) => option.textContent)).toContain('Homebrewry');
    expect(Array.from(source.options).map((option) => option.textContent)).toContain("Player's Handbook");

    await act(async () => {
      source.value = 'Homebrewry';
      source.dispatchEvent(new Event('change', { bubbles: true }));
      school.value = 'evocation';
      school.dispatchEvent(new Event('change', { bubbles: true }));
      edition.value = 'Homebrewry';
      edition.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const results = container.querySelector('.compendium-results')?.textContent ?? '';
    expect(results).toContain('Ember Ladder');
    expect(results).not.toContain('Silent Image');
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
