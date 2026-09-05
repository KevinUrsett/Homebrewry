/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pwa = vi.hoisted(() => ({
  initialNeedRefresh: false,
  triggerNeedRefresh: null as null | (() => void),
  updateServiceWorker: vi.fn()
}));

vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react');
  return {
    useRegisterSW: () => {
      const [needRefresh, setNeedRefresh] = useState(pwa.initialNeedRefresh);
      pwa.triggerNeedRefresh = () => setNeedRefresh(true);
      return {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker: pwa.updateServiceWorker
      };
    }
  };
});

import { checkForPwaUpdate, PwaUpdateNotice } from './PwaUpdateNotice';

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];
let registration: {
  active: ServiceWorker | null;
  installing: ServiceWorker | null;
  update: ReturnType<typeof vi.fn>;
  waiting: ServiceWorker | null;
};

beforeEach(() => {
  pwa.initialNeedRefresh = false;
  pwa.triggerNeedRefresh = null;
  pwa.updateServiceWorker.mockResolvedValue(undefined);
  registration = {
    active: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    waiting: null
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue(registration) }
  });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
  vi.clearAllMocks();
});

async function renderNotice() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(<PwaUpdateNotice />);
    await Promise.resolve();
  });
  return container;
}

describe('PwaUpdateNotice', () => {
  it('applies a waiting update automatically on a fresh bookmarked launch', async () => {
    pwa.initialNeedRefresh = true;

    await renderNotice();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('makes the manual update check install a waiting worker in one action', async () => {
    registration.waiting = {} as ServiceWorker;
    await renderNotice();

    await act(async () => {
      checkForPwaUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(registration.update).toHaveBeenCalledOnce();
    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('prompts instead of reloading after the user has started working', async () => {
    const container = await renderNotice();
    window.dispatchEvent(new Event('pointerdown'));

    await act(async () => {
      pwa.triggerNeedRefresh?.();
      await Promise.resolve();
    });

    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
    expect(container.textContent).toContain('A new version of Homebrewry is ready.');
  });
});
