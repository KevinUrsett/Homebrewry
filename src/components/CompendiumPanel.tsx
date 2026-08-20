import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import { catalogueDataset } from '../catalogue/catalogueData';
import { createCustomCatalogueEntry, createCustomMonster } from '../catalogue/customEntries';
import { entrySummary } from '../catalogue/presentation';
import {
  catalogueCategoryLabel,
  catalogueEntryKey,
  type CatalogueCategory,
  type CatalogueEntry,
  type CustomCatalogueCategory,
  type CustomCatalogueEntry
} from '../catalogue/types';
import { campaignStoragePresentation } from '../lib/campaignStorageStatus';
import { seedBrews } from '../lib/brewStore';
import { listEncounters } from '../lib/encounterStore';
import { remainingTalesOnUnwrittenTomesReferences, type CuratedReference } from '../lib/talesOnUnwrittenTomesReferences';
import { findUnresolvedNames } from '../lib/unresolvedReferences';
import { findWorldbuildingConnections } from '../lib/worldbuildingConnections';
import { worldbuildingKindLabel } from '../lib/worldbuilding';
import type {
  Brew,
  CampaignEntity,
  Encounter,
  EntityCurrentState,
  SyncState,
  WorldbuildingEntry,
  WorldbuildingKind,
  WorldbuildingType,
  WorldEvent
} from '../types';
import { CatalogueEntryDetails } from './CatalogueEntryDetails';
import { CustomCatalogueEntryEditor } from './CustomCatalogueEntryEditor';
import { CustomMonsterEditor } from './CustomMonsterEditor';
import {
  ReferenceInbox,
  WorldbuildingEntryEditor,
  WorldbuildingEntryPreview
} from './WorldbuildingPanel';

// Calendar storage is only needed on its dedicated view. Keeping it lazy lets
// the main Compendium open immediately, including in browsers with no local
// calendar database yet.
const BelentorCalendar = lazy(async () => {
  const module = await import('./BelentorCalendar');
  return { default: module.BelentorCalendar };
});

type CompendiumMode = 'library' | 'calendar';
type BrowserMode = 'library' | 'inbox';
type FixedCompendiumCategory =
  | 'all'
  | 'characters'
  | 'monsters'
  | 'npcs'
  | 'places'
  | 'factions'
  | 'deities'
  | 'events'
  | 'spells'
  | 'items'
  | 'feats'
  | 'backgrounds'
  | 'species'
  | 'races'
  | 'classes'
  | 'subclasses'
  | 'vehicles'
  | 'rules'
  | 'tables'
  | 'other';
type CompendiumCategory = FixedCompendiumCategory | `custom:${string}`;

type CompendiumCategoryDefinition = {
  id: FixedCompendiumCategory;
  label: string;
  group: 'Campaign' | 'Rules';
  shortLabel: string;
};

const compendiumCategories: readonly CompendiumCategoryDefinition[] = [
  { id: 'characters', label: 'Characters', group: 'Campaign', shortLabel: 'C' },
  { id: 'monsters', label: 'Monsters', group: 'Campaign', shortLabel: 'M' },
  { id: 'npcs', label: 'NPCs', group: 'Campaign', shortLabel: 'N' },
  { id: 'places', label: 'Places', group: 'Campaign', shortLabel: 'P' },
  { id: 'factions', label: 'Factions', group: 'Campaign', shortLabel: 'F' },
  { id: 'deities', label: 'Deities', group: 'Campaign', shortLabel: 'D' },
  { id: 'events', label: 'Events', group: 'Campaign', shortLabel: 'E' },
  { id: 'spells', label: 'Spells', group: 'Rules', shortLabel: 'S' },
  { id: 'items', label: 'Items', group: 'Rules', shortLabel: 'I' },
  { id: 'feats', label: 'Feats', group: 'Rules', shortLabel: 'F' },
  { id: 'backgrounds', label: 'Backgrounds', group: 'Rules', shortLabel: 'B' },
  { id: 'species', label: 'Species', group: 'Rules', shortLabel: 'S' },
  { id: 'races', label: 'Races (Legacy)', group: 'Rules', shortLabel: 'R' },
  { id: 'classes', label: 'Classes', group: 'Rules', shortLabel: 'C' },
  { id: 'subclasses', label: 'Subclasses', group: 'Rules', shortLabel: 'S' },
  { id: 'vehicles', label: 'Vehicles', group: 'Rules', shortLabel: 'V' },
  { id: 'rules', label: 'Rules', group: 'Rules', shortLabel: 'R' },
  { id: 'tables', label: 'Tables', group: 'Rules', shortLabel: 'T' }
];

const compendiumCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

type CompendiumItem = {
  key: string;
  category: CompendiumCategory;
  entry: CatalogueEntry | WorldbuildingEntry;
  kindLabel: string;
  searchText: string;
  source: 'campaign' | 'rules';
  sourceLabel: string;
};

