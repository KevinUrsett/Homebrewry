/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogueEntryKey, type CatalogueEntry } from '../catalogue/types';
import type { WorldbuildingEntry } from '../types';
import { ReferenceContent } from './ReferenceContent';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rancid: WorldbuildingEntry = {
  id: 'be2e31f0-52b4-46d9-8cb6-45e95b6cb5d9',
  name: 'Rancid',
  kind: 'region',
  aliases: [],
  notes: 'A wind-scoured border region.',
  createdAt: '2026-07-26T12:00:00.000Z',
  updatedAt: '2026-07-26T12:00:00.000Z',
  version: 1
};

const item: CatalogueEntry = {
  id: 'c674b91f-94c8-5c80-9d1d-31bef50bc779',
  category: 'item',
  name: 'Moon key',
  description: 'A silver key.',
  data: {},
  source: 'Custom',
  ruleset: 'Homebrewry'
};

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

describe('ReferenceContent', () => {
  it('resolves Worldbuilding and catalogue links in campaign-owned notes', async () => {
    const onWorldbuildingOpen = vi.fn();
    const onReferenceOpen = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(
        <ReferenceContent
          catalogue={new Map([[catalogueEntryKey(item), item]])}
          content={`Whispers watches [[world:${rancid.id}|Rancid]] with a [[item:${item.id}|moon key]].`}
          onReferenceOpen={onReferenceOpen}
          onWorldbuildingOpen={onWorldbuildingOpen}
          worldbuilding={new Map([[rancid.id, rancid]])}
        />
      );
    });

    const worldbuildingLink = container.querySelector<HTMLButtonElement>('.worldbuilding-reference-link');
    const catalogueLink = container.querySelector<HTMLButtonElement>('.catalogue-reference-link');
    expect(worldbuildingLink?.textContent).toBe('Rancid');
    expect(catalogueLink?.textContent).toBe('moon key');

    await act(async () => {
      worldbuildingLink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      catalogueLink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onWorldbuildingOpen).toHaveBeenCalledWith(rancid);
    expect(onReferenceOpen).toHaveBeenCalledWith(item);
  });
});
