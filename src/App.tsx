import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CataloguePanel } from './components/CataloguePanel';
import { CampaignPanel, type PlotBeatDraftSeed } from './components/CampaignPanel';
import { BrewPreview } from './components/BrewPreview';
import { EncounterPanel } from './components/EncounterPanel';
import { EditorPane } from './components/EditorPane';
import { ImportDialog } from './components/ImportDialog';
import { IdeasPanel } from './components/IdeasPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { NameGeneratorDialog } from './components/NameGeneratorDialog';
import { OutlinePanel } from './components/OutlinePanel';
import { PrivateMonsterImportDialog } from './components/PrivateMonsterImportDialog';
import { ReferenceDialog } from './components/ReferenceDialog';
import { WorldbuildingPanel } from './components/WorldbuildingPanel';
import { WorldbuildingReferenceDialog } from './components/WorldbuildingReferenceDialog';
import type { MarkdownEditorHandle } from './components/MarkdownEditor';
import {
  creationDeviceLabel,
  createBrew,
  deleteBrew,
  getCampaignDataSyncMetadata,
  getLivingWorldData,
  getPrivateMonsterSyncMetadata,
  replaceBrews,
  replaceCampaignData,
  replacePrivateMonsterData,
  saveBrew,
  saveCampaignDataSyncMetadata,
  saveLivingWorldData,
  savePrivateMonsterSyncMetadata,
  seedBrews
} from './lib/brewStore';
import { createAsset, listAssets, replaceAssets, saveAsset } from './lib/assetStore';
import { syncAssets } from './lib/assetSync';
import { createCampaignDataSnapshot } from './lib/campaignData';
import { deriveCampaignPosition, derivePartyLocation } from './lib/campaignProgress';
import { partyEntityId, recordCombatCompletion, recordManualStateChange, recordPartyLocation, synchroniseLivingWorld } from './lib/livingWorld';
import { projectCurrentState } from './lib/worldState';
import { keepBothCampaignDataVersions, keepDriveCampaignData, overwriteDriveCampaignData, syncCampaignData, type CampaignDataSyncResult } from './lib/campaignSync';
import { keepBothVersions, resolveWithDriveVersion } from './lib/conflicts';
import { isGoogleConfigured, requestDriveAccess } from './lib/googleIdentity';
import { getOutline, getOutlineLocations, insertAtOutlineSectionEnd } from './lib/outline';
import { importHomebrewerySource, titleFromImportedSource } from './lib/importer';
import type { PrivateMonsterImportReport } from './lib/privateMonsterImport';
import { clearPrivateMonsterEntries, listPrivateMonsterEntries, replacePrivateMonsterEntries } from './lib/privateMonsterStore';
import { keepDrivePrivateMonsterCatalogue, overwriteDrivePrivateMonsterCatalogue, syncPrivateMonsterCatalogue, type PrivateMonsterSyncResult } from './lib/privateMonsterSync';
import {
  deleteCustomCatalogueEntry,
  listCustomCatalogueCategories,
  listCustomCatalogueEntries,
  saveCustomCatalogueCategory,
  saveCustomCatalogueEntry
} from './lib/customCatalogueStore';
import { overwriteDriveBrew, syncBrews } from './lib/sync';
import { createEncounter as createCombatEncounter, createPartyMember, touchEncounter } from './lib/encounters';
import { deleteEncounter as deleteStoredEncounter, deletePartyMember as deleteStoredPartyMember, listEncounters, listPartyMembers, saveEncounter, savePartyMember } from './lib/encounterStore';
import { formatEncounterReference } from './lib/encounterReferences';
import { createWorldbuildingEntry, createWorldbuildingType, findWorldbuildingEntryByName, touchWorldbuildingEntry, worldbuildingKindLabels } from './lib/worldbuilding';
import type { CuratedReference } from './lib/talesOnUnwrittenTomesReferences';
import {
  deleteWorldbuildingEntry as deleteStoredWorldbuildingEntry,
  listWorldbuildingEntries,
  listWorldbuildingTypes,
  saveWorldbuildingEntry,
  saveWorldbuildingEntries,
  saveWorldbuildingType
} from './lib/worldbuildingStore';
import { loadCatalogue, toCatalogueMap } from './catalogue/catalogueData';
import { createCustomCatalogueCategory, createCustomCatalogueEntry, normaliseCustomCatalogueEntry } from './catalogue/customEntries';
import { findCatalogueEntryByName, formatCatalogueReference } from './catalogue/references';
import { formatWorldbuildingReference } from './lib/worldbuildingReferences';
import type { GeneratedName } from './lib/nameGenerator';
import { catalogueCategoryLabel, catalogueCategoryLabels, type CatalogueCategory, type CatalogueEntry, type CustomCatalogueCategory, type CustomCatalogueEntry } from './catalogue/types';
import type { Brew, BrewAsset, CampaignDataSyncMetadata, CampaignMap, Encounter, IdeaDraft, LivingWorldData, MobileSection, PartyMember, PlotBoard, PrivateMonsterSyncMetadata, ViewMode, WorldbuildingEntry, WorldbuildingKind, WorldbuildingType } from './types';

const mobileLabels: Record<MobileSection, string> = {
  library: 'Brews',
  editor: 'Edit',
  preview: 'Preview',
  outline: 'Outline',
  catalogue: 'Catalogue',
  campaign: 'Campaign',
  encounters: 'Encounters',
  worldbuilding: 'Worldbuilding'
};

type DriveSaveNotice = {
  tone: 'saving' | 'success' | 'error';
  message: string;
};

