/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueEntry } from '../catalogue/types';
import { CataloguePanel } from './CataloguePanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const aboleth: CatalogueEntry = {
  id: 'aboleth-id',
  category: 'monster',
  name: 'Aboleth',
  description: 'An ancient aberration.',
  data: { type: 'aberration' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const dragon: CatalogueEntry = {
  id: 'dragon-id',
  category: 'monster',
  name: 'Adult Blue Dragon',
  description: 'A storm-charged dragon.',
  data: { type: 'dragon' },
  source: 'SRD-521',
  ruleset: '5.5e'
};

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('CataloguePanel', () => {
  it('keeps the selected catalogue entry visible in its independent result list', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(
        <CataloguePanel
          entries={[aboleth, dragon]}
          error={null}
          loading={false}
          onDeleteCustomMonster={vi.fn().mockResolvedValue(undefined)}
          onInsertReference={vi.fn()}
          onOpenPrivateMonsterImport={vi.fn()}
          onSaveCustomMonster={vi.fn().mockResolvedValue(undefined)}
          customEntryCount={0}
          privateMonsterCount={0}
          selectedEntry={dragon}
        />
      );
    });

    expect(container.querySelector('.catalogue-result.is-selected')?.textContent).toContain('Adult Blue Dragon');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('creates a campaign-owned monster draft from the selected monster', async () => {
    const onSaveCustomMonster = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(
        <CataloguePanel
          entries={[aboleth]}
          error={null}
          loading={false}
          onDeleteCustomMonster={vi.fn().mockResolvedValue(undefined)}
          onInsertReference={vi.fn()}
          onOpenPrivateMonsterImport={vi.fn()}
          onSaveCustomMonster={onSaveCustomMonster}
          customEntryCount={0}
          privateMonsterCount={0}
          selectedEntry={aboleth}
        />
      );
    });

    const duplicate = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Duplicate as custom monster');
    await act(async () => {
      duplicate?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector<HTMLInputElement>('[aria-label="Monster name"]')?.value).toBe('Aboleth copy');
    const save = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save monster');
    await act(async () => {
      save?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSaveCustomMonster).toHaveBeenCalledWith(expect.objectContaining({
      category: 'monster',
      name: 'Aboleth copy',
      source: 'Custom',
      ruleset: 'Homebrewry',
      data: aboleth.data
    }));
  });
});