type MonsterEditorState = {
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
};

type CatalogueEntryEditorState = {
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
};

export type CompendiumPanelProps = {
  catalogueEntries: CatalogueEntry[];
  catalogueError: string | null;
  catalogueLoading: boolean;
  catalogueSelection?: CatalogueEntry | null;
  customCatalogueCategories: CustomCatalogueCategory[];
  customEntryCount: number;
  entitiesByWorldbuildingId?: ReadonlyMap<string, CampaignEntity>;
  hasDriveBackup?: boolean;
  onCreateCatalogueReference: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
  onCreateCuratedReferences?: (references: readonly CuratedReference[]) => void;
  onCreateCustomCategory: (name: string) => CustomCatalogueCategory | null;
  onCreateSuggestedEntries?: (references: readonly Pick<WorldbuildingEntry, 'name' | 'kind'>[]) => void;
  onCreateType: (name: string) => string | null;
  onCreateWorldbuilding: (kind?: WorldbuildingKind) => string | null | void;
  onCreateWorldbuildingReference: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onDeleteCustomEntry: (entry: CustomCatalogueEntry) => Promise<void>;
  onDeleteCustomMonster: (entry: CustomCatalogueEntry) => Promise<void>;
  onDeleteWorldbuilding: (entry: WorldbuildingEntry) => void;
  onEncounterOpen?: (encounterId: string) => void;
  onInsertReference: (entry: CatalogueEntry) => void;
  onOpenNameGenerator?: () => void;
  onOpenPrivateMonsterImport: () => void;
  onSaveCustomEntry: (entry: CustomCatalogueEntry) => Promise<void>;
  onSaveCustomMonster: (entry: CustomCatalogueEntry) => Promise<void>;
  onSelectCatalogue: (entry: CatalogueEntry | null) => void;
  onSelectWorldbuilding: (id: string | null) => void;
  onSetNpcStatus?: (entry: WorldbuildingEntry, status: string) => void;
  onUpdateWorldbuilding: (entry: WorldbuildingEntry) => void;
  privateMonsterCount: number;
  selectedWorldbuildingId: string | null;
  syncState: SyncState;
  types: WorldbuildingType[];
  worldbuildingEntries: WorldbuildingEntry[];
  worldbuildingMap: ReadonlyMap<string, WorldbuildingEntry>;
  worldEvents?: readonly WorldEvent[];
  currentStateByEntityId?: ReadonlyMap<string, EntityCurrentState>;
  onCreatePlotBeat?: (entry: WorldbuildingEntry, entity?: CampaignEntity) => void;
};

function normalisedName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
}

function categoryForCatalogueEntry(entry: CatalogueEntry): CompendiumCategory {
  const categories: Record<string, FixedCompendiumCategory> = {
    background: 'backgrounds',
    class: 'classes',
    feat: 'feats',
    item: 'items',
    monster: 'monsters',
    npc: 'npcs',
    race: 'races',
    rule: 'rules',
    species: 'species',
    vehicle: 'vehicles',
    spell: 'spells',
    subclass: 'subclasses',
    table: 'tables'
  };
  return categories[entry.category] ?? `custom:${entry.category}`;
}

function categoryForWorldbuildingEntry(entry: WorldbuildingEntry, types: readonly WorldbuildingType[], customCategories: readonly CustomCatalogueCategory[]): CompendiumCategory {
  const categories: Partial<Record<WorldbuildingKind, FixedCompendiumCategory>> = {
    character: 'characters',
    creature: 'monsters',
    deity: 'deities',
    event: 'events',
    faction: 'factions',
    'historical-figure': 'characters',
    item: 'items',
    landmark: 'places',
    npc: 'npcs',
    organization: 'factions',
    region: 'places',
    road: 'places',
    town: 'places'
  };
  const fixed = categories[entry.kind];
  if (fixed) return fixed;

  const customType = types.find((type) => type.id === entry.kind)?.name ?? '';
  const normalisedType = normalisedName(customType);
  if (normalisedType === 'vehicle' || normalisedType === 'vehicles') return 'vehicles';
  if (normalisedType === 'race' || normalisedType === 'races' || normalisedType === 'legacyrace') return 'races';
  if (normalisedType === 'spell' || normalisedType === 'spells') return 'spells';
  if (normalisedType === 'monster' || normalisedType === 'monsters' || normalisedType === 'creature' || normalisedType === 'creatures') return 'monsters';

  const matchingCustomCategory = customCategories.find((category) => normalisedName(category.name) === normalisedType);
  return matchingCustomCategory ? `custom:${matchingCustomCategory.id}` : 'other';
}

function catalogueKey(entry: CatalogueEntry): string {
  return `rules:${catalogueEntryKey(entry)}`;
}

function worldbuildingKey(entry: WorldbuildingEntry): string {
  return `campaign:${entry.id}`;
}

