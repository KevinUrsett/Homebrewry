import { useEffect, useMemo, useRef, useState } from 'react';
import { CataloguePanel } from './components/CataloguePanel';
import { BrewPreview } from './components/BrewPreview';
import { EditorPane } from './components/EditorPane';
import { ImportDialog } from './components/ImportDialog';
import { LibraryPanel } from './components/LibraryPanel';
import { OutlinePanel } from './components/OutlinePanel';
import { ReferenceDialog } from './components/ReferenceDialog';
import type { MarkdownEditorHandle } from './components/MarkdownEditor';
import { createBrew, deleteBrew, replaceBrews, saveBrew, seedBrews } from './lib/brewStore';
import { createAsset, listAssets, replaceAssets, saveAsset } from './lib/assetStore';
import { syncAssets } from './lib/assetSync';
import { keepBothVersions, resolveWithDriveVersion } from './lib/conflicts';
import { isGoogleConfigured, requestDriveAccess } from './lib/googleIdentity';
import { getOutline } from './lib/outline';
import { importHomebrewerySource, titleFromImportedSource } from './lib/importer';
import { overwriteDriveBrew, syncBrews } from './lib/sync';
import { loadCatalogue, toCatalogueMap } from './catalogue/catalogueData';
import { formatCatalogueReference } from './catalogue/references';
import type { CatalogueEntry } from './catalogue/types';
import type { Brew, BrewAsset, MobileSection, ViewMode } from './types';

const mobileLabels: Record<MobileSection, string> = {
  library: 'Brews',
  editor: 'Edit',
  preview: 'Preview',
  outline: 'Outline',
  catalogue: 'Catalogue'
};

