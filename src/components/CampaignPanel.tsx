import { useMemo, useState } from 'react';
import type { CampaignPosition, DerivedPartyLocation } from '../lib/campaignProgress';
import type { Brew, CampaignEntity, Encounter, EntityCurrentState, TimelineEntry, TimelineLane, TimelineStatus, WorldEvent } from '../types';
import '../campaign.css';

type CampaignPanelProps = {
  position: CampaignPosition | null;
  partyLocation: DerivedPartyLocation;
  brews: readonly Brew[];
  encounters: readonly Encounter[];
  entities: readonly CampaignEntity[];
  currentStateByEntityId: ReadonlyMap<string, EntityCurrentState>;
  worldEvents: readonly WorldEvent[];
  timelineEntries: readonly TimelineEntry[];
  onOpenEncounter: (encounter: Encounter) => void;
  onOpenEntity: (entity: CampaignEntity) => void;
  onSaveTimelineEntry: (entry: TimelineEntry | Omit<TimelineEntry, 'id' | 'campaignId' | 'order' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteTimelineEntry: (entryId: string) => void;
};

const entityLabel = (entity: CampaignEntity) => entity.kind === 'npc' ? 'NPC' : entity.kind;

export function CampaignPanel({ position, partyLocation, brews, encounters, entities, currentStateByEntityId, worldEvents, timelineEntries, onOpenEncounter, onOpenEntity, onSaveTimelineEntry, onDeleteTimelineEntry }: CampaignPanelProps) {
  const [laneFilter, setLaneFilter] = useState<TimelineLane | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TimelineStatus | 'all'>('all');
  const [draft, setDraft] = useState({ lane: 'main' as TimelineLane, status: 'planned' as TimelineStatus, title: '', when: '', notes: '', entityIds: [] as string[], encounterId: '' });
  const brew = brews.find((item) => item.id === position?.brewId);
  const active = encounters.find((item) => item.id === position?.activeEncounterId);
  const previous = encounters.find((item) => item.id === position?.previousEncounterId);
  const next = encounters.find((item) => item.id === position?.nextEncounterId);
  const activeQuests = entities.filter((entity) => entity.kind === 'quest' && !['complete', 'completed', 'failed'].includes(String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active').toLowerCase()));
  const notable = entities.filter((entity) => entity.kind === 'npc' || entity.kind === 'faction').filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value !== 'dead').slice(0, 8);
  const recentEvents = [...worldEvents].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 8);
  const timeline = useMemo(() => timelineEntries.filter((entry) => (laneFilter === 'all' || entry.lane === laneFilter) && (statusFilter === 'all' || entry.status === statusFilter)).sort((left, right) => left.order - right.order || left.updatedAt.localeCompare(right.updatedAt)), [laneFilter, statusFilter, timelineEntries]);
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const encounterById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
  const submitTimeline = () => {
    if (!draft.title.trim()) return;
    onSaveTimelineEntry({ ...draft, encounterId: draft.encounterId || undefined });
    setDraft({ lane: draft.lane, status: 'planned', title: '', when: '', notes: '', entityIds: [], encounterId: '' });
  };

  return <main className="campaign-page" aria-label="Campaign dashboard">
    <header className="campaign-page-header"><div><p className="eyebrow">Generated campaign state</p><h1>Campaign</h1><p>Current status assembled from encounters, explicit links, and World Events.</p></div></header>
    <section className="campaign-hero-grid">
      <article><span>Current brew</span><strong>{brew?.title ?? 'No encounter-linked brew'}</strong><small>{position?.headingPath.join(' › ') || 'No current section'}</small></article>
      <article><span>Party location</span><strong>{partyLocation?.name ?? 'Not established'}</strong><small>{partyLocation ? (partyLocation.source === 'manual' ? 'Manual override' : 'Derived from current section') : 'Link a location in the current section or set an override.'}</small></article>
      <article><span>Campaign now</span><strong>{active ? `Active: ${active.name}` : previous ? `After: ${previous.name}` : 'Opening position'}</strong><small>{next ? `Next: ${next.name}` : 'No required encounter is queued.'}</small></article>
    </section>
    <section className="campaign-grid">
      <article className="campaign-card"><h2>Encounter path</h2>{active && <button onClick={() => onOpenEncounter(active)} type="button"><span>Active</span><strong>{active.name}</strong></button>}{previous && !active && <button onClick={() => onOpenEncounter(previous)} type="button"><span>Previous</span><strong>{previous.name}</strong></button>}{next && <button onClick={() => onOpenEncounter(next)} type="button"><span>Next</span><strong>{next.name}</strong></button>}{!active && !previous && !next && <p>No linked encounters yet.</p>}</article>
      <article className="campaign-card"><h2>Active quests</h2>{activeQuests.length ? activeQuests.map((entity) => <button key={entity.id} onClick={() => onOpenEntity(entity)} type="button"><span>{String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active')}</span><strong>{entity.name}</strong></button>) : <p>No active quests have been classified yet.</p>}</article>
      <article className="campaign-card"><h2>Important entities</h2>{notable.length ? notable.map((entity) => <button key={entity.id} onClick={() => onOpenEntity(entity)} type="button"><span>{entityLabel(entity)} · {String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'unknown')}</span><strong>{entity.name}</strong></button>) : <p>No confirmed NPCs or factions yet.</p>}</article>
      <article className="campaign-card"><h2>Recent world events</h2>{recentEvents.length ? recentEvents.map((event) => <div key={event.id}><strong>{event.type.replaceAll('.', ' ')}</strong><span>{new Date(event.occurredAt).toLocaleString()}</span></div>) : <p>No structured world events yet.</p>}</article>
    </section>
    <section className="campaign-timeline" aria-label="Campaign timeline">
      <header><div><p className="eyebrow">World progression</p><h2>Timeline</h2><small>Manual story beats live alongside read-only structured World Events.</small></div><div className="timeline-filters"><select aria-label="Timeline lane" onChange={(event) => setLaneFilter(event.target.value as TimelineLane | 'all')} value={laneFilter}><option value="all">All stories</option><option value="main">Main campaign</option><option value="quest">Quest / side story</option><option value="backstory">Character backstory</option></select><select aria-label="Timeline status" onChange={(event) => setStatusFilter(event.target.value as TimelineStatus | 'all')} value={statusFilter}><option value="all">All statuses</option><option value="planned">Planned</option><option value="current">Current</option><option value="past">Past</option></select></div></header>
      <div className="timeline-create"><select aria-label="New timeline lane" onChange={(event) => setDraft({ ...draft, lane: event.target.value as TimelineLane })} value={draft.lane}><option value="main">Main campaign</option><option value="quest">Quest / side story</option><option value="backstory">Character backstory</option></select><select aria-label="New timeline status" onChange={(event) => setDraft({ ...draft, status: event.target.value as TimelineStatus })} value={draft.status}><option value="planned">Planned</option><option value="current">Current</option><option value="past">Past</option></select><input aria-label="Timeline event title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Story beat" value={draft.title} /><input aria-label="Timeline date" onChange={(event) => setDraft({ ...draft, when: event.target.value })} placeholder="In-world date or era" value={draft.when} /><textarea aria-label="Timeline notes" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Private context or outcome" value={draft.notes} /><label>Links<select multiple aria-label="Linked timeline entities" onChange={(event) => setDraft({ ...draft, entityIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })} value={draft.entityIds}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><label>Encounter<select aria-label="Linked timeline encounter" onChange={(event) => setDraft({ ...draft, encounterId: event.target.value })} value={draft.encounterId}><option value="">No encounter link</option>{encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.name}</option>)}</select></label><button className="primary-button" onClick={submitTimeline} type="button">Add to timeline</button></div>
      <div className="timeline-list">{timeline.map((entry) => { const encounter = entry.encounterId ? encounterById.get(entry.encounterId) : undefined; return <article className={`timeline-entry lane-${entry.lane} status-${entry.status}`} key={entry.id}><div className="timeline-entry-meta"><span>{entry.lane === 'main' ? 'Main campaign' : entry.lane === 'quest' ? 'Quest / side story' : 'Character backstory'}</span><b>{entry.status}</b></div><div><h3>{entry.title}</h3>{entry.when && <p className="timeline-when">{entry.when}</p>}{entry.notes && <p>{entry.notes}</p>}{entry.entityIds.length > 0 && <p className="timeline-links">{entry.entityIds.flatMap((id) => { const entity = entitiesById.get(id); return entity ? [<button key={id} onClick={() => onOpenEntity(entity)} type="button">{entity.name}</button>] : []; })}</p>}{encounter && <button className="timeline-encounter-link" onClick={() => onOpenEncounter(encounter)} type="button">Open {encounter.name}</button>}</div><button className="quiet-danger" onClick={() => onDeleteTimelineEntry(entry.id)} type="button">Remove</button></article>; })}</div>
      <div className="timeline-system-events"><h3>Structured World Events</h3>{recentEvents.length ? recentEvents.map((event) => <article key={event.id}><strong>{event.type.replaceAll('.', ' ')}</strong><span>{new Date(event.occurredAt).toLocaleString()} · {event.source.kind}</span></article>) : <p>No structured world events yet.</p>}</div>
    </section>
  </main>;
}
