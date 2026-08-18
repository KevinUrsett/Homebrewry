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
