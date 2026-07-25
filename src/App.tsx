import { useEffect, useMemo, useRef, useState } from 'react';
import { BrewPreview } from './components/BrewPreview';
import { EditorPane } from './components/EditorPane';
import { LibraryPanel } from './components/LibraryPanel';
import { OutlinePanel } from './components/OutlinePanel';
import { createBrew, deleteBrew, replaceBrews, saveBrew, seedBrews } from './lib/brewStore';
import { keepBothVersions, resolveWithDriveVersion } from './lib/conflicts';
import { isGoogleConfigured, requestDriveAccess } from './lib/googleIdentity';
import { getOutline } from './lib/outline';
import { overwriteDriveBrew, syncBrews } from './lib/sync';
import type { Brew, MobileSection, ViewMode } from './types';

const mobileLabels: Record<MobileSection, string> = {
  library: 'Brews',
  editor: 'Edit',
  preview: 'Preview',
  outline: 'Outline'
};

export default function App() {
  const [brews, setBrews] = useState<Brew[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [mobileSection, setMobileSection] = useState<MobileSection>('editor');
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState('Loading local drafts…');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [findVisible, setFindVisible] = useState(false);
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);

  useEffect(() => {
    seedBrews()
      .then((storedBrews) => {
        setBrews(storedBrews);
        setActiveId(storedBrews[0]?.id ?? null);
        setSaveState('Saved locally');
      })
      .catch(() => setSaveState('Local storage is unavailable'))
      .finally(() => setLoading(false));
  }, []);

  const activeBrew = useMemo(
    () => brews.find((brew) => brew.id === activeId) ?? null,
    [activeId, brews]
  );

  useEffect(() => {
    if (!activeBrew || loading) return;

    const timer = window.setTimeout(() => {
      saveBrew(activeBrew)
        .then(() => setSaveState('Saved locally'))
        .catch(() => setSaveState('Local save failed'));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [activeBrew, loading]);

  const updateActiveBrew = (updater: (brew: Brew) => Brew) => {
    if (!activeId) return;

    setSaveState('Saving locally…');
    setBrews((currentBrews) =>
      currentBrews.map((brew) =>
        brew.id === activeId
          ? {
              ...updater(brew),
              updatedAt: new Date().toISOString(),
              version: brew.version + 1,
              syncState: brew.drive ? 'pending' : 'local'
            }
          : brew
      )
    );
  };

  const updateContent = (content: string, recordHistory = true) => {
    if (!activeBrew || content === activeBrew.content) return;
    if (recordHistory) {
      historyRef.current = [...historyRef.current, activeBrew.content].slice(-150);
      redoRef.current = [];
    }
    updateActiveBrew((brew) => ({ ...brew, content }));
  };

  const insertText = (before: string, after = '') => {
    const editor = editorRef.current;
    if (!editor || !activeBrew) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = activeBrew.content.slice(start, end);
    const next = `${activeBrew.content.slice(0, start)}${before}${selected}${after}${activeBrew.content.slice(end)}`;
    updateContent(next);

    window.requestAnimationFrame(() => {
      editor.focus();
      const cursor = start + before.length + selected.length + after.length;
      editor.setSelectionRange(cursor, cursor);
    });
  };

  const undo = () => {
    if (!activeBrew) return;
    const previous = historyRef.current.pop();
    if (previous === undefined) return;
    redoRef.current.push(activeBrew.content);
    updateContent(previous, false);
  };

  const redo = () => {
    if (!activeBrew) return;
    const next = redoRef.current.pop();
    if (next === undefined) return;
    historyRef.current.push(activeBrew.content);
    updateContent(next, false);
  };

  const createNewBrew = () => {
    const brew = createBrew();
    setBrews((currentBrews) => [brew, ...currentBrews]);
    setActiveId(brew.id);
    historyRef.current = [];
    redoRef.current = [];
    setMobileSection('editor');
  };

  const duplicateActiveBrew = () => {
    if (!activeBrew) return;
    const duplicate = {
      ...activeBrew,
      id: crypto.randomUUID(),
      title: `${activeBrew.title || 'Untitled Brew'} copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    setBrews((currentBrews) => [duplicate, ...currentBrews]);
    setActiveId(duplicate.id);
    setMobileSection('editor');
  };

  const deleteActiveBrew = async () => {
    if (!activeBrew) return;
    if (!window.confirm(`Delete “${activeBrew.title || 'Untitled Brew'}” from this device? This cannot be undone.`)) return;

    await deleteBrew(activeBrew.id);
    const remaining = brews.filter((brew) => brew.id !== activeBrew.id);
    if (remaining.length === 0) {
      const replacement = createBrew();
      setBrews([replacement]);
      setActiveId(replacement.id);
    } else {
      setBrews(remaining);
      setActiveId(remaining[0].id);
    }
  };

  const replaceAll = () => {
    if (!activeBrew || !findValue) return;
    updateContent(activeBrew.content.split(findValue).join(replaceValue));
  };

  const connectDrive = async () => {
    try {
      setSaveState('Connecting to Google Drive…');
      const token = await requestDriveAccess();
      setAccessToken(token);
      setSaveState('Google Drive connected for this session');
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Google Drive connection failed');
    }
  };

  const syncToDrive = async () => {
    if (!accessToken || syncing) return;
    try {
      setSyncing(true);
      setSaveState('Syncing with Google Drive…');
      const result = await syncBrews(accessToken, brews);
      await replaceBrews(result.brews);
      setBrews(result.brews);
      setSaveState(result.detail);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Google Drive sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const replaceBrew = async (brew: Brew) => {
    await saveBrew(brew);
    setBrews((current) => current.map((item) => item.id === brew.id ? brew : item));
  };

  const keepDriveConflict = async () => {
    if (!activeBrew) return;
    await replaceBrew(resolveWithDriveVersion(activeBrew));
    setSaveState('Kept the Drive version');
  };

  const keepBothConflict = async () => {
    if (!activeBrew) return;
    const resolved = keepBothVersions(activeBrew);
    await replaceBrews(resolved);
    setBrews((current) => current.flatMap((brew) => brew.id === activeBrew.id ? resolved : brew));
    setSaveState('Kept both copies; sync the local copy when ready');
  };

  const overwriteDriveConflict = async () => {
    if (!activeBrew || !accessToken) return;
    try {
      setSyncing(true);
      const resolved = await overwriteDriveBrew(accessToken, activeBrew);
      await replaceBrew(resolved);
      setSaveState('Drive version replaced with this local copy');
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Could not replace the Drive version');
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !activeBrew) {
    return <main className="loading-screen">Opening your local brew library…</main>;
  }

  const outline = getOutline(activeBrew.content);

  return (
    <div className={`app-shell mobile-${mobileSection}`}>
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden>✦</span>
          <span>Homebrewry</span>
          <span className="phase-badge">Local beta</span>
        </div>
        <div className="desktop-view-controls" aria-label="Preview layout">
          {(['editor', 'split', 'preview'] as ViewMode[]).map((mode) => (
            <button
              className={viewMode === mode ? 'is-selected' : ''}
              key={mode}
              onClick={() => setViewMode(mode)}
              type="button"
            >
              {mode === 'editor' ? 'Editor' : mode === 'preview' ? 'Preview' : 'Split'}
            </button>
          ))}
          <button onClick={() => window.print()} type="button">Print</button>
        </div>
        <div className="cloud-controls">
          {accessToken ? (
            <button onClick={() => void syncToDrive()} type="button" disabled={syncing}>
              {syncing ? 'Syncing…' : 'Refresh & sync'}
            </button>
          ) : (
            <button onClick={() => void connectDrive()} type="button" disabled={!isGoogleConfigured()}>
              Connect Drive
            </button>
          )}
        </div>
        <div className="save-indicator" aria-live="polite">{saveState}</div>
      </header>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {(Object.keys(mobileLabels) as MobileSection[]).map((section) => (
          <button
            className={mobileSection === section ? 'is-selected' : ''}
            key={section}
            onClick={() => setMobileSection(section)}
            type="button"
          >
            {mobileLabels[section]}
          </button>
        ))}
      </nav>

      <div className={`workspace view-${viewMode}`}>
        <LibraryPanel
          activeId={activeBrew.id}
          brews={brews}
          onDelete={() => void deleteActiveBrew()}
          onDuplicate={duplicateActiveBrew}
          onNew={createNewBrew}
          onQueryChange={setQuery}
          onSelect={(id) => {
            setActiveId(id);
            setMobileSection('editor');
          }}
          query={query}
        />

        <div className="main-panes">
          <EditorPane
            content={activeBrew.content}
            editorRef={editorRef}
            findValue={findValue}
            findVisible={findVisible}
            onContentChange={updateContent}
            onFindChange={setFindValue}
            onInsert={insertText}
            onKeyDown={(event) => {
              if (!(event.metaKey || event.ctrlKey)) return;
              if (event.key.toLowerCase() === 'z') {
                event.preventDefault();
                if (event.shiftKey) redo(); else undo();
              }
              if (event.key.toLowerCase() === 'y') {
                event.preventDefault();
                redo();
              }
            }}
            onRedo={redo}
            onReplaceAll={replaceAll}
            onReplaceChange={setReplaceValue}
            onTitleChange={(title) => updateActiveBrew((brew) => ({ ...brew, title }))}
            onToggleFind={() => setFindVisible((visible) => !visible)}
            onUndo={undo}
            replaceValue={replaceValue}
            title={activeBrew.title}
          />
          <section className="preview-pane" aria-label="Live preview">
            <div className="preview-canvas">
              <BrewPreview brew={activeBrew} />
            </div>
          </section>
        </div>

        <OutlinePanel outline={outline} />
      </div>
      {activeBrew.syncState === 'conflict' && activeBrew.conflict && (
        <div className="conflict-backdrop" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
          <section className="conflict-dialog">
            <p className="eyebrow">Sync conflict</p>
            <h2 id="conflict-title">Both copies changed</h2>
            <p>Nothing has been overwritten. Choose what to keep for “{activeBrew.title || 'Untitled Brew'}”.</p>
            <div className="conflict-times">
              <span>This device: {new Date(activeBrew.updatedAt).toLocaleString()}</span>
              <span>Google Drive: {new Date(activeBrew.conflict.remoteBrew.updatedAt).toLocaleString()}</span>
            </div>
            <div className="conflict-actions">
              <button onClick={() => void keepDriveConflict()} type="button">Keep Drive version</button>
              <button onClick={() => void keepBothConflict()} type="button">Keep both copies</button>
              <button className="danger-button" disabled={!accessToken || syncing} onClick={() => void overwriteDriveConflict()} type="button">Replace Drive with this copy</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