export default function App() {
  const [brews, setBrews] = useState<Brew[]>([]);
  const [assets, setAssets] = useState<BrewAsset[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [mobileSection, setMobileSection] = useState<MobileSection>('editor');
  const [mobilePreviewOutlineOpen, setMobilePreviewOutlineOpen] = useState(false);
  const [mobileTopMenuOpen, setMobileTopMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState('Loading local drafts…');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [savingToDrive, setSavingToDrive] = useState(false);
  const [driveSaveNotice, setDriveSaveNotice] = useState<DriveSaveNotice | null>(null);
  const [findVisible, setFindVisible] = useState(false);
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(() => localStorage.getItem('homebrewry-spellcheck') !== 'off');
  const [importOpen, setImportOpen] = useState(false);
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [baseCatalogueEntries, setBaseCatalogueEntries] = useState<CatalogueEntry[]>([]);
  const [privateMonsterEntries, setPrivateMonsterEntries] = useState<CatalogueEntry[]>([]);
  const [customCatalogueEntries, setCustomCatalogueEntries] = useState<CustomCatalogueEntry[]>([]);
  const [customCatalogueCategories, setCustomCatalogueCategories] = useState<CustomCatalogueCategory[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [plotBeatDraftSeed, setPlotBeatDraftSeed] = useState<PlotBeatDraftSeed | null>(null);
  const [privateMonsterImportOpen, setPrivateMonsterImportOpen] = useState(false);
  const [catalogueSelection, setCatalogueSelection] = useState<CatalogueEntry | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [encountersOpen, setEncountersOpen] = useState(false);
  const [encounterSelectedId, setEncounterSelectedId] = useState<string | null>(null);
  const [pendingInsertion, setPendingInsertion] = useState<{ label: string; content: string; ideaId?: string } | null>(null);
  const [worldbuildingEntries, setWorldbuildingEntries] = useState<WorldbuildingEntry[]>([]);
  const [worldbuildingTypes, setWorldbuildingTypes] = useState<WorldbuildingType[]>([]);
  const [worldbuildingOpen, setWorldbuildingOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [captureMenuOpen, setCaptureMenuOpen] = useState(false);
  const [nameGeneratorTarget, setNameGeneratorTarget] = useState<'editor' | 'worldbuilding' | null>(null);
  const [worldbuildingSelectedId, setWorldbuildingSelectedId] = useState<string | null>(null);
  const [campaignDataSync, setCampaignDataSync] = useState<CampaignDataSyncMetadata | null>(null);
  const [livingWorld, setLivingWorld] = useState<LivingWorldData>(() => ({
    id: 'living-world',
    campaignId: 'default-campaign',
    entities: [],
    entityReferences: [],
    worldEvents: [],
    timelineEntries: [],
    ideaDrafts: []
  }));
  const [privateMonsterSync, setPrivateMonsterSync] = useState<PrivateMonsterSyncMetadata | null>(null);
  const [referenceEntry, setReferenceEntry] = useState<CatalogueEntry | null>(null);
  const [worldbuildingReferenceEntry, setWorldbuildingReferenceEntry] = useState<WorldbuildingEntry | null>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const campaignRecordsRef = useRef({
    encounters: [] as Encounter[],
    partyMembers: [] as PartyMember[],
    worldbuildingEntries: [] as WorldbuildingEntry[],
    customCatalogueEntries: [] as CustomCatalogueEntry[],
    customCatalogueCategories: [] as CustomCatalogueCategory[],
    worldbuildingTypes: [] as WorldbuildingType[],
    livingWorld: null as LivingWorldData | null
  });
  const campaignMetadataRef = useRef<CampaignDataSyncMetadata | null>(null);
  const campaignMutationRef = useRef(0);
  const campaignSyncInFlightRef = useRef(false);
  const campaignSyncQueuedRef = useRef(false);
  const campaignSyncTimerRef = useRef<number | null>(null);
  const privateMonsterEntriesRef = useRef<CatalogueEntry[]>([]);
  const privateMonsterMetadataRef = useRef<PrivateMonsterSyncMetadata | null>(null);
  const privateMonsterMutationRef = useRef(0);
  const privateMonsterSyncInFlightRef = useRef(false);
  const privateMonsterSyncQueuedRef = useRef(false);
  const privateMonsterSyncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateAppHeight = () => {
      // iOS can pan its layout viewport to keep the caret visible. In that
      // state `visualViewport.height` alone leaves the lower part of the
      // editor short by `offsetTop`, revealing an inert strip beneath it.
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleHeight = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${Math.round(visibleTop + visibleHeight)}px`);
    };
    updateAppHeight();
    viewport?.addEventListener('resize', updateAppHeight);
    viewport?.addEventListener('scroll', updateAppHeight);
    window.addEventListener('resize', updateAppHeight);
    return () => {
      viewport?.removeEventListener('resize', updateAppHeight);
      viewport?.removeEventListener('scroll', updateAppHeight);
      window.removeEventListener('resize', updateAppHeight);
      document.documentElement.style.removeProperty('--app-height');
    };
  }, []);

  useEffect(() => {
    Promise.all([
      seedBrews(),
      listAssets(),
      listEncounters(),
      listPartyMembers(),
      listWorldbuildingEntries(),
      listWorldbuildingTypes(),
      listPrivateMonsterEntries(),
      listCustomCatalogueEntries(),
      listCustomCatalogueCategories(),
      getCampaignDataSyncMetadata(),
      getLivingWorldData(),
      getPrivateMonsterSyncMetadata()
    ])
      .then(([
        storedBrews,
        storedAssets,
        storedEncounters,
        storedPartyMembers,
        storedWorldbuildingEntries,
        storedWorldbuildingTypes,
        storedPrivateMonsterEntries,
        storedCustomCatalogueEntries,
        storedCustomCatalogueCategories,
        storedCampaignDataSync,
        storedLivingWorld,
        storedPrivateMonsterSync
      ]) => {
        setBrews(storedBrews);
        setAssets(storedAssets);
        setEncounters(storedEncounters);
        setPartyMembers(storedPartyMembers);
        setWorldbuildingEntries(storedWorldbuildingEntries);
        setWorldbuildingTypes(storedWorldbuildingTypes);
        setPrivateMonsterEntries(storedPrivateMonsterEntries);
        setCustomCatalogueEntries(storedCustomCatalogueEntries);
        setCustomCatalogueCategories(storedCustomCatalogueCategories);
        setCampaignDataSync(storedCampaignDataSync);
        const syncedLivingWorld = synchroniseLivingWorld(storedLivingWorld, storedWorldbuildingEntries);
        setLivingWorld(syncedLivingWorld);
        if (JSON.stringify(syncedLivingWorld.entities) !== JSON.stringify(storedLivingWorld.entities)) {
          void saveLivingWorldData(syncedLivingWorld).then((metadata) => {
            campaignMetadataRef.current = metadata;
            setCampaignDataSync(metadata);
          });
        }
        setPrivateMonsterSync(storedPrivateMonsterSync);
        const savedCurrentBrew = syncedLivingWorld.currentBrewId;
        setActiveId(storedBrews.some((brew) => brew.id === savedCurrentBrew) ? savedCurrentBrew! : storedBrews[0]?.id ?? null);
        setEncounterSelectedId(storedEncounters[0]?.id ?? null);
        setWorldbuildingSelectedId(storedWorldbuildingEntries[0]?.id ?? null);
        setSaveState('Saved locally');
      })
      .catch(() => setSaveState('Local storage is unavailable'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCatalogue()
      .then((entries) => {
        if (!cancelled) {
          setBaseCatalogueEntries(entries);
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

  useEffect(() => {
    campaignRecordsRef.current = {
      encounters,
      partyMembers,
      worldbuildingEntries,
      customCatalogueEntries,
      customCatalogueCategories,
      worldbuildingTypes,
      livingWorld
    };
  }, [customCatalogueCategories, customCatalogueEntries, encounters, livingWorld, partyMembers, worldbuildingEntries, worldbuildingTypes]);

  useEffect(() => {
    campaignMetadataRef.current = campaignDataSync;
  }, [campaignDataSync]);

  useEffect(() => {
    privateMonsterEntriesRef.current = privateMonsterEntries;
  }, [privateMonsterEntries]);

  useEffect(() => {
    privateMonsterMetadataRef.current = privateMonsterSync;
  }, [privateMonsterSync]);

  useEffect(() => () => {
    if (campaignSyncTimerRef.current !== null) {
      window.clearTimeout(campaignSyncTimerRef.current);
    }
    if (privateMonsterSyncTimerRef.current !== null) {
      window.clearTimeout(privateMonsterSyncTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!driveSaveNotice || driveSaveNotice.tone === 'saving') return;
    const timer = window.setTimeout(() => setDriveSaveNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [driveSaveNotice]);

  const activeBrew = useMemo(
    () => brews.find((brew) => brew.id === activeId) ?? null,
    [activeId, brews]
  );
  const deferredBrews = useDeferredValue(brews);
  const previewBrew = useMemo(
    () => deferredBrews.find((brew) => brew.id === activeId) ?? activeBrew,
    [activeBrew, activeId, deferredBrews]
  );
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const catalogueEntries = useMemo(
    () => [...baseCatalogueEntries, ...privateMonsterEntries, ...customCatalogueEntries].sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name)),
    [baseCatalogueEntries, customCatalogueEntries, privateMonsterEntries]
  );
  const catalogueMap = useMemo(() => toCatalogueMap(catalogueEntries), [catalogueEntries]);
  const encounterMap = useMemo(() => new Map(encounters.map((encounter) => [encounter.id, encounter])), [encounters]);
  const campaignPosition = useMemo(
    () => deriveCampaignPosition(deferredBrews, encounters, livingWorld.currentBrewId),
    [deferredBrews, encounters, livingWorld.currentBrewId]
  );
  const worldbuildingMap = useMemo(() => new Map(worldbuildingEntries.map((entry) => [entry.id, entry])), [worldbuildingEntries]);
  const entityByWorldbuildingId = useMemo(() => new Map(
    livingWorld.entities.flatMap((entity) => entity.source.kind === 'worldbuilding' ? [[entity.source.id, entity] as const] : [])
  ), [livingWorld.entities]);
  const currentStateByEntityId = useMemo(
    () => new Map(projectCurrentState(livingWorld.worldEvents).map((state) => [state.entityId, state])),
    [livingWorld.worldEvents]
  );
  const partyLocation = useMemo(
    () => derivePartyLocation(campaignPosition, deferredBrews, livingWorld.entities, currentStateByEntityId),
    [campaignPosition, currentStateByEntityId, deferredBrews, livingWorld.entities]
  );
  const previewContent = previewBrew?.content ?? '';
  const outline = useMemo(() => getOutline(previewContent), [previewContent]);

  useEffect(() => {
    if (!activeBrew || loading) return;

    const timer = window.setTimeout(() => {
      saveBrew(activeBrew)
        .then(() => setSaveState('Saved locally'))
        .catch(() => setSaveState('Local save failed'));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [activeBrew, loading]);

  const saveActiveBrewNow = async () => {
    if (!activeBrew || savingToDrive || syncing) return;
    try {
      setSavingToDrive(true);
      setSaveState('Saving to Google Drive…');
      setDriveSaveNotice({ tone: 'saving', message: 'Saving to Google Drive…' });
      const token = accessToken ?? await requestDriveAccess();
      setAccessToken(token);
      await saveBrew(activeBrew);
      setBrews((currentBrews) => currentBrews.map((brew) => brew.id === activeBrew.id ? { ...activeBrew } : brew));
      setSaveState('Saved to Google Drive');
      setDriveSaveNotice({ tone: 'success', message: 'Saved to Google Drive' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save to Google Drive';
      setSaveState(message);
      setDriveSaveNotice({ tone: 'error', message });
    } finally {
      setSavingToDrive(false);
    }
  };

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

  const createCatalogueReference = async (selectedText: string, category: CatalogueCategory): Promise<string | null> => {
    let entry = findCatalogueEntryByName(catalogueEntries, category, selectedText);

    if (!entry) {
      if (!selectedText.trim()) {
        setSaveState('Select text before adding a reference');
        return null;
      }
      const customEntry = createCustomCatalogueEntry(selectedText, category);
      try {
        const saved = await saveCustomCatalogueEntry(customEntry);
        const nextEntries = [...customCatalogueEntries, saved.entry];
        campaignRecordsRef.current = { ...campaignRecordsRef.current, customCatalogueEntries: nextEntries };
        setCustomCatalogueEntries(nextEntries);
        noteCampaignDataSaved(saved.metadata, 'Reference saved locally');
        entry = saved.entry;
      } catch {
        setSaveState(`Could not save the ${catalogueCategoryLabel(category, customCatalogueCategories)} reference`);
        return null;
      }
    }

    return formatCatalogueReference(entry, selectedText);
  };

  const insertSelectedCatalogueReference = async (category: CatalogueCategory) => {
    if (!activeBrew) return;
    const editor = editorRef.current;
    const selection = editor?.getSelection() ?? selectionRef.current;
    const selectedText = activeBrew.content.slice(selection.start, selection.end);
    const reference = await createCatalogueReference(selectedText, category);
    if (!reference) {
      window.requestAnimationFrame(() => editorRef.current?.focus(selection.start));
      return;
    }
    const next = `${activeBrew.content.slice(0, selection.start)}${reference}${activeBrew.content.slice(selection.end)}`;
    updateContent(next);

    const cursor = selection.start + reference.length;
    selectionRef.current = { start: cursor, end: cursor };
    window.requestAnimationFrame(() => editorRef.current?.focus(cursor));
  };

  const openCatalogue = (entry?: CatalogueEntry) => {
    setCatalogueSelection(entry ?? null);
    setCatalogueOpen(true);
    setCampaignOpen(false);
    setEncountersOpen(false);
    setWorldbuildingOpen(false);
    setIdeasOpen(false);
    setPendingInsertion(null);
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
    const metadata = await replacePrivateMonsterEntries(report.entries);
    setPrivateMonsterEntries(report.entries);
    privateMonsterEntriesRef.current = report.entries;
    setCatalogueSelection(report.entries[0] ?? null);
    notePrivateMonsterDataSaved(metadata, report.entries, `${report.importedCount.toLocaleString()} private monsters imported locally`);
    return report;
  };

  const clearPrivateMonsterArchive = async () => {
    const metadata = await clearPrivateMonsterEntries();
    setPrivateMonsterEntries([]);
    privateMonsterEntriesRef.current = [];
    setCatalogueSelection((current) => current?.source.toLowerCase().includes('private import') ? null : current);
    setReferenceEntry((current) => current?.source.toLowerCase().includes('private import') ? null : current);
    notePrivateMonsterDataSaved(metadata, [], 'Private monsters removed locally');
  };

  const openEncounters = (encounter?: Encounter) => {
    if (encounter) setEncounterSelectedId(encounter.id);
    setCatalogueOpen(false);
    setCampaignOpen(false);
    setEncountersOpen(true);
    setWorldbuildingOpen(false);
    setIdeasOpen(false);
    setPendingInsertion(null);
    setMobileSection('encounters');
  };

  const openWorldbuilding = (entry?: WorldbuildingEntry) => {
    if (entry) setWorldbuildingSelectedId(entry.id);
    setCatalogueOpen(false);
    setCampaignOpen(false);
    setEncountersOpen(false);
    setWorldbuildingOpen(true);
    setIdeasOpen(false);
    setPendingInsertion(null);
    setMobileSection('worldbuilding');
  };

  const openReferenceInCatalogue = () => {
    if (!referenceEntry) return;
    openCatalogue(referenceEntry);
    setReferenceEntry(null);
  };

  const openCampaign = () => {
    setCatalogueOpen(false);
    setEncountersOpen(false);
    setWorldbuildingOpen(false);
    setIdeasOpen(false);
    setCampaignOpen(true);
    setPendingInsertion(null);
    setMobileSection('campaign');
  };

  const openReferenceInWorldbuilding = () => {
    if (!worldbuildingReferenceEntry) return;
    openWorldbuilding(worldbuildingReferenceEntry);
    setWorldbuildingReferenceEntry(null);
  };

  const insertCatalogueReference = (entry: CatalogueEntry) => {
    insertText(formatCatalogueReference(entry));
    setReferenceEntry(null);
    setCatalogueOpen(false);
    setMobileSection('editor');
  };

  const beginEncounterInsertion = (encounter: Encounter) => {
    setPendingInsertion({
      label: encounter.name || 'Untitled encounter',
      content: formatEncounterReference(encounter)
    });
    setEncountersOpen(false);
    setWorldbuildingOpen(false);
    setIdeasOpen(false);
    setMobileSection('outline');
    setSaveState('Choose an outline section for this encounter');
  };

  const insertPendingAtSection = (item: { id: string } | null) => {
    if (!activeBrew || !pendingInsertion) return;
    updateContent(insertAtOutlineSectionEnd(activeBrew.content, item?.id ?? null, pendingInsertion.content));
    if (pendingInsertion.ideaId) removeIdeaDraft(pendingInsertion.ideaId, false);
    setPendingInsertion(null);
    setMobileSection('editor');
  };

  const persistEncounter = (encounter: Encounter) => {
    const related = encounter.status === 'active'
      ? encounters.filter((item) => item.id !== encounter.id && item.status === 'active')
        .map((item) => ({ ...item, status: 'not-started' as const, activeCombatantId: null, updatedAt: encounter.updatedAt, version: item.version + 1 }))
      : [];
    const changed = [encounter, ...related];
    setEncounters((current) => [
      ...changed,
      ...current.filter((item) => !changed.some((updated) => updated.id === item.id))
    ]);
    void Promise.all(changed.map(saveEncounter))
      .then((metadata) => {
        noteCampaignDataSaved(metadata.at(-1)!, encounter.status === 'active' ? 'Active encounter saved locally' : 'Encounter progress saved locally');
      })
      .catch(() => setSaveState('Encounter save failed'));
  };

  const endCombat = (encounter: Encounter) => {
    const completed = touchEncounter(encounter, { status: 'completed', activeCombatantId: null });
    const nextLivingWorld = recordCombatCompletion(livingWorld, completed, completed.updatedAt);
    const worldUpdates = nextLivingWorld.worldEvents.length - livingWorld.worldEvents.length;
    const nextEncounters = [completed, ...encounters.filter((item) => item.id !== completed.id)];
    campaignRecordsRef.current = { ...campaignRecordsRef.current, encounters: nextEncounters, livingWorld: nextLivingWorld };
    setEncounters(nextEncounters);
    setLivingWorld(nextLivingWorld);
    void Promise.all([saveEncounter(completed), saveLivingWorldData(nextLivingWorld)])
      .then((metadata) => {
        noteCampaignDataSaved(
          metadata.at(-1)!,
          worldUpdates
            ? `Combat ended · ${worldUpdates} NPC status update${worldUpdates === 1 ? '' : 's'} saved`
            : 'Combat ended'
        );
      })
      .catch(() => setSaveState('Combat outcome save failed'));
  };

  const createNewEncounter = () => {
    const encounter = createCombatEncounter('New encounter', partyMembers);
    persistEncounter(encounter);
    setEncounterSelectedId(encounter.id);
  };

  const persistWorldbuildingEntry = (entry: WorldbuildingEntry) => {
    const nextEntries = [entry, ...worldbuildingEntries.filter((item) => item.id !== entry.id)];
    const nextLivingWorld = synchroniseLivingWorld(livingWorld, nextEntries);
    campaignRecordsRef.current = { ...campaignRecordsRef.current, worldbuildingEntries: nextEntries, livingWorld: nextLivingWorld };
    setWorldbuildingEntries(nextEntries);
    setLivingWorld(nextLivingWorld);
    void Promise.all([saveWorldbuildingEntry(entry), saveLivingWorldData(nextLivingWorld)])
      .then((metadata) => {
        noteCampaignDataSaved(metadata.at(-1)!, 'Worldbuilding entry and entity saved locally');
      })
      .catch(() => setSaveState('Worldbuilding save failed'));
  };

  const addWorldbuildingQuickNote = (entry: WorldbuildingEntry, note: string) => {
    const value = note.trim();
    if (!value) return;
    persistWorldbuildingEntry(touchWorldbuildingEntry(entry, {
      notes: [entry.notes.trim(), value].filter(Boolean).join('\n\n')
    }));
  };

  const createCuratedReferences = (references: readonly CuratedReference[]) => {
    if (!references.length) return;
    const newEntries = references.map((reference) => ({
      ...createWorldbuildingEntry(reference.name, reference.kind),
      aliases: [...(reference.aliases ?? [])],
      notes: reference.notes
    }));
    const nextEntries = [...newEntries, ...worldbuildingEntries];
    const nextLivingWorld = synchroniseLivingWorld(livingWorld, nextEntries);
    campaignRecordsRef.current = { ...campaignRecordsRef.current, worldbuildingEntries: nextEntries, livingWorld: nextLivingWorld };
    setWorldbuildingEntries(nextEntries);
    setLivingWorld(nextLivingWorld);
    void Promise.all([saveWorldbuildingEntries(newEntries), saveLivingWorldData(nextLivingWorld)])
      .then((metadata) => noteCampaignDataSaved(metadata.at(-1)!, `${newEntries.length} curated references created`))
      .catch(() => setSaveState('Curated reference setup failed'));
  };

  const setNpcStatus = (entry: WorldbuildingEntry, status: string) => {
    const entity = entityByWorldbuildingId.get(entry.id);
    if (!entity || entity.kind !== 'npc') return;
    const next = recordManualStateChange(livingWorld, entity.id, 'status', status);
    campaignRecordsRef.current = { ...campaignRecordsRef.current, livingWorld: next };
    setLivingWorld(next);
    void saveLivingWorldData(next)
      .then((metadata) => noteCampaignDataSaved(metadata, `${entry.name} is now ${status}`))
      .catch(() => setSaveState('NPC status save failed'));
  };

  const setPartyLocation = (entityId: string) => {
    const next = recordPartyLocation(livingWorld, entityId);
    campaignRecordsRef.current = { ...campaignRecordsRef.current, livingWorld: next };
    setLivingWorld(next);
    void saveLivingWorldData(next)
      .then((metadata) => noteCampaignDataSaved(metadata, 'Party location updated'))
      .catch(() => setSaveState('Party location save failed'));
  };

  const resurrectNpc = (entityId: string) => {
    const entity = livingWorld.entities.find((item) => item.id === entityId);
    if (!entity) return;
    const next = recordManualStateChange(livingWorld, entityId, 'status', 'alive');
    campaignRecordsRef.current = { ...campaignRecordsRef.current, livingWorld: next };
    setLivingWorld(next);
    void saveLivingWorldData(next).then((metadata) => noteCampaignDataSaved(metadata, `${entity.name} restored`)).catch(() => setSaveState('NPC restoration save failed'));
  };

  const saveCampaignMap = (campaignMap: CampaignMap) => {
    const next = { ...livingWorld, campaignMap };
    campaignRecordsRef.current = { ...campaignRecordsRef.current, livingWorld: next };
    setLivingWorld(next);
    void saveLivingWorldData(next).then((metadata) => noteCampaignDataSaved(metadata, 'Campaign board updated')).catch(() => setSaveState('Campaign board save failed'));
  };

  const savePlotBoard = (plotBoard: PlotBoard) => {
    const next = { ...livingWorld, plotBoard };
    campaignRecordsRef.current = { ...campaignRecordsRef.current, livingWorld: next };
    setLivingWorld(next);
    void saveLivingWorldData(next).then((metadata) => noteCampaignDataSaved(metadata, 'Plot board updated')).catch(() => setSaveState('Plot board save failed'));
  };

  const setCurrentCampaignBrew = (brewId: string | null) => {
    const next = { ...livingWorld, ...(brewId ? { currentBrewId: brewId } : { currentBrewId: undefined }) };
    campaignRecordsRef.current = { ...campaignRecordsRef.current, livingWorld: next };
    setLivingWorld(next);
    if (brewId && brews.some((brew) => brew.id === brewId)) setActiveId(brewId);
    void saveLivingWorldData(next)
      .then((metadata) => noteCampaignDataSaved(metadata, brewId ? 'Current campaign brew updated' : 'Campaign brew returned to automatic'))
      .catch(() => setSaveState('Current campaign brew save failed'));
  };

  const openPlotBeatComposer = (seed: PlotBeatDraftSeed) => {
    setPlotBeatDraftSeed(seed);
    setCampaignOpen(true);
    setCatalogueOpen(false);
    setEncountersOpen(false);
    setWorldbuildingOpen(false);
    setMobileSection('campaign');
  };

  const createPlotBeatFromBrew = () => {
    if (!activeBrew) return;
    const selection = editorRef.current?.getSelection() ?? selectionRef.current;
    const selectedText = activeBrew.content.slice(selection.start, selection.end).replace(/[#*_`\[\]]/g, '').replace(/\s+/g, ' ').trim();
    openPlotBeatComposer({
      title: selectedText || activeBrew.title
    });
  };

  const createPlotBeatFromWorldbuilding = (entry: WorldbuildingEntry, entity?: { id: string }) => {
    openPlotBeatComposer({
      title: entry.name,
      entityIds: entity ? [entity.id] : []
    });
  };

  const createNewWorldbuildingEntry = () => {
    const entry = createWorldbuildingEntry();
    persistWorldbuildingEntry(entry);
    setWorldbuildingSelectedId(entry.id);
    return entry.id;
  };

  const useGeneratedName = (result: GeneratedName) => {
    if (nameGeneratorTarget === 'editor') {
      insertText(result.name);
      setCaptureMenuOpen(false);
      setSaveState(`Inserted “${result.name}”`);
    } else if (nameGeneratorTarget === 'worldbuilding') {
      const existing = findWorldbuildingEntryByName(worldbuildingEntries, result.name);
      const entry = existing ?? createWorldbuildingEntry(result.name, result.kind);
      if (!existing) persistWorldbuildingEntry(entry);
      setWorldbuildingSelectedId(entry.id);
      setSaveState(existing ? `Opened existing Worldbuilding entry “${entry.name}”` : `Created Worldbuilding entry “${entry.name}”`);
    }
    setNameGeneratorTarget(null);
  };

  const useGeneratedNames = (results: readonly GeneratedName[]) => {
    if (nameGeneratorTarget !== 'editor') return;
    insertText(results.map((result) => `- ${result.name}`).join('\n'));
    setCaptureMenuOpen(false);
    setNameGeneratorTarget(null);
    setSaveState(`Inserted ${results.length} generated names`);
  };

  const createWorldbuildingReference = (name: string, kind: WorldbuildingKind): string | null => {
    const selectedText = name;
    const entry = findWorldbuildingEntryByName(worldbuildingEntries, name) ?? createWorldbuildingEntry(name, kind);
    const isNew = !worldbuildingEntries.some((item) => item.id === entry.id);
    if (isNew) persistWorldbuildingEntry(entry);
    setWorldbuildingSelectedId(entry.id);

    const reference = formatWorldbuildingReference(entry, selectedText || entry.name);
    setSaveState(isNew ? `Added “${entry.name}” and linked it in this source` : `Linked existing Worldbuilding entry “${entry.name}”`);
    return reference;
  };

  const createNewWorldbuildingType = (name: string): string | null => {
    try {
      const candidate = createWorldbuildingType(name);
      const existing = [...worldbuildingTypes, ...Object.entries(worldbuildingKindLabels).map(([id, label]) => ({ id, name: label }))]
        .some((type) => type.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase());
      if (existing) return null;
      setWorldbuildingTypes((current) => [...current, candidate].sort((left, right) => left.name.localeCompare(right.name)));
      void saveWorldbuildingType(candidate)
        .then((metadata) => noteCampaignDataSaved(metadata, 'Worldbuilding type saved locally'))
        .catch(() => setSaveState('Worldbuilding type save failed'));
      return candidate.id;
    } catch {
      return null;
    }
  };

  const createNewCustomCatalogueCategory = (name: string): CustomCatalogueCategory | null => {
    try {
      const candidate = createCustomCatalogueCategory(name);
      const builtInNames = Object.values(catalogueCategoryLabels).map((label) => label.toLocaleLowerCase());
      const exists = builtInNames.includes(candidate.name.toLocaleLowerCase())
        || customCatalogueCategories.some((category) => category.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase());
      if (exists) return null;
      setCustomCatalogueCategories((current) => [...current, candidate].sort((left, right) => left.name.localeCompare(right.name)));
      void saveCustomCatalogueCategory(candidate)
        .then((metadata) => noteCampaignDataSaved(metadata, 'Catalogue category saved locally'))
        .catch(() => setSaveState('Catalogue category save failed'));
      return candidate;
    } catch {
      return null;
    }
  };

  const deleteWorldbuilding = (entry: WorldbuildingEntry) => {
    if (!window.confirm(`Delete “${entry.name}” from Worldbuilding? This cannot be undone.`)) return;
    setWorldbuildingEntries((current) => current.filter((item) => item.id !== entry.id));
    setWorldbuildingSelectedId((currentId) => currentId === entry.id ? null : currentId);
    void deleteStoredWorldbuildingEntry(entry.id)
      .then((metadata) => {
        noteCampaignDataSaved(metadata, 'Worldbuilding entry deleted locally');
      })
      .catch(() => setSaveState('Worldbuilding deletion failed'));
  };

  const deleteEncounter = (encounter: Encounter) => {
    if (!window.confirm(`Delete “${encounter.name || 'Untitled encounter'}”? This cannot be undone.`)) return;
    setEncounters((current) => current.filter((item) => item.id !== encounter.id));
    setEncounterSelectedId((currentId) => currentId === encounter.id ? null : currentId);
    void deleteStoredEncounter(encounter.id)
      .then((metadata) => {
        noteCampaignDataSaved(metadata, 'Encounter deleted locally');
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
        noteCampaignDataSaved(metadata, 'Party roster saved locally');
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
        noteCampaignDataSaved(metadata, 'Party member removed locally');
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
    setPendingInsertion(null);
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
      createdOn: creationDeviceLabel(),
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
    if (livingWorld.currentBrewId === activeBrew.id) setCurrentCampaignBrew(null);
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

  const convertHomebreweryFormatting = () => {
    if (!activeBrew) return;
    const result = importHomebrewerySource(activeBrew.content);
    if (result.content === activeBrew.content) {
      setSaveState('No supported Homebrewery blocks needed conversion');
      return;
    }
    const detail = result.notices.join(' ') || 'Known Homebrewery formatting will be converted.';
    if (!window.confirm(`${detail}\n\nApply this reversible conversion to the current brew?`)) return;
    updateContent(result.content);
    setSaveState(`Converted current brew. ${detail}`);
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
      setCustomCatalogueEntries(result.data.customCatalogueEntries);
      setCustomCatalogueCategories(result.data.customCatalogueCategories);
      setWorldbuildingTypes(result.data.worldbuildingTypes);
      setLivingWorld({
        id: 'living-world',
        campaignId: result.data.campaignId,
        entities: result.data.entities,
        entityReferences: result.data.entityReferences,
        worldEvents: result.data.worldEvents,
        timelineEntries: result.data.timelineEntries ?? [],
        ideaDrafts: result.data.ideaDrafts ?? [],
        ...(result.data.campaignMap ? { campaignMap: result.data.campaignMap } : {}),
        ...(result.data.plotBoard ? { plotBoard: result.data.plotBoard } : {}),
        ...(result.data.currentBrewId ? { currentBrewId: result.data.currentBrewId } : {})
      });
      setEncounterSelectedId((current) => result.data.encounters.some((encounter) => encounter.id === current) ? current : result.data.encounters[0]?.id ?? null);
      setWorldbuildingSelectedId((current) => result.data.worldbuildingEntries.some((entry) => entry.id === current) ? current : result.data.worldbuildingEntries[0]?.id ?? null);
    }
    campaignRecordsRef.current = {
      encounters: result.data.encounters,
      partyMembers: result.data.partyMembers,
      worldbuildingEntries: result.data.worldbuildingEntries,
      customCatalogueEntries: result.data.customCatalogueEntries,
      customCatalogueCategories: result.data.customCatalogueCategories,
      worldbuildingTypes: result.data.worldbuildingTypes,
      livingWorld: {
        id: 'living-world',
        campaignId: result.data.campaignId,
        entities: result.data.entities,
        entityReferences: result.data.entityReferences,
        worldEvents: result.data.worldEvents,
        timelineEntries: result.data.timelineEntries ?? [],
        ideaDrafts: result.data.ideaDrafts ?? [],
        ...(result.data.campaignMap ? { campaignMap: result.data.campaignMap } : {}),
        ...(result.data.plotBoard ? { plotBoard: result.data.plotBoard } : {}),
        ...(result.data.currentBrewId ? { currentBrewId: result.data.currentBrewId } : {})
      }
    };
    campaignMetadataRef.current = result.metadata;
    setCampaignDataSync(result.metadata);
  };

  const applyPrivateMonsterSyncResult = async (
    result: PrivateMonsterSyncResult,
    sourceEntries: CatalogueEntry[]
  ) => {
    if (result.entries === sourceEntries) {
      await savePrivateMonsterSyncMetadata(result.metadata);
    } else {
      await replacePrivateMonsterData(result.entries, result.metadata);
      setPrivateMonsterEntries(result.entries);
      setCatalogueSelection((current) => {
        if (!current?.source.toLowerCase().includes('private import')) return current;
        return result.entries.some((entry) => entry.id === current.id) ? current : result.entries[0] ?? null;
      });
      setReferenceEntry((current) => {
        if (!current?.source.toLowerCase().includes('private import')) return current;
        return result.entries.some((entry) => entry.id === current.id) ? current : null;
      });
    }
    privateMonsterEntriesRef.current = result.entries;
    privateMonsterMetadataRef.current = result.metadata;
    setPrivateMonsterSync(result.metadata);
  };

  const syncPrivateMonsterCatalogueOnly = async (token: string, announce = false): Promise<PrivateMonsterSyncResult | null> => {
    if (privateMonsterSyncInFlightRef.current) {
      privateMonsterSyncQueuedRef.current = true;
      return null;
    }

    privateMonsterSyncInFlightRef.current = true;
    const mutationAtStart = privateMonsterMutationRef.current;

    try {
      if (announce) setSaveState('Syncing private monster catalogue with Google Drive…');
      const sourceEntries = privateMonsterEntriesRef.current;
      const metadata = privateMonsterMetadataRef.current ?? await getPrivateMonsterSyncMetadata();
      privateMonsterMetadataRef.current = metadata;
      const result = await syncPrivateMonsterCatalogue(token, sourceEntries, metadata);
      const changedDuringSync = privateMonsterMutationRef.current !== mutationAtStart;

      if (result.state === 'conflict' || !changedDuringSync) {
        await applyPrivateMonsterSyncResult(result, sourceEntries);
      } else if (result.entries === sourceEntries && result.metadata.drive) {
        const latestMetadata = privateMonsterMetadataRef.current ?? metadata;
        const pendingMetadata: PrivateMonsterSyncMetadata = {
          ...latestMetadata,
          drive: result.metadata.drive,
          syncState: 'pending',
          conflict: undefined
        };
        await savePrivateMonsterSyncMetadata(pendingMetadata);
        privateMonsterMetadataRef.current = pendingMetadata;
        setPrivateMonsterSync(pendingMetadata);
        privateMonsterSyncQueuedRef.current = true;
      } else {
        const latestMetadata = privateMonsterMetadataRef.current ?? metadata;
        const remoteDrive = result.metadata.drive;
        const conflictMetadata: PrivateMonsterSyncMetadata = {
          ...latestMetadata,
          ...(remoteDrive ? { drive: remoteDrive } : {}),
          syncState: 'conflict',
          conflict: {
            remoteEntries: result.entries,
            remoteRevisionId: remoteDrive?.revisionId ?? ''
          }
        };
        await savePrivateMonsterSyncMetadata(conflictMetadata);
        privateMonsterMetadataRef.current = conflictMetadata;
        setPrivateMonsterSync(conflictMetadata);
      }

      if (announce) setSaveState(result.detail);
      return result;
    } catch (error) {
      const metadata = privateMonsterMetadataRef.current ?? await getPrivateMonsterSyncMetadata();
      if (!metadata.conflict) {
        const errorMetadata: PrivateMonsterSyncMetadata = { ...metadata, syncState: 'error' };
        try {
          await savePrivateMonsterSyncMetadata(errorMetadata);
        } catch {
          // Preserve the original Drive error when local metadata persistence is unavailable.
        }
        privateMonsterMetadataRef.current = errorMetadata;
        setPrivateMonsterSync(errorMetadata);
      }
      throw error;
    } finally {
      privateMonsterSyncInFlightRef.current = false;
      if (privateMonsterSyncQueuedRef.current) {
        privateMonsterSyncQueuedRef.current = false;
        schedulePrivateMonsterSync();
      }
    }
  };

  const schedulePrivateMonsterSync = () => {
    if (!accessToken) return;
    if (privateMonsterSyncTimerRef.current !== null) {
      window.clearTimeout(privateMonsterSyncTimerRef.current);
    }
    const token = accessToken;
    privateMonsterSyncTimerRef.current = window.setTimeout(() => {
      privateMonsterSyncTimerRef.current = null;
      void syncPrivateMonsterCatalogueOnly(token).catch((error) => {
        setSaveState(error instanceof Error ? error.message : 'Private monster catalogue sync failed');
      });
    }, 500);
  };

  const notePrivateMonsterDataSaved = (
    metadata: PrivateMonsterSyncMetadata,
    entries: CatalogueEntry[],
    localMessage: string
  ) => {
    privateMonsterMutationRef.current += 1;
    privateMonsterEntriesRef.current = entries;
    privateMonsterMetadataRef.current = metadata;
    setPrivateMonsterSync(metadata);
    if (!accessToken) {
      setSaveState(localMessage);
      return;
    }
    setSaveState(`${localMessage} — syncing to Drive…`);
    schedulePrivateMonsterSync();
  };

  /**
   * Keeps campaign records local-first, but uploads their companion Drive file
   * shortly after a successful local save. A second change made during an
   * upload stays pending and is sent by a follow-up pass instead of being lost.
   */
  const syncCampaignDataOnly = async (token: string, announce = false): Promise<CampaignDataSyncResult | null> => {
    if (campaignSyncInFlightRef.current) {
      campaignSyncQueuedRef.current = true;
      return null;
    }

    campaignSyncInFlightRef.current = true;
    const mutationAtStart = campaignMutationRef.current;

    try {
      if (announce) setSaveState('Syncing campaign data with Google Drive…');
      const records = campaignRecordsRef.current;
      const sourceData = createCampaignDataSnapshot(
        records.encounters,
        records.partyMembers,
        records.worldbuildingEntries,
        undefined,
        records.customCatalogueEntries,
        records.customCatalogueCategories,
        records.worldbuildingTypes,
        brews,
        records.livingWorld ?? livingWorld
      );
      const metadata = campaignMetadataRef.current ?? await getCampaignDataSyncMetadata();
      campaignMetadataRef.current = metadata;
      const result = await syncCampaignData(token, sourceData, metadata);
      const changedDuringSync = campaignMutationRef.current !== mutationAtStart;

      if (result.state === 'conflict' || !changedDuringSync) {
        await applyCampaignDataResult(result, sourceData);
      } else if (result.data === sourceData && result.metadata.drive) {
        // This device wrote the previous snapshot, then changed again before
        // Drive replied. Preserve the new local change while recording Drive's
        // new revision so the queued pass can safely upload the latest data.
        const latestMetadata = campaignMetadataRef.current ?? metadata;
        const pendingMetadata: CampaignDataSyncMetadata = {
          ...latestMetadata,
          drive: result.metadata.drive,
          syncState: 'pending',
          conflict: undefined
        };
        await saveCampaignDataSyncMetadata(pendingMetadata);
        campaignMetadataRef.current = pendingMetadata;
        setCampaignDataSync(pendingMetadata);
        campaignSyncQueuedRef.current = true;
      } else {
        // Avoid silently replacing a new local change with a remote download
        // that began before the edit. Surface the existing conflict choices.
        const latestMetadata = campaignMetadataRef.current ?? metadata;
        const remoteDrive = result.metadata.drive;
        const conflictMetadata: CampaignDataSyncMetadata = {
          ...latestMetadata,
          ...(remoteDrive ? { drive: remoteDrive } : {}),
          syncState: 'conflict',
          conflict: {
            remoteData: result.data,
            remoteRevisionId: remoteDrive?.revisionId ?? ''
          }
        };
        await saveCampaignDataSyncMetadata(conflictMetadata);
        campaignMetadataRef.current = conflictMetadata;
        setCampaignDataSync(conflictMetadata);
      }

      if (announce) setSaveState(result.detail);
      return result;
    } catch (error) {
      const metadata = campaignMetadataRef.current ?? await getCampaignDataSyncMetadata();
      if (!metadata.conflict) {
        const errorMetadata: CampaignDataSyncMetadata = { ...metadata, syncState: 'error' };
        try {
          await saveCampaignDataSyncMetadata(errorMetadata);
        } catch {
          // Preserve the original Drive error when local metadata persistence is unavailable.
        }
        campaignMetadataRef.current = errorMetadata;
        setCampaignDataSync(errorMetadata);
      }
      throw error;
    } finally {
      campaignSyncInFlightRef.current = false;
      if (campaignSyncQueuedRef.current) {
        campaignSyncQueuedRef.current = false;
        scheduleCampaignSync();
      }
    }
  };

  const scheduleCampaignSync = () => {
    if (!accessToken) return;
    if (campaignSyncTimerRef.current !== null) {
      window.clearTimeout(campaignSyncTimerRef.current);
    }
    const token = accessToken;
    campaignSyncTimerRef.current = window.setTimeout(() => {
      campaignSyncTimerRef.current = null;
      void syncCampaignDataOnly(token).catch((error) => {
        setSaveState(error instanceof Error ? error.message : 'Campaign data sync failed');
      });
    }, 700);
  };

  const noteCampaignDataSaved = (metadata: CampaignDataSyncMetadata, localMessage: string) => {
    campaignMutationRef.current += 1;
    campaignMetadataRef.current = metadata;
    setCampaignDataSync(metadata);
    if (!accessToken) {
      setSaveState(localMessage);
      return;
    }
    setSaveState(`${localMessage} — syncing to Drive…`);
    scheduleCampaignSync();
  };

  const persistIdeaDrafts = (ideas: IdeaDraft[], message: string | null) => {
    const nextLivingWorld = { ...livingWorld, ideaDrafts: ideas };
    campaignRecordsRef.current = { ...campaignRecordsRef.current, livingWorld: nextLivingWorld };
    setLivingWorld(nextLivingWorld);
    void saveLivingWorldData(nextLivingWorld)
      .then((metadata) => {
        if (message) noteCampaignDataSaved(metadata, message);
      })
      .catch(() => setSaveState('Idea save failed'));
  };

  const createIdeaDraft = (brewId: string) => {
    if (!brewId) return;
    const timestamp = new Date().toISOString();
    const idea: IdeaDraft = { id: crypto.randomUUID(), brewId, text: '', createdAt: timestamp, updatedAt: timestamp };
    persistIdeaDrafts([idea, ...(livingWorld.ideaDrafts ?? [])], 'Idea saved locally');
  };

  const saveIdeaDraft = (idea: IdeaDraft) => {
    const next = [idea, ...(livingWorld.ideaDrafts ?? []).filter((item) => item.id !== idea.id)];
    persistIdeaDrafts(next, 'Idea saved locally');
  };

  const removeIdeaDraft = (ideaId: string, announce = true) => {
    persistIdeaDrafts((livingWorld.ideaDrafts ?? []).filter((idea) => idea.id !== ideaId), announce ? 'Idea removed locally' : null);
  };

  const openIdeas = () => {
    setCatalogueOpen(false);
    setCampaignOpen(false);
    setEncountersOpen(false);
    setWorldbuildingOpen(false);
    setIdeasOpen(true);
    setCaptureMenuOpen(false);
    setPendingInsertion(null);
    setMobileSection('editor');
  };

  const createIdeaContent = (idea: IdeaDraft) => {
    const target = brews.find((brew) => brew.id === idea.brewId);
    const content = idea.text.trim();
    if (!target || !content) return;
    setActiveId(target.id);
    setIdeasOpen(false);
    setPendingInsertion({ label: 'Idea text', content, ideaId: idea.id });
    setMobileSection('outline');
    setSaveState('Choose an outline section for this idea');
  };

  const createIdeaEncounter = (idea: IdeaDraft) => {
    const target = brews.find((brew) => brew.id === idea.brewId);
    const title = idea.text.trim().split(/\r?\n/)[0]?.slice(0, 80) || 'New encounter';
    if (!target || !idea.text.trim()) return;
    const encounter = createCombatEncounter(title, partyMembers);
    persistEncounter(encounter);
    setEncounterSelectedId(encounter.id);
    setActiveId(target.id);
    setIdeasOpen(false);
    setPendingInsertion({ label: encounter.name, content: formatEncounterReference(encounter), ideaId: idea.id });
    setMobileSection('outline');
    setSaveState('Choose where to place this encounter');
  };

  const saveCustomMonster = async (draft: CustomCatalogueEntry) => {
    const existing = customCatalogueEntries.find((entry) => entry.id === draft.id);
    const timestamp = new Date().toISOString();
    const candidate = normaliseCustomCatalogueEntry({
      ...draft,
      category: 'monster',
      source: 'Custom',
      createdAt: existing?.createdAt ?? draft.createdAt ?? timestamp,
      updatedAt: timestamp,
      version: existing ? existing.version + 1 : 1
    });
    const saved = await saveCustomCatalogueEntry(candidate);
    const nextEntries = existing
      ? customCatalogueEntries.map((entry) => entry.id === saved.entry.id ? saved.entry : entry)
      : [...customCatalogueEntries, saved.entry];
    campaignRecordsRef.current = { ...campaignRecordsRef.current, customCatalogueEntries: nextEntries };
    setCustomCatalogueEntries(nextEntries);
    setCatalogueSelection(saved.entry);
    noteCampaignDataSaved(saved.metadata, existing ? 'Custom monster updated locally' : 'Custom monster created locally');
  };

  const deleteCustomMonster = async (entry: CustomCatalogueEntry) => {
    const metadata = await deleteCustomCatalogueEntry(entry.id);
    const nextEntries = customCatalogueEntries.filter((item) => item.id !== entry.id);
    campaignRecordsRef.current = { ...campaignRecordsRef.current, customCatalogueEntries: nextEntries };
    setCustomCatalogueEntries(nextEntries);
    setCatalogueSelection((selected) => selected?.id === entry.id ? null : selected);
    noteCampaignDataSaved(metadata, 'Custom monster removed locally');
  };

  const saveGenericCustomEntry = async (draft: CustomCatalogueEntry) => {
    const existing = customCatalogueEntries.find((entry) => entry.id === draft.id);
    const timestamp = new Date().toISOString();
    const candidate = normaliseCustomCatalogueEntry({
      ...draft,
      source: 'Custom',
      createdAt: existing?.createdAt ?? draft.createdAt ?? timestamp,
      updatedAt: timestamp,
      version: existing ? existing.version + 1 : 1
    });
    const saved = await saveCustomCatalogueEntry(candidate);
    const nextEntries = existing
      ? customCatalogueEntries.map((entry) => entry.id === saved.entry.id ? saved.entry : entry)
      : [...customCatalogueEntries, saved.entry];
    campaignRecordsRef.current = { ...campaignRecordsRef.current, customCatalogueEntries: nextEntries };
    setCustomCatalogueEntries(nextEntries);
    setCatalogueSelection(saved.entry);
    noteCampaignDataSaved(saved.metadata, existing ? 'Custom catalogue entry updated locally' : 'Custom catalogue entry created locally');
  };

  const deleteGenericCustomEntry = async (entry: CustomCatalogueEntry) => {
    const metadata = await deleteCustomCatalogueEntry(entry.id);
    const nextEntries = customCatalogueEntries.filter((item) => item.id !== entry.id);
    campaignRecordsRef.current = { ...campaignRecordsRef.current, customCatalogueEntries: nextEntries };
    setCustomCatalogueEntries(nextEntries);
    setCatalogueSelection((selected) => selected?.id === entry.id ? null : selected);
    noteCampaignDataSaved(metadata, 'Custom catalogue entry removed locally');
  };

  const connectDrive = async () => {
    try {
      setSaveState('Connecting to Google Drive…');
      const token = await requestDriveAccess();
      setAccessToken(token);
      const campaignResult = await syncCampaignDataOnly(token, true);
      const privateMonsterResult = await syncPrivateMonsterCatalogueOnly(token, true);
      const details = [campaignResult?.detail, privateMonsterResult?.detail].filter(Boolean).join('; ');
      setSaveState(details ? `Google Drive connected; ${details}` : 'Google Drive connected for this session');
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
      const campaignResult = await syncCampaignDataOnly(accessToken);
      const syncedCurrentBrew = campaignResult?.data.currentBrewId;
      if (syncedCurrentBrew && brewResult.brews.some((brew) => brew.id === syncedCurrentBrew)) setActiveId(syncedCurrentBrew);
      const privateMonsterResult = await syncPrivateMonsterCatalogueOnly(accessToken);
      setSaveState(`${brewResult.detail}; ${assetResult.detail}; ${campaignResult?.detail ?? 'Campaign data sync already in progress'}; ${privateMonsterResult?.detail ?? 'Private monster catalogue sync already in progress'}`);
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
    const sourceData = createCampaignDataSnapshot(encounters, partyMembers, worldbuildingEntries, undefined, customCatalogueEntries, customCatalogueCategories, worldbuildingTypes, brews, livingWorld);
    await applyCampaignDataResult(result, sourceData);
    setSaveState(result.detail);
  };

  const keepBothCampaignConflict = async () => {
    if (!campaignDataSync) return;
    const sourceData = createCampaignDataSnapshot(encounters, partyMembers, worldbuildingEntries, undefined, customCatalogueEntries, customCatalogueCategories, worldbuildingTypes, brews, livingWorld);
    const result = keepBothCampaignDataVersions(sourceData, campaignDataSync);
    if (!result) return;
    await applyCampaignDataResult(result, sourceData);
    setSaveState(`${result.detail}. Sync when ready.`);
  };

  const overwriteDriveCampaignConflict = async () => {
    if (!campaignDataSync || !accessToken) return;
    try {
      setSyncing(true);
      const sourceData = createCampaignDataSnapshot(encounters, partyMembers, worldbuildingEntries, undefined, customCatalogueEntries, customCatalogueCategories, worldbuildingTypes, brews, livingWorld);
      const result = await overwriteDriveCampaignData(accessToken, sourceData, campaignDataSync);
      await applyCampaignDataResult(result, sourceData);
      setSaveState(result.detail);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Could not replace Drive campaign data');
    } finally {
      setSyncing(false);
    }
  };

  const keepDrivePrivateMonsterConflict = async () => {
    if (!privateMonsterSync) return;
    const result = keepDrivePrivateMonsterCatalogue(privateMonsterSync);
    if (!result) return;
    await applyPrivateMonsterSyncResult(result, privateMonsterEntries);
    setSaveState(result.detail);
  };

  const overwriteDrivePrivateMonsterConflict = async () => {
    if (!privateMonsterSync || !accessToken) return;
    try {
      setSyncing(true);
      const result = await overwriteDrivePrivateMonsterCatalogue(accessToken, privateMonsterEntriesRef.current, privateMonsterSync);
      await applyPrivateMonsterSyncResult(result, privateMonsterEntriesRef.current);
      setSaveState(result.detail);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Could not replace the Drive private monster catalogue');
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !activeBrew) {
    return <main className="loading-screen">Opening your local brew library…</main>;
  }

  const renderedBrew = previewBrew ?? activeBrew;

  return (
    <div className={`app-shell mobile-${mobileSection}${mobileTopMenuOpen ? ' mobile-top-menu-open' : ''}`}>
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden>✦</span>
          <span>Homebrewry</span>
          <span className="phase-badge">Phase 8 beta</span>
        </div>
        <div className="desktop-view-controls" aria-label="Preview layout">
          {(['editor', 'split', 'preview'] as ViewMode[]).map((mode) => (
            <button
              className={viewMode === mode ? 'is-selected' : ''}
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setCatalogueOpen(false);
                setCampaignOpen(false);
                setEncountersOpen(false);
                setWorldbuildingOpen(false);
                setIdeasOpen(false);
                setPendingInsertion(null);
              }}
              type="button"
            >
              {mode === 'editor' ? 'Editor' : mode === 'preview' ? 'Preview' : 'Split'}
            </button>
          ))}
          <button className={catalogueOpen ? 'is-selected' : ''} onClick={() => catalogueOpen ? setCatalogueOpen(false) : openCatalogue()} type="button">Catalogue</button>
          <button className={campaignOpen ? 'is-selected' : ''} onClick={() => campaignOpen ? setCampaignOpen(false) : openCampaign()} type="button">Campaign</button>
          <button className={encountersOpen ? 'is-selected' : ''} onClick={() => encountersOpen ? setEncountersOpen(false) : openEncounters()} type="button">Encounters</button>
          <button className={worldbuildingOpen ? 'is-selected' : ''} onClick={() => worldbuildingOpen ? setWorldbuildingOpen(false) : openWorldbuilding()} type="button">Worldbuilding</button>
          <button className={ideasOpen ? 'is-selected' : ''} onClick={() => ideasOpen ? setIdeasOpen(false) : openIdeas()} type="button">My ideas</button>
          <button onClick={() => window.print()} type="button">Print</button>
        </div>
        <div className="cloud-controls">
          {accessToken ? (
            <button onClick={() => void syncToDrive()} type="button" disabled={syncing}>
              {syncing ? 'Syncing…' : 'Refresh & sync'}
            </button>
          ) : (
            <button onClick={() => void connectDrive()} type="button" disabled={!isGoogleConfigured()}>
              {campaignDataSync?.drive || privateMonsterSync?.drive ? 'Reconnect Drive' : 'Connect Drive'}
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
              setMobileTopMenuOpen(false);
              setMobilePreviewOutlineOpen(false);
              if (section === 'catalogue') {
                openCatalogue();
                return;
              }
              if (section === 'campaign') {
                openCampaign();
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
              setCampaignOpen(false);
              setEncountersOpen(false);
              setWorldbuildingOpen(false);
              setIdeasOpen(false);
              if (section !== 'outline') setPendingInsertion(null);
            }}
            type="button"
          >
            {mobileLabels[section]}
          </button>
        ))}
      </nav>

      {!ideasOpen && !campaignOpen && !catalogueOpen && !encountersOpen && !worldbuildingOpen && mobileSection === 'preview' ? (
        <main className="mobile-preview-page" aria-label="Live preview">
          <div className="mobile-preview-page-content">
            <BrewPreview assets={assetMap} brew={renderedBrew} catalogue={catalogueMap} catalogueCategories={customCatalogueCategories} encounters={encounterMap} onAddWorldbuildingNote={addWorldbuildingQuickNote} onDeleteWorldbuildingReference={deleteWorldbuilding} onEncounterOpen={openEncounters} onOpenInWorldbuilding={openWorldbuilding} onReferenceOpen={setReferenceEntry} onWorldbuildingOpen={setWorldbuildingReferenceEntry} worldbuilding={worldbuildingMap} worldbuildingTypes={worldbuildingTypes} />
          </div>

          <button aria-expanded={mobilePreviewOutlineOpen} className="mobile-preview-page-outline-button" onClick={() => setMobilePreviewOutlineOpen((open) => !open)} type="button">Outline</button>

          {mobilePreviewOutlineOpen && (
            <aside aria-label="Preview outline" className="mobile-preview-page-outline">
              <header><strong>Outline</strong><button aria-label="Close outline" onClick={() => setMobilePreviewOutlineOpen(false)} type="button">×</button></header>
              <div>
                {outline.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setMobilePreviewOutlineOpen(false);
                    }}
                    style={{ paddingLeft: `${12 + Math.max(0, item.level - 1) * 12}px` }}
                    type="button"
                  >
                    {item.text}
                  </button>
                ))}
                {!outline.length && <p>No headings in this brew yet.</p>}
              </div>
            </aside>
          )}
        </main>
      ) : ideasOpen ? (
        <IdeasPanel
          brews={brews}
          ideas={livingWorld.ideaDrafts ?? []}
          initialBrewId={activeBrew.id}
          onClose={() => {
            setIdeasOpen(false);
            setMobileSection('editor');
          }}
          onCreate={createIdeaDraft}
          onCreateContent={createIdeaContent}
          onCreateEncounter={createIdeaEncounter}
          onDelete={(idea) => removeIdeaDraft(idea.id)}
          onSave={saveIdeaDraft}
        />
      ) : campaignOpen ? (
        <CampaignPanel
          brews={brews}
          campaignMap={livingWorld.campaignMap}
          plotBoard={livingWorld.plotBoard}
          currentBrewId={livingWorld.currentBrewId}
          currentStateByEntityId={currentStateByEntityId}
          encounters={encounters}
          entityReferences={livingWorld.entityReferences}
          entities={livingWorld.entities}
          onOpenEncounter={openEncounters}
          onOpenEntity={(entity) => {
            const source = entity.source;
            if (source.kind !== 'worldbuilding') return;
            const entry = worldbuildingEntries.find((item) => item.id === source.id);
            if (entry) openWorldbuilding(entry);
          }}
          onSetCurrentBrew={setCurrentCampaignBrew}
          partyLocation={partyLocation}
          position={campaignPosition}
          plotBeatDraftSeed={plotBeatDraftSeed}
          onPlotBeatDraftSeedApplied={() => setPlotBeatDraftSeed(null)}
          onSaveCampaignMap={saveCampaignMap}
          onSavePlotBoard={savePlotBoard}
          worldEvents={livingWorld.worldEvents}
          worldbuildingEntries={worldbuildingEntries}
        />
      ) : catalogueOpen ? (
        <CataloguePanel
          key={catalogueSelection?.id ?? 'browse'}
          entries={catalogueEntries}
          error={catalogueError}
          loading={catalogueLoading}
          customEntryCount={customCatalogueEntries.length}
          customCategories={customCatalogueCategories}
          onCreateCustomCategory={createNewCustomCatalogueCategory}
          onCreateCatalogueReference={createCatalogueReference}
          onCreateWorldbuildingReference={createWorldbuildingReference}
          onDeleteCustomEntry={deleteGenericCustomEntry}
          onDeleteCustomMonster={deleteCustomMonster}
          onInsertReference={insertCatalogueReference}
          onOpenPrivateMonsterImport={() => setPrivateMonsterImportOpen(true)}
          onReferenceOpen={setReferenceEntry}
          onSaveCustomEntry={saveGenericCustomEntry}
          onSaveCustomMonster={saveCustomMonster}
          onWorldbuildingOpen={setWorldbuildingReferenceEntry}
          privateMonsterCount={privateMonsterEntries.length}
          selectedEntry={catalogueSelection}
          worldbuilding={worldbuildingMap}
          worldbuildingTypes={worldbuildingTypes}
        />
      ) : encountersOpen ? (
        <EncounterPanel
          encounters={encounters}
          campaignPosition={campaignPosition}
          partyLocation={partyLocation}
          locationEntities={livingWorld.entities.filter((entity) => entity.kind === 'location' || entity.kind === 'settlement')}
          worldEvents={livingWorld.worldEvents}
          hasDriveBackup={Boolean(campaignDataSync?.drive)}
          loading={catalogueLoading}
          monsters={catalogueEntries.filter((entry) => entry.category === 'monster')}
          npcEntities={livingWorld.entities.filter((entity) => entity.kind === 'npc')}
          currentStateByEntityId={currentStateByEntityId}
          syncState={campaignDataSync?.syncState ?? 'local'}
          onCreateEncounter={createNewEncounter}
          onCreatePartyMember={addPartyMember}
          onDeleteEncounter={deleteEncounter}
          onDeletePartyMember={deletePartyMember}
          onEndCombat={endCombat}
          onResurrectNpc={resurrectNpc}
          onSetPartyLocation={setPartyLocation}
          onInsertReference={beginEncounterInsertion}
          onSelectEncounter={setEncounterSelectedId}
          onUpdateEncounter={persistEncounter}
          onUpdatePartyMember={persistPartyMember}
          partyMembers={partyMembers}
          selectedId={encounterSelectedId}
        />
      ) : worldbuildingOpen ? (
        <WorldbuildingPanel
          catalogue={catalogueMap}
          catalogueCategories={customCatalogueCategories}
          currentStateByEntityId={currentStateByEntityId}
          entitiesByWorldbuildingId={entityByWorldbuildingId}
          entries={worldbuildingEntries}
          hasDriveBackup={Boolean(campaignDataSync?.drive)}
          syncState={campaignDataSync?.syncState ?? 'local'}
          onCreate={createNewWorldbuildingEntry}
          onOpenNameGenerator={() => setNameGeneratorTarget('worldbuilding')}
          onCreateType={createNewWorldbuildingType}
          onCreateCatalogueReference={createCatalogueReference}
          onCreateWorldbuildingReference={createWorldbuildingReference}
          onCreateCuratedReferences={createCuratedReferences}
          onCreatePlotBeat={createPlotBeatFromWorldbuilding}
          onDelete={deleteWorldbuilding}
          onEncounterOpen={(encounterId) => {
            const encounter = encounters.find((item) => item.id === encounterId);
            if (encounter) openEncounters(encounter);
          }}
          onReferenceOpen={setReferenceEntry}
          onSetNpcStatus={setNpcStatus}
          onSelect={setWorldbuildingSelectedId}
          onUpdate={persistWorldbuildingEntry}
          onWorldbuildingOpen={setWorldbuildingReferenceEntry}
          selectedId={worldbuildingSelectedId}
          types={worldbuildingTypes}
          worldbuilding={worldbuildingMap}
          worldEvents={livingWorld.worldEvents}
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
              setPendingInsertion(null);
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
              onCreatePlotBeat={createPlotBeatFromBrew}
              onFindChange={setFindValue}
              onImageUpload={(file) => void uploadImage(file)}
              onInsert={insertText}
              onInsertReferenceCategory={(category) => { void insertSelectedCatalogueReference(category); }}
              customCatalogueCategories={customCatalogueCategories}
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
              onSave={() => { void saveActiveBrewNow(); }}
              onCreateCatalogueReference={createCatalogueReference}
              onCreateWorldbuildingReference={createWorldbuildingReference}
              worldbuildingTypes={worldbuildingTypes}
              onConvertHomebrewery={convertHomebreweryFormatting}
              onRedo={redo}
              onReplaceAll={replaceAll}
              onReplaceChange={setReplaceValue}
              onSelectionChange={(selection) => { selectionRef.current = selection; }}
              onTitleChange={(title) => updateActiveBrew((brew) => ({ ...brew, title }))}
              onToggleFind={() => setFindVisible((visible) => !visible)}
              spellcheckEnabled={spellcheckEnabled}
              onToggleSpellcheck={() => setSpellcheckEnabled((current) => { const next = !current; localStorage.setItem('homebrewry-spellcheck', next ? 'on' : 'off'); return next; })}
              onUndo={undo}
              replaceValue={replaceValue}
              title={activeBrew.title}
            />
            <section className="preview-pane" aria-label="Live preview">
              <div className="preview-canvas">
                <BrewPreview
                  assets={assetMap}
                  brew={renderedBrew}
                  catalogue={catalogueMap}
                  catalogueCategories={customCatalogueCategories}
                  encounters={encounterMap}
                  onEncounterOpen={openEncounters}
                  onReferenceOpen={setReferenceEntry}
                  onAddWorldbuildingNote={addWorldbuildingQuickNote}
                  onDeleteWorldbuildingReference={deleteWorldbuilding}
                  onWorldbuildingOpen={setWorldbuildingReferenceEntry}
                  onOpenInWorldbuilding={openWorldbuilding}
                  worldbuilding={worldbuildingMap}
                  worldbuildingTypes={worldbuildingTypes}
                />
              </div>
            </section>
          </div>

          <OutlinePanel
            insertionLabel={pendingInsertion?.label ?? null}
            onCancelInsertion={() => {
              setPendingInsertion(null);
              setSaveState('Placement cancelled');
            }}
            onInsertAtSection={insertPendingAtSection}
            onNavigate={(item) => {
              if (!window.matchMedia('(max-width: 820px)').matches) {
                const target = getOutlineLocations(activeBrew.content).find((location) => location.id === item.id);
                if (target && (viewMode === 'split' || viewMode === 'editor')) editorRef.current?.scrollTo(target.from);
                if (viewMode === 'split' || viewMode === 'preview') {
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
              }
              const target = getOutlineLocations(activeBrew.content).find((location) => location.id === item.id);
              if (!target) return;
              setMobileSection('editor');
              window.requestAnimationFrame(() => editorRef.current?.focus(target.from));
            }}
            outline={outline}
          />
        </div>
      )}
      {!ideasOpen && !campaignOpen && !catalogueOpen && !encountersOpen && !worldbuildingOpen && mobileSection === 'editor' && (
        <div className="mobile-capture-menu">
          {captureMenuOpen && <>
            <div className="mobile-writing-tools" aria-label="Writing tools">
              <div className="mobile-writing-tool-group" aria-label="Formatting">
                <button onClick={() => { insertText('#### '); setCaptureMenuOpen(false); }} type="button">H4</button>
              </div>
              <div className="mobile-writing-tool-group" aria-label="Insert blocks">
                <button onClick={() => { insertText('\n:::note Note\n', '\n:::\n'); setCaptureMenuOpen(false); }} type="button">Note</button>
                <button onClick={() => { insertText('\n:::descriptive\n', '\n:::\n'); setCaptureMenuOpen(false); }} type="button">Descr</button>
                <button onClick={() => { insertText('\n:::pagebreak\n'); setCaptureMenuOpen(false); }} type="button">Page</button>
                <button onClick={() => { document.getElementById('brew-image-input')?.click(); setCaptureMenuOpen(false); }} type="button">Image</button>
              </div>
              <div className="mobile-writing-tool-group" aria-label="Insert content">
                <button onClick={() => { setCaptureMenuOpen(false); openCatalogue(); }} type="button">Reference</button>
                <button onClick={() => { setCaptureMenuOpen(false); openEncounters(); }} type="button">Encounter</button>
                <button onClick={() => { setCaptureMenuOpen(false); setNameGeneratorTarget('editor'); }} type="button">Name</button>
              </div>
              <div className="mobile-writing-tool-group mobile-writing-destinations" aria-label="Editor panels">
                <button onClick={() => { setCaptureMenuOpen(false); setMobileSection('outline'); }} type="button">Outline</button>
                <button onClick={openIdeas} type="button">My ideas</button>
              </div>
               <div className="mobile-writing-tool-group mobile-writing-destinations" aria-label="Editor settings">
                 <button aria-pressed={spellcheckEnabled} onClick={() => setSpellcheckEnabled((current) => { const next = !current; localStorage.setItem('homebrewry-spellcheck', next ? 'on' : 'off'); return next; })} type="button">
                   Spellcheck: {spellcheckEnabled ? 'On' : 'Off'}
                 </button>
               </div>
              <div className="mobile-writing-tool-group mobile-writing-save" aria-label="Drive save">
                <button disabled={savingToDrive || syncing} onClick={() => { void saveActiveBrewNow(); setCaptureMenuOpen(false); }} type="button">
                  {savingToDrive ? 'Saving…' : 'Save to Drive'}
                </button>
              </div>
            </div>
          </>}
          <button
            aria-expanded={mobileTopMenuOpen}
            aria-label={mobileTopMenuOpen ? 'Hide top menu' : 'Show top menu'}
            className="mobile-top-menu-button"
            onClick={() => setMobileTopMenuOpen((open) => !open)}
            title={mobileTopMenuOpen ? 'Hide menu' : 'Show menu'}
            type="button"
          >
            ☰
          </button>
          <button aria-expanded={captureMenuOpen} aria-label="Open writing tools" className="mobile-outline-fab" onClick={() => setCaptureMenuOpen((open) => !open)} type="button">+</button>
        </div>
      )}
      {driveSaveNotice && (
        <div className={`drive-save-notice is-${driveSaveNotice.tone}`} role="status">
          {driveSaveNotice.message}
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
            <p>Encounters, the current party, Worldbuilding, or custom catalogue records have changes on both devices. Nothing has been overwritten.</p>
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
      {activeBrew.syncState !== 'conflict' && campaignDataSync?.syncState !== 'conflict' && privateMonsterSync?.syncState === 'conflict' && privateMonsterSync.conflict && (
        <div className="conflict-backdrop" role="dialog" aria-modal="true" aria-labelledby="private-monster-conflict-title">
          <section className="conflict-dialog">
            <p className="eyebrow">Private monster sync conflict</p>
            <h2 id="private-monster-conflict-title">Both catalogues changed</h2>
            <p>Nothing has been overwritten. Choose whether to keep the imported monsters from this device or from Drive.</p>
            <div className="conflict-times">
              <span>This device: {new Date(privateMonsterSync.lastLocalChangeAt).toLocaleString()}</span>
              <span>Google Drive: {privateMonsterSync.conflict.remoteEntries.length.toLocaleString()} imported monster{privateMonsterSync.conflict.remoteEntries.length === 1 ? '' : 's'}</span>
            </div>
            <div className="conflict-actions">
              <button onClick={() => void keepDrivePrivateMonsterConflict()} type="button">Keep Drive catalogue</button>
              <button className="danger-button" disabled={!accessToken || syncing} onClick={() => void overwriteDrivePrivateMonsterConflict()} type="button">Replace Drive catalogue</button>
            </div>
          </section>
        </div>
      )}
      {nameGeneratorTarget && <NameGeneratorDialog actionLabel={nameGeneratorTarget === 'editor' ? 'Insert into brew' : 'Create Worldbuilding entry'} onClose={() => setNameGeneratorTarget(null)} onUse={useGeneratedName} onUseAll={nameGeneratorTarget === 'editor' ? useGeneratedNames : undefined} />}
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImport={importBrew} />}
      {privateMonsterImportOpen && (
        <PrivateMonsterImportDialog
          existingCount={privateMonsterEntries.length}
          onClear={clearPrivateMonsterArchive}
          onClose={() => setPrivateMonsterImportOpen(false)}
          onImport={importMonsterArchive}
        />
      )}
      {referenceEntry && (
        <ReferenceDialog
          categoryLabel={catalogueCategoryLabel(referenceEntry.category, customCatalogueCategories)}
          entry={referenceEntry}
          onClose={() => setReferenceEntry(null)}
          onOpenInCatalogue={openReferenceInCatalogue}
          references={{
            catalogue: catalogueMap,
            catalogueCategories: customCatalogueCategories,
            onReferenceOpen: setReferenceEntry,
            onWorldbuildingOpen: setWorldbuildingReferenceEntry,
            worldbuilding: worldbuildingMap,
            worldbuildingTypes
          }}
        />
      )}
      {worldbuildingReferenceEntry && (
        <WorldbuildingReferenceDialog
          entry={worldbuildingReferenceEntry}
          onClose={() => setWorldbuildingReferenceEntry(null)}
          onOpenInWorldbuilding={openReferenceInWorldbuilding}
          types={worldbuildingTypes}
        />
      )}
    </div>
  );
}
