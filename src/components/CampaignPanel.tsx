import { useEffect, useMemo, useState } from 'react';
import type { CampaignPosition, DerivedPartyLocation } from '../lib/campaignProgress';
import { belentorMonths, compareBelentorDates, formatBelentorDate } from '../lib/belentorCalendar';
import { getOutline } from '../lib/outline';
import { CampaignMapPanel } from './CampaignMapPanel';
import type { BelentorEra, BelentorMonth, Brew, CampaignEntity, CampaignMap, Encounter, EntityCurrentState, EntityReference, TimelineEntry, TimelineLane, TimelineStatus, WorldEvent, WorldbuildingEntry } from '../types';
import '../campaign.css';

export type TimelineDraftSeed = {
  title?: string;
  entityIds?: string[];
  brewId?: string;
  sectionId?: string;
  worldbuildingId?: string;
};

type CampaignPanelProps = {
  position: CampaignPosition | null;
  partyLocation: DerivedPartyLocation;
  brews: readonly Brew[];
  encounters: readonly Encounter[];
  entities: readonly CampaignEntity[];
  currentStateByEntityId: ReadonlyMap<string, EntityCurrentState>;
  worldEvents: readonly WorldEvent[];
  timelineEntries: readonly TimelineEntry[];
  campaignMap?: CampaignMap;
  entityReferences: readonly EntityReference[];
  worldbuildingEntries: readonly WorldbuildingEntry[];
  currentBrewId?: string;
  onOpenEncounter: (encounter: Encounter) => void;
  onOpenEntity: (entity: CampaignEntity) => void;
  onOpenBrewSection: (brewId: string, sectionId?: string) => void;
  onSetCurrentBrew: (brewId: string | null) => void;
  onOpenWorldbuildingEntry: (entryId: string) => void;
  timelineDraftSeed?: TimelineDraftSeed | null;
  onTimelineDraftSeedApplied?: () => void;
  onSaveTimelineEntry: (entry: TimelineEntry | Omit<TimelineEntry, 'id' | 'campaignId' | 'order' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteTimelineEntry: (entryId: string) => void;
  onSaveCampaignMap: (map: CampaignMap) => void;
};

const entityLabel = (entity: CampaignEntity) => entity.kind === 'npc' ? 'NPC' : entity.kind;
const timelineDateLabel = (entry: TimelineEntry) => entry.date ? formatBelentorDate(entry.date) : entry.when;

function orderTimeline(entries: readonly TimelineEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.date && right.date) return compareBelentorDates(left.date, right.date) || left.order - right.order;
    if (left.date) return -1;
    if (right.date) return 1;
    return left.order - right.order || left.updatedAt.localeCompare(right.updatedAt);
  });
}

