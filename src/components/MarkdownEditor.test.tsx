/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from './MarkdownEditor';
import type { BrewAsset } from '../types';

const asset: BrewAsset = {
  id: 'lantern-art',
  name: 'lantern.jpg',
  alt: 'A brass lantern',
  mimeType: 'image/jpeg',
  size: 3,
  blob: new Blob(['art'], { type: 'image/jpeg' }),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('MarkdownEditor images', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.restoreAllMocks();
  });

  it('renders a stored image beneath its Markdown in Edit mode', async () => {
    const createObjectURL = vi.fn(() => 'blob:lantern-preview');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<MarkdownEditor assets={new Map([[asset.id, asset]])} content="![A brass lantern](asset://lantern-art)" onChange={() => undefined} />);
    });

    const image = host.querySelector<HTMLImageElement>('.cm-markdown-image-preview img');
    expect(image?.alt).toBe('A brass lantern');
    expect(image?.src).toBe('blob:lantern-preview');
    expect(host.textContent).toContain('A brass lantern');
    expect(host.textContent).not.toContain('asset://lantern-art');
    expect(createObjectURL).toHaveBeenCalledWith(asset.blob);
  });
});

describe('MarkdownEditor encounter references', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('opens an encounter editor when its edit-mode reference is clicked', async () => {
    const encounterId = 'ad7d5e0d-4b4d-4fd8-9c78-bf44f9205030';
    const onOpenEncounter = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<MarkdownEditor content={`[[encounter:${encounterId}|Goblin ambush]]`} onChange={() => undefined} onOpenEncounter={onOpenEncounter} />);
    });

    const reference = host.querySelector<HTMLButtonElement>('[aria-label="encounter reference: Goblin ambush"]');
    expect(reference?.title).toBe('Open encounter editor');
    await act(async () => reference?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onOpenEncounter).toHaveBeenCalledWith(encounterId);
  });
});
