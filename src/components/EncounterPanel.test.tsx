/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueEntry } from '../catalogue/types';
import type { CampaignEntity, Encounter, EntityCurrentState } from '../types';
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
const talon: CampaignEntity = {
  id: 'worldbuilding:talon',
  campaignId: 'campaign-1',
  kind: 'npc',
  name: 'Talon Bloodwing',
  aliases: ['Talon'],
  source: { kind: 'worldbuilding', id: 'talon' },
  createdAt: '2026-07-26T10:00:00.000Z',
  updatedAt: '2026-07-26T10:00:00.000Z',
  version: 1
};
const trackedEncounter: Encounter = {
  ...encounter,
  id: 'encounter-with-hp',
  participants: [{
    id: 'rook',
    kind: 'player',
    name: 'Rook',
    armorClass: 16,
    maxHitPoints: 42,
    currentHitPoints: 42,
    initiative: 14
  }]
};
const talonState: EntityCurrentState = {
  campaignId: 'campaign-1',
  entityId: talon.id,
  fields: {
    status: {
      value: 'alive',
      eventId: 'event-1',
      updatedAt: '2026-07-26T10:00:00.000Z',
      authority: 'manual'
    }
  }
};

describe('EncounterPanel monster browser', () => {
  it('places the edited encounter into the active brew through the shared insertion flow', async () => {
    const onInsertReference = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(<EncounterPanel encounters={[encounter]} loading={false} monsters={[]} onCreateEncounter={vi.fn()} onCreatePartyMember={vi.fn()} onDeleteEncounter={vi.fn()} onDeletePartyMember={vi.fn()} onInsertReference={onInsertReference} onSelectEncounter={vi.fn()} onUpdateEncounter={vi.fn()} onUpdatePartyMember={vi.fn()} partyMembers={[]} selectedId={encounter.id} syncState="synced" />);
    });

    const edit = container.querySelector<HTMLButtonElement>('[aria-label="Edit Test encounter"]');
    await act(async () => edit?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const place = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Place in brew');
    await act(async () => place?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onInsertReference).toHaveBeenCalledWith(encounter);
  });

  it('loads the full catalogue so the user is not trapped in the first results', async () => {
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

    const addCombatant = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Add combatant');
    await act(async () => {
      addCombatant?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const catalogueTab = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Catalogue');
    await act(async () => {
      catalogueTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelectorAll('.encounter-monster-result')).toHaveLength(31);
  });

  it('uses the Compendium book-source filters when adding catalogue monsters', async () => {
    const filterableMonsters: CatalogueEntry[] = [
      {
        id: 'aboleth',
        category: 'monster',
        name: 'Aboleth',
        description: '',
        data: { size: 'L', type: 'aberration, Monster Manual', cr: '10', environments: ['underdark'] },
        source: 'Private import',
        ruleset: '5.5e'
      },
      {
        id: 'displacer-beast',
        category: 'monster',
        name: 'Displacer Beast',
        description: '',
        data: { size: 'L', type: 'beast, Monster Manual', cr: '3', environments: ['forest'] },
        source: 'SRD-521',
        ruleset: '5.5e'
      },
      {
        id: 'dire-wolf',
        category: 'monster',
        name: 'Dire Wolf',
        description: '',
        data: { size: 'L', type: "beast, Mordenkainen's Tome Of Foes", cr: '1', environments: ['forest'] },
        source: 'SRD-521',
        ruleset: '5e'
      }
    ];
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(
        <EncounterPanel
          encounters={[encounter]}
          loading={false}
          monsters={filterableMonsters}
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

    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Add combatant')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Catalogue')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const bookSource = container.querySelector('select[aria-label="Filter encounter monsters by book source"]') as HTMLSelectElement;
    const type = container.querySelector('select[aria-label="Filter encounter monsters by type"]') as HTMLSelectElement;
    const challenge = container.querySelector('select[aria-label="Filter encounter monsters by challenge rating"]') as HTMLSelectElement;
    const size = container.querySelector('select[aria-label="Filter encounter monsters by size"]') as HTMLSelectElement;
    const environment = container.querySelector('select[aria-label="Filter encounter monsters by environment"]') as HTMLSelectElement;
    const importSource = container.querySelector('select[aria-label="Filter encounter monsters by import source"]') as HTMLSelectElement;
    expect(bookSource).toBeTruthy();
    expect(Array.from(bookSource.options).map((option) => option.textContent)).toContain('Monster Manual');
    expect(Array.from(bookSource.options).map((option) => option.textContent)).not.toContain('Private import');
    expect(Array.from(type.options).map((option) => option.value)).toEqual(['', 'aberration', 'beast']);
    expect(challenge).toBeTruthy();
    expect(size).toBeTruthy();
    expect(environment).toBeTruthy();
    expect(container.querySelector('.encounter-monster-advanced-filters')?.textContent).toContain('Import source');

    await act(async () => {
      bookSource.value = 'Monster Manual';
      bookSource.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.encounter-monster-results')?.textContent).toContain('Aboleth');
    expect(container.querySelector('.encounter-monster-results')?.textContent).toContain('Displacer Beast');
    expect(container.querySelector('.encounter-monster-results')?.textContent).not.toContain('Dire Wolf');

    await act(async () => {
      type.value = 'beast';
      type.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.encounter-monster-results')?.textContent).toContain('Displacer Beast');
    expect(container.querySelector('.encounter-monster-results')?.textContent).not.toContain('Aboleth');

    const clearFilters = container.querySelector<HTMLButtonElement>('button[aria-label="Clear encounter monster filters"]');
    await act(async () => clearFilters?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => {
      challenge.value = '1';
      challenge.dispatchEvent(new Event('change', { bubbles: true }));
      size.value = 'L';
      size.dispatchEvent(new Event('change', { bubbles: true }));
      environment.value = 'forest';
      environment.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.encounter-monster-results')?.textContent).toContain('Dire Wolf');
    expect(container.querySelector('.encounter-monster-results')?.textContent).not.toContain('Displacer Beast');

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Clear encounter monster filters"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => {
      importSource.value = 'Private import';
      importSource.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('.encounter-monster-results')?.textContent).toContain('Aboleth');
    expect(container.querySelector('.encounter-monster-results')?.textContent).not.toContain('Displacer Beast');
  });

  it('keeps the picker open after adding a monster so several can be added', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const onUpdateEncounter = vi.fn();
    await act(async () => {
      root.render(<EncounterPanel encounters={[encounter]} loading={false} monsters={[monster(1)]} onCreateEncounter={vi.fn()} onCreatePartyMember={vi.fn()} onDeleteEncounter={vi.fn()} onDeletePartyMember={vi.fn()} onInsertReference={vi.fn()} onSelectEncounter={vi.fn()} onUpdateEncounter={onUpdateEncounter} onUpdatePartyMember={vi.fn()} partyMembers={[]} selectedId={encounter.id} syncState="synced" />);
    });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Add combatant')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Catalogue')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { Array.from(container.querySelectorAll('.encounter-monster-result button')).find((button) => button.textContent === 'Add')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onUpdateEncounter).toHaveBeenCalledWith(expect.objectContaining({ participants: [expect.objectContaining({ kind: 'monster' })] }));
    expect(container.querySelector('.encounter-picker')).not.toBeNull();
  });

  it('adds a confirmed Worldbuilding NPC with its current status and stable entity link', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const onUpdateEncounter = vi.fn();

    await act(async () => {
      root.render(
        <EncounterPanel
          currentStateByEntityId={new Map([[talon.id, talonState]])}
          encounters={[encounter]}
          loading={false}
          monsters={[]}
          npcEntities={[talon]}
          onCreateEncounter={vi.fn()}
          onCreatePartyMember={vi.fn()}
          onDeleteEncounter={vi.fn()}
          onDeletePartyMember={vi.fn()}
          onInsertReference={vi.fn()}
          onSelectEncounter={vi.fn()}
          onUpdateEncounter={onUpdateEncounter}
          onUpdatePartyMember={vi.fn()}
          partyMembers={[]}
          selectedId={encounter.id}
          syncState="synced"
        />
      );
    });

    const editName = container.querySelector<HTMLButtonElement>('button[aria-label="Edit encounter name"]');
    expect(editName?.querySelector('svg')).toBeTruthy();
    expect(editName?.textContent).toBe('');

    const addCombatant = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Add combatant');
    await act(async () => {
      addCombatant?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const npcTab = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Worldbuilding NPCs');
    await act(async () => {
      npcTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Current status: alive');
    const addNpc = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Add');
    await act(async () => {
      addNpc?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onUpdateEncounter).toHaveBeenCalledWith(expect.objectContaining({
      participants: [expect.objectContaining({ entityId: talon.id, kind: 'npc' })]
    }));
  });

  it('defaults Enter in the HP calculator to damage and reduces current HP', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const onUpdateEncounter = vi.fn();

    await act(async () => {
      root.render(
        <EncounterPanel
          encounters={[trackedEncounter]}
          loading={false}
          monsters={[]}
          onCreateEncounter={vi.fn()}
          onCreatePartyMember={vi.fn()}
          onDeleteEncounter={vi.fn()}
          onDeletePartyMember={vi.fn()}
          onInsertReference={vi.fn()}
          onSelectEncounter={vi.fn()}
          onUpdateEncounter={onUpdateEncounter}
          onUpdatePartyMember={vi.fn()}
          partyMembers={[]}
          selectedId={trackedEncounter.id}
          syncState="synced"
        />
      );
    });

    const hpButton = container.querySelector<HTMLButtonElement>('.combatant-hp-button');
    expect(hpButton?.textContent).toContain('42/ 42');
    await act(async () => {
      hpButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Rook HP change"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setValue?.call(input, '10');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });

    expect(onUpdateEncounter).toHaveBeenCalledWith(expect.objectContaining({
      participants: [expect.objectContaining({ id: 'rook', currentHitPoints: 32 })]
    }));
  });

  it('offers an explicit End combat action for an active encounter', async () => {
    const activeEncounter = { ...trackedEncounter, status: 'active' as const, activeCombatantId: 'rook' };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const onEndCombat = vi.fn();

    await act(async () => {
      root.render(
        <EncounterPanel
          encounters={[activeEncounter]}
          loading={false}
          monsters={[]}
          onCreateEncounter={vi.fn()}
          onCreatePartyMember={vi.fn()}
          onDeleteEncounter={vi.fn()}
          onDeletePartyMember={vi.fn()}
          onEndCombat={onEndCombat}
          onInsertReference={vi.fn()}
          onSelectEncounter={vi.fn()}
          onUpdateEncounter={vi.fn()}
          onUpdatePartyMember={vi.fn()}
          partyMembers={[]}
          selectedId={activeEncounter.id}
          syncState="synced"
        />
      );
    });

    const endCombat = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'End combat');
    await act(async () => {
      endCombat?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onEndCombat).toHaveBeenCalledWith(activeEncounter);
  });
});