function itemMatches(item: CompendiumItem, category: CompendiumCategory, terms: string): boolean {
  if (category !== 'all' && item.category !== category) return false;
  return !terms || item.searchText.includes(terms);
}

function newWorldbuildingKindForCategory(category: CompendiumCategory): WorldbuildingKind {
  const kinds: Partial<Record<FixedCompendiumCategory, WorldbuildingKind>> = {
    characters: 'character',
    deities: 'deity',
    events: 'event',
    factions: 'faction',
    items: 'item',
    monsters: 'creature',
    npcs: 'npc',
    places: 'landmark'
  };
  return kinds[category as FixedCompendiumCategory] ?? 'custom';
}

function catalogueCategoryForCategory(category: CompendiumCategory, customCategories: readonly CustomCatalogueCategory[]): CatalogueCategory | null {
  const categories: Partial<Record<FixedCompendiumCategory, CatalogueCategory>> = {
    backgrounds: 'background',
    classes: 'class',
    feats: 'feat',
    items: 'item',
    monsters: 'monster',
    npcs: 'npc',
    races: 'race',
    rules: 'rule',
    species: 'species',
    vehicles: 'vehicle',
    spells: 'spell',
    subclasses: 'subclass',
    tables: 'table'
  };
  if (category.startsWith('custom:')) {
    const id = category.slice('custom:'.length);
    return customCategories.some((item) => item.id === id) ? id : null;
  }
  return categories[category as FixedCompendiumCategory] ?? null;
}

function isWorldbuildingItem(item: CompendiumItem | null): item is CompendiumItem & { entry: WorldbuildingEntry } {
  return Boolean(item && item.source === 'campaign');
}

function isCatalogueItem(item: CompendiumItem | null): item is CompendiumItem & { entry: CatalogueEntry } {
  return Boolean(item && item.source === 'rules');
}

