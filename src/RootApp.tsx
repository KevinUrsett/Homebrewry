import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App';
import { createBrew, saveBrew, seedBrews } from './lib/brewStore';
import { listEncounters } from './lib/encounterStore';
import { listWorldbuildingEntries } from './lib/worldbuildingStore';
import type { Brew } from './types';
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
  const [brews, setBrews] = useState<Brew[]>([]);
  const [stats, setStats] = useState<LandingStats>({ encounters: 0, worldbuilding: 0 });
  const [loading, setLoading] = useState(true);
  const [desktopNavigation, setDesktopNavigation] = useState<HTMLElement | null>(null);
  const [mobileNavigation, setMobileNavigation] = useState<HTMLElement | null>(null);

  const loadLandingData = async () => {
    const [storedBrews, encounters, worldbuilding] = await Promise.all([
      seedBrews(),
      listEncounters(),
      listWorldbuildingEntries()
    ]);
    setBrews(storedBrews);
    setStats({ encounters: encounters.length, worldbuilding: worldbuilding.length });
  };

  useEffect(() => {
    void loadLandingData().finally(() => setLoading(false));
  }, []);

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
    if (!workspaceOpen || !pendingDestination) return;

    let cancelled = false;
    let frame = 0;
    const label = destinationLabels[pendingDestination];

    const navigate = () => {
      if (cancelled) return;
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('.mobile-nav button')];
      const destination = buttons.find((button) => button.textContent?.trim() === label);
      if (!destination) {
        frame = window.requestAnimationFrame(navigate);
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
    setPendingDestination(destination);
    setWorkspaceOpen(true);
  };

  const returnHome = async () => {
    setWorkspaceOpen(false);
    setPendingDestination(null);
    setLoading(true);
    try {
      await loadLandingData();
    } finally {
      setLoading(false);
    }
  };

  const openBrew = async (brew: Brew) => {
    const touched = { ...brew, updatedAt: new Date().toISOString() };
    await saveBrew(touched);
    setBrews((current) => [touched, ...current.filter((candidate) => candidate.id !== brew.id)]);
    openWorkspace('editor');
  };

  const createNew = async () => {
    const brew = createBrew();
    await saveBrew(brew);
    setBrews((current) => [brew, ...current]);
    openWorkspace('editor');
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

  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-brand" aria-label="Homebrewry">
          <span aria-hidden>✦</span>
          <strong>Homebrewry</strong>
        </div>
        <button className="landing-library-button" onClick={() => openWorkspace('library')} type="button">
          Open workspace
        </button>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">Your campaign workshop</p>
          <h1>Pick up where the story left off.</h1>
          <p className="landing-intro">
            Write polished brews, prepare encounters, and keep the people and places of your world close at hand.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={() => void createNew()} type="button">Create a new brew</button>
            <button className="landing-secondary" onClick={() => openWorkspace('library')} type="button">Browse all brews</button>
          </div>
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
          <button onClick={() => openWorkspace('library')} type="button">View library <span aria-hidden>→</span></button>
        </div>

        {loading ? (
          <div className="landing-loading">Opening your local library…</div>
        ) : (
          <div className="recent-brew-grid">
            {recentBrews.map((brew, index) => (
              <button className={`recent-brew-card ${index === 0 ? 'is-featured' : ''}`} key={brew.id} onClick={() => void openBrew(brew)} type="button">
                <span className="recent-brew-ornament" aria-hidden>◆</span>
                <span className="recent-brew-time">Edited {relativeTime(brew.updatedAt)}</span>
                <strong>{brew.title || 'Untitled Brew'}</strong>
                <span className="recent-brew-excerpt">{plainExcerpt(brew.content) || 'An empty page waiting for its first idea.'}</span>
                <span className="recent-brew-meta">
                  <span>{wordCount(brew.content).toLocaleString()} words</span>
                  <span>{brew.drive ? 'Drive linked' : 'Local'}</span>
                </span>
              </button>
            ))}
            <button className="recent-brew-card new-brew-card" onClick={() => void createNew()} type="button">
              <span className="new-brew-plus" aria-hidden>+</span>
              <strong>Start a new brew</strong>
              <span>Create a fresh document with the campaign-ready editor.</span>
            </button>
          </div>
        )}

        <section className="landing-dashboard" aria-label="Campaign overview">
          <div className="landing-stat-panel">
            <p className="landing-eyebrow">At a glance</p>
            <h2>Your campaign library</h2>
            <div className="landing-stats">
              <button onClick={() => openWorkspace('library')} type="button"><strong>{brews.length}</strong><span>Brews</span></button>
              <button onClick={() => openWorkspace('encounters')} type="button"><strong>{stats.encounters}</strong><span>Encounters</span></button>
              <button onClick={() => openWorkspace('worldbuilding')} type="button"><strong>{stats.worldbuilding}</strong><span>World entries</span></button>
              <div><strong>{totalWords.toLocaleString()}</strong><span>Words written</span></div>
            </div>
          </div>

          <div className="landing-tool-panel">
            <p className="landing-eyebrow">Quick access</p>
            <div className="landing-tool-list">
              <button onClick={() => openWorkspace('encounters')} type="button"><span aria-hidden>⚔</span><div><strong>Prepare an encounter</strong><small>Build and run initiative-ready combats.</small></div><b aria-hidden>→</b></button>
              <button onClick={() => openWorkspace('worldbuilding')} type="button"><span aria-hidden>⌘</span><div><strong>Open worldbuilding</strong><small>Return to your people, factions, and places.</small></div><b aria-hidden>→</b></button>
              <button onClick={() => openWorkspace('catalogue')} type="button"><span aria-hidden>◇</span><div><strong>Browse the catalogue</strong><small>Find creatures and reusable references.</small></div><b aria-hidden>→</b></button>
            </div>
          </div>
        </section>
      </section>

      <footer className="landing-footer">
        <span>Homebrewry</span>
        <small>Your drafts stay available locally and can be backed up to Google Drive.</small>
      </footer>
    </main>
  );
}
