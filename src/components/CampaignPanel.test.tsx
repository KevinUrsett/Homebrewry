/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Brew } from '../types';

vi.mock('./CampaignMapPanel', () => ({ CampaignMapPanel: () => <section>Campaign map</section> }));
vi.mock('./PlotBoardPanel', () => ({ PlotBoardPanel: () => <section>Plot board</section> }));

import { CampaignPanel } from './CampaignPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];
const cardOrderStorageKey = 'homebrewry-campaign-card-order-v1';

const brew: Brew = {
  id: 'brew-1',
  title: 'Campaign notes',
  content: '# Notes',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  version: 1,
  rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' }
};

beforeEach(() => localStorage.removeItem(cardOrderStorageKey));
afterEach(() => mounted.splice(0).forEach(({ container, root }) => { act(() => root.unmount()); container.remove(); }));

describe('CampaignPanel card arrangement', () => {
  it('reorders the overview cards and stores the preference locally', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(<CampaignPanel
        brews={[brew]}
        currentStateByEntityId={new Map()}
        encounters={[]}
        entities={[]}
        entityReferences={[]}
        onOpenEncounter={vi.fn()}
        onOpenEntity={vi.fn()}
        onSaveCampaignMap={vi.fn()}
        onSavePlotBoard={vi.fn()}
        onSetCurrentBrew={vi.fn()}
        partyLocation={null}
        position={null}
        worldEvents={[]}
        worldbuildingEntries={[]}
      />);
    });

    const arrange = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Arrange cards');
    await act(async () => arrange?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const move = container.querySelector<HTMLButtonElement>('[aria-label="Move Current brew down"]');
    await act(async () => move?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const ids = Array.from(container.querySelectorAll<HTMLElement>('.campaign-hero-grid [data-campaign-card-id]')).map((card) => card.dataset.campaignCardId);
    expect(ids).toEqual(['party-location', 'current-brew', 'campaign-now']);
    expect(JSON.parse(localStorage.getItem(cardOrderStorageKey) ?? '{}').overview).toEqual(ids);
  });

  it('reorders the Plot board and Campaign map workspaces and stores the preference locally', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(<CampaignPanel
        brews={[brew]}
        currentStateByEntityId={new Map()}
        encounters={[]}
        entities={[]}
        entityReferences={[]}
        onOpenEncounter={vi.fn()}
        onOpenEntity={vi.fn()}
        onSaveCampaignMap={vi.fn()}
        onSavePlotBoard={vi.fn()}
        onSetCurrentBrew={vi.fn()}
        partyLocation={null}
        position={null}
        worldEvents={[]}
        worldbuildingEntries={[]}
      />);
    });

    const arrange = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Arrange cards');
    await act(async () => arrange?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const move = container.querySelector<HTMLButtonElement>('[aria-label="Move Campaign map up"]');
    await act(async () => move?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const ids = Array.from(container.querySelectorAll<HTMLElement>('.campaign-workspace-stack [data-campaign-card-id]')).map((card) => card.dataset.campaignCardId);
    expect(ids).toEqual(['campaign-map', 'plot-board']);
    expect(JSON.parse(localStorage.getItem(cardOrderStorageKey) ?? '{}').workspaces).toEqual(ids);
  });
});
