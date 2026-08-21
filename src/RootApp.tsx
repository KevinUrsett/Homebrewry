import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App';
import { checkForPwaUpdate } from './components/PwaUpdateNotice';
import { createBrew, getLivingWorldData, replaceBrews, saveBrew, saveLivingWorldData } from './lib/brewStore';
import { loadBrewsFromDrive } from './lib/driveBrewStorage';
import { listEncounters } from './lib/encounterStore';
import { isGoogleConfigured, requestDriveAccess } from './lib/googleIdentity';
import { listWorldbuildingEntries } from './lib/worldbuildingStore';
import type { Brew, IdeaDraft } from './types';
import './landing-page.css';
import './workspace-home-nav.css';

type LandingStats = {
  encounters: number;
  worldbuilding: number;
};

type WorkspaceDestination = 'library' | 'editor' | 'catalogue' | 'encounters' | 'worldbuilding';

const destinationLabels: Record<WorkspaceDestination, string> = {
  library: 'Brews',
  editor: 'Edit',
  catalogue: 'Catalogue',
  encounters: 'Encounters',
  worldbuilding: 'Worldbuilding'
};

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (seconds < 60) return formatter.format(-seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return formatter.format(-days, 'day');
  const months = Math.round(days / 30);
  if (months < 12) return formatter.format(-months, 'month');
  return formatter.format(-Math.round(months / 12), 'year');
}