export function CampaignPanel({ position, partyLocation, brews, encounters, entities, currentStateByEntityId, worldEvents, timelineEntries, campaignMap, entityReferences, worldbuildingEntries, currentBrewId, onOpenEncounter, onOpenEntity, onOpenBrewSection, onSetCurrentBrew, onOpenWorldbuildingEntry, timelineDraftSeed, onTimelineDraftSeedApplied, onSaveTimelineEntry, onDeleteTimelineEntry, onSaveCampaignMap }: CampaignPanelProps) {
  const [laneFilter, setLaneFilter] = useState<TimelineLane | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TimelineStatus | 'all'>('all');
  const [draft, setDraft] = useState({ lane: 'main' as TimelineLane, status: 'planned' as TimelineStatus, title: '', when: '', notes: '', entityIds: [] as string[], dateEra: 'AA' as BelentorEra, dateYear: '', dateMonth: 'Din' as BelentorMonth, dateDay: '', worldbuildingId: '', encounterId: '', brewId: '', sectionId: '' });
  useEffect(() => {
    if (!timelineDraftSeed) return;
    setDraft((current) => ({
      ...current,
      title: timelineDraftSeed.title ?? current.title,
      entityIds: timelineDraftSeed.entityIds ?? current.entityIds,
      brewId: timelineDraftSeed.brewId ?? '',
      sectionId: timelineDraftSeed.sectionId ?? '',
      worldbuildingId: timelineDraftSeed.worldbuildingId ?? ''
    }));
    onTimelineDraftSeedApplied?.();
  }, [onTimelineDraftSeedApplied, timelineDraftSeed]);
  const brew = brews.find((item) => item.id === currentBrewId) ?? brews.find((item) => item.id === position?.brewId);
  const draftBrew = brews.find((item) => item.id === draft.brewId);
  const draftSections = useMemo(() => draftBrew ? getOutline(draftBrew.content) : [], [draftBrew]);
  const active = encounters.find((item) => item.id === position?.activeEncounterId);
  const previous = encounters.find((item) => item.id === position?.previousEncounterId);
  const next = encounters.find((item) => item.id === position?.nextEncounterId);
  const activeQuests = entities.filter((entity) => entity.kind === 'quest' && !['complete', 'completed', 'failed'].includes(String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active').toLowerCase()));
  const notable = entities.filter((entity) => entity.kind === 'npc' || entity.kind === 'faction').filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value !== 'dead').slice(0, 8);
  const recentEvents = [...worldEvents].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 8);
  const orderedTimelineEntries = useMemo(() => orderTimeline(timelineEntries), [timelineEntries]);
  const timeline = useMemo(() => orderedTimelineEntries.filter((entry) => (laneFilter === 'all' || entry.lane === laneFilter) && (statusFilter === 'all' || entry.status === statusFilter)), [laneFilter, statusFilter, orderedTimelineEntries]);
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const encounterById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
  const visualEvents = useMemo(() => [
    ...orderedTimelineEntries.map((entry) => ({ id: `timeline:${entry.id}`, lane: entry.lane, status: entry.status, title: entry.title, subtitle: timelineDateLabel(entry) || entry.status, system: false, brewId: entry.brewId, sectionId: entry.sectionId, worldbuildingId: entry.worldbuildingId })),
    ...worldEvents.map((event) => ({ id: `event:${event.id}`, lane: 'main' as const, status: 'past' as const, title: event.type.replaceAll('.', ' '), subtitle: new Date(event.occurredAt).toLocaleString(), system: true, brewId: undefined, sectionId: undefined, worldbuildingId: undefined }))
  ], [orderedTimelineEntries, worldEvents]);
  const submitTimeline = () => {
    if (!draft.title.trim()) return;
    const year = Number(draft.dateYear);
    const day = Number(draft.dateDay);
    const date = Number.isInteger(year) && year >= 0 && Number.isInteger(day) && day >= 1 && day <= 30 ? { era: draft.dateEra, year, month: draft.dateMonth, day } : undefined;
    onSaveTimelineEntry({ ...draft, when: date ? formatBelentorDate(date) : '', date, worldbuildingId: draft.worldbuildingId || undefined, encounterId: draft.encounterId || undefined, brewId: draft.brewId || undefined, sectionId: draft.sectionId || undefined });
    setDraft({ lane: draft.lane, status: 'planned', title: '', when: '', notes: '', entityIds: [], dateEra: 'AA', dateYear: '', dateMonth: 'Din', dateDay: '', worldbuildingId: '', encounterId: '', brewId: '', sectionId: '' });
  };

  return <main className="campaign-page" aria-label="Campaign dashboard">
    <header className="campaign-page-header"><div><p className="eyebrow">Generated campaign state</p><h1>Campaign</h1><p>Current status assembled from encounters, explicit links, and World Events.</p></div></header>
    <section className="campaign-hero-grid">
      <article className="campaign-current-brew"><span>Current brew</span><select aria-label="Current campaign brew" onChange={(event) => onSetCurrentBrew(event.target.value || null)} value={currentBrewId ?? ''}><option value="">Automatic from encounter flow</option>{brews.map((item) => <option key={item.id} value={item.id}>{item.title || 'Untitled Brew'}</option>)}</select><small>{currentBrewId ? (position?.brewId === brew?.id ? position?.headingPath.join(' › ') || 'No current section' : 'Saved campaign selection') : position?.headingPath.join(' › ') || 'No current section'}</small></article>
      <article><span>Party location</span><strong>{partyLocation?.name ?? 'Not established'}</strong><small>{partyLocation ? (partyLocation.source === 'manual' ? 'Manual override' : 'Derived from current section') : 'Link a location in the current section or set an override.'}</small></article>
      <article><span>Campaign now</span><strong>{active ? `Active: ${active.name}` : previous ? `After: ${previous.name}` : 'Opening position'}</strong><small>{next ? `Next: ${next.name}` : 'No required encounter is queued.'}</small></article>
    </section>
    <section className="campaign-grid">
      <article className="campaign-card"><h2>Encounter path</h2>{active && <button onClick={() => onOpenEncounter(active)} type="button"><span>Active</span><strong>{active.name}</strong></button>}{previous && !active && <button onClick={() => onOpenEncounter(previous)} type="button"><span>Previous</span><strong>{previous.name}</strong></button>}{next && <button onClick={() => onOpenEncounter(next)} type="button"><span>Next</span><strong>{next.name}</strong></button>}{!active && !previous && !next && <p>No linked encounters yet.</p>}</article>
      <article className="campaign-card"><h2>Active quests</h2>{activeQuests.length ? activeQuests.map((entity) => <button key={entity.id} onClick={() => onOpenEntity(entity)} type="button"><span>{String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active')}</span><strong>{entity.name}</strong></button>) : <p>No active quests have been classified yet.</p>}</article>
      <article className="campaign-card"><h2>Important entities</h2>{notable.length ? notable.map((entity) => <button key={entity.id} onClick={() => onOpenEntity(entity)} type="button"><span>{entityLabel(entity)} · {String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'unknown')}</span><strong>{entity.name}</strong></button>) : <p>No confirmed NPCs or factions yet.</p>}</article>
      <article className="campaign-card"><h2>Recent world events</h2>{recentEvents.length ? recentEvents.map((event) => <div key={event.id}><strong>{event.type.replaceAll('.', ' ')}</strong><span>{new Date(event.occurredAt).toLocaleString()}</span></div>) : <p>No structured world events yet.</p>}</article>
    </section>
    <CampaignMapPanel
      brews={brews}
      campaignMap={campaignMap}
      currentStateByEntityId={currentStateByEntityId}
      entities={entities}
      entityReferences={entityReferences}
      worldbuildingEntries={worldbuildingEntries}
      onOpenEntity={onOpenEntity}
      onOpenBrew={(brewId) => onOpenBrewSection(brewId)}
      onSave={onSaveCampaignMap}
    />
    <section className="campaign-timeline" aria-label="Campaign timeline">
      <header><div><p className="eyebrow">World progression</p><h2>Timeline</h2><small>Manual story beats live alongside read-only structured World Events.</small></div><div className="timeline-filters"><select aria-label="Timeline lane" onChange={(event) => setLaneFilter(event.target.value as TimelineLane | 'all')} value={laneFilter}><option value="all">All stories</option><option value="main">Main campaign</option><option value="quest">Quest / side story</option><option value="backstory">Character backstory</option></select><select aria-label="Timeline status" onChange={(event) => setStatusFilter(event.target.value as TimelineStatus | 'all')} value={statusFilter}><option value="all">All statuses</option><option value="planned">Planned</option><option value="current">Current</option><option value="past">Past</option></select></div></header>
      <div className="timeline-branch-actions" aria-label="Create timeline branch"><button className={draft.lane === 'main' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, lane: 'main' })} type="button">+ Main node</button><button className={draft.lane === 'quest' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, lane: 'quest' })} type="button">+ Side-quest branch</button><button className={draft.lane === 'backstory' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, lane: 'backstory' })} type="button">+ Backstory branch</button></div>
      <div className="timeline-create"><select aria-label="New timeline lane" onChange={(event) => setDraft({ ...draft, lane: event.target.value as TimelineLane })} value={draft.lane}><option value="main">Main campaign</option><option value="quest">Quest / side story</option><option value="backstory">Character backstory</option></select><select aria-label="New timeline status" onChange={(event) => setDraft({ ...draft, status: event.target.value as TimelineStatus })} value={draft.status}><option value="planned">Planned</option><option value="current">Current</option><option value="past">Past</option></select><input aria-label="Timeline event title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Story beat" value={draft.title} /><div className="timeline-date-fields" aria-label="Belentor calendar date"><label>Era<select aria-label="Belentor era" onChange={(event) => setDraft({ ...draft, dateEra: event.target.value as BelentorEra })} value={draft.dateEra}><option value="AA">AA · After Ascension</option><option value="BA">BA · Before Ascension</option></select></label><label>Year<input aria-label="Belentor year" inputMode="numeric" min="0" onChange={(event) => setDraft({ ...draft, dateYear: event.target.value })} placeholder="Year" type="number" value={draft.dateYear} /></label><label>Month<select aria-label="Belentor month" onChange={(event) => setDraft({ ...draft, dateMonth: event.target.value as BelentorMonth })} value={draft.dateMonth}>{belentorMonths.map((month) => <option key={month.name} value={month.name}>{month.star ? `${month.name} · ${month.star}` : month.name}</option>)}</select></label><label>Day<input aria-label="Belentor day" inputMode="numeric" max="30" min="1" onChange={(event) => setDraft({ ...draft, dateDay: event.target.value })} placeholder="Day" type="number" value={draft.dateDay} /></label></div><textarea aria-label="Timeline notes" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Private context or outcome" value={draft.notes} /><label>Links<select multiple aria-label="Linked timeline entities" onChange={(event) => setDraft({ ...draft, entityIds: [...event.currentTarget.selectedOptions].map((option) => option.value) })} value={draft.entityIds}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><label>Encounter<select aria-label="Linked timeline encounter" onChange={(event) => setDraft({ ...draft, encounterId: event.target.value })} value={draft.encounterId}><option value="">No encounter link</option>{encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.name}</option>)}</select></label><label>Brew to open<select aria-label="Linked timeline brew" onChange={(event) => setDraft({ ...draft, brewId: event.target.value, sectionId: '' })} value={draft.brewId}><option value="">No brew jump</option>{brews.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Section<select aria-label="Linked timeline brew section" disabled={!draftBrew} onChange={(event) => setDraft({ ...draft, sectionId: event.target.value })} value={draft.sectionId}><option value="">Beginning of brew</option>{draftSections.map((section) => <option key={section.id} value={section.id}>{`${'—'.repeat(Math.max(0, section.level - 1))} ${section.text}`}</option>)}</select></label><button className="primary-button" onClick={submitTimeline} type="button">Add to timeline</button></div>
      <section className="visual-timeline" aria-label="Visual campaign timeline"><div className="visual-timeline-heading"><h3>Campaign tree</h3><span>Main campaign <i className="visual-main" /> Quest <i className="visual-quest" /> Backstory <i className="visual-backstory" /></span></div>{visualEvents.length ? <div className="campaign-tree"><div className="campaign-tree-columns">{visualEvents.map((event) => <div className={`tree-column lane-${event.lane}`} key={event.id}><span className="tree-connector" /><button aria-label={event.brewId || event.worldbuildingId ? `Open ${event.title}` : event.title} className={`tree-node ${event.system ? 'is-system' : ''}`} disabled={!event.brewId && !event.worldbuildingId} onClick={() => event.brewId ? onOpenBrewSection(event.brewId, event.sectionId) : event.worldbuildingId ? onOpenWorldbuildingEntry(event.worldbuildingId) : undefined} type="button"><i /><strong>{event.title}</strong><span>{event.subtitle}</span>{event.system && <small>World Event</small>}</button></div>)}</div></div> : <p>Create a story beat or complete a structured action to see progression here.</p>}</section>
      <div className="timeline-list">{timeline.map((entry) => { const encounter = entry.encounterId ? encounterById.get(entry.encounterId) : undefined; return <article className={`timeline-entry lane-${entry.lane} status-${entry.status}`} key={entry.id}><div className="timeline-entry-meta"><span>{entry.lane === 'main' ? 'Main campaign' : entry.lane === 'quest' ? 'Quest / side story' : 'Character backstory'}</span><b>{entry.status}</b></div><div><h3>{entry.title}</h3>{timelineDateLabel(entry) && <p className="timeline-when">{timelineDateLabel(entry)}</p>}{entry.notes && <p>{entry.notes}</p>}{entry.entityIds.length > 0 && <p className="timeline-links">{entry.entityIds.flatMap((id) => { const entity = entitiesById.get(id); return entity ? [<button key={id} onClick={() => onOpenEntity(entity)} type="button">{entity.name}</button>] : []; })}</p>}{encounter && <button className="timeline-encounter-link" onClick={() => onOpenEncounter(encounter)} type="button">Open {encounter.name}</button>}{entry.brewId && <button className="timeline-encounter-link" onClick={() => onOpenBrewSection(entry.brewId!, entry.sectionId)} type="button">Open linked brew{entry.sectionId ? ' section' : ''}</button>}{entry.worldbuildingId && <button className="timeline-encounter-link" onClick={() => onOpenWorldbuildingEntry(entry.worldbuildingId!)} type="button">Open Worldbuilding entry</button>}</div><button className="quiet-danger" onClick={() => onDeleteTimelineEntry(entry.id)} type="button">Remove</button></article>; })}</div>
      <div className="timeline-system-events"><h3>Structured World Events</h3>{recentEvents.length ? recentEvents.map((event) => <article key={event.id}><strong>{event.type.replaceAll('.', ' ')}</strong><span>{new Date(event.occurredAt).toLocaleString()} · {event.source.kind}</span></article>) : <p>No structured world events yet.</p>}</div>
    </section>
  </main>;
}
