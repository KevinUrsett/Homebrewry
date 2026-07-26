/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogueCategories, catalogueCategoryLabels } from '../catalogue/types';
import { ReferenceMenu } from './ReferenceMenu';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

describe('ReferenceMenu', () => {
  it('offers every catalogue category and forwards the chosen category', async () => {
    const onSelectCategory = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(<ReferenceMenu onBrowseCatalogue={vi.fn()} onSelectCategory={onSelectCategory} />);
    });

    const trigger = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Reference'));
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    for (const category of catalogueCategories) {
      expect(container.textContent).toContain(catalogueCategoryLabels[category]);
    }

    const monsters = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Monsters');
    await act(async () => {
      monsters?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelectCategory).toHaveBeenCalledWith('monster');
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
