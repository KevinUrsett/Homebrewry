import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  challengeRatingValue,
  compareMonsterMetadata,
  compareOptionalNumbers,
  emptyMonsterMetadata,
  monsterMatchesFilters,
  monsterMetadataForCatalogueEntry,
  monsterSizeLabel,
  monsterSizeRank,
  monsterSortLabel,
  titleCaseMonsterValue,
  type MonsterFilterFields,
  type MonsterSort
} from '../catalogue/monsterMetadata';
import { dataRecords, dataString, entrySummary } from '../catalogue/presentation';
import { encounterEquipmentItems, magicWeaponForItem, resolvedEncounterMonsterStatBlock, resolvedMonsterEquipment, type MonsterEquipment } from '../catalogue/magicItems';
import type { CatalogueEntry } from '../catalogue/types';
import {
  addMonstersToEncounter,
  addNpcToEncounter,
  addPartyMembersToEncounter,
  adjustEncounterParticipantHitPoints,
  advanceCombatTurn,
  moveEncounterParticipant,
  patchEncounterParticipant,
  removeEncounterParticipant,
  reorderEncounterParticipants,
  sortCombatants,
  touchEncounter
} from '../lib/encounters';
import { campaignStoragePresentation } from '../lib/campaignStorageStatus';
import { belentorMonths, formatBelentorDate } from '../lib/belentorCalendar';
import type { CampaignPosition, DerivedPartyLocation } from '../lib/campaignProgress';
import type { BelentorDate, CampaignEntity, Encounter, EncounterParticipant, EntityCurrentState, PartyMember, SyncState, WorldEvent } from '../types';
import '../encounter-refresh.css';

type EncounterPanelProps = {
  encounters: Encounter[];
  campaignPosition?: CampaignPosition | null;
  partyLocation?: DerivedPartyLocation;
  locationEntities?: CampaignEntity[];
  worldEvents?: readonly WorldEvent[];
  selectedId: string | null;
  partyMembers: PartyMember[];
  npcEntities?: CampaignEntity[];
  currentStateByEntityId?: ReadonlyMap<string, EntityCurrentState>;
  monsters: CatalogueEntry[];
  items?: CatalogueEntry[];
  loading: boolean;
  syncState: SyncState;
  hasDriveBackup?: boolean;
  onCreateEncounter: () => void;
  onDeleteEncounter: (encounter: Encounter) => void;
  onInsertReference: (encounter: Encounter) => void;
  onMonsterOpen?: (monster: CatalogueEntry, equipment?: MonsterEquipment[]) => void;
  onSelectEncounter: (id: string) => void;
  onUpdateEncounter: (encounter: Encounter) => void;
  onCreatePartyMember: (name: string, armorClass: number | null, maxHitPoints: number | null) => void;
  onDeletePartyMember: (member: PartyMember) => void;
  onUpdatePartyMember: (member: PartyMember) => void;
  onEndCombat?: (encounter: Encounter) => void;
  onResurrectNpc?: (entityId: string) => void;
  onSetPartyLocation?: (entityId: string) => void;
};

type CombatantPicker = 'party' | 'npc' | 'monster' | null;
type StatField = 'initiative' | 'armorClass' | 'maxHitPoints';
type StatEditor = { participantId: string; field: StatField; value: string } | null;
type EquipmentEditor = { participantId: string } | null;
type EncounterMonsterFilters = MonsterFilterFields & {
  ruleset: string;
  sort: MonsterSort;
};
type EncounterMonsterFilterOptions = {
  sources: string[];
  importSources: string[];
  types: string[];
  crs: string[];
  sizes: string[];
  environments: string[];
  rulesets: string[];
};
type EncounterMonsterFilterControlsProps = {
  filters: EncounterMonsterFilters;
  options: EncounterMonsterFilterOptions;
  onFilterChange: <Key extends keyof EncounterMonsterFilters>(key: Key, value: EncounterMonsterFilters[Key]) => void;
  variant: 'inline' | 'drawer';
};
type EncounterView = 'create' | 'run';

const MONSTER_RESULTS_PAGE_SIZE = Number.MAX_SAFE_INTEGER;
const defaultEncounterDate: BelentorDate = { era: 'AA', year: 641, month: 'Quen', day: 1 };
const savedEncounterListHeightKey = 'homebrewry-saved-encounter-list-height-v1';
const defaultSavedEncounterListHeight = 370;
const monsterCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const defaultEncounterMonsterFilters: EncounterMonsterFilters = {
  source: '',
  importSource: '',
  type: '',
  cr: '',
  size: '',
  environment: '',
  ruleset: '',
  sort: 'name-asc'
};

function encounterRulesetLabel(ruleset: string) {
  return ruleset === '5.5e' ? 'D&D 5.5e / One D&D' : ruleset;
}

function EncounterMonsterFilterControls({ filters, onFilterChange, options, variant }: EncounterMonsterFilterControlsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(filters.importSource || filters.ruleset));
  const activeAdvancedFilterCount = Number(Boolean(filters.importSource)) + Number(Boolean(filters.ruleset));

  return (
    <div aria-label="Monster filters" className={`encounter-monster-filters encounter-monster-filters--${variant}`}>
      <label className="encounter-monster-book-source-control">Book source
        <select aria-label="Filter encounter monsters by book source" onChange={(event) => onFilterChange('source', event.target.value)} value={filters.source}>
          <option value="">All book sources</option>
          {options.sources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
      </label>
      <label>Type
        <select aria-label="Filter encounter monsters by type" onChange={(event) => onFilterChange('type', event.target.value)} value={filters.type}>
          <option value="">All types</option>
          {options.types.map((type) => <option key={type} value={type}>{titleCaseMonsterValue(type)}</option>)}
        </select>
      </label>
      <label>CR
        <select aria-label="Filter encounter monsters by challenge rating" onChange={(event) => onFilterChange('cr', event.target.value)} value={filters.cr}>
          <option value="">All CRs</option>
          {options.crs.map((cr) => <option key={cr} value={cr}>CR {cr}</option>)}
        </select>
      </label>
      <label>Size
        <select aria-label="Filter encounter monsters by size" onChange={(event) => onFilterChange('size', event.target.value)} value={filters.size}>
          <option value="">All sizes</option>
          {options.sizes.map((size) => <option key={size} value={size}>{monsterSizeLabel(size)}</option>)}
        </select>
      </label>
      <label>Environment
        <select aria-label="Filter encounter monsters by environment" onChange={(event) => onFilterChange('environment', event.target.value)} value={filters.environment}>
          <option value="">All environments</option>
          {options.environments.map((environment) => <option key={environment} value={environment}>{titleCaseMonsterValue(environment)}</option>)}
        </select>
      </label>
      <label className="encounter-monster-sort-control">Sort
        <select aria-label="Sort encounter monsters" onChange={(event) => onFilterChange('sort', event.target.value as MonsterSort)} value={filters.sort}>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="cr-asc">CR: low to high</option>
          <option value="cr-desc">CR: high to low</option>
          <option value="size-asc">Size: small to large</option>
          <option value="size-desc">Size: large to small</option>
          <option value="type-asc">Type A–Z</option>
        </select>
      </label>
      <details className="encounter-monster-advanced-filters" onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} open={advancedOpen}>
        <summary>Advanced filters{activeAdvancedFilterCount ? ` (${activeAdvancedFilterCount})` : ''}</summary>
        <div>
          <label>Import source
            <select aria-label="Filter encounter monsters by import source" onChange={(event) => onFilterChange('importSource', event.target.value)} value={filters.importSource}>
              <option value="">All import sources</option>
              {options.importSources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
          </label>
          <label>Edition
            <select aria-label="Filter encounter monsters by edition" onChange={(event) => onFilterChange('ruleset', event.target.value)} value={filters.ruleset}>
              <option value="">All editions</option>
              {options.rulesets.map((ruleset) => <option key={ruleset} value={ruleset}>{encounterRulesetLabel(ruleset)}</option>)}
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}

function readSavedEncounterListHeight() {
  try {
    return Math.min(620, Math.max(260, Number(localStorage.getItem(savedEncounterListHeightKey)) || defaultSavedEncounterListHeight));
  } catch {
    return defaultSavedEncounterListHeight;
  }
}

const asNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function participantPatch(
  encounter: Encounter,
  participant: EncounterParticipant,
  changes: Partial<Pick<EncounterParticipant, 'name' | 'armorClass' | 'maxHitPoints' | 'currentHitPoints' | 'initiative' | 'availabilityOverride' | 'encounterEquipment'>>,
  onUpdateEncounter: (encounter: Encounter) => void
) {
  onUpdateEncounter(patchEncounterParticipant(encounter, participant.id, changes));
}

function likelyWeaponActionIndexes(actions: Record<string, unknown>[]): number[] {
  return actions.flatMap((action, index) => /(?:Melee|Ranged)(?:\s+Weapon)?\s+Attack(?:\s+Roll)?/i.test(typeof action.text === 'string' ? action.text : '') ? [index] : []);
}

function statNumber(entry: CatalogueEntry, key: string): number | null {
  const numberFromValue = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const match = value.match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    }
    if (Array.isArray(value)) {
      for (const candidate of value) {
        const number = numberFromValue(candidate);
        if (number !== null) return number;
      }
      return null;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      for (const candidate of [record.ac, record.average, record.hp, record.value]) {
        const number = numberFromValue(candidate);
        if (number !== null) return number;
      }
    }
    return null;
  };
  return numberFromValue(entry.data[key]);
}

