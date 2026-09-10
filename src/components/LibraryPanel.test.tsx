/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryPanel } from './LibraryPanel';
import type { Brew } from '../types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const brew: Brew = {
  id: 'brew-1',
  title: 'Old title',
  content: '',
  createdAt: '2026-09-10T10:00:00.000Z',
  updatedAt: '2026-09-10T10:00:00.000Z',
  version: 1,
  rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' },
  syncState: 'synced'
};

describe('LibraryPanel brew renaming', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });

  it('renames the selected brew from the library actions', async () => {
    const onRename = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<LibraryPanel activeId={brew.id} brews={[brew]} onDelete={vi.fn()} onDuplicate={vi.fn()} onImport={vi.fn()} onNew={vi.fn()} onQueryChange={vi.fn()} onRename={onRename} onSelect={vi.fn()} query="" />);
    });

    const renameButton = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Rename');
    await act(async () => renameButton?.click());
    const input = host.querySelector<HTMLInputElement>('#rename-brew-input');
    expect(input?.value).toBe('Old title');

    await act(async () => {
      input?.focus();
      if (input) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'New title');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const form = host.querySelector<HTMLFormElement>('.rename-brew-dialog');
    await act(async () => form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    expect(onRename).toHaveBeenCalledWith('New title');
  });
});
