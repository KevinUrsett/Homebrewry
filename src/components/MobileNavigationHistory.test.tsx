/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileNavigationHistory } from './MobileNavigationHistory';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let app: HTMLDivElement;
let root: Root | null = null;
let host: HTMLDivElement | null = null;

function dispatchTouchPointer(type: 'pointerdown' | 'pointerup', target: EventTarget, x: number, y = 80) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    isPrimary: { value: true },
    clientX: { value: x },
    clientY: { value: y }
  });
  target.dispatchEvent(event);
}

function setSection(section: string) {
  app.className = `app-shell mobile-${section}`;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });

  app = document.createElement('div');
  setSection('editor');
  const nav = document.createElement('nav');
  nav.className = 'mobile-nav';
  for (const label of ['Edit', 'Preview']) {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', () => setSection(label === 'Edit' ? 'editor' : 'preview'));
    nav.append(button);
  }
  app.append(nav);
  document.body.append(app);

  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(<MobileNavigationHistory />);
  });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  app.remove();
  root = null;
  host = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MobileNavigationHistory', () => {
  it('uses opposite edge swipes to move backward and forward through app navigation', async () => {
    const preview = [...app.querySelectorAll('button')].find((button) => button.textContent === 'Preview');
    await act(async () => {
      preview?.click();
      vi.advanceTimersByTime(70);
    });
    expect(app.classList.contains('mobile-preview')).toBe(true);

    await act(async () => {
      dispatchTouchPointer('pointerdown', document, 12);
      dispatchTouchPointer('pointerup', document, 98);
    });
    expect(app.classList.contains('mobile-editor')).toBe(true);

    await act(async () => {
      dispatchTouchPointer('pointerdown', document, 378);
      dispatchTouchPointer('pointerup', document, 292);
    });
    expect(app.classList.contains('mobile-preview')).toBe(true);
  });

  it('does not navigate when the swipe begins in a writing field', async () => {
    const preview = [...app.querySelectorAll('button')].find((button) => button.textContent === 'Preview');
    await act(async () => {
      preview?.click();
      vi.advanceTimersByTime(70);
    });
    const input = document.createElement('textarea');
    app.append(input);

    await act(async () => {
      dispatchTouchPointer('pointerdown', input, 12);
      dispatchTouchPointer('pointerup', input, 98);
    });
    expect(app.classList.contains('mobile-preview')).toBe(true);
  });
});
