import { useEffect, useMemo, useState } from 'react';
import type { CampaignPosition, DerivedPartyLocation } from '../lib/campaignProgress';
import { belentorMonths, compareBelentorDates, formatBelentorDate } from '../lib/belentorCalendar';
import { CampaignMapPanel } from './CampaignMapPanel';
import type { BelentorEra, BelentorMonth, Brew, CampaignEntity, CampaignMap, Encounter, EntityCurrentState, EntityReference, TimelineEntry, TimelineLane, TimelineStatus, WorldEvent, WorldbuildingEntry } from '../types';
import '../campaign.css';

export type TimelineDraftSeed = {
  title?: string;
  entityIds?: string[];
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
  onSetCurrentBrew: (brewId: string | null) => void;
  timelineDraftSeed?: TimelineDraftSeed | null;
  onTimelineDraftSeedApplied?: () => void;
  onSaveTimelineEntry: (entry: TimelineEntry | Omit<TimelineEntry, 'id' | 'campaignId' | 'order' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteTimelineEntry: (entryId: string) => void;
  onSaveCampaignMap: (map: CampaignMap) => void;
};

type TimelineDraft = {
  lane: TimelineLane;
  title: string;
  notes: string;
  dateEra: BelentorEra;
  dateYear: string;
  dateMonth: BelentorMonth;
  dateDay: string;
  parentId: string;
  referenceEntityId: string;
};

const emptyDraft = (lane: TimelineLane = 'main'): TimelineDraft => ({
  lane,
  title: '',
  notes: '',
  dateEra: 'AA',
  dateYear: '',
  dateMonth: 'Din',
  dateDay: '',
  parentId: '',
  referenceEntityId: ''
});

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

export function CampaignPanel({ position, partyLocation, brews, encounters, entities, currentStateByEntityId, worldEvents, timelineEntries, campaignMap, entityReferences, worldbuildingEntries, currentBrewId, onOpenEncounter, onOpenEntity, onSetCurrentBrew, timelineDraftSeed, onTimelineDraftSeedApplied, onSaveTimelineEntry, onDeleteTimelineEntry, onSaveCampaignMap }: CampaignPanelProps) {
  const [draft, setDraft] = useState<TimelineDraft>(() => emptyDraft());
  const [referenceQuery, setReferenceQuery] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const orderedTimelineEntries = useMemo(() => orderTimeline(timelineEntries), [timelineEntries]);
  const timelineById = useMemo(() => new Map(orderedTimelineEntries.map((entry) => [entry.id, entry])), [orderedTimelineEntries]);
  const childrenByParent = useMemo(() => {
    const children = new Map<string, TimelineEntry[]>();
    for (const entry of orderedTimelineEntries) {
      if (!entry.parentId || !timelineById.has(entry.parentId)) continue;
      children.set(entry.parentId, [...(children.get(entry.parentId) ?? []), entry]);
    }
    return children;
  }, [orderedTimelineEntries, timelineById]);
  const mainStory = useMemo(() => orderedTimelineEntries.filter((entry) => entry.lane === 'main'), [orderedTimelineEntries]);
  const referenceCandidates = useMemo(() => {
    const query = referenceQuery.trim().toLocaleLowerCase();
    return entities
      .filter((entity) => !query || `${entity.name} ${entity.aliases.join(' ')} ${entity.kind}`.toLocaleLowerCase().includes(query))
      .slice(0, 8);
  }, [entities, referenceQuery]);
  const selectedReference = draft.referenceEntityId ? entityById.get(draft.referenceEntityId) : undefined;
  const brew = brews.find((item) => item.id === currentBrewId) ?? brews.find((item) => item.id === position?.brewId);
  const active = encounters.find((item) => item.id === position?.activeEncounterId);
  const previous = encounters.find((item) => item.id === position?.previousEncounterId);
  const next = encounters.find((item) => item.id === position?.nextEncounterId);
  const activeQuests = entities.filter((entity) => entity.kind === 'quest' && !['complete', 'completed', 'failed'].includes(String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active').toLowerCase()));
  const notable = entities.filter((entity) => entity.kind === 'npc' || entity.kind === 'faction').filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value !== 'dead').slice(0, 8);
  const recentEvents = [...worldEvents].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 8);

  useEffect(() => {
    if (!timelineDraftSeed) return;
    const seededEntity = timelineDraftSeed.entityIds?.find((id) => entityById.has(id));
    setDraft((current) => ({ ...current, title: timelineDraftSeed.title ?? current.title, referenceEntityId: seededEntity ?? current.referenceEntityId }));
    onTimelineDraftSeedApplied?.();
  }, [entityById, onTimelineDraftSeedApplied, timelineDraftSeed]);

  const submitTimeline = () => {
    if (!draft.title.trim()) {
      setSaveNotice('Give the story node a title first.');
      return;
    }
    if (draft.lane !== 'main' && !draft.parentId) {
      setSaveNotice('Attach side stories and backstories to a story node.');
      return;
    }
    const year = Number(draft.dateYear);
    const day = Number(draft.dateDay);
    const date = Number.isInteger(year) && year >= 0 && Number.isInteger(day) && day >= 1 && day <= 30
      ? { era: draft.dateEra, year, month: draft.dateMonth, day }
      : undefined;
    const entity = draft.referenceEntityId ? entityById.get(draft.referenceEntityId) : undefined;
    onSaveTimelineEntry({
      lane: draft.lane,
      status: 'planned',
      title: draft.title,
      when: date ? formatBelentorDate(date) : '',
      date,
      notes: draft.notes,
      entityIds: entity ? [entity.id] : [],
      parentId: draft.parentId || undefined,
      ...(entity?.source.kind === 'worldbuilding' ? { worldbuildingId: entity.source.id } : {})
    });
    setSaveNotice(`Added “${draft.title.trim()}”.`);
    setDraft(emptyDraft(draft.lane));
    setReferenceQuery('');
  };

  const renderBranch = (entry: TimelineEntry) => {
    const reference = entry.entityIds.map((id) => entityById.get(id)).find(Boolean);
    const children = (childrenByParent.get(entry.id) ?? []).filter((child) => child.lane !== 'main');
    return <div className={`story-branch lane-${entry.lane}`} key={entry.id}>
      <span className="story-branch-connector" />
      <div className="story-branch-node"><strong>{entry.title}</strong>{timelineDateLabel(entry) && <small>{timelineDateLabel(entry)}</small>}{reference && <em>{reference.name}</em>}</div>
      {children.length > 0 && <div className="story-branch-children">{children.map(renderBranch)}</div>}
    </div>;
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
    <CampaignMapPanel brews={brews} campaignMap={campaignMap} currentStateByEntityId={currentStateByEntityId} entities={entities} entityReferences={entityReferences} worldbuildingEntries={worldbuildingEntries} onSave={onSaveCampaignMap} />
    <section className="campaign-timeline" aria-label="Story timeline">
      <header><div><p className="eyebrow">Story planning</p><h2>Timeline</h2><small>Plot the main story in the centre, with parallel narratives branching from it.</small></div></header>
      <div className="timeline-branch-actions" aria-label="Choose story type"><button className={draft.lane === 'main' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, lane: 'main' })} type="button">Main story</button><button className={draft.lane === 'quest' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, lane: 'quest' })} type="button">Side story</button><button className={draft.lane === 'backstory' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, lane: 'backstory' })} type="button">Backstory</button></div>
      <div className="timeline-planner">
        <label>Story node<input aria-label="Timeline event title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What happens?" value={draft.title} /></label>
        <label>Attach to<select aria-label="Timeline parent node" onChange={(event) => setDraft({ ...draft, parentId: event.target.value })} value={draft.parentId}><option value="">Start a new narrative</option>{orderedTimelineEntries.map((entry) => <option key={entry.id} value={entry.id}>{`${entry.lane === 'main' ? 'Main' : entry.lane === 'quest' ? 'Side' : 'Backstory'} · ${entry.title}`}</option>)}</select></label>
        <label className="timeline-reference-search">Reference<input aria-label="Search timeline references" onChange={(event) => setReferenceQuery(event.target.value)} placeholder="Search Worldbuilding…" value={referenceQuery} />{selectedReference ? <div className="timeline-reference-selected"><span>{selectedReference.name}</span><button aria-label="Clear selected timeline reference" onClick={() => { setDraft({ ...draft, referenceEntityId: '' }); setReferenceQuery(''); }} type="button">Clear</button></div> : referenceQuery.trim() && <div className="timeline-reference-results">{referenceCandidates.length ? referenceCandidates.map((entity) => <button key={entity.id} onClick={() => { setDraft({ ...draft, referenceEntityId: entity.id }); setReferenceQuery(entity.name); }} type="button"><strong>{entity.name}</strong><small>{entityLabel(entity)}</small></button>) : <span>No confirmed references found.</span>}</div>}</label>
        <div className="timeline-date-fields" aria-label="Optional Belentor calendar date"><label>Era<select aria-label="Belentor era" onChange={(event) => setDraft({ ...draft, dateEra: event.target.value as BelentorEra })} value={draft.dateEra}><option value="AA">AA · After Ascension</option><option value="BA">BA · Before Ascension</option></select></label><label>Year<input aria-label="Belentor year" inputMode="numeric" min="0" onChange={(event) => setDraft({ ...draft, dateYear: event.target.value })} placeholder="Optional" type="number" value={draft.dateYear} /></label><label>Month<select aria-label="Belentor month" onChange={(event) => setDraft({ ...draft, dateMonth: event.target.value as BelentorMonth })} value={draft.dateMonth}>{belentorMonths.map((month) => <option key={month.name} value={month.name}>{month.star ? `${month.name} · ${month.star}` : month.name}</option>)}</select></label><label>Day<input aria-label="Belentor day" inputMode="numeric" max="30" min="1" onChange={(event) => setDraft({ ...draft, dateDay: event.target.value })} placeholder="Optional" type="number" value={draft.dateDay} /></label></div>
        <label className="timeline-notes">Notes<textarea aria-label="Timeline notes" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Private context, a possible outcome, or questions to explore." value={draft.notes} /></label>
        <div className="timeline-submit"><button className="primary-button" onClick={submitTimeline} type="button">Add story node</button>{saveNotice && <span aria-live="polite">{saveNotice}</span>}</div>
      </div>
      <section className="visual-timeline" aria-label="Horizontal story tree"><div className="visual-timeline-heading"><h3>Story tree</h3><span>Main <i className="visual-main" /> Side story <i className="visual-quest" /> Backstory <i className="visual-backstory" /></span></div>{mainStory.length ? <div className="story-tree-scroll"><div className="story-horizontal-tree">{mainStory.map((entry) => { const reference = entry.entityIds.map((id) => entityById.get(id)).find(Boolean); const branches = (childrenByParent.get(entry.id) ?? []).filter((child) => child.lane !== 'main'); return <div className="story-main-column" key={entry.id}><div className="story-branch-stack story-branch-above">{branches.filter((branch) => branch.lane === 'quest').map(renderBranch)}</div><div className="story-main-node"><span className="story-main-dot" /><strong>{entry.title}</strong>{timelineDateLabel(entry) && <small>{timelineDateLabel(entry)}</small>}{reference && <em>{reference.name}</em>}<button className="quiet-danger" onClick={() => onDeleteTimelineEntry(entry.id)} type="button">Remove</button></div><div className="story-branch-stack story-branch-below">{branches.filter((branch) => branch.lane === 'backstory').map(renderBranch)}</div></div>; })}</div></div> : <p>Add a main story node to begin planning.</p>}</section>
      <div className="timeline-system-events"><h3>Structured World Events</h3>{recentEvents.length ? recentEvents.map((event) => <article key={event.id}><strong>{event.type.replaceAll('.', ' ')}</strong><span>{new Date(event.occurredAt).toLocaleString()} · {event.source.kind}</span></article>) : <p>No structured world events yet.</p>}</div>
    </section>
  </main>;
}
