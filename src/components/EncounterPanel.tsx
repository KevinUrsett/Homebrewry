import { useMemo, useState } from 'react';
import { entrySummary } from '../catalogue/presentation';
import type { CatalogueEntry } from '../catalogue/types';
import { addMonsterToEncounter, addPartyMembersToEncounter, advanceCombatTurn, patchEncounterParticipant, removeEncounterParticipant, sortCombatants, touchEncounter } from '../lib/encounters';
import type { Encounter, EncounterParticipant, PartyMember } from '../types';

type EncounterPanelProps = {
  encounters: Encounter[];
  selectedId: string | null;
  partyMembers: PartyMember[];
  monsters: CatalogueEntry[];
  loading: boolean;
  onCreateEncounter: () => void;
  onDeleteEncounter: (encounter: Encounter) => void;
  onInsertReference: (encounter: Encounter) => void;
  onSelectEncounter: (id: string) => void;
  onUpdateEncounter: (encounter: Encounter) => void;
  onCreatePartyMember: (name: string, armorClass: number | null, maxHitPoints: number | null) => void;
  onDeletePartyMember: (member: PartyMember) => void;
  onUpdatePartyMember: (member: PartyMember) => void;
};

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
  selectedId,
  partyMembers,
  monsters,
  loading,
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
  const selected = encounters.find((encounter) => encounter.id === selectedId) ?? encounters[0] ?? null;
  const orderedParticipants = selected ? sortCombatants(selected.participants) : [];
  const monsterMatches = useMemo(() => {
    const terms = monsterQuery.trim().toLowerCase();
    const source = terms
      ? monsters.filter((monster) => [monster.name, ...entrySummary(monster)].join(' ').toLowerCase().includes(terms))
      : monsters;
    return source.slice(0, 18);
  }, [monsterQuery, monsters]);

  const addPartyMember = () => {
    const name = partyName.trim();
    if (!name) return;
    onCreatePartyMember(name, asNumber(partyArmorClass), asNumber(partyHitPoints));
    setPartyName('');
    setPartyArmorClass('');
    setPartyHitPoints('');
  };

  return (
    <main className="encounter-page" aria-label="Combat encounters">
      <header className="encounter-page-header">
        <div>
          <p className="eyebrow">Combat toolkit</p>
          <h1>Encounters</h1>
          <p>Build a fight from the offline SRD catalogue, then run initiative and hit points in one place.</p>
        </div>
        <button className="primary-button" onClick={onCreateEncounter} type="button">New encounter</button>
      </header>

      <section className="encounter-workspace">
        <aside className="encounter-library" aria-label="Saved encounters">
          <div className="encounter-sidebar-heading"><span>Saved encounters</span><span>{encounters.length}</span></div>
          <div className="encounter-list">
            {encounters.map((encounter) => (
              <button
                className={`encounter-list-item ${selected?.id === encounter.id ? 'is-selected' : ''}`}
                key={encounter.id}
                onClick={() => onSelectEncounter(encounter.id)}
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
                <label className="visually-hidden" htmlFor="encounter-name">Encounter name</label>
                <input
                  id="encounter-name"
                  onChange={(event) => onUpdateEncounter(touchEncounter(selected, { name: event.target.value }))}
                  value={selected.name}
                />
                <span className={`encounter-status status-${selected.status}`}>{selected.status}</span>
              </div>
              <div className="encounter-actions">
                <button className="primary-button" disabled={!selected.participants.length} onClick={() => onUpdateEncounter(advanceCombatTurn(selected))} type="button">
                  {selected.status === 'active' ? 'Next turn' : 'Start combat'}
                </button>
                <button onClick={() => onInsertReference(selected)} type="button">Insert into brew</button>
                <button className="quiet-danger" onClick={() => onDeleteEncounter(selected)} type="button">Delete</button>
              </div>

              <section className="encounter-section">
                <div className="encounter-section-heading">
                  <div><p className="eyebrow">Party</p><h2>Combatants</h2></div>
                  <button disabled={!partyMembers.length} onClick={() => onUpdateEncounter(addPartyMembersToEncounter(selected, partyMembers))} type="button">Add current party</button>
                </div>
                <p className="encounter-helper">Add a party roster on the left, or add them to this encounter as independent combatants.</p>
              </section>

              <section className="encounter-section">
                <div className="encounter-section-heading">
                  <div><p className="eyebrow">Monsters</p><h2>Add from catalogue</h2></div>
                  <span>{loading ? 'Loading…' : `${monsters.length} available`}</span>
                </div>
                <input className="encounter-search" onChange={(event) => setMonsterQuery(event.target.value)} placeholder="Search monsters…" value={monsterQuery} />
                <div className="encounter-monster-results">
                  {monsterMatches.map((monster) => (
                    <div className="encounter-monster-result" key={monster.id}>
                      <div><strong>{monster.name}</strong><span>{entrySummary(monster).join(' · ') || 'SRD monster'}</span></div>
                      <button onClick={() => onUpdateEncounter(addMonsterToEncounter(selected, monster))} type="button">Add</button>
                    </div>
                  ))}
                  {!loading && !monsterMatches.length && <p className="empty-panel">No monsters match that search.</p>}
                </div>
              </section>
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
                <article className={`combatant-card ${participant.id === selected.activeCombatantId ? 'is-active' : ''} ${participant.currentHitPoints !== null && participant.currentHitPoints <= 0 ? 'is-defeated' : ''}`} key={participant.id}>
                  <div className="combatant-title">
                    <button aria-label={`Set ${participant.name} as current turn`} className="turn-marker" onClick={() => onUpdateEncounter(touchEncounter(selected, { activeCombatantId: participant.id, status: 'active' }))} type="button">{participant.id === selected.activeCombatantId ? '●' : '○'}</button>
                    <input aria-label={`${participant.name} combatant name`} onChange={(event) => participantPatch(selected, participant, { name: event.target.value }, onUpdateEncounter)} value={participant.name} />
                    <span className={`combatant-kind kind-${participant.kind}`}>{participant.kind}</span>
                  </div>
                  <div className="combatant-fields">
                    <label>Init<input aria-label={`${participant.name} initiative`} onChange={(event) => participantPatch(selected, participant, { initiative: asNumber(event.target.value) }, onUpdateEncounter)} type="number" value={participant.initiative ?? ''} /></label>
                    <label>HP<input aria-label={`${participant.name} current hit points`} onChange={(event) => participantPatch(selected, participant, { currentHitPoints: asNumber(event.target.value) }, onUpdateEncounter)} type="number" value={participant.currentHitPoints ?? ''} /></label>
                    <span className="combatant-slash">/</span>
                    <label>Max<input aria-label={`${participant.name} maximum hit points`} min="0" onChange={(event) => participantPatch(selected, participant, { maxHitPoints: asNumber(event.target.value) }, onUpdateEncounter)} type="number" value={participant.maxHitPoints ?? ''} /></label>
                    <label>AC<input aria-label={`${participant.name} armor class`} min="0" onChange={(event) => participantPatch(selected, participant, { armorClass: asNumber(event.target.value) }, onUpdateEncounter)} type="number" value={participant.armorClass ?? ''} /></label>
                    <button aria-label={`Remove ${participant.name} from encounter`} className="quiet-danger" onClick={() => onUpdateEncounter(removeEncounterParticipant(selected, participant.id))} type="button">×</button>
                  </div>
                </article>
              ))}
              {!orderedParticipants.length && <p className="empty-panel">Add party members or monsters to begin.</p>}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