function plainExcerpt(content: string) {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\{\{[^\n]*/g, '')
    .replace(/[:*_`>#|\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

function wordCount(content: string) {
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}

export default function RootApp() {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<WorkspaceDestination | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState('Google Drive is required to open and save your brews.');
  const [brews, setBrews] = useState<Brew[]>([]);
  const [stats, setStats] = useState<LandingStats>({ encounters: 0, worldbuilding: 0 });
  const [loading, setLoading] = useState(false);
  const [connectionPhase, setConnectionPhase] = useState<'disconnected' | 'connecting' | 'loading' | 'ready' | 'error'>('disconnected');
  const [quickIdeaBrew, setQuickIdeaBrew] = useState<Brew | null>(null);
  const [quickIdeaText, setQuickIdeaText] = useState('');
  const [savingQuickIdea, setSavingQuickIdea] = useState(false);
  const [desktopNavigation, setDesktopNavigation] = useState<HTMLElement | null>(null);
  const [mobileNavigation, setMobileNavigation] = useState<HTMLElement | null>(null);

  const loadLandingData = async (token: string) => {
    const [driveBrews, encounters, worldbuilding] = await Promise.all([
      loadBrewsFromDrive(token),
      listEncounters(),
      listWorldbuildingEntries()
    ]);
    await replaceBrews(driveBrews);
    setBrews(driveBrews);
    setStats({ encounters: encounters.length, worldbuilding: worldbuilding.length });
    return driveBrews.length;
  };

  const connectDrive = async () => {
    if (loading || connectionPhase === 'connecting' || connectionPhase === 'loading') return;
    setLoading(true);
    setConnectionPhase('connecting');
    setDriveStatus('Connecting to Google Drive…');
    try {
      const token = await requestDriveAccess();
      setAccessToken(token);
      setConnectionPhase('loading');
      setDriveStatus('Connected. Loading your Drive library…');
      const brewCount = await loadLandingData(token);
      setDriveStatus(`${brewCount} brew${brewCount === 1 ? '' : 's'} ready. Google Drive is connected for this session.`);
      setConnectionPhase('ready');
      if (brewCount > 0) {
        setPendingDestination('library');
        setWorkspaceOpen(true);
      }
    } catch (error) {
      setConnectionPhase('error');
      setDriveStatus(error instanceof Error ? error.message : 'Google Drive connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleEmptyLibrary = () => {
      setWorkspaceOpen(false);
      setPendingDestination(null);
      if (!accessToken) return;
      setLoading(true);
      void loadLandingData(accessToken).finally(() => setLoading(false));
    };
    window.addEventListener('homebrewry-brews-empty', handleEmptyLibrary);
    return () => window.removeEventListener('homebrewry-brews-empty', handleEmptyLibrary);
  }, [accessToken]);

  useEffect(() => {
    if (!workspaceOpen) {
      setDesktopNavigation(null);
      setMobileNavigation(null);
      return;
    }

    let logo: HTMLElement | null = null;
    let cancelled = false;

    const connectWorkspaceNavigation = () => {
      if (cancelled) return;
      logo = document.querySelector<HTMLElement>('.brand-lockup');
      const desktop = document.querySelector<HTMLElement>('.desktop-view-controls');
      const mobile = document.querySelector<HTMLElement>('.mobile-nav');

      setDesktopNavigation(desktop);
      setMobileNavigation(mobile);

      if (!logo || !desktop || !mobile) {
        window.requestAnimationFrame(connectWorkspaceNavigation);
        return;
      }

      const goHome = () => void returnHome();
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        goHome();
      };

      logo.classList.add('is-home-link');
      logo.setAttribute('role', 'button');
      logo.setAttribute('tabindex', '0');
      logo.setAttribute('aria-label', 'Return to Homebrewry home');
      logo.addEventListener('click', goHome);
      logo.addEventListener('keydown', handleKeyDown);

      return () => {
        logo?.classList.remove('is-home-link');
        logo?.removeAttribute('role');
        logo?.removeAttribute('tabindex');
        logo?.setAttribute('aria-label', 'Homebrewry');
        logo?.removeEventListener('click', goHome);
        logo?.removeEventListener('keydown', handleKeyDown);
      };
    };

    let disconnect: (() => void) | undefined;
    const frame = window.requestAnimationFrame(() => {
      disconnect = connectWorkspaceNavigation();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      disconnect?.();
    };
  }, [workspaceOpen]);

  useEffect(() => {
    if (!workspaceOpen || !accessToken) return;
    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    const connectWorkspaceDrive = () => {
      if (cancelled || attempts > 180) return;
      attempts += 1;
      const button = document.querySelector<HTMLButtonElement>('.cloud-controls button');
      if (!button) {
        frame = window.requestAnimationFrame(connectWorkspaceDrive);
        return;
      }
      const label = button.textContent?.trim() ?? '';
      if (label === 'Connect Drive' || label === 'Reconnect Drive') button.click();
    };

    frame = window.requestAnimationFrame(connectWorkspaceDrive);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [accessToken, workspaceOpen]);

  useEffect(() => {
    if (!workspaceOpen || !pendingDestination) return;

    let cancelled = false;
    let frame = 0;
    const label = destinationLabels[pendingDestination];

    const navigate = () => {
      if (cancelled) return;
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('.mobile-nav button')];
      const destination = buttons.find((button) => button.dataset.mobileDestination === pendingDestination || button.textContent?.trim() === label);
      if (!destination) {
        const tools = buttons.find((button) => button.textContent?.trim() === 'Tools');
        if (!tools) {
          frame = window.requestAnimationFrame(navigate);
          return;
        }
        tools.click();
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLButtonElement>(`[data-mobile-destination="${pendingDestination}"]`)?.click();
          setPendingDestination(null);
        });
        return;
      }
      destination.click();
      setPendingDestination(null);
    };

    frame = window.requestAnimationFrame(navigate);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [pendingDestination, workspaceOpen]);

  const recentBrews = useMemo(
    () => [...brews].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 6),
    [brews]
  );

  const totalWords = useMemo(
    () => brews.reduce((total, brew) => total + wordCount(brew.content), 0),
    [brews]
  );

  const openWorkspace = (destination: WorkspaceDestination) => {
    if (!accessToken || !brews.length) return;
    setPendingDestination(destination);
    setWorkspaceOpen(true);
  };

  const returnHome = async () => {
    setWorkspaceOpen(false);
    setPendingDestination(null);
    if (!accessToken) return;
    setLoading(true);
    try {
      await loadLandingData(accessToken);
    } finally {
      setLoading(false);
    }
  };

  const openBrew = (brew: Brew) => {
    try {
      sessionStorage.setItem('homebrewry-active-brew-id', brew.id);
    } catch {
      // Opening a brew must not depend on browser session storage.
    }
    openWorkspace('editor');
  };

  const createNew = async () => {
    if (!accessToken) return;
    const brew = createBrew();
    await saveBrew(brew);
    try {
      sessionStorage.setItem('homebrewry-active-brew-id', brew.id);
    } catch {
      // The brew remains available through the normal library fallback.
    }
    setBrews((current) => [brew, ...current]);
    openWorkspace('editor');
  };

  const captureQuickIdea = async () => {
    const text = quickIdeaText.trim();
    if (!accessToken || !quickIdeaBrew || !text) return;
    setSavingQuickIdea(true);
    try {
      const world = await getLivingWorldData();
      const timestamp = new Date().toISOString();
      const idea: IdeaDraft = {
        id: crypto.randomUUID(),
        brewId: quickIdeaBrew.id,
        text,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await saveLivingWorldData({ ...world, ideaDrafts: [idea, ...(world.ideaDrafts ?? [])] });
      setQuickIdeaBrew(null);
      setQuickIdeaText('');
    } finally {
      setSavingQuickIdea(false);
    }
  };

  if (workspaceOpen) {
    const homeButton = (
      <button className="workspace-home-tab" onClick={() => void returnHome()} type="button">
        <span aria-hidden>⌂</span>
        Home
      </button>
    );

    return (
      <>
        <App />
        {desktopNavigation && createPortal(homeButton, desktopNavigation)}
        {mobileNavigation && createPortal(homeButton, mobileNavigation)}
      </>
    );
  }

  if (!accessToken || connectionPhase !== 'ready') {
    const connecting = connectionPhase === 'connecting' || connectionPhase === 'loading';
    const retrying = connectionPhase === 'error';
    const actionLabel = connectionPhase === 'loading'
      ? 'Loading library…'
      : connectionPhase === 'connecting'
        ? 'Connecting…'
        : retrying
          ? 'Try again'
          : 'Connect Google Drive';

    return (
      <main className="landing-page">
        <header className="landing-header">
          <div className="landing-brand" aria-label="Homebrewry"><span aria-hidden>✦</span><strong>Homebrewry</strong></div>
          <button className="landing-update-button" onClick={checkForPwaUpdate} type="button">Check for updates</button>
        </header>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Drive-first storage</p>
            <h1>{connecting ? 'Preparing your campaign library.' : retrying ? 'Could not open your Drive library.' : 'Connect Drive to open your campaign library.'}</h1>
            <p className="landing-intro">
              {connecting
                ? 'Homebrewry is loading your Drive library once before opening the workspace.'
                : retrying
                  ? 'Your brews have not been changed. Try the connection again when you are ready.'
                  : 'Google Drive is required before a brew can be created, edited, imported, or deleted.'}
            </p>
            <div className="landing-hero-actions">
              <button className="landing-primary" disabled={connecting || !isGoogleConfigured()} onClick={() => void connectDrive()} type="button">{actionLabel}</button>
            </div>
            <p aria-live="polite">{driveStatus}</p>
          </div>
          <div className="landing-tome" aria-hidden><div className="landing-tome-cover"><span>✦</span><strong>Homebrewry</strong><small>Campaign Codex</small></div><div className="landing-tome-pages" /></div>
        </section>
        <footer className="landing-footer"><span>Homebrewry</span><small>Google Drive is the source of truth. Device storage is used only as a temporary cache.</small></footer>
      </main>
    );
  }

  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-brand" aria-label="Homebrewry">
          <span aria-hidden>✦</span>
          <strong>Homebrewry</strong>
        </div>
        <div className="landing-header-actions">
          <button className="landing-update-button" onClick={checkForPwaUpdate} type="button">Check for updates</button>
          <button className="landing-library-button" disabled={!brews.length} onClick={() => openWorkspace('library')} type="button">
            {brews.length ? 'Open workspace' : 'No brews yet'}
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">Your campaign workshop</p>
          <h1>{brews.length ? 'Pick up where the story left off.' : 'Your Drive library is empty.'}</h1>
          <p className="landing-intro">
            {brews.length ? 'Write polished brews, prepare encounters, and keep the people and places of your world close at hand.' : 'Create a blank brew when you are ready. No starter document will be generated.'}
          </p>
          <div className="landing-hero-actions">
            <button className="landing-primary" disabled={loading} onClick={() => void createNew()} type="button">Create a new brew</button>
            <button className="landing-secondary" disabled={!brews.length} onClick={() => openWorkspace('library')} type="button">Browse all brews</button>
          </div>
          <p aria-live="polite">{driveStatus}</p>
        </div>
        <div className="landing-tome" aria-hidden>
          <div className="landing-tome-cover">
            <span>✦</span>
            <strong>Homebrewry</strong>
            <small>Campaign Codex</small>
          </div>
          <div className="landing-tome-pages" />
        </div>
      </section>

      <section className="landing-content">
        <div className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">Continue writing</p>
            <h2>Recent brews</h2>
          </div>
          <button disabled={!brews.length} onClick={() => openWorkspace('library')} type="button">View library <span aria-hidden>→</span></button>
        </div>

        {loading ? (
          <div className="landing-loading">Loading your Google Drive library…</div>
        ) : (
          <div className="recent-brew-grid">
            {recentBrews.map((brew, index) => (
              <article className={`recent-brew-card ${index === 0 ? 'is-featured' : ''}`} key={brew.id}>
                <button className="recent-brew-open" onClick={() => void openBrew(brew)} type="button">
                  <span className="recent-brew-ornament" aria-hidden>◆</span>
                  <span className="recent-brew-time">Edited {relativeTime(brew.updatedAt)}</span>
                  <strong>{brew.title || 'Untitled Brew'}</strong>
                  <span className="recent-brew-excerpt">{plainExcerpt(brew.content) || 'An empty page waiting for its first idea.'}</span>
                  <span className="recent-brew-meta">
                    <span>{wordCount(brew.content).toLocaleString()} words</span>
                    <span>{brew.drive ? 'Saved to Drive' : 'Pending Drive save'}</span>
                  </span>
                  <span className="recent-brew-origin">Created on: {brew.createdOn ?? 'Earlier version'}</span>
                </button>
                <button aria-label={`Capture an idea for ${brew.title || 'Untitled Brew'}`} className="recent-brew-idea-plus" onClick={() => { setQuickIdeaBrew(brew); setQuickIdeaText(''); }} type="button">+</button>
              </article>
            ))}
            <button className="recent-brew-card new-brew-card" onClick={() => void createNew()} type="button">
              <span className="new-brew-plus" aria-hidden>+</span>
              <strong>Start a new brew</strong>
              <span>Create a blank document saved directly to Google Drive.</span>
            </button>
          </div>
        )}

        <section className="landing-dashboard" aria-label="Campaign overview">
          <div className="landing-stat-panel">
            <p className="landing-eyebrow">At a glance</p>
            <h2>Your campaign library</h2>
            <div className="landing-stats">
              <button disabled={!brews.length} onClick={() => openWorkspace('library')} type="button"><strong>{brews.length}</strong><span>Brews</span></button>
              <button disabled={!brews.length} onClick={() => openWorkspace('encounters')} type="button"><strong>{stats.encounters}</strong><span>Encounters</span></button>
              <button disabled={!brews.length} onClick={() => openWorkspace('worldbuilding')} type="button"><strong>{stats.worldbuilding}</strong><span>World entries</span></button>
              <div><strong>{totalWords.toLocaleString()}</strong><span>Words written</span></div>
            </div>
          </div>

          <div className="landing-tool-panel">
            <p className="landing-eyebrow">Quick access</p>
            <div className="landing-tool-list">
              <button disabled={!brews.length} onClick={() => openWorkspace('encounters')} type="button"><span aria-hidden>⚔</span><div><strong>Prepare an encounter</strong><small>Build and run initiative-ready combats.</small></div><b aria-hidden>→</b></button>
              <button disabled={!brews.length} onClick={() => openWorkspace('worldbuilding')} type="button"><span aria-hidden>⌘</span><div><strong>Open worldbuilding</strong><small>Return to your people, factions, and places.</small></div><b aria-hidden>→</b></button>
              <button disabled={!brews.length} onClick={() => openWorkspace('catalogue')} type="button"><span aria-hidden>◇</span><div><strong>Browse the catalogue</strong><small>Find creatures and reusable references.</small></div><b aria-hidden>→</b></button>
            </div>
          </div>
        </section>
      </section>

      <footer className="landing-footer">
        <span>Homebrewry</span>
        <small>Google Drive is required for brew storage. This device keeps only a replaceable cache.</small>
      </footer>
      {quickIdeaBrew && (
        <div className="landing-idea-backdrop" role="presentation" onMouseDown={() => !savingQuickIdea && setQuickIdeaBrew(null)}>
          <form className="landing-idea-dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void captureQuickIdea(); }}>
            <p className="landing-eyebrow">Quick capture</p>
            <h2>{quickIdeaBrew.title || 'Untitled Brew'}</h2>
            <textarea autoFocus onChange={(event) => setQuickIdeaText(event.target.value)} placeholder="Write it down before it gets away…" value={quickIdeaText} />
            <div>
              <button disabled={savingQuickIdea} onClick={() => setQuickIdeaBrew(null)} type="button">Cancel</button>
              <button className="landing-primary" disabled={!quickIdeaText.trim() || savingQuickIdea} type="submit">{savingQuickIdea ? 'Saving…' : 'Save idea'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
