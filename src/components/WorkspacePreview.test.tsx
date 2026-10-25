/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkspacePreview } from './WorkspacePreview';
import type { MobileSection, ViewMode } from '../types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: { root: ReturnType<typeof createRoot>; host: HTMLDivElement }[] = [];
afterEach(() => {
  mounted.splice(0).forEach(({ root, host }) => { act(() => root.unmount()); host.remove(); });
  vi.unstubAllGlobals();
});

function setup(mobile = false) {
  const media = new EventTarget() as EventTarget & { matches: boolean };
  media.matches = mobile;
  vi.stubGlobal('matchMedia', () => media);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const renderPreview = vi.fn((printing: boolean) => <div>{printing ? 'Print latest' : 'Preview'}</div>);
  const render = (viewMode: ViewMode = 'editor', mobileSection: MobileSection = 'editor') => {
    act(() => root.render(<WorkspacePreview viewMode={viewMode} mobileSection={mobileSection}>{renderPreview}</WorkspacePreview>));
  };
  return { host, media, render, renderPreview };
}

it('does no preview work during desktop editing, but renders Split and Preview', () => {
  const { render, renderPreview } = setup();
  render(); render();
  expect(renderPreview).not.toHaveBeenCalled();
  render('split');
  expect(renderPreview).toHaveBeenLastCalledWith(false);
  renderPreview.mockClear();
  render('editor');
  expect(renderPreview).not.toHaveBeenCalled();
  render('preview');
  expect(renderPreview).toHaveBeenCalledWith(false);
});

it('follows the mobile destination and viewport changes', () => {
  const { host, media, render, renderPreview } = setup(true);
  render('split', 'editor');
  expect(renderPreview).not.toHaveBeenCalled();
  render('editor', 'preview');
  expect(host.textContent).toBe('Preview');
  act(() => { media.matches = false; media.dispatchEvent(new Event('change')); });
  expect(host.textContent).toBe('');
});

it('mounts the latest document synchronously for native printing and hides it afterwards', () => {
  const { host, render } = setup();
  render();
  act(() => window.dispatchEvent(new Event('beforeprint')));
  expect(host.textContent).toBe('Print latest');
  act(() => window.dispatchEvent(new Event('afterprint')));
  expect(host.textContent).toBe('');
});
