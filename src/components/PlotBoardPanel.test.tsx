/* @vitest-environment jsdom */

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createBlankPlotBoard } from '../lib/plotBoard';
import type { PlotBoard } from '../types';
import { PlotBoardPanel } from './PlotBoardPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const timestamp = '2026-08-12T08:00:00.000Z';
const board: PlotBoard = {
  ...createBlankPlotBoard(timestamp),
  phases: [
    { id: 'phase-main', title: 'Main', order: 0, createdAt: timestamp, updatedAt: timestamp },
    { id: 'phase-2', title: 'Phase 2', order: 1, createdAt: timestamp, updatedAt: timestamp }
  ],
  lanes: [
    { id: 'main', title: 'Main', tone: 'main', order: 0, createdAt: timestamp, updatedAt: timestamp },
    { id: 'side', title: 'Side', tone: 'side', order: 1, createdAt: timestamp, updatedAt: timestamp }
  ]
};

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];
afterEach(() => mounted.splice(0).forEach(({ container, root }) => { act(() => root.unmount()); container.remove(); }));

const change = async (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  await act(async () => {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }));
  });
};

describe('PlotBoardPanel', () => {
  it('saves a beat spanning later phases and renders it across both cells', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    const Harness = () => {
      const [current, setCurrent] = useState(board);
      return <PlotBoardPanel board={current} entities={[]} onSave={setCurrent} />;
    };

    await act(async () => { root.render(<Harness />); });
    const add = container.querySelector<HTMLButtonElement>('.plot-board-add-beat');
    await act(async () => { add?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const selects = Array.from(container.querySelectorAll<HTMLSelectElement>('.plot-beat-editor select'));
    await change(selects[2]!, 'phase-2');
    const title = container.querySelector<HTMLInputElement>('.plot-beat-editor input[placeholder^="The discovery"]');
    await change(title!, 'Shared discovery');
    const save = Array.from(container.querySelectorAll<HTMLButtonElement>('.plot-beat-editor button')).find((button) => button.textContent === 'Save beat');
    await act(async () => { save?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const span = container.querySelector<HTMLElement>('.plot-board-span');
    expect(container.innerHTML).toContain('Shared discovery');
    expect(span?.textContent).toContain('Shared discovery');
    expect(span?.style.gridColumn).toBe('2 / 4');
    const sideLane = Array.from(container.querySelectorAll<HTMLElement>('.plot-board-lane')).find((lane) => lane.textContent?.includes('Side'));
    expect(sideLane?.style.gridColumn).toBe('1');
    expect(sideLane?.style.gridRow).toBe('3');
  });
});
