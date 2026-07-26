import { useEffect, useMemo, useRef, useState } from 'react';
import { CataloguePanel } from './components/CataloguePanel';
import { BrewPreview } from './components/BrewPreview';
import { EncounterPanel } from './components/EncounterPanel';
import { EditorPane } from './components/EditorPane';
import { ImportDialog } from './components/ImportDialog';
import { LibraryPanel } from './components/LibraryPanel';
import { OutlinePanel } from './components/OutlinePanel';
import { PrivateMonsterImportDialog } from './components/PrivateMonsterImportDialog';
import { ReferenceDialog } from './components/ReferenceDialog';
import { WorldbuildingPanel } from './components/WorldbuildingPanel';
import type { MarkdownEditorHandle } from './components/MarkdownEditor';
import { createBrew, deleteBrew, getCampaignDataSyncMetadata, replaceBrews, replaceCampaignData, saveBrew, saveCampaignDataSyncMetadata, seedBrews } from './lib/brewStore';
import { createAsset, listAssets, replaceAssets, saveAsset } from './lib/assetStore';
import { syncAssets } from './lib/assetSync';
import { createCampaignDataSnapshot } from './lib/campaignData';
import { keepBothCampaignDataVersions, keepDriveCampaignData, overwriteDriveCampaignData, syncCampaignData, type CampaignDataSyncResult } from './lib/campaignSync';
import { keepBothVersions, resolveWithDriveVersion } from './lib/conflicts';
import { isGoogleConfigured, requestDriveAccess } from './lib/googleIdentity';
import { getOutline, insertAtOutlineSectionEnd } from './lib/outline';
import { importHomebrewerySource, titleFromImportedSource } from './lib/importer';
import type { PrivateMonsterImportReport } from './lib/privateMonsterImport';
import { clearPrivateMonsterEntries, listPrivateMonsterEntries, replacePrivateMonsterEntries } from './lib/privateMonsterStore';
import { overwriteDriveBrew, syncBrews } from './lib/sync';
import { createEncounter as createCombatEncounter, createPartyMember } from './lib/encounters';
import { deleteEncounter as deleteStoredEncounter, deletePartyMember as deleteStoredPartyMember, listEncounters, listPartyMembers, saveEncounter, savePartyMember } from './lib/encounterStore';
import { formatEncounterReference } from './lib/encounterReferences';
import { createWorldbuildingEntry } from './lib/worldbuilding';
import { deleteWorldbuildingEntry as deleteStoredWorldbuildingEntry, listWorldbuildingEntries, saveWorldbuildingEntry } from './lib/worldbuildingStore';
import { loadCatalogue, toCatalogueMap } from './catalogue/catalogueData';
import { formatCatalogueReference } from './catalogue/references';
import type { CatalogueEntry } from './catalogue/types';
import type { Brew, BrewAsset, CampaignDataSyncMetadata, Encounter, MobileSection, PartyMember, ViewMode, WorldbuildingEntry, WorldbuildingKind } from './types';