export function EncounterPanel({
  encounters,
  campaignPosition,
  partyLocation = null,
  locationEntities = [],
  worldEvents = [],
  selectedId,
  partyMembers,
  npcEntities = [],
  currentStateByEntityId = new Map(),
  monsters,
  items = [],
  loading,
  syncState,
  hasDriveBackup = false,
  onCreateEncounter,
  onDeleteEncounter,
  onInsertReference,
  onMonsterOpen = () => undefined,
  onSelectEncounter,
  onUpdateEncounter,
  onCreatePartyMember,
  onDeletePartyMember,
  onUpdatePartyMember,
  onEndCombat = () => undefined,
  onResurrectNpc = () => undefined,
  onSetPartyLocation = () => undefined
}: EncounterPanelProps) {
  const [monsterQuery, setMonsterQuery] = useState('');
  const [encounterView, setEncounterView] = useState<EncounterView>('create');
  const [savedListAdjusting, setSavedListAdjusting] = useState(false);
  const [savedListHeight, setSavedListHeight] = useState(readSavedEncounterListHeight);
  const [editingEncounter, setEditingEncounter] = useState(false);
  const [monsterFilters, setMonsterFilters] = useState<EncounterMonsterFilters>(() => ({ ...defaultEncounterMonsterFilters }));
  const [monsterFiltersOpen, setMonsterFiltersOpen] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [partyArmorClass, setPartyArmorClass] = useState('');
  const [partyHitPoints, setPartyHitPoints] = useState('');
  const [hitPointChanges, setHitPointChanges] = useState<Record<string, string>>({});
  const [hitPointEditorId, setHitPointEditorId] = useState<string | null>(null);
  const [statEditor, setStatEditor] = useState<StatEditor>(null);
  const [equipmentEditor, setEquipmentEditor] = useState<EquipmentEditor>(null);
  const [equipmentToAdd, setEquipmentToAdd] = useState('');
  const [visibleMonsterCount, setVisibleMonsterCount] = useState(MONSTER_RESULTS_PAGE_SIZE);
  const [combatantPicker, setCombatantPicker] = useState<CombatantPicker>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerMonthIndex, setDatePickerMonthIndex] = useState(0);
  const [datePickerYear, setDatePickerYear] = useState(641);
  const [datePickerEra, setDatePickerEra] = useState<BelentorDate['era']>('AA');
  const [draggingParticipantId, setDraggingParticipantId] = useState<string | null>(null);
  const [touchDropTargetId, setTouchDropTargetId] = useState<string | null>(null);
  const draggedParticipantId = useRef<string | null>(null);
  const pointerDragSourceId = useRef<string | null>(null);
  const pointerDragTargetId = useRef<string | null>(null);
  const selected = encounters.find((encounter) => encounter.id === selectedId) ?? encounters[0] ?? null;
  const positionActive = encounters.find((encounter) => encounter.id === campaignPosition?.activeEncounterId);
  const positionPrevious = encounters.find((encounter) => encounter.id === campaignPosition?.previousEncounterId);
  const positionNext = encounters.find((encounter) => encounter.id === campaignPosition?.nextEncounterId);
  const storage = campaignStoragePresentation(syncState, hasDriveBackup);
  const unavailableParticipants = selected?.status === 'completed' ? [] : (selected?.participants ?? []).filter((participant) => participant.entityId && currentStateByEntityId.get(participant.entityId)?.fields.status?.value === 'dead' && !participant.availabilityOverride);
  const orderedParticipants = selected ? sortCombatants(selected.participants.filter((participant) => !unavailableParticipants.some((item) => item.id === participant.id))) : [];
  const availableNpcEntities = npcEntities.filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value !== 'dead');
  const unavailableNpcEntities = npcEntities.filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value === 'dead');

  useEffect(() => {
    if (!monsterFiltersOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMonsterFiltersOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [monsterFiltersOpen]);

  const monsterMetadataById = useMemo(
    () => new Map(monsters.map((monster) => [monster.id, monsterMetadataForCatalogueEntry(monster)] as const)),
    [monsters]
  );
  const monsterFilterOptions = useMemo(() => {
    const sources = new Set<string>();
    const importSources = new Set<string>();
    const types = new Set<string>();
    const crs = new Set<string>();
    const sizes = new Set<string>();
    const environments = new Set<string>();
    const rulesets = new Set<string>();

    monsters.forEach((monster) => {
      const metadata = monsterMetadataById.get(monster.id) ?? emptyMonsterMetadata;
      metadata.sources.forEach((source) => sources.add(source));
      if (metadata.importSource) importSources.add(metadata.importSource);
      if (metadata.type) types.add(metadata.type);
      if (metadata.cr) crs.add(metadata.cr);
      if (metadata.size) sizes.add(metadata.size);
      metadata.environments.forEach((environment) => environments.add(environment));
      if (monster.ruleset.trim()) rulesets.add(monster.ruleset.trim());
    });

    return {
      sources: Array.from(sources).sort((left, right) => monsterCollator.compare(left, right)),
      importSources: Array.from(importSources).sort((left, right) => monsterCollator.compare(left, right)),
      types: Array.from(types).sort((left, right) => monsterCollator.compare(left, right)),
      crs: Array.from(crs).sort((left, right) => compareOptionalNumbers(challengeRatingValue(left), challengeRatingValue(right)) || monsterCollator.compare(left, right)),
      sizes: Array.from(sizes).sort((left, right) => compareOptionalNumbers(monsterSizeRank(left), monsterSizeRank(right)) || monsterCollator.compare(left, right)),
      environments: Array.from(environments).sort((left, right) => monsterCollator.compare(left, right)),
      rulesets: Array.from(rulesets).sort((left, right) => monsterCollator.compare(left, right))
    };
  }, [monsterMetadataById, monsters]);
  const monsterMatches = useMemo(() => {
    const terms = monsterQuery.trim().toLowerCase();
    const filtered = monsters.filter((monster) => {
      const metadata = monsterMetadataById.get(monster.id) ?? emptyMonsterMetadata;
      const matchesText = !terms || [
        monster.name,
        monster.source,
        monster.ruleset,
        ...metadata.sources,
        metadata.type,
        metadata.cr,
        metadata.size,
        ...metadata.environments,
        ...entrySummary(monster)
      ].join(' ').toLowerCase().includes(terms);
      return matchesText
        && monsterMatchesFilters(metadata, monsterFilters)
        && (!monsterFilters.ruleset || monster.ruleset === monsterFilters.ruleset);
    });
    return [...filtered].sort((left, right) => {
      const compared = compareMonsterMetadata(
        monsterMetadataById.get(left.id) ?? emptyMonsterMetadata,
        monsterMetadataById.get(right.id) ?? emptyMonsterMetadata,
        monsterFilters.sort
      );
      if (compared) return compared;
      return monsterFilters.sort === 'name-desc'
        ? -monsterCollator.compare(left.name, right.name)
        : monsterCollator.compare(left.name, right.name);
    });
  }, [monsterFilters, monsterMetadataById, monsterQuery, monsters]);
  const visibleMonsterMatches = useMemo(
    () => monsterMatches.slice(0, visibleMonsterCount),
    [monsterMatches, visibleMonsterCount]
  );
  const monstersById = useMemo(() => new Map(monsters.map((monster) => [monster.id, monster])), [monsters]);
  const encounterItems = useMemo(() => encounterEquipmentItems(items), [items]);
  const encounterItemCatalogue = useMemo(() => new Map(items.map((item) => [`item:${item.id}`, item] as const)), [items]);
  const equipmentEditorParticipant = equipmentEditor && selected
    ? selected.participants.find((participant) => participant.id === equipmentEditor.participantId) ?? null
    : null;
  const equipmentEditorMonster = equipmentEditorParticipant?.kind === 'monster' && equipmentEditorParticipant.source?.category === 'monster'
    ? monstersById.get(equipmentEditorParticipant.source.id) ?? null
    : null;
  const equipmentEditorActions = equipmentEditorMonster ? dataRecords(equipmentEditorMonster, 'actions') : [];
  const equipmentEditorItems = equipmentEditorParticipant?.encounterEquipment ?? [];
  const equippedItemIds = new Set(equipmentEditorMonster
    ? resolvedMonsterEquipment(equipmentEditorMonster, equipmentEditorItems).map((item) => item.itemId)
    : []);
  const addedMonsterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const participant of selected?.participants ?? []) {
      if (participant.kind !== 'monster' || participant.source?.category !== 'monster') continue;
      counts.set(participant.source.id, (counts.get(participant.source.id) ?? 0) + 1);
    }
    return counts;
  }, [selected?.participants]);

  const addPartyMember = () => {
    const name = partyName.trim();
    if (!name) return;
    onCreatePartyMember(name, asNumber(partyArmorClass), asNumber(partyHitPoints));
    setPartyName('');
    setPartyArmorClass('');
    setPartyHitPoints('');
  };

  const changeSavedListHeight = (value: number) => {
    const next = Math.min(620, Math.max(260, value));
    setSavedListHeight(next);
    try { localStorage.setItem(savedEncounterListHeightKey, String(next)); } catch { /* local-only preference */ }
  };

  const clearCombatantEditors = () => {
    setHitPointEditorId(null);
    setStatEditor(null);
    setEquipmentEditor(null);
    setEquipmentToAdd('');
  };

  const updateMonsterFilter = <Key extends keyof EncounterMonsterFilters>(key: Key, value: EncounterMonsterFilters[Key]) => {
    setMonsterFilters((current) => ({ ...current, [key]: value }));
    setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE);
  };

  const resetMonsterFilters = () => {
    setMonsterFilters({ ...defaultEncounterMonsterFilters });
    setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE);
  };

  const activeMonsterFilterChips: Array<{ key: keyof EncounterMonsterFilters; label: string; value: string }> = [
    { key: 'source' as const, label: 'Book', value: monsterFilters.source },
    { key: 'importSource' as const, label: 'Import', value: monsterFilters.importSource },
    { key: 'type' as const, label: 'Type', value: monsterFilters.type ? titleCaseMonsterValue(monsterFilters.type) : '' },
    { key: 'cr' as const, label: 'CR', value: monsterFilters.cr },
    { key: 'size' as const, label: 'Size', value: monsterFilters.size ? monsterSizeLabel(monsterFilters.size) : '' },
    { key: 'environment' as const, label: 'Environment', value: monsterFilters.environment ? titleCaseMonsterValue(monsterFilters.environment) : '' },
    { key: 'ruleset' as const, label: 'Edition', value: monsterFilters.ruleset ? encounterRulesetLabel(monsterFilters.ruleset) : '' },
    ...(monsterFilters.sort !== defaultEncounterMonsterFilters.sort
      ? [{ key: 'sort' as const, label: 'Sort', value: monsterSortLabel(monsterFilters.sort) }]
      : [])
  ].filter((chip) => Boolean(chip.value));
  const activeMonsterFilterCount = activeMonsterFilterChips.length;
  const hasActiveMonsterFilters = activeMonsterFilterCount > 0;
  const clearMonsterFilter = (key: keyof EncounterMonsterFilters) => {
    switch (key) {
      case 'source': updateMonsterFilter('source', ''); break;
      case 'importSource': updateMonsterFilter('importSource', ''); break;
      case 'type': updateMonsterFilter('type', ''); break;
      case 'cr': updateMonsterFilter('cr', ''); break;
      case 'size': updateMonsterFilter('size', ''); break;
      case 'environment': updateMonsterFilter('environment', ''); break;
      case 'ruleset': updateMonsterFilter('ruleset', ''); break;
      case 'sort': updateMonsterFilter('sort', defaultEncounterMonsterFilters.sort); break;
    }
  };

  const closeCombatantPicker = () => {
    setMonsterFiltersOpen(false);
    setCombatantPicker(null);
  };

  const closeEquipmentEditor = () => {
    setEquipmentEditor(null);
    setEquipmentToAdd('');
  };

  const openEquipmentEditor = (participant: EncounterParticipant) => {
    if (participant.kind !== 'monster' || !participant.source) return;
    setHitPointEditorId(null);
    setStatEditor(null);
    setEquipmentToAdd('');
    setEquipmentEditor({ participantId: participant.id });
  };

  const setEncounterEquipment = (participant: EncounterParticipant, equipment: MonsterEquipment[]) => {
    if (!selected) return;
    const monster = participant.kind === 'monster' && participant.source?.category === 'monster'
      ? monstersById.get(participant.source.id)
      : null;
    if (!monster) {
      participantPatch(selected, participant, { encounterEquipment: equipment }, onUpdateEncounter);
      return;
    }
    const before = resolvedEncounterMonsterStatBlock(monster, encounterItemCatalogue, participant.encounterEquipment);
    const after = resolvedEncounterMonsterStatBlock(monster, encounterItemCatalogue, equipment);
    const armorClassDelta = (statNumber(after, 'ac') ?? 0) - (statNumber(before, 'ac') ?? 0);
    const hitPointDelta = (statNumber(after, 'hp') ?? 0) - (statNumber(before, 'hp') ?? 0);
    const armorClass = participant.armorClass === null ? null : Math.max(0, participant.armorClass + armorClassDelta);
    const maxHitPoints = participant.maxHitPoints === null ? null : Math.max(0, participant.maxHitPoints + hitPointDelta);
    const currentHitPoints = participant.currentHitPoints === null
      ? null
      : Math.max(0, Math.min(maxHitPoints ?? Number.POSITIVE_INFINITY, participant.currentHitPoints + hitPointDelta));
    participantPatch(selected, participant, { encounterEquipment: equipment, armorClass, maxHitPoints, currentHitPoints }, onUpdateEncounter);
  };

  const addEncounterEquipment = () => {
    if (!equipmentEditorParticipant || !equipmentEditorMonster || !equipmentToAdd) return;
    if (equippedItemIds.has(equipmentToAdd)) return;
    const equippedItem = encounterItems.find((item) => item.id === equipmentToAdd);
    const targetIndexes = magicWeaponForItem(equippedItem) ? likelyWeaponActionIndexes(equipmentEditorActions) : [];
    setEncounterEquipment(equipmentEditorParticipant, [
      ...equipmentEditorItems,
      { itemId: equipmentToAdd, actionIndexes: targetIndexes.length === 1 ? targetIndexes : [] }
    ]);
    setEquipmentToAdd('');
  };

  const removeEncounterEquipment = (itemId: string) => {
    if (!equipmentEditorParticipant) return;
    setEncounterEquipment(equipmentEditorParticipant, equipmentEditorItems.filter((item) => item.itemId !== itemId));
  };

  const toggleEncounterEquipmentAction = (itemId: string, actionIndex: number, checked: boolean) => {
    if (!equipmentEditorParticipant) return;
    const next = equipmentEditorItems.map((item) => {
      const actionIndexes = item.actionIndexes ?? [];
      if (item.itemId === itemId) {
        return { ...item, actionIndexes: checked ? [...new Set([...actionIndexes, actionIndex])] : actionIndexes.filter((index) => index !== actionIndex) };
      }
      return checked ? { ...item, actionIndexes: actionIndexes.filter((index) => index !== actionIndex) } : item;
    });
    setEncounterEquipment(equipmentEditorParticipant, next);
  };

  const openCombatantPicker = (picker: Exclude<CombatantPicker, null>) => {
    setMonsterFiltersOpen(false);
    setCombatantPicker(picker);
  };

  /** On touch screens, close the large picker before the tracker reflows. This
   * avoids leaving an inert scroll layer above the newly added combatant. */
  const addCombatantAndClosePicker = (next: Encounter) => {
    onUpdateEncounter(next);
    closeCombatantPicker();
    setMonsterQuery('');
    setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE);
    clearCombatantEditors();
  };

  const addOneMonster = (monster: CatalogueEntry) => {
    if (!selected) return;
    onUpdateEncounter(addMonstersToEncounter(selected, monster, 1));
    clearCombatantEditors();
  };

  const selectEncounter = (id: string) => {
    setIsEditingName(false);
    closeCombatantPicker();
    clearCombatantEditors();
    onSelectEncounter(id);
  };

  const openEncounterEditor = (id: string) => {
    selectEncounter(id);
    setEncounterView('create');
    setEditingEncounter(true);
  };

  const createEncounter = () => {
    onCreateEncounter();
    setEncounterView('create');
    window.setTimeout(() => setEditingEncounter(true), 0);
  };

  const startEditingName = () => {
    if (!selected) return;
    setNameDraft(selected.name);
    setIsEditingName(true);
  };

  const saveEncounterName = () => {
    if (!selected) return;
    const name = nameDraft.replace(/[\r\n]/g, ' ').trim() || 'Untitled encounter';
    if (name !== selected.name) onUpdateEncounter(touchEncounter(selected, { name }));
    setIsEditingName(false);
  };

  const updateEncounterDate = (patch: Partial<BelentorDate>) => {
    if (!selected) return;
    const currentDate = selected.date ?? defaultEncounterDate;
    onUpdateEncounter(touchEncounter(selected, { date: { ...currentDate, ...patch } }));
  };

  const openDatePicker = () => {
    const date = selected?.date ?? defaultEncounterDate;
    setDatePickerMonthIndex(Math.max(0, belentorMonths.findIndex(({ name }) => name === date.month)));
    setDatePickerYear(date.year);
    setDatePickerEra(date.era);
    setIsDatePickerOpen(true);
  };

  const moveDatePickerMonth = (direction: -1 | 1) => {
    setDatePickerMonthIndex((current) => {
      const next = current + direction;
      if (next < 0) {
        setDatePickerYear((year) => Math.max(0, year - 1));
        return belentorMonths.length - 1;
      }
      if (next >= belentorMonths.length) {
        setDatePickerYear((year) => Math.min(9999, year + 1));
        return 0;
      }
      return next;
    });
  };

  const selectEncounterDate = (day: number) => {
    if (!selected) return;
    onUpdateEncounter(touchEncounter(selected, {
      date: { day, month: belentorMonths[datePickerMonthIndex].name, year: datePickerYear, era: datePickerEra }
    }));
    setIsDatePickerOpen(false);
  };

  const applyHitPointChange = (participant: EncounterParticipant, mode: 'damage' | 'healing' = 'damage') => {
    if (!selected) return;
    const entered = asNumber(hitPointChanges[participant.id] ?? '');
    if (entered === null || entered === 0) return;
    const amount = Math.abs(entered);
    const change = mode === 'damage' ? -amount : amount;
    onUpdateEncounter(adjustEncounterParticipantHitPoints(selected, participant.id, change));
    setHitPointChanges((current) => ({ ...current, [participant.id]: '' }));
    setHitPointEditorId(null);
  };

  const canAdjustHitPoints = (participant: EncounterParticipant) => participant.currentHitPoints !== null || participant.maxHitPoints !== null;

  const openStatEditor = (participant: EncounterParticipant, field: StatField) => {
    setHitPointEditorId(null);
    setStatEditor({ participantId: participant.id, field, value: String(participant[field] ?? '') });
  };

  const saveStatEditor = () => {
    if (!selected || !statEditor) return;
    const participant = selected.participants.find((item) => item.id === statEditor.participantId);
    if (!participant) {
      setStatEditor(null);
      return;
    }
    const value = asNumber(statEditor.value);
    const changes = statEditor.field === 'initiative'
      ? { initiative: value }
      : statEditor.field === 'armorClass'
        ? { armorClass: value }
        : {
            maxHitPoints: value === null ? null : Math.max(0, value),
            currentHitPoints: value === null
              ? null
              : participant.currentHitPoints === null
                ? Math.max(0, value)
                : Math.min(participant.currentHitPoints, Math.max(0, value))
          };
    participantPatch(selected, participant, changes, onUpdateEncounter);
    setStatEditor(null);
  };

  const reorderCombatant = (sourceId: string, targetId: string) => {
    if (!selected || sourceId === targetId) return;
    const sourceIndex = orderedParticipants.findIndex((participant) => participant.id === sourceId);
    const targetIndex = orderedParticipants.findIndex((participant) => participant.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...orderedParticipants];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    onUpdateEncounter(reorderEncounterParticipants(selected, next.map((participant) => participant.id)));
  };

  const resetPointerDrag = () => {
    pointerDragSourceId.current = null;
    pointerDragTargetId.current = null;
    setDraggingParticipantId(null);
    setTouchDropTargetId(null);
  };

  const includedPartyMemberIds = new Set(
    selected?.participants.flatMap((participant) => participant.partyMemberId ? [participant.partyMemberId] : []) ?? []
  );
  const includedNpcEntityIds = new Set(
    selected?.participants.flatMap((participant) => participant.entityId ? [participant.entityId] : []) ?? []
  );

  return (
    <main className={`encounter-page encounter-view-${encounterView}${editingEncounter ? ' is-editing' : ''}`} aria-label="Combat encounters">
      <header className="encounter-page-header">
        <div>
          <p className="eyebrow">Combat toolkit</p>
          <h1>Encounters</h1>
          <p>Build a fight from the offline SRD catalogue, then run initiative and hit points in one place.</p>
        </div>
        <div className="page-header-actions">
          <div className="encounter-view-tabs" role="tablist" aria-label="Encounter view">
            <button aria-selected={encounterView === 'create'} className={encounterView === 'create' ? 'is-selected' : ''} onClick={() => setEncounterView('create')} role="tab" type="button">Create</button>
            <button aria-selected={encounterView === 'run'} className={encounterView === 'run' ? 'is-selected' : ''} onClick={() => setEncounterView('run')} role="tab" type="button">Run combat</button>
          </div>
          <span className={`sync-badge sync-${storage.tone}`} title={storage.title}>{storage.label}</span>
          <button className="primary-button" onClick={createEncounter} type="button">New encounter</button>
        </div>
      </header>

      <section className="encounter-workspace">
        <aside className="encounter-library" aria-label="Saved encounters" style={{ '--saved-encounter-list-height': `${savedListHeight}px` } as CSSProperties}>
          <div className="encounter-sidebar-heading"><span>Saved encounters</span><div><button aria-expanded={savedListAdjusting} className="encounter-list-size-button" onClick={() => setSavedListAdjusting((open) => !open)} type="button">Resize</button><span>{encounters.length}</span></div></div>
          {savedListAdjusting && (
            <div className="encounter-list-size-controls">
              <label>List height<input aria-label="Saved encounters list height" max="620" min="260" onChange={(event) => changeSavedListHeight(Number(event.target.value))} type="range" value={savedListHeight} /><output>{savedListHeight}px</output></label>
              <button onClick={() => changeSavedListHeight(defaultSavedEncounterListHeight)} type="button">Reset</button>
            </div>
          )}
          <div className="encounter-list">
            {encounters.map((encounter) => (
              <article className={`encounter-list-item ${selected?.id === encounter.id ? 'is-selected' : ''}`} key={encounter.id}>
                <button aria-label={`Edit ${encounter.name || 'untitled encounter'}`} className="encounter-list-main" onClick={() => openEncounterEditor(encounter.id)} type="button">
                  <strong className="encounter-list-name">{encounter.name || 'Untitled encounter'}</strong>
                  <span>{encounter.participants.length} combatant{encounter.participants.length === 1 ? '' : 's'} · {encounter.status}</span>
                  {encounter.date && <small>{formatBelentorDate(encounter.date)}</small>}
                </button>
                <div className="encounter-list-actions">
                  <button aria-label={`Run ${encounter.name || 'encounter'}`} onClick={() => { selectEncounter(encounter.id); setEncounterView('run'); }} title="Run combat" type="button">Run</button>
                  <button aria-label={`Delete ${encounter.name || 'encounter'}`} className="quiet-danger" onClick={() => onDeleteEncounter(encounter)} title="Delete" type="button">×</button>
                  <button aria-label={`Edit ${encounter.name || 'encounter'}`} className="encounter-list-edit-button" onClick={() => openEncounterEditor(encounter.id)} title="Edit encounter" type="button">✎</button>
                </div>
              </article>
            ))}
            {!encounters.length && <p className="empty-panel">Create an encounter to start a combat setup.</p>}
          </div>

          <details className="party-roster">
            <summary>Current party <span>{partyMembers.length}</span></summary>
            <div className="encounter-sidebar-heading"><span>Current party</span><span>{partyMembers.length}</span></div>
            <p className="encounter-helper">New encounters snapshot this roster; later roster changes never overwrite a running fight.</p>
            <div className="party-member-list">
              {partyMembers.map((member) => (
                <div className="party-member" key={member.id}>
                  <input aria-label={`${member.name || 'Party member'} name`} onBlur={(event) => { if (!event.target.value.trim()) onUpdatePartyMember({ ...member, name: 'Unnamed character' }); }} onChange={(event) => onUpdatePartyMember({ ...member, name: event.target.value })} value={member.name} />
                  <label>AC<input aria-label={`${member.name || 'Party member'} armor class`} min="0" onChange={(event) => onUpdatePartyMember({ ...member, armorClass: asNumber(event.target.value) })} type="number" value={member.armorClass ?? ''} /></label>
                  <label>HP<input aria-label={`${member.name || 'Party member'} maximum hit points`} min="0" onChange={(event) => onUpdatePartyMember({ ...member, maxHitPoints: asNumber(event.target.value) })} type="number" value={member.maxHitPoints ?? ''} /></label>
                  <button aria-label={`Delete ${member.name || 'party member'} from party`} className="quiet-danger" onClick={() => onDeletePartyMember(member)} type="button">×</button>
                </div>
              ))}
            </div>
            <div className="party-member-form">
              <input aria-label="New party member name" onChange={(event) => setPartyName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addPartyMember(); }} placeholder="Character name" value={partyName} />
              <input aria-label="New party member armor class" min="0" onChange={(event) => setPartyArmorClass(event.target.value)} placeholder="AC" type="number" value={partyArmorClass} />
              <input aria-label="New party member maximum hit points" min="0" onChange={(event) => setPartyHitPoints(event.target.value)} placeholder="Max HP" type="number" value={partyHitPoints} />
              <button disabled={!partyName.trim()} onClick={addPartyMember} type="button">Add character</button>
            </div>
          </details>
        </aside>

        <section className="encounter-setup" aria-live="polite">
          {!selected ? (
            <p className="empty-panel">Select or create an encounter.</p>
          ) : (
            <>
              <div className="encounter-title-row">
                {isEditingName ? (
                  <div className="encounter-name-editor">
                    <label className="visually-hidden" htmlFor="encounter-name">Encounter name</label>
                    <input
                      autoFocus
                      id="encounter-name"
                      onChange={(event) => setNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          saveEncounterName();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setIsEditingName(false);
                        }
                      }}
                      value={nameDraft}
                    />
                    <button className="primary-button" onClick={saveEncounterName} type="button">Save</button>
                    <button className="encounter-inline-button" onClick={() => setIsEditingName(false)} type="button">Cancel</button>
                  </div>
                ) : (
                  <div className="encounter-title-display">
                    <h2>{selected.name || 'Untitled encounter'}</h2>
                    <button
                      aria-label="Edit encounter name"
                      className="encounter-icon-button"
                      onClick={startEditingName}
                      title="Edit encounter name"
                      type="button"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M4 20h4l11-11-4-4L4 16v4Zm12.5-16.5 4 4 1.1-1.1a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0L16.5 3.5Z" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="encounter-progress-controls">
                  <div className="encounter-date-control">
                    <span>When</span>
                    <div className="encounter-date-actions">
                      <button className="encounter-add-date" onClick={openDatePicker} type="button">{selected.date ? formatBelentorDate(selected.date) : 'Set date'}</button>
                      {selected.date && <button aria-label="Clear encounter date" className="encounter-date-clear" onClick={() => onUpdateEncounter(touchEncounter(selected, { date: undefined }))} title="Clear date" type="button">×</button>}
                    </div>
                  </div>
                  <label>
                    Progress
                    <select
                      aria-label="Encounter progress"
                      onChange={(event) => onUpdateEncounter(touchEncounter(selected, {
                        status: event.target.value as Encounter['status'],
                        activeCombatantId: event.target.value === 'active' ? selected.activeCombatantId : null
                      }))}
                      value={selected.status}
                    >
                      <option value="not-started">Not started</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </label>
                  <label className="encounter-optional-toggle">
                    <input
                      checked={selected.optional}
                      onChange={(event) => onUpdateEncounter(touchEncounter(selected, { optional: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>Optional encounter</span>
                  </label>
                </div>
              </div>

              <div className="encounter-actions" aria-label="Encounter actions">
                <button className="primary-button" onClick={() => onInsertReference(selected)} type="button">Place in brew</button>
              </div>

              <section className={`encounter-section encounter-tracker-summary ${selected.participants.length ? '' : 'is-empty'}`}>
                <div className="encounter-section-heading">
                  <div><p className="eyebrow">Tracker</p><h2>{selected.participants.length} combatant{selected.participants.length === 1 ? '' : 's'}</h2></div>
                <button className="encounter-add-button tracker-add-button" onClick={() => openCombatantPicker('monster')} type="button">Add combatants</button>
                </div>
                <p className="encounter-helper">
                  {selected.participants.length
                    ? 'Added combatants are listed below. Set their initiative and order in Run combat.'
                    : 'Add party members, confirmed Worldbuilding NPCs, or catalogue monsters to prepare this encounter.'}
                </p>
                {selected.participants.length > 0 && (
                  <div className="encounter-combatant-summary-list" aria-label="Combatants in this encounter">
                    {selected.participants.map((participant) => (
                      <div className="encounter-combatant-summary" key={participant.id}>
                        <span className={`combatant-kind kind-${participant.kind}`}>{participant.kind}</span>
                        <strong>{participant.name || 'Unnamed combatant'}</strong>
                        {participant.kind === 'monster' && participant.source?.category === 'monster' && (
                          <button aria-label={`Edit encounter equipment for ${participant.name || 'monster'}`} className="encounter-combatant-equipment-button" onClick={() => openEquipmentEditor(participant)} type="button">
                            Equipment{participant.encounterEquipment?.length ? ` (${participant.encounterEquipment.length})` : ''}
                          </button>
                        )}
                        <button aria-label={`Remove ${participant.name || 'combatant'} from encounter`} className="quiet-danger" onClick={() => onUpdateEncounter(removeEncounterParticipant(selected, participant.id))} type="button">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {combatantPicker && (
                <>
                  <div
                    className="encounter-combatant-picker-backdrop"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) closeCombatantPicker();
                    }}
                    role="presentation"
                  >
                  <section aria-label="Add combatant" aria-modal="true" className="encounter-picker" role="dialog">
                  <div className="encounter-picker-header">
                    <div>
                      <h3>Add combatant</h3>
                      <span>
                        {combatantPicker === 'party'
                          ? `${partyMembers.length} party member${partyMembers.length === 1 ? '' : 's'}`
                          : combatantPicker === 'npc'
                            ? `${availableNpcEntities.length} available NPC${availableNpcEntities.length === 1 ? '' : 's'}`
                            : loading
                              ? 'Loading…'
                              : `${monsterMatches.length.toLocaleString()} monster match${monsterMatches.length === 1 ? '' : 'es'}`}
                      </span>
                    </div>
                    <button aria-label="Close combatant picker" className="encounter-picker-close" onClick={closeCombatantPicker} type="button">×</button>
                  </div>
                  <div className="encounter-picker-tabs" role="tablist" aria-label="Combatant source">
                    <button aria-selected={combatantPicker === 'party'} className={combatantPicker === 'party' ? 'is-selected' : ''} onClick={() => openCombatantPicker('party')} role="tab" type="button">Party</button>
                    <button aria-selected={combatantPicker === 'npc'} className={combatantPicker === 'npc' ? 'is-selected' : ''} onClick={() => openCombatantPicker('npc')} role="tab" type="button">Worldbuilding NPCs</button>
                    <button aria-selected={combatantPicker === 'monster'} className={combatantPicker === 'monster' ? 'is-selected' : ''} onClick={() => openCombatantPicker('monster')} role="tab" type="button">Catalogue</button>
                  </div>

                  {combatantPicker === 'party' ? (
                    <div className="encounter-party-picker">
                      {partyMembers.length > 0 && (
                        <button
                          className="encounter-inline-button"
                          disabled={partyMembers.every((member) => includedPartyMemberIds.has(member.id))}
                          onClick={() => onUpdateEncounter(addPartyMembersToEncounter(selected, partyMembers))}
                          type="button"
                        >
                          Add all missing party members
                        </button>
                      )}
                      {partyMembers.map((member) => {
                        const included = includedPartyMemberIds.has(member.id);
                        return (
                          <div className="encounter-party-choice" key={member.id}>
                            <div><strong>{member.name}</strong><span>AC {member.armorClass ?? '—'} · HP {member.maxHitPoints ?? '—'}</span></div>
                            <button disabled={included} onClick={() => onUpdateEncounter(addPartyMembersToEncounter(selected, [member]))} type="button">{included ? 'Added' : 'Add'}</button>
                          </div>
                        );
                      })}
                      {!partyMembers.length && <p className="empty-panel">Add characters to the current party first.</p>}
                    </div>
                  ) : combatantPicker === 'npc' ? (
                    <div className="encounter-party-picker encounter-npc-picker">
                      {availableNpcEntities.map((entity) => {
                        const included = includedNpcEntityIds.has(entity.id);
                        const status = currentStateByEntityId.get(entity.id)?.fields.status?.value;
                        return (
                          <div className="encounter-party-choice" key={entity.id}>
                            <div>
                              <strong>{entity.name}</strong>
                              <span>{status === null || status === undefined ? 'No current status' : `Current status: ${String(status)}`}</span>
                            </div>
                            <button disabled={included} onClick={() => addCombatantAndClosePicker(addNpcToEncounter(selected, entity))} type="button">{included ? 'Added' : 'Add'}</button>
                          </div>
                        );
                      })}
                      {!availableNpcEntities.length && <p className="empty-panel">No available Worldbuilding NPCs. Dead NPCs are retained for history.</p>}
                      {unavailableNpcEntities.length > 0 && <section className="unavailable-combatants"><h4>Unavailable combatants</h4>{unavailableNpcEntities.map((entity) => <div className="encounter-party-choice" key={entity.id}><div><strong>{entity.name}</strong><span>Dead · preserved in historical encounters</span></div><button onClick={() => onResurrectNpc(entity.id)} type="button">Resurrect</button></div>)}</section>}
                    </div>
                  ) : (
                    <>
                      <input
                        className="encounter-search"
                        onChange={(event) => {
                          setMonsterQuery(event.target.value);
                          setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE);
                        }}
                        placeholder="Search monsters…"
                        value={monsterQuery}
                      />
                      <div className="encounter-monster-filter-heading">
                        <span>Filter &amp; sort</span>
                        {hasActiveMonsterFilters && <button aria-label="Clear encounter monster filters" className="encounter-monster-filter-clear" onClick={resetMonsterFilters} type="button">Clear filters</button>}
                      </div>
                      <div className="encounter-monster-mobile-filter-summary">
                        <button aria-controls="encounter-monster-filter-dialog" aria-expanded={monsterFiltersOpen} aria-label={hasActiveMonsterFilters ? `Open filters, ${activeMonsterFilterCount} active` : 'Open filters'} className="encounter-monster-filter-trigger" onClick={() => setMonsterFiltersOpen(true)} type="button">Filter &amp; sort{hasActiveMonsterFilters && <span>{activeMonsterFilterCount}</span>}</button>
                        {hasActiveMonsterFilters && <div aria-label="Active encounter monster filters" className="encounter-monster-filter-chip-row">
                          {activeMonsterFilterChips.map((chip) => <button aria-label={`Clear ${chip.label} filter`} className="encounter-monster-filter-chip" key={chip.key} onClick={() => clearMonsterFilter(chip.key)} type="button"><span>{chip.label}: {chip.value}</span><span aria-hidden="true">×</span></button>)}
                        </div>}
                      </div>
                      <EncounterMonsterFilterControls filters={monsterFilters} onFilterChange={updateMonsterFilter} options={monsterFilterOptions} variant="inline" />
                      <div className="encounter-monster-results">
                        {visibleMonsterMatches.map((monster) => (
                          <div className="encounter-monster-result" key={monster.id}>
                            <button aria-label={`Open ${monster.name} stat block`} className="encounter-monster-open" onClick={() => onMonsterOpen(monster)} type="button"><strong>{monster.name}</strong><span>{entrySummary(monster).join(' · ') || 'SRD monster'}</span></button>
                            <div className="encounter-monster-actions">
                              {(addedMonsterCounts.get(monster.id) ?? 0) > 0 && <span aria-label={`${addedMonsterCounts.get(monster.id)} ${monster.name} added`} className="encounter-monster-count">×{addedMonsterCounts.get(monster.id)}</span>}
                              <button onClick={() => addOneMonster(monster)} type="button">Add</button>
                            </div>
                          </div>
                        ))}
                        {!loading && !monsterMatches.length && <p className="empty-panel">No monsters match that search.</p>}
                        {visibleMonsterMatches.length < monsterMatches.length && (
                          <button
                            className="encounter-monster-more"
                            onClick={() => setVisibleMonsterCount((count) => count + MONSTER_RESULTS_PAGE_SIZE)}
                            type="button"
                          >
                            Show {Math.min(MONSTER_RESULTS_PAGE_SIZE, monsterMatches.length - visibleMonsterMatches.length)} more ({(monsterMatches.length - visibleMonsterMatches.length).toLocaleString()} remaining)
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  </section>
                  </div>
                {combatantPicker === 'monster' && monsterFiltersOpen && (
                  <div
                    aria-labelledby="encounter-monster-filter-dialog-title"
                    aria-modal="true"
                    className="encounter-monster-filter-backdrop"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) setMonsterFiltersOpen(false);
                    }}
                    role="dialog"
                  >
                    <section className="encounter-monster-filter-dialog" id="encounter-monster-filter-dialog" onMouseDown={(event) => event.stopPropagation()}>
                      <header>
                        <div>
                          <p className="eyebrow">Catalogue monsters</p>
                          <h3 id="encounter-monster-filter-dialog-title">Filters &amp; sort</h3>
                          <p aria-live="polite">{monsterMatches.length.toLocaleString()} monster{monsterMatches.length === 1 ? '' : 's'} shown</p>
                        </div>
                        <button aria-label="Close encounter monster filters" onClick={() => setMonsterFiltersOpen(false)} type="button">×</button>
                      </header>
                      <EncounterMonsterFilterControls filters={monsterFilters} onFilterChange={updateMonsterFilter} options={monsterFilterOptions} variant="drawer" />
                      <footer className="encounter-monster-filter-dialog-actions">
                        {hasActiveMonsterFilters && <button aria-label="Clear encounter monster filters" className="encounter-monster-filter-reset" onClick={resetMonsterFilters} type="button">Clear filters</button>}
                        <button className="primary-button" onClick={() => setMonsterFiltersOpen(false)} type="button">Show {monsterMatches.length.toLocaleString()} monster{monsterMatches.length === 1 ? '' : 's'}</button>
                      </footer>
                    </section>
                  </div>
                )}
                </>
              )}
              {unavailableParticipants.length > 0 && (
                <section className="unavailable-combatants" aria-label="Unavailable combatants">
                  <h3>Unavailable combatants</h3><p>Dead NPCs stay in this encounter record but do not enter future initiative.</p>
                  {unavailableParticipants.map((participant) => <div className="encounter-party-choice" key={participant.id}><div><strong>{participant.name}</strong><span>Dead · choose an explicit exception</span></div><button onClick={() => participantPatch(selected, participant, { availabilityOverride: 'flashback' }, onUpdateEncounter)} type="button">Flashback</button><button onClick={() => participantPatch(selected, participant, { availabilityOverride: 'temporary' }, onUpdateEncounter)} type="button">Temporary return</button>{participant.entityId && <button onClick={() => onResurrectNpc(participant.entityId!)} type="button">Resurrect</button>}</div>)}
                </section>
              )}
            </>
          )}
      </section>

      {isDatePickerOpen && (
        <div className="encounter-date-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDatePickerOpen(false); }}>
          <section aria-label="Choose encounter date" aria-modal="true" className="encounter-date-picker" role="dialog">
            <header>
              <div><span>When does this happen?</span><strong>{belentorMonths[datePickerMonthIndex].name} {datePickerYear} {datePickerEra}</strong></div>
              <button aria-label="Close date picker" onClick={() => setIsDatePickerOpen(false)} type="button">×</button>
            </header>
            <div className="encounter-date-picker-controls">
              <button aria-label="Previous month" onClick={() => moveDatePickerMonth(-1)} type="button">←</button>
              <label>Month<select onChange={(event) => setDatePickerMonthIndex(Number(event.target.value))} value={datePickerMonthIndex}>{belentorMonths.map(({ name }, index) => <option key={name} value={index}>{name}</option>)}</select></label>
              <label>Year<input max="9999" min="0" onChange={(event) => setDatePickerYear(Math.min(9999, Math.max(0, Number(event.target.value) || 0)))} type="number" value={datePickerYear} /></label>
              <label>Era<select onChange={(event) => setDatePickerEra(event.target.value as BelentorDate['era'])} value={datePickerEra}><option value="AA">AA</option><option value="BA">BA</option></select></label>
              <button aria-label="Next month" onClick={() => moveDatePickerMonth(1)} type="button">→</button>
            </div>
            <div className="encounter-date-day-grid" role="grid" aria-label={`${belentorMonths[datePickerMonthIndex].name} days`}>
              {Array.from({ length: 30 }, (_, index) => index + 1).map((day) => <button aria-label={`${day} ${belentorMonths[datePickerMonthIndex].name}, ${datePickerYear} ${datePickerEra}`} className={selected?.date?.day === day && selected.date.month === belentorMonths[datePickerMonthIndex].name && selected.date.year === datePickerYear && selected.date.era === datePickerEra ? 'is-selected' : ''} key={day} onClick={() => selectEncounterDate(day)} role="gridcell" type="button"><span>{day}</span><small>Day {((day - 1) % 10) + 1}</small></button>)}
            </div>
            <footer>Pick a day to set the encounter date.</footer>
          </section>
        </div>
      )}

      {equipmentEditorParticipant && equipmentEditorMonster && (
        <div className="encounter-equipment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEquipmentEditor(); }} role="presentation">
          <section aria-label={`Equipment for ${equipmentEditorParticipant.name || equipmentEditorMonster.name}`} aria-modal="true" className="encounter-equipment-dialog" role="dialog">
            <header>
              <div>
                <p className="eyebrow">Encounter-only equipment</p>
                <h3>{equipmentEditorParticipant.name || equipmentEditorMonster.name}</h3>
                <p>These changes apply only to this combatant in “{selected?.name}”. The Compendium monster stays unchanged.</p>
              </div>
              <button aria-label="Close encounter equipment" onClick={closeEquipmentEditor} type="button">×</button>
            </header>

            <div className="encounter-equipment-add">
              <label>Magic item
                <select aria-label="Add magic item to encounter combatant" onChange={(event) => setEquipmentToAdd(event.target.value)} value={equipmentToAdd}>
                  <option value="">Choose a campaign magic item</option>
                  {encounterItems.filter((item) => !equippedItemIds.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <button disabled={!equipmentToAdd} onClick={addEncounterEquipment} type="button">Add equipment</button>
            </div>

            {!encounterItems.length && <p className="encounter-equipment-hint">Create a campaign-owned Magic item or Magic weapon with an encounter stat change to use it here.</p>}
            {!equipmentEditorItems.length ? (
              <p className="encounter-equipment-empty">No encounter-only equipment is assigned.</p>
            ) : (
              <ul className="encounter-equipment-list">
                {equipmentEditorItems.map((item) => {
                  const equippedItem = encounterItems.find((candidate) => candidate.id === item.itemId);
                  const weapon = magicWeaponForItem(equippedItem);
                  return (
                    <li key={item.itemId}>
                      <div className="encounter-equipment-item-heading">
                        <span><strong>{equippedItem?.name ?? 'Missing magic item'}</strong><small>{equippedItem ? 'Encounter-only' : 'This campaign item is no longer available.'}</small></span>
                        <button aria-label={`Remove ${equippedItem?.name ?? 'magic item'} from ${equipmentEditorParticipant.name || equipmentEditorMonster.name}`} onClick={() => removeEncounterEquipment(item.itemId)} type="button">Remove</button>
                      </div>
                      {weapon && equipmentEditorActions.length > 0 ? (
                        <fieldset className="encounter-equipment-targets">
                          <legend>Applies to Actions</legend>
                          {equipmentEditorActions.map((action, index) => {
                            const actionName = typeof action.name === 'string' && action.name.trim() ? action.name : `Action ${index + 1}`;
                            return <label key={`${actionName}-${index}`}><input checked={item.actionIndexes.includes(index)} onChange={(event) => toggleEncounterEquipmentAction(item.itemId, index, event.target.checked)} type="checkbox" />{actionName}</label>;
                          })}
                        </fieldset>
                      ) : weapon ? <p className="encounter-equipment-hint">This monster has no editable Actions to apply the weapon to.</p> : <p className="encounter-equipment-hint">This item’s stat changes apply to the full Encounter stat block.</p>}
                      {weapon && !item.actionIndexes.length && equipmentEditorActions.length > 0 && <p className="encounter-equipment-hint">Choose an Action before its attack and damage change.</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            <footer><button className="primary-button" onClick={closeEquipmentEditor} type="button">Done</button></footer>
          </section>
        </div>
      )}

      <section className="initiative-panel" aria-label="Initiative tracker">
          <div className="encounter-section-heading">
            <div><p className="eyebrow">Run combat</p><h2>Initiative</h2></div>
            <div className="initiative-run-actions">
              {selected?.activeCombatantId && <span className="initiative-current">Current turn</span>}
              {selected && <button className="primary-button" disabled={!selected.participants.length} onClick={() => onUpdateEncounter(advanceCombatTurn(selected))} type="button">{selected.status === 'active' ? 'Next turn' : 'Start combat'}</button>}
              {selected?.status === 'active' && <button className="encounter-end-button" onClick={() => onEndCombat(selected)} type="button">End combat</button>}
              {selected && <button className="encounter-add-button" onClick={() => openCombatantPicker('monster')} type="button">Add combatant</button>}
            </div>
          </div>
          {!selected ? (
            <p className="empty-panel">Choose an encounter to run combat.</p>
          ) : (
            <div className="initiative-list">
              {orderedParticipants.map((participant) => {
                const sourceMonster = participant.kind === 'monster' && participant.source?.category === 'monster'
                  ? monstersById.get(participant.source.id)
                  : undefined;
                return (
                <article
                  className={`combatant-card ${participant.id === selected.activeCombatantId ? 'is-active' : ''} ${participant.currentHitPoints !== null && participant.currentHitPoints <= 0 ? 'is-defeated' : ''} ${participant.id === draggingParticipantId ? 'is-dragging' : ''} ${participant.id === touchDropTargetId ? 'is-drop-target' : ''}`}
                  data-participant-id={participant.id}
                  key={participant.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = draggedParticipantId.current ?? event.dataTransfer.getData('text/plain');
                    reorderCombatant(sourceId, participant.id);
                    draggedParticipantId.current = null;
                    setDraggingParticipantId(null);
                  }}
                >
                  <button
                    aria-label={`Reorder ${participant.name}. Drag on touch or desktop, or use arrow keys.`}
                    className="combatant-drag-handle"
                    draggable
                    onDragEnd={() => {
                      draggedParticipantId.current = null;
                      setDraggingParticipantId(null);
                    }}
                    onDragStart={(event) => {
                      draggedParticipantId.current = participant.id;
                      setDraggingParticipantId(participant.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', participant.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                      event.preventDefault();
                      onUpdateEncounter(moveEncounterParticipant(selected, participant.id, event.key === 'ArrowUp' ? -1 : 1));
                    }}
                    onPointerCancel={resetPointerDrag}
                    onPointerDown={(event) => {
                      if (event.pointerType === 'mouse') return;
                      event.preventDefault();
                      pointerDragSourceId.current = participant.id;
                      pointerDragTargetId.current = participant.id;
                      draggedParticipantId.current = participant.id;
                      setDraggingParticipantId(participant.id);
                      setTouchDropTargetId(participant.id);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (!pointerDragSourceId.current || event.pointerType === 'mouse') return;
                      event.preventDefault();
                      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-participant-id]');
                      const targetId = target?.dataset.participantId ?? null;
                      if (!targetId) return;
                      pointerDragTargetId.current = targetId;
                      setTouchDropTargetId(targetId);
                    }}
                    onPointerUp={(event) => {
                      if (!pointerDragSourceId.current || event.pointerType === 'mouse') return;
                      event.preventDefault();
                      const sourceId = pointerDragSourceId.current;
                      const targetId = pointerDragTargetId.current;
                      if (targetId) reorderCombatant(sourceId, targetId);
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                      resetPointerDrag();
                    }}
                    title="Press and drag to reorder; ↑ and ↓ also move this combatant"
                    type="button"
                  >
                    ⋮⋮
                  </button>

                  <div className="combatant-card-body">
                    <div className="combatant-title">
                      <button
                        aria-label={`Set ${participant.name} as current turn`}
                        className="turn-marker"
                        onClick={() => onUpdateEncounter(touchEncounter(selected, { activeCombatantId: participant.id, status: 'active' }))}
                        type="button"
                      >
                        {participant.id === selected.activeCombatantId ? '●' : '○'}
                      </button>
                      <input aria-label={`${participant.name} combatant name`} onChange={(event) => participantPatch(selected, participant, { name: event.target.value }, onUpdateEncounter)} value={participant.name} />
                      {sourceMonster && <button aria-label={`Open ${sourceMonster.name} stat block`} className="combatant-statblock-button" onClick={() => onMonsterOpen(sourceMonster, participant.encounterEquipment ?? [])} type="button">Stat</button>}
                      {sourceMonster && <button aria-label={`Edit encounter equipment for ${participant.name}`} className="combatant-equipment-button" onClick={() => openEquipmentEditor(participant)} type="button">Gear{participant.encounterEquipment?.length ? ` (${participant.encounterEquipment.length})` : ''}</button>}
                      <span className={`combatant-kind kind-${participant.kind}`}>{participant.kind}</span>
                      {participant.entityId && (
                        <span className="combatant-world-status">
                          {String(currentStateByEntityId.get(participant.entityId)?.fields.status?.value ?? 'linked')}
                        </span>
                      )}
                    </div>

                    <div className="combatant-summary-row">
                      <button
                        aria-expanded={hitPointEditorId === participant.id}
                        className="combatant-hp-button"
                        onClick={() => {
                          if (!canAdjustHitPoints(participant)) {
                            openStatEditor(participant, 'maxHitPoints');
                            return;
                          }
                          setStatEditor(null);
                          setHitPointEditorId((current) => current === participant.id ? null : participant.id);
                        }}
                        title={canAdjustHitPoints(participant) ? 'Open damage and healing calculator' : 'Set maximum HP first'}
                        type="button"
                      >
                        <span>HP</span>
                        <strong>
                          <b>{participant.currentHitPoints ?? '—'}</b>
                          <small>/ {participant.maxHitPoints ?? '—'}</small>
                        </strong>
                      </button>

                      <div className="combatant-secondary-stats">
                        <button
                          aria-label={`Initiative ${participant.initiative ?? 'not set'}. Edit initiative for ${participant.name}`}
                          className="combatant-stat-button combatant-initiative-button"
                          onClick={() => openStatEditor(participant, 'initiative')}
                          type="button"
                        >
                          <span>Init.</span>
                          <strong>{participant.initiative ?? '—'}</strong>
                        </button>
                        <button
                          aria-label={`Armor class ${participant.armorClass ?? 'not set'}. Edit armor class for ${participant.name}`}
                          className="combatant-stat-button combatant-ac-button"
                          onClick={() => openStatEditor(participant, 'armorClass')}
                          type="button"
                        >
                          <span>AC</span>
                          <strong>{participant.armorClass ?? '—'}</strong>
                        </button>
                      </div>

                      <button aria-label={`Remove ${participant.name} from encounter`} className="quiet-danger combatant-remove-button" onClick={() => onUpdateEncounter(removeEncounterParticipant(selected, participant.id))} type="button">×</button>

                      {statEditor?.participantId === participant.id && (
                        <div className="combatant-stat-editor">
                          <label>
                            {statEditor.field === 'initiative' ? 'Initiative' : statEditor.field === 'armorClass' ? 'Armor class' : 'Maximum HP'}
                            <input
                              aria-label={`Set ${statEditor.field === 'initiative' ? 'initiative' : statEditor.field === 'armorClass' ? 'armor class' : 'maximum HP'} for ${participant.name}`}
                              autoFocus
                              min={statEditor.field === 'initiative' ? undefined : 0}
                              onChange={(event) => setStatEditor({ ...statEditor, value: event.target.value })}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  saveStatEditor();
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  setStatEditor(null);
                                }
                              }}
                              type="number"
                              value={statEditor.value}
                            />
                          </label>
                          <button onClick={saveStatEditor} type="button">Save</button>
                          <button onClick={() => setStatEditor(null)} type="button">Cancel</button>
                        </div>
                      )}

                      {hitPointEditorId === participant.id && (
                        <div className="combatant-hp-calculator">
                          <label>
                            Amount
                            <input
                              aria-label={`${participant.name} HP change`}
                              autoFocus
                              min="0"
                              onChange={(event) => setHitPointChanges((current) => ({ ...current, [participant.id]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  applyHitPointChange(participant, 'damage');
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  setHitPointEditorId(null);
                                }
                              }}
                              placeholder="10"
                              step="1"
                              type="number"
                              value={hitPointChanges[participant.id] ?? ''}
                            />
                          </label>
                          <button className="hp-damage-button" disabled={asNumber(hitPointChanges[participant.id] ?? '') === null || asNumber(hitPointChanges[participant.id] ?? '') === 0} onClick={() => applyHitPointChange(participant, 'damage')} type="button">Damage −</button>
                          <button className="hp-healing-button" disabled={asNumber(hitPointChanges[participant.id] ?? '') === null || asNumber(hitPointChanges[participant.id] ?? '') === 0} onClick={() => applyHitPointChange(participant, 'healing')} type="button">Heal +</button>
                          <small>Enter defaults to damage and subtracts this amount from HP.</small>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
                );
              })}
              {!orderedParticipants.length && <p className="empty-panel">Use Add combatant to add party members, Worldbuilding NPCs, or monsters.</p>}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
