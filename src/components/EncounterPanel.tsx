import { useMemo, useRef, useState } from 'react';
import { entrySummary } from '../catalogue/presentation';
import type { CatalogueEntry } from '../catalogue/types';
import {
  addMonsterToEncounter,
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
import type { CampaignPosition } from '../lib/campaignProgress';
import type { CampaignEntity, Encounter, EncounterParticipant, EntityCurrentState, PartyMember, SyncState } from '../types';
import '../encounter-refresh.css';

type EncounterPanelProps = {
  encounters: Encounter[];
  campaignPosition?: CampaignPosition | null;
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
  onSelectEncounter: (id: string) => void;
  onUpdateEncounter: (encounter: Encounter) => void;
  onCreatePartyMember: (name: string, armorClass: number | null, maxHitPoints: number | null) => void;
  onDeletePartyMember: (member: PartyMember) => void;
  onUpdatePartyMember: (member: PartyMember) => void;
};

type CombatantPicker = 'party' | 'npc' | 'monster' | null;
type StatField = 'initiative' | 'armorClass';
type StatEditor = { participantId: string; field: StatField; value: string } | null;

const MONSTER_RESULTS_PAGE_SIZE = 30;

const asNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function participantPatch(
  encounter: Encounter,
  participant: EncounterParticipant,
  changes: Partial<Pick<EncounterParticipant, 'name' | 'armorClass' | 'maxHitPoints' | 'currentHitPoints' | 'initiative'>>,
  onUpdateEncounter: (encounter: Encounter) => void
) {
  onUpdateEncounter(patchEncounterParticipant(encounter, participant.id, changes));
}

export function EncounterPanel({
  encounters,
  campaignPosition,
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
  onSelectEncounter,
  onUpdateEncounter,
  onCreatePartyMember,
  onDeletePartyMember,
  onUpdatePartyMember
}: EncounterPanelProps) {
  const [monsterQuery, setMonsterQuery] = useState('');
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
  const orderedParticipants = selected ? sortCombatants(selected.participants) : [];
  const monsterMatches = useMemo(() => {
    const terms = monsterQuery.trim().toLowerCase();
    const source = terms
      ? monsters.filter((monster) => [monster.name, ...entrySummary(monster)].join(' ').toLowerCase().includes(terms))
      : monsters;
    return source;
  }, [monsterQuery, monsters]);
  const visibleMonsterMatches = useMemo(
    () => monsterMatches.slice(0, visibleMonsterCount),
    [monsterMatches, visibleMonsterCount]
  );

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

  const applyHitPointChange = (participant: EncounterParticipant) => {
    if (!selected) return;
    const change = asNumber(hitPointChanges[participant.id] ?? '');
    if (change === null || change === 0) return;
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
    const changes = statEditor.field === 'initiative' ? { initiative: value } : { armorClass: value };
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
    <main className="encounter-page" aria-label="Combat encounters">
      <header className="encounter-page-header">
        <div>
          <p className="eyebrow">Combat toolkit</p>
          <h1>Encounters</h1>
          <p>Build a fight from the offline SRD catalogue, then run initiative and hit points in one place.</p>
        </div>
        <div className="page-header-actions">
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
          <small>Derived from encounter order and progress; brew text remains unchanged.</small>
        </section>
      )}

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
                    <button className="encounter-inline-button" onClick={startEditingName} type="button">Edit name</button>
                  </div>
                )}
                <div className="encounter-progress-controls">
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
                    Optional
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
                <button onClick={() => onInsertReference(selected)} type="button">Insert into brew</button>
                <button onClick={() => setCombatantPicker((current) => current ? null : 'party')} type="button">
                  {combatantPicker ? 'Close picker' : 'Add combatant'}
                </button>
                <button className="quiet-danger" onClick={() => onDeleteEncounter(selected)} type="button">Delete</button>
              </div>

              <section className="encounter-section">
                <div className="encounter-section-heading">
                  <div><p className="eyebrow">Tracker</p><h2>{selected.participants.length} combatant{selected.participants.length === 1 ? '' : 's'}</h2></div>
                </div>
                <p className="encounter-helper">Press and drag the left grip to set order on phone or desktop. The tracker recalculates initiative so the new order remains stable; keyboard users can focus a grip and press ↑ or ↓.</p>
              </section>

              {combatantPicker && (
                <section className="encounter-picker" aria-label="Add combatant">
                  <div className="encounter-picker-header">
                    <h3>Add combatant</h3>
                    <span>
                      {combatantPicker === 'party'
                        ? `${partyMembers.length} party member${partyMembers.length === 1 ? '' : 's'}`
                        : combatantPicker === 'npc'
                          ? `${npcEntities.length} confirmed NPC${npcEntities.length === 1 ? '' : 's'}`
                          : loading
                            ? 'Loading…'
                            : `${monsterMatches.length.toLocaleString()} monster match${monsterMatches.length === 1 ? '' : 'es'}`}
                    </span>
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
                      {npcEntities.map((entity) => {
                        const included = includedNpcEntityIds.has(entity.id);
                        const status = currentStateByEntityId.get(entity.id)?.fields.status?.value;
                        return (
                          <div className="encounter-party-choice" key={entity.id}>
                            <div>
                              <strong>{entity.name}</strong>
                              <span>{status === null || status === undefined ? 'No current status' : `Current status: ${String(status)}`}</span>
                            </div>
                            <button disabled={included} onClick={() => onUpdateEncounter(addNpcToEncounter(selected, entity))} type="button">{included ? 'Added' : 'Add'}</button>
                          </div>
                        );
                      })}
                      {!npcEntities.length && <p className="empty-panel">Create a Worldbuilding character to add a confirmed NPC.</p>}
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
                      <div className="encounter-monster-results">
                        {visibleMonsterMatches.map((monster) => (
                          <div className="encounter-monster-result" key={monster.id}>
                            <div><strong>{monster.name}</strong><span>{entrySummary(monster).join(' · ') || 'SRD monster'}</span></div>
                            <button onClick={() => onUpdateEncounter(addMonsterToEncounter(selected, monster))} type="button">Add</button>
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
              )}
            </>
          )}
        </section>

        <section className="initiative-panel" aria-label="Initiative tracker">
          <div className="encounter-section-heading">
            <div><p className="eyebrow">Run combat</p><h2>Initiative</h2></div>
            {selected?.activeCombatantId && <span className="initiative-current">Current turn</span>}
          </div>
          {!selected ? (
            <p className="empty-panel">Choose an encounter to run combat.</p>
          ) : (
            <div className="initiative-list">
              {orderedParticipants.map((participant) => (
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
                      <span className={`combatant-kind kind-${participant.kind}`}>{participant.kind}</span>
                      {participant.entityId && (
                        <span className="combatant-world-status">
                          {String(currentStateByEntityId.get(participant.entityId)?.fields.status?.value ?? 'linked')}
                        </span>
                      )}
                    </div>

                    <div className="combatant-summary-row">
                      <button
                        aria-label={`Armor class ${participant.armorClass ?? 'not set'}. Edit armor class for ${participant.name}`}
                        className="combatant-stat-button combatant-ac-button"
                        onClick={() => openStatEditor(participant, 'armorClass')}
                        type="button"
                      >
                        <span>AC</span>
                        <strong>{participant.armorClass ?? '—'}</strong>
                      </button>

                      <div className="combatant-vitals">
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
                          aria-expanded={hitPointEditorId === participant.id}
                          className="combatant-hp-button"
                          disabled={!canAdjustHitPoints(participant)}
                          onClick={() => {
                            setStatEditor(null);
                            setHitPointEditorId((current) => current === participant.id ? null : participant.id);
                          }}
                          title={canAdjustHitPoints(participant) ? 'Open damage and healing calculator' : 'Set maximum HP first'}
                          type="button"
                        >
                          <span>HP</span>
                          <strong>{participant.currentHitPoints ?? '—'} / {participant.maxHitPoints ?? '—'}</strong>
                        </button>
                      </div>

                      <button aria-label={`Remove ${participant.name} from encounter`} className="quiet-danger combatant-remove-button" onClick={() => onUpdateEncounter(removeEncounterParticipant(selected, participant.id))} type="button">×</button>

                      {statEditor?.participantId === participant.id && (
                        <div className="combatant-stat-editor">
                          <label>
                            {statEditor.field === 'initiative' ? 'Initiative' : 'Armor class'}
                            <input
                              aria-label={`Set ${statEditor.field === 'initiative' ? 'initiative' : 'armor class'} for ${participant.name}`}
                              autoFocus
                              min={statEditor.field === 'armorClass' ? 0 : undefined}
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
                            Damage + / healing −
                            <input
                              aria-label={`${participant.name} damage or healing`}
                              autoFocus
                              onChange={(event) => setHitPointChanges((current) => ({ ...current, [participant.id]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  applyHitPointChange(participant);
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  setHitPointEditorId(null);
                                }
                              }}
                              placeholder="10 or −10"
                              step="1"
                              type="number"
                              value={hitPointChanges[participant.id] ?? ''}
                            />
                          </label>
                          <button disabled={asNumber(hitPointChanges[participant.id] ?? '') === null || asNumber(hitPointChanges[participant.id] ?? '') === 0} onClick={() => applyHitPointChange(participant)} type="button">Apply</button>
                          <small>Positive values deal damage; negative values restore HP.</small>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
              {!orderedParticipants.length && <p className="empty-panel">Use Add combatant to add party members or monsters.</p>}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
