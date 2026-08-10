/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogueEntryKey } from '../catalogue/types';
import type { CatalogueEntry } from '../catalogue/types';
import type { Brew, Encounter, WorldbuildingEntry } from '../types';
import { BrewPreview } from './BrewPreview';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry: CatalogueEntry = {
  id: 'c674b91f-94c8-5c80-9d1d-31bef50bc779',
  category: 'monster',
  name: 'Aboleth',
  description: 'An ancient aberration.',
  data: { type: 'aberration' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const brew: Brew = {
  id: 'brew-id',
  title: 'Reference test',
  content: 'Meet [[monster:c674b91f-94c8-5c80-9d1d-31bef50bc779|Aboleth]].',
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
  version: 1,
  rendererSettings: { accentColor: '#6a2f26', parchmentTone: 'warm' }
};

const encounter: Encounter = {
  id: '329dec56-7f04-49b2-98b2-5710e54f3de2',
  name: 'The flooded vault',
  status: 'not-started',
  optional: false,
  participants: [],
  activeCombatantId: null,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
  version: 1
};

const worldbuildingEntry: WorldbuildingEntry = {
  id: 'be2e31f0-52b4-46d9-8cb6-45e95b6cb5d9',
  name: 'Sund',
  kind: 'town',
  aliases: [],
  notes: 'A city built around the old road.',
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
  version: 1
};

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

describe('BrewPreview', () => {
  it('opens a validated catalogue reference when its rendered name is clicked', async () => {
    const onReferenceOpen = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(
        <BrewPreview
          brew={brew}
          catalogue={new Map([[catalogueEntryKey(entry), entry]])}
          onReferenceOpen={onReferenceOpen}
        />
      );
    });

    const reference = container.querySelector<HTMLButtonElement>('.catalogue-reference-link');
    expect(reference?.textContent).toBe('Aboleth');

    await act(async () => {
      reference?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onReferenceOpen).toHaveBeenCalledWith(entry);
  });

  it('opens the matching encounter from a rendered preview card', async () => {
    const onEncounterOpen = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const encounterBrew = {
      ...brew,
      content: `Run [[encounter:${encounter.id}|Old encounter name]].`
    };

    await act(async () => {
      root.render(
        <BrewPreview
          brew={encounterBrew}
          encounters={new Map([[encounter.id, encounter]])}
          onEncounterOpen={onEncounterOpen}
        />
      );
    });

    const reference = container.querySelector<HTMLButtonElement>('.brew-encounter-reference');
    expect(reference?.textContent).toContain('The flooded vault');
    expect(reference?.textContent).not.toContain('Old encounter name');

    await act(async () => {
      reference?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onEncounterOpen).toHaveBeenCalledWith(encounter);
  });

  it('opens a matching Worldbuilding entry without changing the preview tab', async () => {
    const onWorldbuildingOpen = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const worldBrew = {
      ...brew,
      content: `The road ends at [[world:${worldbuildingEntry.id}|Sund]].`
    };

    await act(async () => {
      root.render(
        <BrewPreview
          brew={worldBrew}
          onWorldbuildingOpen={onWorldbuildingOpen}
          worldbuilding={new Map([[worldbuildingEntry.id, worldbuildingEntry]])}
        />
      );
    });

    const reference = container.querySelector<HTMLButtonElement>('.worldbuilding-reference-link');
    expect(reference?.textContent).toBe('Sund');

    await act(async () => {
      reference?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onWorldbuildingOpen).toHaveBeenCalledWith(worldbuildingEntry);
  });

  it('keeps a Worldbuilding reference inside its Markdown table cell', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const tableBrew = {
      ...brew,
      content: `| Date | Traveller | Detail |\n|---|---|---|\n| 19 Unri | [[world:${worldbuildingEntry.id}|Sund]] | Passed north |`
    };

    await act(async () => {
      root.render(
        <BrewPreview
          brew={tableBrew}
          onWorldbuildingOpen={vi.fn()}
          worldbuilding={new Map([[worldbuildingEntry.id, worldbuildingEntry]])}
        />
      );
    });

    const row = container.querySelector('tbody tr');
    expect(row?.querySelectorAll('td')).toHaveLength(3);
    expect(row?.querySelector('.worldbuilding-reference-link')?.textContent).toBe('Sund');
  });

  it('keeps a Worldbuilding popover actionable for quick notes and removal', async () => {
    const onAddWorldbuildingNote = vi.fn();
    const onDeleteWorldbuildingReference = vi.fn();
    const onOpenInWorldbuilding = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const worldBrew = { ...brew, content: `Visit [[world:${worldbuildingEntry.id}|Sund]].` };

    await act(async () => {
      root.render(<BrewPreview brew={worldBrew} onAddWorldbuildingNote={onAddWorldbuildingNote} onDeleteWorldbuildingReference={onDeleteWorldbuildingReference} onOpenInWorldbuilding={onOpenInWorldbuilding} worldbuilding={new Map([[worldbuildingEntry.id, worldbuildingEntry]])} />);
    });

    const reference = container.querySelector<HTMLButtonElement>('.worldbuilding-reference-link');
    await act(async () => { reference?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const note = container.querySelector<HTMLTextAreaElement>('.reference-quick-note textarea');
    expect(note).not.toBeNull();
    await act(async () => {
      if (!note) return;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(note, 'Use the old gate.');
      note.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const addButton = [...container.querySelectorAll<HTMLButtonElement>('.reference-popover-actions button')].find((button) => button.textContent === 'Add note');
    await act(async () => { addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onAddWorldbuildingNote).toHaveBeenCalledWith(worldbuildingEntry, 'Use the old gate.');
    const openButton = [...container.querySelectorAll<HTMLButtonElement>('.reference-popover-actions button')].find((button) => button.textContent === 'Open');
    await act(async () => { openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onOpenInWorldbuilding).toHaveBeenCalledWith(worldbuildingEntry);
    const deleteButton = [...container.querySelectorAll<HTMLButtonElement>('.reference-popover-actions button')].find((button) => button.textContent === 'Delete reference');
    await act(async () => { deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onDeleteWorldbuildingReference).toHaveBeenCalledWith(worldbuildingEntry);
  });
});
