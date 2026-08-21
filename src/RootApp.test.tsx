/* @vitest-environment jsdom */

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Brew } from './types';

const { loadBrewsFromDrive, replaceBrews, requestDriveAccess } = vi.hoisted(() => ({
  loadBrewsFromDrive: vi.fn(),
  replaceBrews: vi.fn(),
  requestDriveAccess: vi.fn()
}));

vi.mock('./App', () => {
  function TestApp() {
    const [destination, setDestination] = useState('editor');
    return (
      <div className="app-shell">
        <div className="brand-lockup">Homebrewry</div>
        <div className="desktop-view-controls" />
        <nav className="mobile-nav">
          <button data-mobile-destination="library" onClick={() => setDestination('library')} type="button">Brews</button>
        </nav>
        <div className="cloud-controls"><button type="button">Connected</button></div>
        <output>{destination}</output>
      </div>
    );
  }
  return { default: TestApp };
});

vi.mock('./components/PwaUpdateNotice', () => ({ checkForPwaUpdate: vi.fn() }));
vi.mock('./lib/brewStore', () => ({
  createBrew: vi.fn(),
  getLivingWorldData: vi.fn(),
  replaceBrews,
  saveBrew: vi.fn(),
  saveLivingWorldData: vi.fn()
}));
vi.mock('./lib/driveBrewStorage', () => ({ loadBrewsFromDrive }));
vi.mock('./lib/encounterStore', () => ({ listEncounters: vi.fn().mockResolvedValue([]) }));
vi.mock('./lib/googleIdentity', () => ({ isGoogleConfigured: vi.fn(() => true), requestDriveAccess }));
vi.mock('./lib/worldbuildingStore', () => ({ listWorldbuildingEntries: vi.fn().mockResolvedValue([]) }));

import RootApp from './RootApp';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('RootApp Drive landing', () => {
  it('opens Brews immediately after Drive finishes loading', async () => {
    const brew: Brew = {
      id: 'brew-1',
      title: 'Belentor',
      content: '',
      createdAt: '2026-08-21T12:00:00.000Z',
      updatedAt: '2026-08-21T12:00:00.000Z',
      version: 1,
      rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' }
    };
    requestDriveAccess.mockResolvedValue('drive-token');
    loadBrewsFromDrive.mockResolvedValue([brew]);
    replaceBrews.mockResolvedValue(undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(<RootApp />);
    });

    const connect = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Connect Google Drive');
    await act(async () => {
      connect?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadBrewsFromDrive).toHaveBeenCalledWith('drive-token');
    expect(replaceBrews).toHaveBeenCalledWith([brew]);
    expect(container.querySelector('.app-shell')).toBeTruthy();
    expect(container.querySelector('output')?.textContent).toBe('library');
    expect(container.textContent).not.toContain('Browse all brews');
  });

  it('keeps the create-brew screen available when Drive is empty', async () => {
    requestDriveAccess.mockResolvedValue('drive-token');
    loadBrewsFromDrive.mockResolvedValue([]);
    replaceBrews.mockResolvedValue(undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(<RootApp />);
    });

    const connect = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Connect Google Drive');
    await act(async () => {
      connect?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.app-shell')).toBeNull();
    expect(container.textContent).toContain('Your Drive library is empty.');
  });
});