export function CompendiumPanel({
  catalogueEntries,
  catalogueError,
  catalogueLoading,
  catalogueSelection,
  customCatalogueCategories,
  customEntryCount,
  entitiesByWorldbuildingId = new Map(),
  hasDriveBackup = false,
  onCreateCatalogueReference,
  onCreateCuratedReferences = () => undefined,
  onCreateCustomCategory,
  onCreateSuggestedEntries = () => undefined,
  onCreateType,
  onCreateWorldbuilding,
  onCreateWorldbuildingReference,
  onDeleteCustomEntry,
  onDeleteCustomMonster,
  onDeleteWorldbuilding,
  onEncounterOpen = () => undefined,
  onInsertReference,
  onOpenNameGenerator = () => undefined,
  onOpenPrivateMonsterImport,
  onSaveCustomEntry,
  onSaveCustomMonster,
  onSelectCatalogue,
  onSelectWorldbuilding,
  onSetNpcStatus = () => undefined,
  onUpdateWorldbuilding,
  privateMonsterCount,
  selectedWorldbuildingId,
  syncState,
  types,
  worldbuildingEntries,
  worldbuildingMap,
  worldEvents = [],
  currentStateByEntityId = new Map(),
  onCreatePlotBeat = () => undefined
}: CompendiumPanelProps) {
  const [mode, setMode] = useState<CompendiumMode>('library');
  const [browserMode, setBrowserMode] = useState<BrowserMode>('library');
  const [category, setCategory] = useState<CompendiumCategory>(() => catalogueSelection ? categoryForCatalogueEntry(catalogueSelection) : 'all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [editingWorldbuildingId, setEditingWorldbuildingId] = useState<string | null>(null);
  const [monsterEditor, setMonsterEditor] = useState<MonsterEditorState | null>(null);
  const [entryEditor, setEntryEditor] = useState<CatalogueEntryEditorState | null>(null);
  const [addingType, setAddingType] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [brews, setBrews] = useState<Brew[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [dismissedNames, setDismissedNames] = useState<Set<string>>(() => new Set());
  const [detailOpen, setDetailOpen] = useState(() => Boolean(catalogueSelection || selectedWorldbuildingId));
  const [localSelectedKey, setLocalSelectedKey] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([seedBrews(), listEncounters()])
      .then(([nextBrews, nextEncounters]) => {
        if (cancelled) return;
        setBrews(nextBrews);
        setEncounters(nextEncounters);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const allItems = useMemo<CompendiumItem[]>(() => {
    const campaignItems = worldbuildingEntries.map((entry) => {
      const itemCategory = categoryForWorldbuildingEntry(entry, types, customCatalogueCategories);
      const kindLabel = worldbuildingKindLabel(entry.kind, types);
      return {
        key: worldbuildingKey(entry),
        category: itemCategory,
        entry,
        kindLabel,
        searchText: [entry.name, kindLabel, ...entry.aliases, entry.notes].join(' ').toLocaleLowerCase(),
        source: 'campaign' as const,
        sourceLabel: `Campaign · ${kindLabel}`
      };
    });
    const rulesItems = catalogueEntries.map((entry) => {
      const itemCategory = categoryForCatalogueEntry(entry);
      const kindLabel = catalogueCategoryLabel(entry.category, customCatalogueCategories);
      return {
        key: catalogueKey(entry),
        category: itemCategory,
        entry,
        kindLabel,
        searchText: [entry.name, kindLabel, entry.ruleset, entry.source, entry.type ?? '', ...entrySummary(entry)].join(' ').toLocaleLowerCase(),
        source: 'rules' as const,
        sourceLabel: `${entry.ruleset} · ${entry.source}`
      };
    });
    return [...campaignItems, ...rulesItems];
  }, [catalogueEntries, customCatalogueCategories, types, worldbuildingEntries]);

  const itemsByKey = useMemo(() => new Map(allItems.map((item) => [item.key, item])), [allItems]);
  const catalogueByKey = useMemo(
    () => new Map(catalogueEntries.map((entry) => [catalogueEntryKey(entry), entry])),
    [catalogueEntries]
  );
  const externallySelectedKey = catalogueSelection
    ? catalogueKey(catalogueSelection)
    : selectedWorldbuildingId
      ? `campaign:${selectedWorldbuildingId}`
      : null;
  const externallySelectedItem = externallySelectedKey ? itemsByKey.get(externallySelectedKey) ?? null : null;
  const activeCategory = externallySelectedItem?.category ?? category;
  const filterTerms = deferredQuery.trim().toLocaleLowerCase();
  const filteredItems = allItems
    .filter((item) => itemMatches(item, activeCategory, filterTerms))
    .sort((left, right) => compendiumCollator.compare(left.entry.name, right.entry.name) || left.source.localeCompare(right.source));
  const categoryCounts = useMemo(() => {
    const counts = new Map<CompendiumCategory, number>();
    allItems.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
    return counts;
  }, [allItems]);
  const selected = externallySelectedItem ?? (localSelectedKey ? itemsByKey.get(localSelectedKey) ?? null : null);
  const displayingDetail = detailOpen || Boolean(selected);

  const knownNames = useMemo(() => [
    ...worldbuildingEntries.flatMap((entry) => [entry.name, ...entry.aliases]),
    ...catalogueEntries.map((entry) => entry.name),
    ...encounters.map((encounter) => encounter.name)
  ], [catalogueEntries, encounters, worldbuildingEntries]);
  const unresolved = useMemo(
    () => findUnresolvedNames(brews.map((brew) => brew.content), knownNames)
      .filter((item) => !dismissedNames.has(item.name.toLocaleLowerCase()))
      .slice(0, 30),
    [brews, dismissedNames, knownNames]
  );
  const curatedReferences = useMemo(() => remainingTalesOnUnwrittenTomesReferences(worldbuildingEntries), [worldbuildingEntries]);

  const selectedWorldbuilding = isWorldbuildingItem(selected) ? selected.entry : null;
  const selectedCatalogue = isCatalogueItem(selected) ? selected.entry : null;
  const editingWorldbuilding = editingWorldbuildingId === selectedWorldbuilding?.id;
  const selectedEntity = selectedWorldbuilding ? entitiesByWorldbuildingId.get(selectedWorldbuilding.id) : undefined;
  const selectedCurrentState = selectedEntity ? currentStateByEntityId.get(selectedEntity.id) : undefined;
  const selectedConnections = selectedWorldbuilding
    ? findWorldbuildingConnections(selectedWorldbuilding, brews, encounters, worldbuildingEntries)
    : [];
  const combatNotes = (() => {
    if (!selectedEntity) return [];
    const encountersById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
    return worldEvents
      .filter((event) => event.entityId === selectedEntity.id && event.type === 'npc.died' && event.source.kind === 'combat')
      .map((event) => ({
        id: event.id,
        encounterId: event.source.kind === 'combat' ? event.source.encounterId : '',
        encounterName: encountersById.get(event.source.kind === 'combat' ? event.source.encounterId : '')?.name ?? 'an unavailable encounter',
        occurredAt: event.occurredAt
      }))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  })();
  const storage = campaignStoragePresentation(syncState, hasDriveBackup);

  const selectItem = (item: CompendiumItem) => {
    if (editingWorldbuilding && item.key !== selected?.key && !window.confirm('Discard unsaved campaign entry changes?')) return;
    setCategory(item.category);
    setBrowserMode('library');
    setDetailOpen(true);
    setLocalSelectedKey(item.key);
    setEditingWorldbuildingId(null);
    setMonsterEditor(null);
    setEntryEditor(null);
    setActionError(null);
    if (isWorldbuildingItem(item)) onSelectWorldbuilding(item.entry.id);
    else if (isCatalogueItem(item)) onSelectCatalogue(item.entry);
  };

  const selectCategory = (next: CompendiumCategory) => {
    if (editingWorldbuilding && !window.confirm('Discard unsaved campaign entry changes?')) return;
    setCategory(next);
    setBrowserMode('library');
    setCategoryPickerOpen(false);
    setDetailOpen(false);
    setLocalSelectedKey(null);
    setEditingWorldbuildingId(null);
    setMonsterEditor(null);
    setEntryEditor(null);
    onSelectCatalogue(null);
    onSelectWorldbuilding(null);
  };

  const selectWorldbuilding = (entry: WorldbuildingEntry) => {
    selectItem(itemsByKey.get(worldbuildingKey(entry)) ?? {
      key: worldbuildingKey(entry),
      category: categoryForWorldbuildingEntry(entry, types, customCatalogueCategories),
      entry,
      kindLabel: worldbuildingKindLabel(entry.kind, types),
      searchText: entry.name.toLocaleLowerCase(),
      source: 'campaign',
      sourceLabel: 'Campaign'
    });
  };

  const selectCatalogue = (entry: CatalogueEntry) => {
    const next = itemsByKey.get(catalogueKey(entry));
    if (!next) return;
    setCategory(next.category);
    selectItem(next);
  };

  const createCampaignEntry = () => {
    onSelectCatalogue(null);
    onSelectWorldbuilding(null);
    const id = onCreateWorldbuilding(newWorldbuildingKindForCategory(activeCategory));
    if (!id) return;
    setBrowserMode('library');
    setActionMenuOpen(false);
    setDetailOpen(true);
    setLocalSelectedKey(null);
    setEditingWorldbuildingId(id);
  };

  const beginNewMonster = () => {
    setActionError(null);
    setCategory('monsters');
    setBrowserMode('library');
    setActionMenuOpen(false);
    setDetailOpen(true);
    setLocalSelectedKey(null);
    onSelectCatalogue(null);
    onSelectWorldbuilding(null);
    setMonsterEditor({ entry: createCustomMonster(), mode: 'create' });
    setEntryEditor(null);
    setEditingWorldbuildingId(null);
  };

  const beginNewRulesEntry = () => {
    const rulesCategory = catalogueCategoryForCategory(activeCategory, customCatalogueCategories);
    if (!rulesCategory) {
      setActionError('Choose a rules category first, or create a campaign entry instead.');
      setActionMenuOpen(false);
      return;
    }
    if (rulesCategory === 'monster') {
      beginNewMonster();
      return;
    }
    setActionError(null);
    setActionMenuOpen(false);
    setDetailOpen(true);
    setLocalSelectedKey(null);
    setEntryEditor({ entry: createCustomCatalogueEntry('Untitled entry', rulesCategory), mode: 'create' });
    setMonsterEditor(null);
    setEditingWorldbuildingId(null);
  };

  const beginMonsterDuplicate = (entry: CatalogueEntry) => {
    setActionError(null);
    setDetailOpen(true);
    setMonsterEditor({ entry: createCustomMonster(entry), mode: 'create' });
    setEntryEditor(null);
  };

  const deleteCustomMonster = (entry: CustomCatalogueEntry) => {
    if (!window.confirm(`Delete custom monster “${entry.name}”? This cannot be undone.`)) return;
    void onDeleteCustomMonster(entry)
      .then(() => {
        setMonsterEditor(null);
        setDetailOpen(false);
        setLocalSelectedKey(null);
        onSelectCatalogue(null);
      })
      .catch((reason) => setActionError(reason instanceof Error ? reason.message : 'Could not delete the custom monster.'));
  };

  const deleteCustomEntry = (entry: CustomCatalogueEntry) => {
    if (!window.confirm(`Delete custom entry “${entry.name}”? This cannot be undone.`)) return;
    void onDeleteCustomEntry(entry)
      .then(() => {
        setEntryEditor(null);
        setDetailOpen(false);
        setLocalSelectedKey(null);
        onSelectCatalogue(null);
      })
      .catch((reason) => setActionError(reason instanceof Error ? reason.message : 'Could not delete the custom entry.'));
  };

  const submitType = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = onCreateType(typeName);
    if (!id) {
      setTypeError('That type already exists, or its name is invalid.');
      return;
    }
    setTypeName('');
    setTypeError(null);
    setAddingType(false);
  };

  const submitCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = onCreateCustomCategory(categoryName);
    if (!next) {
      setActionError('Enter a new category name that is not already in use.');
      return;
    }
    setCategory(`custom:${next.id}`);
    setCategoryName('');
    setAddingCategory(false);
    setActionError(null);
  };

  const showRulesAction = Boolean(catalogueCategoryForCategory(activeCategory, customCatalogueCategories));
  const customCategoryDefinitions = customCatalogueCategories.map((item) => ({
    id: `custom:${item.id}` as CompendiumCategory,
    label: item.name,
    shortLabel: item.name.slice(0, 1).toLocaleUpperCase()
  }));

  const activeCategoryLabel = activeCategory === 'all'
    ? 'All entries'
    : compendiumCategories.find((item) => item.id === activeCategory)?.label
      ?? customCategoryDefinitions.find((item) => item.id === activeCategory)?.label
      ?? 'Other entries';
  const activeCategoryCount = activeCategory === 'all' ? allItems.length : categoryCounts.get(activeCategory) ?? 0;

  const itemSubtitle = (item: CompendiumItem) => {
    if (isCatalogueItem(item)) {
      return entrySummary(item.entry).filter(Boolean).join(' · ') || item.kindLabel;
    }
    const campaignEntry = item.entry as WorldbuildingEntry;
    const notes = campaignEntry.notes.trim().replace(/\s+/g, ' ');
    return notes ? `${item.kindLabel} · ${notes}` : item.kindLabel;
  };

  const closeDetail = () => {
    if (editingWorldbuilding && !window.confirm('Discard unsaved campaign entry changes?')) return;
    setDetailOpen(false);
    setLocalSelectedKey(null);
    setEditingWorldbuildingId(null);
    setMonsterEditor(null);
    setEntryEditor(null);
    setActionError(null);
    onSelectCatalogue(null);
    onSelectWorldbuilding(null);
  };

  const openInbox = () => {
    if (editingWorldbuilding && !window.confirm('Discard unsaved campaign entry changes?')) return;
    setBrowserMode('inbox');
    setDetailOpen(false);
    setLocalSelectedKey(null);
    setCategoryPickerOpen(false);
    setActionMenuOpen(false);
    setEditingWorldbuildingId(null);
    setMonsterEditor(null);
    setEntryEditor(null);
    onSelectCatalogue(null);
    onSelectWorldbuilding(null);
  };

  const openLibrary = () => {
    setBrowserMode('library');
    setQuery('');
  };

  const detailContent = monsterEditor ? (
    <CustomMonsterEditor
      customCategories={customCatalogueCategories}
      entry={monsterEditor.entry}
      key={`${monsterEditor.entry.id}-${monsterEditor.entry.version}`}
      mode={monsterEditor.mode}
      onCancel={closeDetail}
      onCreateCatalogueReference={onCreateCatalogueReference}
      onCreateWorldbuildingReference={onCreateWorldbuildingReference}
      onSave={async (entry) => { await onSaveCustomMonster(entry); onSelectCatalogue(entry); }}
      worldbuildingTypes={types}
    />
  ) : entryEditor ? (
    <CustomCatalogueEntryEditor
      categoryLabel={catalogueCategoryLabel(entryEditor.entry.category, customCatalogueCategories)}
      customCategories={customCatalogueCategories}
      entry={entryEditor.entry}
      key={`${entryEditor.entry.id}-${entryEditor.entry.version}`}
      mode={entryEditor.mode}
      onCancel={closeDetail}
      onCreateCatalogueReference={onCreateCatalogueReference}
      onCreateWorldbuildingReference={onCreateWorldbuildingReference}
      onSave={async (entry) => { await onSaveCustomEntry(entry); onSelectCatalogue(entry); }}
      worldbuildingTypes={types}
    />
  ) : selectedWorldbuilding ? (
    editingWorldbuilding ? (
      <WorldbuildingEntryEditor
        catalogueCategories={customCatalogueCategories}
        entry={selectedWorldbuilding}
        key={selectedWorldbuilding.id}
        onCancel={() => setEditingWorldbuildingId(null)}
        onCreateCatalogueReference={onCreateCatalogueReference}
        onCreateWorldbuildingReference={onCreateWorldbuildingReference}
        onSave={(entry) => { onUpdateWorldbuilding(entry); setEditingWorldbuildingId(null); }}
        types={types}
      />
    ) : (
      <WorldbuildingEntryPreview
        catalogue={catalogueByKey}
        catalogueCategories={customCatalogueCategories}
        combatNotes={combatNotes}
        connections={selectedConnections}
        currentState={selectedCurrentState}
        entity={selectedEntity}
        entry={selectedWorldbuilding}
        onCreatePlotBeat={() => onCreatePlotBeat(selectedWorldbuilding, selectedEntity)}
        onDelete={(entry) => { onDeleteWorldbuilding(entry); closeDetail(); }}
        onEdit={() => setEditingWorldbuildingId(selectedWorldbuilding.id)}
        onEncounterOpen={onEncounterOpen}
        onReferenceOpen={selectCatalogue}
        onSetNpcStatus={(status) => onSetNpcStatus(selectedWorldbuilding, status)}
        onWorldbuildingOpen={selectWorldbuilding}
        types={types}
        worldbuilding={worldbuildingMap}
      />
    )
  ) : selectedCatalogue ? (
    <>
      <CatalogueEntryDetails
        actions={<div className="catalogue-entry-action-list"><button className="primary-button" onClick={() => onInsertReference(selectedCatalogue)} type="button">Insert reference into brew</button>{selectedCatalogue.category === 'monster' && <button onClick={() => beginMonsterDuplicate(selectedCatalogue)} type="button">Duplicate as custom monster</button>}{selectedCatalogue.category === 'monster' && selectedCatalogue.source === 'Custom' && <><button onClick={() => setMonsterEditor({ entry: selectedCatalogue as CustomCatalogueEntry, mode: 'edit' })} type="button">Edit custom monster</button><button className="quiet-danger" onClick={() => deleteCustomMonster(selectedCatalogue as CustomCatalogueEntry)} type="button">Delete custom monster</button></>}{selectedCatalogue.category !== 'monster' && selectedCatalogue.source === 'Custom' && <><button onClick={() => setEntryEditor({ entry: selectedCatalogue as CustomCatalogueEntry, mode: 'edit' })} type="button">Edit custom entry</button><button className="quiet-danger" onClick={() => deleteCustomEntry(selectedCatalogue as CustomCatalogueEntry)} type="button">Delete custom entry</button></>}</div>}
        categoryLabel={catalogueCategoryLabel(selectedCatalogue.category, customCatalogueCategories)}
        entry={selectedCatalogue}
        references={{ catalogue: catalogueByKey, catalogueCategories: customCatalogueCategories, onReferenceOpen: selectCatalogue, onWorldbuildingOpen: selectWorldbuilding, worldbuilding: worldbuildingMap, worldbuildingTypes: types }}
      />
      {actionError && <p className="catalogue-error catalogue-inline-error" role="alert">{actionError}</p>}
    </>
  ) : <p className="empty-panel">Opening the new entry…</p>;

  if (mode === 'calendar') {
    return (
      <main className="compendium-page compendium-calendar-page" aria-label="Compendium calendar">
        <div className="compendium-library-shell">
          <header className="compendium-page-header">
            <div><p className="eyebrow">Campaign preparation</p><h1>Calendar</h1><p>Keep the Belentorian calendar close to your campaign material.</p></div>
            <div className="compendium-toolbar"><button onClick={() => setMode('library')} type="button">← Compendium</button><span className={`sync-badge sync-${storage.tone}`} title={storage.title}>{storage.label}</span></div>
          </header>
          <section className="compendium-calendar-panel"><Suspense fallback={<p className="empty-panel">Opening calendar…</p>}><BelentorCalendar /></Suspense></section>
        </div>
      </main>
    );
  }

  return (
    <main className={`compendium-page ${displayingDetail ? 'is-detail-open' : ''}`} aria-label="Compendium">
      {displayingDetail ? (
        <section className="compendium-detail-shell" aria-live="polite">
          <header className="compendium-detail-header">
            <button onClick={closeDetail} type="button">← Compendium</button>
            <div><p className="eyebrow">{monsterEditor ? 'New custom monster' : entryEditor ? 'New rules entry' : selected?.kindLabel ?? activeCategoryLabel}</p><strong>{monsterEditor ? monsterEditor.entry.name : entryEditor ? entryEditor.entry.name : selected?.entry.name ?? 'New entry'}</strong></div>
            <span className={`sync-badge sync-${storage.tone}`} title={storage.title}>{storage.label}</span>
          </header>
          <div className="compendium-detail-content">{detailContent}</div>
        </section>
      ) : (
        <div className="compendium-library-shell">
          <header className="compendium-page-header">
            <div>
              <p className="eyebrow">Campaign and rules</p>
              <h1>Compendium</h1>
              <p>{worldbuildingEntries.length.toLocaleString()} campaign entr{worldbuildingEntries.length === 1 ? 'y' : 'ies'} and {(catalogueEntries.length - privateMonsterCount - customEntryCount).toLocaleString()} offline {catalogueDataset.version} references in one library.</p>
            </div>
            <div className="compendium-toolbar" aria-label="Compendium actions">
              <button aria-expanded={categoryPickerOpen} onClick={() => setCategoryPickerOpen(true)} type="button"><span>Category</span><strong>{activeCategoryLabel}</strong></button>
              <button onClick={openInbox} type="button">Inbox <span>{curatedReferences.length + unresolved.length}</span></button>
              <button onClick={() => setMode('calendar')} type="button">Calendar</button>
              <button className="primary-button" onClick={() => setActionMenuOpen(true)} type="button">+ Add</button>
              <span className={`sync-badge sync-${storage.tone}`} title={storage.title}>{storage.label}</span>
            </div>
          </header>

          {catalogueError && <p className="catalogue-error">The rules reference data could not load: {catalogueError}</p>}
          {addingType && <form className="compendium-new-type" onSubmit={submitType}><label>New campaign type<input autoFocus onChange={(event) => setTypeName(event.target.value)} placeholder="Tavern, ship, vehicle…" value={typeName} /></label><button onClick={() => { setAddingType(false); setTypeError(null); }} type="button">Cancel</button><button className="primary-button" type="submit">Add type</button>{typeError && <p role="alert">{typeError}</p>}</form>}
          {addingCategory && <form className="compendium-new-type" onSubmit={submitCategory}><label>New rules category<input autoFocus onChange={(event) => setCategoryName(event.target.value)} placeholder="Vehicles, hazards, relics…" value={categoryName} /></label><button onClick={() => setAddingCategory(false)} type="button">Cancel</button><button className="primary-button" type="submit">Add category</button></form>}

          <section className="compendium-library-panel" aria-label="Compendium library">
            {browserMode === 'library' ? <>
              <input aria-label="Search compendium" className="search-input compendium-search" onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${activeCategoryLabel.toLocaleLowerCase()}…`} value={query} />
              <header className="compendium-results-heading"><div><p className="eyebrow">{catalogueLoading ? 'Loading references' : `${filteredItems.length.toLocaleString()} shown`}</p><h2>{activeCategoryLabel}</h2></div><span>{activeCategoryCount.toLocaleString()} total</span></header>
              <div className="compendium-results">
                {filteredItems.map((item) => <button className="compendium-result" key={item.key} onClick={() => selectItem(item)} type="button"><strong>{item.entry.name}</strong><span>{itemSubtitle(item)}</span><small>{item.sourceLabel}</small></button>)}
                {!catalogueLoading && !filteredItems.length && <p className="empty-panel">No entries match that search.</p>}
              </div>
            </> : <div className="compendium-inbox-view"><header><button onClick={openLibrary} type="button">← Library</button><div><p className="eyebrow">Review queue</p><h2>Reference inbox</h2></div></header><input aria-label="Search reference inbox" className="search-input compendium-search" onChange={(event) => setQuery(event.target.value)} placeholder="Filter names to review…" value={query} /><ReferenceInbox curatedReferences={curatedReferences} onCreateCuratedReferences={onCreateCuratedReferences} onCreateSuggestedEntries={onCreateSuggestedEntries} onDismissNames={(names) => setDismissedNames((current) => new Set([...current, ...names.map((name) => name.toLocaleLowerCase())]))} query={query} types={types} unresolved={unresolved} /></div>}
          </section>
        </div>
      )}

      {categoryPickerOpen && <div aria-modal="true" className="compendium-dialog-backdrop" onMouseDown={() => setCategoryPickerOpen(false)} role="dialog"><section className="compendium-category-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Compendium</p><h2>Browse by category</h2><p>Choose what you want to look through.</p></div><button aria-label="Close categories" onClick={() => setCategoryPickerOpen(false)} type="button">×</button></header><nav className="compendium-category-list" aria-label="Compendium categories"><button className={activeCategory === 'all' ? 'is-selected' : ''} onClick={() => selectCategory('all')} type="button"><span className="compendium-category-mark">A</span><span>All entries</span><small>{allItems.length}</small></button>{(['Campaign', 'Rules'] as const).map((group) => <div className="compendium-category-group" key={group}><p>{group}</p>{compendiumCategories.filter((item) => item.group === group).map((item) => <button className={activeCategory === item.id ? 'is-selected' : ''} key={item.id} onClick={() => selectCategory(item.id)} type="button"><span className="compendium-category-mark">{item.shortLabel}</span><span>{item.label}</span><small>{categoryCounts.get(item.id) ?? 0}</small></button>)}</div>)}{customCategoryDefinitions.length > 0 && <div className="compendium-category-group"><p>Custom</p>{customCategoryDefinitions.map((item) => <button className={activeCategory === item.id ? 'is-selected' : ''} key={item.id} onClick={() => selectCategory(item.id)} type="button"><span className="compendium-category-mark">{item.shortLabel}</span><span>{item.label}</span><small>{categoryCounts.get(item.id) ?? 0}</small></button>)}</div>}</nav></section></div>}

      {actionMenuOpen && <div aria-modal="true" className="compendium-dialog-backdrop" onMouseDown={() => setActionMenuOpen(false)} role="dialog"><section className="compendium-actions-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Compendium</p><h2>Add or manage</h2></div><button aria-label="Close add menu" onClick={() => setActionMenuOpen(false)} type="button">×</button></header><div><button className="primary-button" onClick={createCampaignEntry} type="button">New campaign entry</button><button disabled={!showRulesAction} onClick={beginNewRulesEntry} type="button">New rules entry{showRulesAction ? ` · ${activeCategoryLabel}` : ''}</button><button onClick={beginNewMonster} type="button">New custom monster</button><button onClick={() => { setActionMenuOpen(false); onOpenNameGenerator(); }} type="button">Generate names</button><button onClick={() => { setActionMenuOpen(false); setAddingType(true); }} type="button">New campaign type</button><button onClick={() => { setActionMenuOpen(false); setAddingCategory(true); }} type="button">New rules category</button><button onClick={() => { setActionMenuOpen(false); onOpenPrivateMonsterImport(); }} type="button">Import monsters</button></div></section></div>}
    </main>
  );
}
