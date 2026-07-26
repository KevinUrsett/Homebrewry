/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorldbuildingEntry } from '../types';
import { WorldbuildingPanel } from './WorldbuildingPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry: WorldbuildingEntry = {
  id: 'sund-id',
  name: 'Sund',
  kind: 'town',
  aliases: ['City of Worship'],
  notes: 'A city built around the old road.',
  createdAt: '2026-07-26T12:00:00.000Z',
  updatedAt: '2026-07-26T12:00:00.000Z',
  version: 1
};

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

describe('WorldbuildingPanel', () => {
  it('opens selected entries in preview mode and saves only through explicit Edit mode', async () => {
    const onUpdate = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(
        <WorldbuildingPanel
          catalogue={new Map()}
          catalogueCategories={[]}
          entries={[entry]}
          onCreate={vi.fn()}
          onCreateType={vi.fn()}
          onCreateCatalogueReference={vi.fn()}
          onCreateWorldbuildingReference={vi.fn()}
          onDelete={vi.fn()}
          onReferenceOpen={vi.fn()}
          onSelect={vi.fn()}
          onUpdate={onUpdate}
          onWorldbuildingOpen={vi.fn()}
          selectedId={entry.id}
          syncState="synced"
          types={[]}
          worldbuilding={new Map([[entry.id, entry]])}
        />
      );
    });

    expect(container.querySelector('.worldbuilding-entry-preview')?.textContent).toContain('A city built around the old road.');
    expect(container.querySelector('#worldbuilding-name')).toBeNull();

    const edit = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Edit');
    await act(async () => {
      edit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector<HTMLInputElement>('#worldbuilding-name')?.value).toBe('Sund');
    const save = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save');
    await act(async () => {
      save?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: entry.id, name: 'Sund', version: 2 }));
  });
});