const mobileLabels: Record<MobileSection, string> = {
  library: 'Brews',
  editor: 'Edit',
  preview: 'Preview',
  outline: 'Outline',
  catalogue: 'Catalogue',
  encounters: 'Encounters',
  worldbuilding: 'Worldbuilding'
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
  const [baseCatalogueEntries, setBaseCatalogueEntries] = useState<CatalogueEntry[]>([]);
  const [privateMonsterEntries, setPrivateMonsterEntries] = useState<CatalogueEntry[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [privateMonsterImportOpen, setPrivateMonsterImportOpen] = useState(false);
  const [catalogueSelection, setCatalogueSelection] = useState<CatalogueEntry | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [encountersOpen, setEncountersOpen] = useState(false);
  const [encounterSelectedId, setEncounterSelectedId] = useState<string | null>(null);
  const [pendingEncounterInsertion, setPendingEncounterInsertion] = useState<Encounter | null>(null);
  const [worldbuildingEntries, setWorldbuildingEntries] = useState<WorldbuildingEntry[]>([]);
  const [worldbuildingOpen, setWorldbuildingOpen] = useState(false);
  const [worldbuildingSelectedId, setWorldbuildingSelectedId] = useState<string | null>(null);
  const [campaignDataSync, setCampaignDataSync] = useState<CampaignDataSyncMetadata | null>(null);
  const [referenceEntry, setReferenceEntry] = useState<CatalogueEntry | null>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);

  useEffect(() => {
    Promise.all([seedBrews(), listAssets(), listEncounters(), listPartyMembers(), listWorldbuildingEntries(), getCampaignDataSyncMetadata()])
      .then(([storedBrews, storedAssets, storedEncounters, storedPartyMembers, storedWorldbuildingEntries, storedCampaignDataSync]) => {
        setBrews(storedBrews);
        setAssets(storedAssets);
        setEncounters(storedEncounters);
        setPartyMembers(storedPartyMembers);
        setWorldbuildingEntries(storedWorldbuildingEntries);
        setCampaignDataSync(storedCampaignDataSync);
        setActiveId(storedBrews[0]?.id ?? null);
        setEncounterSelectedId(storedEncounters[0]?.id ?? null);
        setWorldbuildingSelectedId(storedWorldbuildingEntries[0]?.id ?? null);
        setSaveState('Saved locally');
      })
      .catch(() => setSaveState('Local storage is unavailable'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCatalogue(), listPrivateMonsterEntries()])
      .then(([entries, privateEntries]) => {
        if (!cancelled) {
          setBaseCatalogueEntries(entries);
          setPrivateMonsterEntries(privateEntries);
        }
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
  const catalogueEntries = useMemo(
    () => [...baseCatalogueEntries, ...privateMonsterEntries].sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name)),
    [baseCatalogueEntries, privateMonsterEntries]
  );
  const catalogueMap = useMemo(() => toCatalogueMap(catalogueEntries), [catalogueEntries]);
  const encounterMap = useMemo(() => new Map(encounters.map((encounter) => [encounter.id, encounter])), [encounters]);

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
    setEncountersOpen(false);
    setWorldbuildingOpen(false);
    setPendingEncounterInsertion(null);
    setMobileSection('catalogue');
  };

  const importMonsterArchive = async (file: File): Promise<PrivateMonsterImportReport> => {
    const existingMonsterIds = new Set(
      baseCatalogueEntries.filter((entry) => entry.category === 'monster').map((entry) => entry.id)
    );
    const { importPrivateMonsterArchive } = await import('./lib/privateMonsterImport');
    const report = await importPrivateMonsterArchive(file, existingMonsterIds);
    if (!report.importedCount) {
      throw new Error('No new valid monsters were found. The existing private catalogue was left unchanged.');
    }
    await replacePrivateMonsterEntries(report.entries);
    setPrivateMonsterEntries(report.entries);
    setCatalogueSelection(report.entries[0] ?? null);
    setSaveState(`${report.importedCount.toLocaleString()} private monsters imported on this device`);
    return report;
  };

  const clearPrivateMonsterArchive = async () => {
    await clearPrivateMonsterEntries();
    setPrivateMonsterEntries([]);
    setCatalogueSelection((current) => current?.source.toLowerCase().includes('private import') ? null : current);
    setReferenceEntry((current) => current?.source.toLowerCase().includes('private import') ? null : current);
    setSaveState('Private monsters removed from this device');
  };

  const openEncounters = (encounter?: Encounter) => {
    if (encounter) setEncounterSelectedId(encounter.id);
    setCatalogueOpen(false);
    setEncountersOpen(true);
    setWorldbuildingOpen(false);
    setPendingEncounterInsertion(null);
    setMobileSection('encounters');
  };

  const openWorldbuilding = (entry?: WorldbuildingEntry) => {
    if (entry) setWorldbuildingSelectedId(entry.id);
    setCatalogueOpen(false);
    setEncountersOpen(false);
    setWorldbuildingOpen(true);
    setPendingEncounterInsertion(null);
    setMobileSection('worldbuilding');
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

  const beginEncounterInsertion = (encounter: Encounter) => {
    setPendingEncounterInsertion(encounter);
    setEncountersOpen(false);
    setWorldbuildingOpen(false);
    setMobileSection('outline');
    setSaveState('Choose an outline section for this encounter');
  };

  const insertEncounterAtSection = (item: { id: string } | null) => {
    if (!activeBrew || !pendingEncounterInsertion) return;
    updateContent(insertAtOutlineSectionEnd(activeBrew.content, item?.id ?? null, formatEncounterReference(pendingEncounterInsertion)));
    setPendingEncounterInsertion(null);
    setMobileSection('editor');
  };

  const persistEncounter = (encounter: Encounter) => {
    setEncounters((current) => [encounter, ...current.filter((item) => item.id !== encounter.id)]);
    void saveEncounter(encounter)
      .then((metadata) => {
        setCampaignDataSync(metadata);
        setSaveState('Encounter saved locally');
      })
      .catch(() => setSaveState('Encounter save failed'));
  };

  const createNewEncounter = () => {
    const encounter = createCombatEncounter('New encounter', partyMembers);
    persistEncounter(encounter);
    setEncounterSelectedId(encounter.id);
  };

  const persistWorldbuildingEntry = (entry: WorldbuildingEntry) => {
    setWorldbuildingEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
    void saveWorldbuildingEntry(entry)
      .then((metadata) => {
        setCampaignDataSync(metadata);
        setSaveState('Worldbuilding entry saved locally');
      })
      .catch(() => setSaveState('Worldbuilding save failed'));
  };

  const createNewWorldbuildingEntry = () => {
    const entry = createWorldbuildingEntry();
    persistWorldbuildingEntry(entry);
    setWorldbuildingSelectedId(entry.id);
  };

  const addWorldbuildingFromEditor = (name: string, kind: WorldbuildingKind) => {
    const entry = createWorldbuildingEntry(name, kind);
    const existing = worldbuildingEntries.find((item) => item.kind === entry.kind && item.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase());
    if (existing) {
      setWorldbuildingSelectedId(existing.id);
      setSaveState(`“${existing.name}” is already in Worldbuilding`);
      return;
    }
    persistWorldbuildingEntry(entry);
    setWorldbuildingSelectedId(entry.id);
    setSaveState(`Added “${entry.name}” to Worldbuilding`);
  };

  const deleteWorldbuilding = (entry: WorldbuildingEntry) => {
    if (!window.confirm(`Delete “${entry.name}” from Worldbuilding? This cannot be undone.`)) return;
    setWorldbuildingEntries((current) => current.filter((item) => item.id !== entry.id));
    setWorldbuildingSelectedId((currentId) => currentId === entry.id ? null : currentId);
    void deleteStoredWorldbuildingEntry(entry.id)
      .then((metadata) => {
        setCampaignDataSync(metadata);
        setSaveState('Worldbuilding entry deleted locally');
      })
      .catch(() => setSaveState('Worldbuilding deletion failed'));
  };

  const deleteEncounter = (encounter: Encounter) => {
    if (!window.confirm(`Delete “${encounter.name || 'Untitled encounter'}”? This cannot be undone.`)) return;
    setEncounters((current) => current.filter((item) => item.id !== encounter.id));
    setEncounterSelectedId((currentId) => currentId === encounter.id ? null : currentId);
    void deleteStoredEncounter(encounter.id)
      .then((metadata) => {
        setCampaignDataSync(metadata);
        setSaveState('Encounter deleted locally');
      })
      .catch(() => setSaveState('Encounter deletion failed'));
  };

  const persistPartyMember = (member: PartyMember) => {
    const next = {
      ...member,
      name: member.name.replace(/[\r\n]/g, ' '),
      updatedAt: new Date().toISOString()
    };
    setPartyMembers((current) => [...current.filter((item) => item.id !== next.id), next].sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
    void savePartyMember(next)
      .then((metadata) => {
        setCampaignDataSync(metadata);
        setSaveState('Party roster saved locally');
      })
      .catch(() => setSaveState('Party roster save failed'));
  };

  const addPartyMember = (name: string, armorClass: number | null, maxHitPoints: number | null) => {
    persistPartyMember(createPartyMember(name, armorClass, maxHitPoints));
  };

  const deletePartyMember = (member: PartyMember) => {
    if (!window.confirm(`Remove “${member.name}” from the current party roster? Existing encounters will be unchanged.`)) return;
    setPartyMembers((current) => current.filter((item) => item.id !== member.id));
    void deleteStoredPartyMember(member.id)
      .then((metadata) => {
        setCampaignDataSync(metadata);
        setSaveState('Party member removed locally');
      })
      .catch(() => setSaveState('Party roster deletion failed'));
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
    setPendingEncounterInsertion(null);
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

  const applyCampaignDataResult = async (
    result: CampaignDataSyncResult,
    sourceData: CampaignDataSyncResult['data']
  ) => {
    if (result.data === sourceData) {
      await saveCampaignDataSyncMetadata(result.metadata);
    } else {
      await replaceCampaignData(result.data, result.metadata);
      setEncounters(result.data.encounters);
      setPartyMembers(result.data.partyMembers);
      setWorldbuildingEntries(result.data.worldbuildingEntries);
      setEncounterSelectedId((current) => result.data.encounters.some((encounter) => encounter.id === current) ? current : result.data.encounters[0]?.id ?? null);
      setWorldbuildingSelectedId((current) => result.data.worldbuildingEntries.some((entry) => entry.id === current) ? current : result.data.worldbuildingEntries[0]?.id ?? null);
    }
    setCampaignDataSync(result.metadata);
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
      const campaignData = createCampaignDataSnapshot(encounters, partyMembers, worldbuildingEntries);
      const campaignResult = await syncCampaignData(accessToken, campaignData, campaignDataSync ?? await getCampaignDataSyncMetadata());
      await applyCampaignDataResult(campaignResult, campaignData);
      setSaveState(`${brewResult.detail}; ${assetResult.detail}; ${campaignResult.detail}`);
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

  const keepDriveCampaignConflict = async () => {
    if (!campaignDataSync) return;
    const result = keepDriveCampaignData(campaignDataSync);
    if (!result) return;
    const sourceData = createCampaignDataSnapshot(encounters, partyMembers, worldbuildingEntries);
    await applyCampaignDataResult(result, sourceData);
    setSaveState(result.detail);
  };

  const keepBothCampaignConflict = async () => {
    if (!campaignDataSync) return;
    const sourceData = createCampaignDataSnapshot(encounters, partyMembers, worldbuildingEntries);
    const result = keepBothCampaignDataVersions(sourceData, campaignDataSync);
    if (!result) return;
    await applyCampaignDataResult(result, sourceData);
    setSaveState(`${result.detail}. Sync when ready.`);
  };

  const overwriteDriveCampaignConflict = async () => {
    if (!campaignDataSync || !accessToken) return;
    try {
      setSyncing(true);
      const sourceData = createCampaignDataSnapshot(encounters, partyMembers, worldbuildingEntries);
      const result = await overwriteDriveCampaignData(accessToken, sourceData, campaignDataSync);
      await applyCampaignDataResult(result, sourceData);
      setSaveState(result.detail);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Could not replace Drive campaign data');
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
          <span className="phase-badge">Phase 7 beta</span>
        </div>
        <div className="desktop-view-controls" aria-label="Preview layout">
          {(['editor', 'split', 'preview'] as ViewMode[]).map((mode) => (
            <button
              className={viewMode === mode ? 'is-selected' : ''}
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setCatalogueOpen(false);
                setEncountersOpen(false);
                setWorldbuildingOpen(false);
                setPendingEncounterInsertion(null);
              }}
              type="button"
            >
              {mode === 'editor' ? 'Editor' : mode === 'preview' ? 'Preview' : 'Split'}
            </button>
          ))}
          <button className={catalogueOpen ? 'is-selected' : ''} onClick={() => catalogueOpen ? setCatalogueOpen(false) : openCatalogue()} type="button">Catalogue</button>
          <button className={encountersOpen ? 'is-selected' : ''} onClick={() => encountersOpen ? setEncountersOpen(false) : openEncounters()} type="button">Encounters</button>
          <button className={worldbuildingOpen ? 'is-selected' : ''} onClick={() => worldbuildingOpen ? setWorldbuildingOpen(false) : openWorldbuilding()} type="button">Worldbuilding</button>
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
              if (section === 'encounters') {
                openEncounters();
                return;
              }
              if (section === 'worldbuilding') {
                openWorldbuilding();
                return;
              }
              setMobileSection(section);
              setCatalogueOpen(false);
              setEncountersOpen(false);
              setWorldbuildingOpen(false);
              if (section !== 'outline') setPendingEncounterInsertion(null);
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
          onOpenPrivateMonsterImport={() => setPrivateMonsterImportOpen(true)}
          privateMonsterCount={privateMonsterEntries.length}
          selectedEntry={catalogueSelection}
        />
      ) : encountersOpen ? (
        <EncounterPanel
          encounters={encounters}
          loading={catalogueLoading}
          monsters={catalogueEntries.filter((entry) => entry.category === 'monster')}
          syncState={campaignDataSync?.syncState ?? 'local'}
          onCreateEncounter={createNewEncounter}
          onCreatePartyMember={addPartyMember}
          onDeleteEncounter={deleteEncounter}
          onDeletePartyMember={deletePartyMember}
          onInsertReference={beginEncounterInsertion}
          onSelectEncounter={setEncounterSelectedId}
          onUpdateEncounter={persistEncounter}
          onUpdatePartyMember={persistPartyMember}
          partyMembers={partyMembers}
          selectedId={encounterSelectedId}
        />
      ) : worldbuildingOpen ? (
        <WorldbuildingPanel
          entries={worldbuildingEntries}
          syncState={campaignDataSync?.syncState ?? 'local'}
          onCreate={createNewWorldbuildingEntry}
          onDelete={deleteWorldbuilding}
          onSelect={setWorldbuildingSelectedId}
          onUpdate={persistWorldbuildingEntry}
          selectedId={worldbuildingSelectedId}
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
              setPendingEncounterInsertion(null);
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
              onOpenEncounters={openEncounters}
              onAddWorldbuilding={addWorldbuildingFromEditor}
              onRedo={redo}
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
                <BrewPreview assets={assetMap} brew={activeBrew} catalogue={catalogueMap} encounters={encounterMap} onEncounterOpen={openEncounters} onReferenceOpen={setReferenceEntry} />
              </div>
            </section>
          </div>

          <OutlinePanel
            insertionLabel={pendingEncounterInsertion?.name ?? null}
            onCancelInsertion={() => {
              setPendingEncounterInsertion(null);
              setSaveState('Encounter placement cancelled');
            }}
            onInsertAtSection={insertEncounterAtSection}
            outline={outline}
          />
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
      {activeBrew.syncState !== 'conflict' && campaignDataSync?.syncState === 'conflict' && campaignDataSync.conflict && (
        <div className="conflict-backdrop" role="dialog" aria-modal="true" aria-labelledby="campaign-conflict-title">
          <section className="conflict-dialog">
            <p className="eyebrow">Campaign sync conflict</p>
            <h2 id="campaign-conflict-title">Both campaign copies changed</h2>
            <p>Encounters, the current party, and Worldbuilding records have changes on both devices. Nothing has been overwritten.</p>
            <div className="conflict-times">
              <span>This device: {new Date(campaignDataSync.lastLocalChangeAt).toLocaleString()}</span>
              <span>Google Drive: {new Date(campaignDataSync.conflict.remoteData.updatedAt).toLocaleString()}</span>
            </div>
            <div className="conflict-actions">
              <button onClick={() => void keepDriveCampaignConflict()} type="button">Keep Drive campaign data</button>
              <button onClick={() => void keepBothCampaignConflict()} type="button">Keep both sets of records</button>
              <button className="danger-button" disabled={!accessToken || syncing} onClick={() => void overwriteDriveCampaignConflict()} type="button">Replace Drive with this device copy</button>
            </div>
          </section>
        </div>
      )}
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImport={importBrew} />}
      {privateMonsterImportOpen && (
        <PrivateMonsterImportDialog
          existingCount={privateMonsterEntries.length}
          onClear={clearPrivateMonsterArchive}
          onClose={() => setPrivateMonsterImportOpen(false)}
          onImport={importMonsterArchive}
        />
      )}
      {referenceEntry && <ReferenceDialog entry={referenceEntry} onClose={() => setReferenceEntry(null)} onOpenInCatalogue={openReferenceInCatalogue} />}
    </div>
  );
}
