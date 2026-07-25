/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueEntry } from '../catalogue/types';
import { ReferenceDialog } from './ReferenceDialog';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry: CatalogueEntry = {
  id: 'aboleth-id',
  category: 'monster',
  name: 'Aboleth',
  description: 'An ancient aberration.',
  data: { type: 'aberration' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

describe('ReferenceDialog', () => {
  it('opens an existing reference in the catalogue instead of inserting another token', async () => {
    const onOpenInCatalogue = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(<ReferenceDialog entry={entry} onClose={vi.fn()} onOpenInCatalogue={onOpenInCatalogue} />);
    });

    expect(container.textContent).toContain('Aboleth');
    expect(container.textContent).toContain('Open in catalogue');
    expect(container.textContent).not.toContain('Insert into brew');

    const openButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Open in catalogue');
    expect(openButton).toBeDefined();

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenInCatalogue).toHaveBeenCalledOnce();
  });
});
