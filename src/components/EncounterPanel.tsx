import { useMemo, useRef, useState } from 'react';
import { dataString, entrySummary } from '../catalogue/presentation';
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
  loading: boolean;
  syncState: SyncState;
  hasDriveBackup?: boolean;
  onCreateEncounter: () => void;
  onDeleteEncounter: (encounter: Encounter) => void;
  onInsertReference: (encounter: Encounter) => void;
  onMonsterOpen?: (monster: CatalogueEntry) => void;
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
type MonsterSort = 'name' | 'cr-ascending' | 'cr-descending' | 'source' | 'type';
type EncounterView = 'entries' | 'run';

const MONSTER_RESULTS_PAGE_SIZE = Number.MAX_SAFE_INTEGER;
const defaultEncounterDate: BelentorDate = { era: 'AA', year: 641, month: 'Quen', day: 1 };

const asNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function challengeRatingNumber(challengeRating: string | undefined) {
  if (!challengeRating) return Number.POSITIVE_INFINITY;
  if (challengeRating.includes('/')) {
    const [numerator, denominator] = challengeRating.split('/').map(Number);
    return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
      ? numerator / denominator
      : Number.POSITIVE_INFINITY;
  }
  const value = Number(challengeRating);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function challengeRatingValue(monster: CatalogueEntry) {
  return challengeRatingNumber(dataString(monster, 'cr')?.trim());
}

function participantPatch(
  encounter: Encounter,
  participant: EncounterParticipant,
  changes: Partial<Pick<EncounterParticipant, 'name' | 'armorClass' | 'maxHitPoints' | 'currentHitPoints' | 'initiative' | 'availabilityOverride'>>,
  onUpdateEncounter: (encounter: Encounter) => void
) {
  onUpdateEncounter(patchEncounterParticipant(encounter, participant.id, changes));
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
  const [encounterView, setEncounterView] = useState<EncounterView>('entries');
  const [monsterSourceFilter, setMonsterSourceFilter] = useState('all');
  const [monsterRulesetFilter, setMonsterRulesetFilter] = useState('all');
  const [monsterCrFilter, setMonsterCrFilter] = useState('all');
  const [monsterTypeFilter, setMonsterTypeFilter] = useState('all');
  const [monsterSort, setMonsterSort] = useState<MonsterSort>('name');
  const [partyName, setPartyName] = useState('');
  const [partyArmorClass, setPartyArmorClass] = useState('');
  const [partyHitPoints, setPartyHitPoints] = useState('');
  const [hitPointChanges, setHitPointChanges] = useState<Record<string, string>>({});
  const [hitPointEditorId, setHitPointEditorId] = useState<string | null>(null);
  const [statEditor, setStatEditor] = useState<StatEditor>(null);
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
  const monsterSourceOptions = useMemo(
    () => [...new Set(monsters.map((monster) => monster.source.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [monsters]
  );
  const monsterRulesetOptions = useMemo(
    () => [...new Set(monsters.map((monster) => monster.ruleset.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [monsters]
  );
  const monsterCrOptions = useMemo(
    () => [...new Set(monsters.map((monster) => dataString(monster, 'cr')?.trim()).filter((value): value is string => Boolean(value)))].sort((left, right) => challengeRatingNumber(left) - challengeRatingNumber(right) || left.localeCompare(right)),
    [monsters]
  );
  const monsterTypeOptions = useMemo(
    () => [...new Set(monsters.map((monster) => dataString(monster, 'type')?.trim()).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right)),
    [monsters]
  );
  const monsterMatches = useMemo(() => {
    const terms = monsterQuery.trim().toLowerCase();
    const filtered = monsters.filter((monster) => {
      const type = dataString(monster, 'type')?.trim() ?? '';
      const cr = dataString(monster, 'cr')?.trim() ?? '';
      const matchesText = !terms || [monster.name, monster.source, type, cr, ...entrySummary(monster)].join(' ').toLowerCase().includes(terms);
      return matchesText
        && (monsterSourceFilter === 'all' || monster.source === monsterSourceFilter)
        && (monsterRulesetFilter === 'all' || monster.ruleset === monsterRulesetFilter)
        && (monsterCrFilter === 'all' || cr === monsterCrFilter)
        && (monsterTypeFilter === 'all' || type === monsterTypeFilter);
    });
    return [...filtered].sort((left, right) => {
      if (monsterSort === 'cr-ascending') return challengeRatingValue(left) - challengeRatingValue(right) || left.name.localeCompare(right.name);
      if (monsterSort === 'cr-descending') return challengeRatingValue(right) - challengeRatingValue(left) || left.name.localeCompare(right.name);
      if (monsterSort === 'source') return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
      if (monsterSort === 'type') return (dataString(left, 'type') ?? '').localeCompare(dataString(right, 'type') ?? '') || left.name.localeCompare(right.name);
      return left.name.localeCompare(right.name);
    });
  }, [monsterCrFilter, monsterQuery, monsterRulesetFilter, monsterSort, monsterSourceFilter, monsterTypeFilter, monsters]);
  const visibleMonsterMatches = useMemo(
    () => monsterMatches.slice(0, visibleMonsterCount),
    [monsterMatches, visibleMonsterCount]
  );
  const monstersById = useMemo(() => new Map(monsters.map((monster) => [monster.id, monster])), [monsters]);
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

  const clearCombatantEditors = () => {
    setHitPointEditorId(null);
    setStatEditor(null);
  };

  /** On touch screens, close the large picker before the tracker reflows. This
   * avoids leaving an inert scroll layer above the newly added combatant. */
  const addCombatantAndClosePicker = (next: Encounter) => {
    onUpdateEncounter(next);
    setCombatantPicker(null);
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
    setCombatantPicker(null);
    clearCombatantEditors();
    onSelectEncounter(id);
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
    <main className={`encounter-page encounter-view-${encounterView}`} aria-label="Combat encounters">
      <header className="encounter-page-header">
        <div>
          <p className="eyebrow">Combat toolkit</p>
          <h1>Encounters</h1>
          <p>Build a fight from the offline SRD catalogue, then run initiative and hit points in one place.</p>
        </div>
        <div className="page-header-actions">
          <div className="encounter-view-tabs" role="tablist" aria-label="Encounter view">
            <button aria-selected={encounterView === 'entries'} className={encounterView === 'entries' ? 'is-selected' : ''} onClick={() => setEncounterView('entries')} role="tab" type="button">Entries</button>
            <button aria-selected={encounterView === 'run'} className={encounterView === 'run' ? 'is-selected' : ''} onClick={() => setEncounterView('run')} role="tab" type="button">Run combat</button>
          </div>
          <span className={`sync-badge sync-${storage.tone}`} title={storage.title}>{storage.label}</span>
          <button className="primary-button" onClick={onCreateEncounter} type="button">New encounter</button>
        </div>
      </header>

      {campaignPosition && (
        <section className="campaign-position" aria-label="Current campaign position">
          <span>Campaign now</span>
          <strong>
            {positionActive
              ? `Active: ${positionActive.name}`
              : `After ${positionPrevious?.name ?? 'the campaign opening'} · Before ${positionNext?.name ?? 'the next required encounter'}`}
          </strong>
          <small>{campaignPosition.headingPath.join(' › ') || 'No section heading'} · {partyLocation ? `Party: ${partyLocation.name}${partyLocation.source === 'manual' ? ' (manual)' : ''}` : 'Party location not set'}.</small>
        </section>
      )}

      <section className="campaign-position" aria-label="Campaign view">
        <span>Campaign view</span>
        <strong>{campaignPosition?.headingPath.join(' › ') || 'No linked encounter position'}</strong>
        <div className="campaign-location-control">
          <label>Party location<select aria-label="Party location" onChange={(event) => event.target.value && onSetPartyLocation(event.target.value)} value={partyLocation?.source === 'manual' ? partyLocation.entityId : ''}><option value="">Derived from section</option>{locationEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
          <small>{worldEvents.slice(-3).reverse().map((event) => event.type).join(' · ') || 'No recent campaign events'}</small>
        </div>
      </section>

      <section className="encounter-workspace">
        <aside className="encounter-library" aria-label="Saved encounters">
          <div className="encounter-sidebar-heading"><span>Saved encounters</span><span>{encounters.length}</span></div>
          <div className="encounter-list">
            {encounters.map((encounter) => (
              <button
                className={`encounter-list-item ${selected?.id === encounter.id ? 'is-selected' : ''}`}
                key={encounter.id}
                onClick={() => selectEncounter(encounter.id)}
                type="button"
              >
                <strong>{encounter.name || 'Untitled encounter'}</strong>
                <span>{encounter.participants.length} combatant{encounter.participants.length === 1 ? '' : 's'} · {encounter.status}</span>
                {encounter.date && <small>{formatBelentorDate(encounter.date)}</small>}
              </button>
            ))}
            {!encounters.length && <p className="empty-panel">Create an encounter to start a combat setup.</p>}
          </div>

          <section className="party-roster">
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
          </section>
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

              <div className="encounter-actions">
                <button
                  className="primary-button"
                  disabled={!selected.participants.length}
                  onClick={() => onUpdateEncounter(advanceCombatTurn(selected))}
                  type="button"
                >
                  {selected.status === 'active' ? 'Next turn' : 'Start combat'}
                </button>
                {selected.status === 'active' && (
                  <button className="encounter-end-button" onClick={() => onEndCombat(selected)} type="button">End combat</button>
                )}
                <button className="encounter-add-button" onClick={() => setCombatantPicker((current) => current ? null : 'monster')} type="button">
                  {combatantPicker ? 'Close picker' : 'Add combatant'}
                </button>
                <button onClick={() => onInsertReference(selected)} type="button">Insert into brew</button>
                <button className="quiet-danger" onClick={() => onDeleteEncounter(selected)} type="button">Delete</button>
              </div>

              <section className={`encounter-section encounter-tracker-summary ${selected.participants.length ? '' : 'is-empty'}`}>
                <div className="encounter-section-heading">
                  <div><p className="eyebrow">Tracker</p><h2>{selected.participants.length} combatant{selected.participants.length === 1 ? '' : 's'}</h2></div>
                </div>
                <p className="encounter-helper">
                  {selected.participants.length
                    ? 'Press and drag the left grip to set order. Keyboard users can focus a grip and press ↑ or ↓.'
                    : 'Add party members, confirmed Worldbuilding NPCs, or catalogue monsters to prepare this encounter.'}
                </p>
              </section>

              {combatantPicker && (
                <div
                  className="encounter-combatant-picker-backdrop"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setCombatantPicker(null);
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
                    <button aria-label="Close combatant picker" className="encounter-picker-close" onClick={() => setCombatantPicker(null)} type="button">×</button>
                  </div>
                  <div className="encounter-picker-tabs" role="tablist" aria-label="Combatant source">
                    <button aria-selected={combatantPicker === 'party'} className={combatantPicker === 'party' ? 'is-selected' : ''} onClick={() => setCombatantPicker('party')} role="tab" type="button">Party</button>
                    <button aria-selected={combatantPicker === 'npc'} className={combatantPicker === 'npc' ? 'is-selected' : ''} onClick={() => setCombatantPicker('npc')} role="tab" type="button">Worldbuilding NPCs</button>
                    <button aria-selected={combatantPicker === 'monster'} className={combatantPicker === 'monster' ? 'is-selected' : ''} onClick={() => setCombatantPicker('monster')} role="tab" type="button">Catalogue</button>
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
                      <div className="encounter-monster-filters" aria-label="Monster filters">
                        <label>Sort
                          <select onChange={(event) => { setMonsterSort(event.target.value as MonsterSort); setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE); }} value={monsterSort}>
                            <option value="name">Name A–Z</option>
                            <option value="cr-ascending">CR: low to high</option>
                            <option value="cr-descending">CR: high to low</option>
                            <option value="type">Creature type</option>
                            <option value="source">Source</option>
                          </select>
                        </label>
                        <label>Source
                          <select onChange={(event) => { setMonsterSourceFilter(event.target.value); setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE); }} value={monsterSourceFilter}>
                            <option value="all">All sources</option>
                            {monsterSourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                          </select>
                        </label>
                        <label>Edition
                          <select onChange={(event) => { setMonsterRulesetFilter(event.target.value); setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE); }} value={monsterRulesetFilter}>
                            <option value="all">All editions</option>
                            {monsterRulesetOptions.map((ruleset) => <option key={ruleset} value={ruleset}>{ruleset === '5.5e' ? 'D&D 5.5e / One D&D' : ruleset}</option>)}
                          </select>
                        </label>
                        <label>CR
                          <select onChange={(event) => { setMonsterCrFilter(event.target.value); setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE); }} value={monsterCrFilter}>
                            <option value="all">All CRs</option>
                            {monsterCrOptions.map((cr) => <option key={cr} value={cr}>CR {cr}</option>)}
                          </select>
                        </label>
                        <label>Type
                          <select onChange={(event) => { setMonsterTypeFilter(event.target.value); setVisibleMonsterCount(MONSTER_RESULTS_PAGE_SIZE); }} value={monsterTypeFilter}>
                            <option value="all">All types</option>
                            {monsterTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </label>
                      </div>
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

      <section className="initiative-panel" aria-label="Initiative tracker">
          <div className="encounter-section-heading">
            <div><p className="eyebrow">Run combat</p><h2>Initiative</h2></div>
            <div className="initiative-run-actions">{selected?.activeCombatantId && <span className="initiative-current">Current turn</span>}{selected && <button className="encounter-add-button" onClick={() => setCombatantPicker('monster')} type="button">Add combatant</button>}</div>
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
                      {sourceMonster && <button aria-label={`Open ${sourceMonster.name} stat block`} className="combatant-statblock-button" onClick={() => onMonsterOpen(sourceMonster)} type="button">Stat block</button>}
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
                        <span>Hit points</span>
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
                          <span>Initiative</span>
                          <strong>{participant.initiative ?? '—'}</strong>
                        </button>
                        <button
                          aria-label={`Armor class ${participant.armorClass ?? 'not set'}. Edit armor class for ${participant.name}`}
                          className="combatant-stat-button combatant-ac-button"
                          onClick={() => openStatEditor(participant, 'armorClass')}
                          type="button"
                        >
                          <span>Armor class</span>
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