export default function App() {
  const [brews, setBrews] = useState<Brew[]>([]);
  const [assets, setAssets] = useState<BrewAsset[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [mobileSection, setMobileSection] = useState<MobileSection>('editor');
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState('Loading local drafts…');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [findVisible, setFindVisible] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [catalogueEntries, setCatalogueEntries] = useState<CatalogueEntry[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogueSelection, setCatalogueSelection] = useState<CatalogueEntry | null>(null);
  const [referenceEntry, setReferenceEntry] = useState<CatalogueEntry | null>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);

  useEffect(() => {
    Promise.all([seedBrews(), listAssets()])
      .then(([storedBrews, storedAssets]) => {
        setBrews(storedBrews);
        setAssets(storedAssets);
        setActiveId(storedBrews[0]?.id ?? null);
        setSaveState('Saved locally');
      })
      .catch(() => setSaveState('Local storage is unavailable'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCatalogue()
      .then((entries) => {
        if (!cancelled) setCatalogueEntries(entries);
      })
      .catch((error) => {
        if (!cancelled) setCatalogueError(error instanceof Error ? error.message : 'Unknown catalogue error');
      })
      .finally(() => {
        if (!cancelled) setCatalogueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeBrew = useMemo(
    () => brews.find((brew) => brew.id === activeId) ?? null,
    [activeId, brews]
  );
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const catalogueMap = useMemo(() => toCatalogueMap(catalogueEntries), [catalogueEntries]);

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
    if (!activeBrew) return;
    const editor = editorRef.current;
    const selection = editor?.getSelection() ?? selectionRef.current;
    const start = selection.start;
    const end = selection.end;
    const selected = activeBrew.content.slice(start, end);
    const next = `${activeBrew.content.slice(0, start)}${before}${selected}${after}${activeBrew.content.slice(end)}`;
    updateContent(next);

    const cursor = start + before.length + selected.length + after.length;
    selectionRef.current = { start: cursor, end: cursor };
    window.requestAnimationFrame(() => editorRef.current?.focus(cursor));
  };

  const openCatalogue = (entry?: CatalogueEntry) => {
    setCatalogueSelection(entry ?? null);
    setCatalogueOpen(true);
    setMobileSection('catalogue');
  };

  const openReferenceInCatalogue = () => {
    if (!referenceEntry) return;
    openCatalogue(referenceEntry);
    setReferenceEntry(null);
  };

  const insertCatalogueReference = (entry: CatalogueEntry) => {
    insertText(formatCatalogueReference(entry));
    setReferenceEntry(null);
    setCatalogueOpen(false);
    setMobileSection('editor');
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

  const importBrew = (source: string) => {
    const result = importHomebrewerySource(source);
    const brew = {
      ...createBrew(titleFromImportedSource(result.content)),
      content: result.content,
      syncState: 'local' as const
    };
    setBrews((current) => [brew, ...current]);
    setActiveId(brew.id);
    setImportOpen(false);
    setMobileSection('editor');
    setSaveState(result.notices.length ? `Imported brew. ${result.notices.join(' ')}` : 'Imported brew locally');
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
      const assetResult = await syncAssets(accessToken, assets);
      await replaceAssets(assetResult.assets);
      setAssets(assetResult.assets);
      const brewResult = await syncBrews(accessToken, brews);
      await replaceBrews(brewResult.brews);
      setBrews(brewResult.brews);
      setSaveState(`${brewResult.detail}; ${assetResult.detail}`);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Google Drive sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const uploadImage = async (file: File) => {
    const suggestedAlt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    const alt = window.prompt('Describe this image for accessibility:', suggestedAlt);
    if (alt === null) return;
    try {
      const asset = createAsset(file, alt);
      await saveAsset(asset);
      const nextAssets = [asset, ...assets];
      setAssets(nextAssets);
      insertText(`\n![${asset.alt}](asset://${asset.id})\n`);
      if (!accessToken) {
        setSaveState('Image added locally — connect Drive, then sync to back it up');
        return;
      }
      const result = await syncAssets(accessToken, nextAssets);
      await replaceAssets(result.assets);
      setAssets(result.assets);
      setSaveState(`Image uploaded to Drive; ${result.detail}`);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Image upload failed');
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
          <span className="phase-badge">Phase 5 beta</span>
        </div>
        <div className="desktop-view-controls" aria-label="Preview layout">
          {(['editor', 'split', 'preview'] as ViewMode[]).map((mode) => (
            <button
              className={viewMode === mode ? 'is-selected' : ''}
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setCatalogueOpen(false);
              }}
              type="button"
            >
              {mode === 'editor' ? 'Editor' : mode === 'preview' ? 'Preview' : 'Split'}
            </button>
          ))}
          <button className={catalogueOpen ? 'is-selected' : ''} onClick={() => catalogueOpen ? setCatalogueOpen(false) : openCatalogue()} type="button">Catalogue</button>
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
            onClick={() => {
              if (section === 'catalogue') {
                openCatalogue();
                return;
              }
              setMobileSection(section);
              setCatalogueOpen(false);
            }}
            type="button"
          >
            {mobileLabels[section]}
          </button>
        ))}
      </nav>

      {catalogueOpen ? (
        <CataloguePanel
          key={catalogueSelection?.id ?? 'browse'}
          entries={catalogueEntries}
          error={catalogueError}
          loading={catalogueLoading}
          onInsertReference={insertCatalogueReference}
          selectedEntry={catalogueSelection}
        />
      ) : (
        <div className={`workspace view-${viewMode}`}>
          <LibraryPanel
            activeId={activeBrew.id}
            brews={brews}
            onDelete={() => void deleteActiveBrew()}
            onDuplicate={duplicateActiveBrew}
            onImport={() => setImportOpen(true)}
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
              catalogue={catalogueMap}
              content={activeBrew.content}
              editorRef={editorRef}
              findValue={findValue}
              findVisible={findVisible}
              onContentChange={updateContent}
              onFindChange={setFindValue}
              onImageUpload={(file) => void uploadImage(file)}
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
              onOpenCatalogue={openCatalogue}
              onRedo={redo}
              onReferenceOpen={setReferenceEntry}
              onReplaceAll={replaceAll}
              onReplaceChange={setReplaceValue}
              onSelectionChange={(selection) => { selectionRef.current = selection; }}
              onTitleChange={(title) => updateActiveBrew((brew) => ({ ...brew, title }))}
              onToggleFind={() => setFindVisible((visible) => !visible)}
              onUndo={undo}
              replaceValue={replaceValue}
              title={activeBrew.title}
            />
            <section className="preview-pane" aria-label="Live preview">
              <div className="preview-canvas">
                <BrewPreview assets={assetMap} brew={activeBrew} catalogue={catalogueMap} onReferenceOpen={setReferenceEntry} />
              </div>
            </section>
          </div>

          <OutlinePanel outline={outline} />
        </div>
      )}
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
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImport={importBrew} />}
      {referenceEntry && <ReferenceDialog entry={referenceEntry} onClose={() => setReferenceEntry(null)} onOpenInCatalogue={openReferenceInCatalogue} />}
    </div>
  );
}
