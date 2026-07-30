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

type StoryNodeEditor = {
  id?: string;
  lane: TimelineLane;
  parentId?: string;
  placement: 'right' | 'top' | 'bottom';
  title: string;
  notes: string;
  referenceEntityId: string;
  referenceName: string;
  dateEra: BelentorEra;
  dateYear: string;
  dateMonth: BelentorMonth;
  dateDay: string;
};

const emptyNodeEditor = (lane: TimelineLane = 'main', parentId?: string, placement: StoryNodeEditor['placement'] = 'right'): StoryNodeEditor => ({
  lane,
  title: '',
  notes: '',
  referenceEntityId: '',
  referenceName: '',
  dateEra: 'AA',
  dateYear: '',
  dateMonth: 'Din',
  dateDay: '',
  parentId,
  placement
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
  const [nodeEditor, setNodeEditor] = useState<StoryNodeEditor | null>(null);
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
  const mainStory = useMemo(() => {
    const mainNodes = orderedTimelineEntries.filter((entry) => entry.lane === 'main');
    const mainById = new Map(mainNodes.map((entry) => [entry.id, entry]));
    const children = new Map<string, TimelineEntry[]>();
    for (const entry of mainNodes) {
      if (!entry.parentId || !mainById.has(entry.parentId)) continue;
      children.set(entry.parentId, [...(children.get(entry.parentId) ?? []), entry]);
    }
    const flattened: TimelineEntry[] = [];
    const append = (entry: TimelineEntry) => {
      flattened.push(entry);
      for (const child of children.get(entry.id) ?? []) append(child);
    };
    for (const entry of mainNodes) if (!entry.parentId || !mainById.has(entry.parentId)) append(entry);
    return flattened;
  }, [orderedTimelineEntries]);
  const brew = brews.find((item) => item.id === currentBrewId) ?? brews.find((item) => item.id === position?.brewId);
  const active = encounters.find((item) => item.id === position?.activeEncounterId);
  const previous = encounters.find((item) => item.id === position?.previousEncounterId);
  const next = encounters.find((item) => item.id === position?.nextEncounterId);
  const activeQuests = entities.filter((entity) => entity.kind === 'quest' && !['complete', 'completed', 'failed'].includes(String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active').toLowerCase()));
  const notable = entities.filter((entity) => entity.kind === 'npc' || entity.kind === 'faction').filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value !== 'dead').slice(0, 8);
  const recentEvents = [...worldEvents].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 8);

  useEffect(() => {
    if (!timelineDraftSeed) return;
    const referenceEntityId = timelineDraftSeed.entityIds?.find((id) => entityById.has(id)) ?? '';
    setNodeEditor({ ...emptyNodeEditor('main', mainStory.at(-1)?.id, 'right'), title: timelineDraftSeed.title ?? '', referenceEntityId, referenceName: entityById.get(referenceEntityId)?.name ?? '' });
    onTimelineDraftSeedApplied?.();
  }, [entityById, mainStory, onTimelineDraftSeedApplied, timelineDraftSeed]);

  const openNewNode = (parentId: string, lane: TimelineLane, placement: StoryNodeEditor['placement']) => {
    setNodeEditor(emptyNodeEditor(lane, parentId, placement));
  };

  const openExistingNode = (entry: TimelineEntry) => {
    const referenceEntityId = entry.entityIds.find((id) => entityById.has(id)) ?? '';
    setNodeEditor({
      id: entry.id,
      lane: entry.lane,
      parentId: entry.parentId,
      placement: entry.lane === 'main' ? 'right' : entry.lane === 'quest' ? 'top' : 'bottom',
      title: entry.title,
      notes: entry.notes,
      referenceEntityId,
      referenceName: entityById.get(referenceEntityId)?.name ?? '',
      dateEra: entry.date?.era ?? 'AA',
      dateYear: entry.date ? String(entry.date.year) : '',
      dateMonth: entry.date?.month ?? 'Din',
      dateDay: entry.date ? String(entry.date.day) : ''
    });
  };

  const saveNode = () => {
    if (!nodeEditor?.title.trim()) return;
    const year = Number(nodeEditor.dateYear);
    const day = Number(nodeEditor.dateDay);
    const date = Number.isInteger(year) && year >= 0 && Number.isInteger(day) && day >= 1 && day <= 30
      ? { era: nodeEditor.dateEra, year, month: nodeEditor.dateMonth, day }
      : undefined;
    const entity = entityById.get(nodeEditor.referenceEntityId);
    const entityIds = entity ? [entity.id] : [];
    const source = entity?.source.kind === 'worldbuilding' ? { worldbuildingId: entity.source.id } : {};
    if (nodeEditor.id) {
      const existing = timelineById.get(nodeEditor.id);
      if (existing) {
        const { worldbuildingId: _worldbuildingId, ...withoutWorldbuilding } = existing;
        onSaveTimelineEntry({ ...withoutWorldbuilding, ...source, lane: nodeEditor.lane, title: nodeEditor.title, notes: nodeEditor.notes, when: date ? formatBelentorDate(date) : '', date, entityIds });
      }
    } else {
      onSaveTimelineEntry({ lane: nodeEditor.lane, status: 'planned', title: nodeEditor.title, when: date ? formatBelentorDate(date) : '', date, notes: nodeEditor.notes, entityIds, parentId: nodeEditor.parentId, ...source });
    }
    setNodeEditor(null);
  };

  const renderNodeEditor = () => nodeEditor && <div className="story-node-editor">
    <label>Narrative <select aria-label="Narrative type" onChange={(event) => setNodeEditor({ ...nodeEditor, lane: event.target.value as TimelineLane })} value={nodeEditor.lane}><option value="main">Main story</option><option value="quest">Side story</option><option value="backstory">Backstory</option></select></label>
    <input aria-label="Story node title" autoFocus onChange={(event) => setNodeEditor({ ...nodeEditor, title: event.target.value })} placeholder="Name this node" value={nodeEditor.title} />
    <label>Reference <input aria-label="Reference" list="timeline-reference-options" onChange={(event) => { const entity = entities.find((item) => item.name === event.target.value); setNodeEditor({ ...nodeEditor, referenceName: event.target.value, referenceEntityId: entity?.id ?? '' }); }} placeholder="Search Worldbuilding references" value={nodeEditor.referenceName} /><datalist id="timeline-reference-options">{entities.map((entity) => <option key={entity.id} value={entity.name}>{entityLabel(entity)}</option>)}</datalist></label>
    <div className="story-node-date-fields"><label>Era <select aria-label="Era" onChange={(event) => setNodeEditor({ ...nodeEditor, dateEra: event.target.value as BelentorEra })} value={nodeEditor.dateEra}><option value="AA">AA</option><option value="BA">BA</option></select></label><label>Year <input aria-label="Year" min="0" onChange={(event) => setNodeEditor({ ...nodeEditor, dateYear: event.target.value })} placeholder="Year" type="number" value={nodeEditor.dateYear} /></label><label>Month <select aria-label="Month" onChange={(event) => setNodeEditor({ ...nodeEditor, dateMonth: event.target.value as BelentorMonth })} value={nodeEditor.dateMonth}>{belentorMonths.map(({ name }) => <option key={name} value={name}>{name}</option>)}</select></label><label>Day <input aria-label="Day" max="30" min="1" onChange={(event) => setNodeEditor({ ...nodeEditor, dateDay: event.target.value })} placeholder="Day" type="number" value={nodeEditor.dateDay} /></label></div>
    <textarea aria-label="Story node information" onChange={(event) => setNodeEditor({ ...nodeEditor, notes: event.target.value })} placeholder="Information, possible outcomes, or questions…" value={nodeEditor.notes} />
    <div><button className="primary-button" onClick={saveNode} type="button">Save</button><button onClick={() => setNodeEditor(null)} type="button">Cancel</button>{nodeEditor.id && <button className="quiet-danger" onClick={() => { onDeleteTimelineEntry(nodeEditor.id!); setNodeEditor(null); }} type="button">Remove</button>}</div>
  </div>;

  const renderNodeControls = (entry: TimelineEntry) => <div className="story-node-controls"><button aria-label={`Continue from ${entry.title}`} onClick={() => openNewNode(entry.id, entry.lane, 'right')} type="button">+</button><button aria-label={`Add side story from ${entry.title}`} onClick={() => openNewNode(entry.id, 'quest', 'top')} type="button">+</button><button aria-label={`Add backstory from ${entry.title}`} onClick={() => openNewNode(entry.id, 'backstory', 'bottom')} type="button">+</button></div>;

  const renderBranch = (entry: TimelineEntry) => {
    const children = (childrenByParent.get(entry.id) ?? []).filter((child) => child.lane !== 'main');
    const continuations = children.filter((child) => child.lane === entry.lane);
    const offshoots = children.filter((child) => child.lane !== entry.lane);
    const pendingContinuation = nodeEditor && !nodeEditor.id && nodeEditor.parentId === entry.id && nodeEditor.placement === 'right' ? <div className={`story-branch story-pending-node lane-${nodeEditor.lane}`}>{renderNodeEditor()}</div> : null;
    const pendingOffshoot = nodeEditor && !nodeEditor.id && nodeEditor.parentId === entry.id && nodeEditor.placement !== 'right' ? <div className={`story-branch story-pending-node lane-${nodeEditor.lane}`}>{renderNodeEditor()}</div> : null;
    return <div className={`story-branch-chain lane-${entry.lane}`} key={entry.id}>
      <div className={`story-branch lane-${entry.lane}`}>
        <span className="story-branch-connector" />
        <div className="story-node-shell">{nodeEditor?.id === entry.id ? renderNodeEditor() : <button className="story-branch-node" onClick={() => openExistingNode(entry)} type="button"><strong>{entry.title}</strong>{timelineDateLabel(entry) && <small>{timelineDateLabel(entry)}</small>}</button>}{renderNodeControls(entry)}</div>
        {(offshoots.length > 0 || pendingOffshoot) && <div className="story-branch-children">{pendingOffshoot}{offshoots.map(renderBranch)}</div>}
      </div>
      {continuations.map(renderBranch)}
      {pendingContinuation}
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
      <header><div><p className="eyebrow">Story planning</p><h2>Timeline</h2><small>Use the + controls on a node: right continues its story, top adds a side story, and bottom adds backstory.</small></div></header>
      <section className="visual-timeline" aria-label="Horizontal story tree"><div className="visual-timeline-heading"><h3>Story tree</h3><span>Main <i className="visual-main" /> Side story <i className="visual-quest" /> Backstory <i className="visual-backstory" /></span></div>{mainStory.length ? <div className="story-tree-scroll"><div className="story-horizontal-tree">{mainStory.flatMap((entry) => { const branches = (childrenByParent.get(entry.id) ?? []).filter((child) => child.lane !== 'main'); const column = <div className="story-main-column" key={entry.id}><div className="story-branch-stack story-branch-above">{branches.filter((branch) => branch.lane === 'quest').map(renderBranch)}{nodeEditor && !nodeEditor.id && nodeEditor.parentId === entry.id && nodeEditor.placement === 'top' && <div className="story-branch lane-quest">{renderNodeEditor()}</div>}</div><div className="story-node-shell">{nodeEditor?.id === entry.id ? renderNodeEditor() : <button className="story-main-node" onClick={() => openExistingNode(entry)} type="button"><span className="story-main-dot" /><strong>{entry.title}</strong>{timelineDateLabel(entry) && <small>{timelineDateLabel(entry)}</small>}</button>}{renderNodeControls(entry)}</div><div className="story-branch-stack story-branch-below">{nodeEditor && !nodeEditor.id && nodeEditor.parentId === entry.id && nodeEditor.placement === 'bottom' && <div className="story-branch lane-backstory">{renderNodeEditor()}</div>}{branches.filter((branch) => branch.lane === 'backstory').map(renderBranch)}</div></div>; const rightEditor = nodeEditor && !nodeEditor.id && nodeEditor.parentId === entry.id && nodeEditor.placement === 'right' ? <div className="story-main-column story-main-editor" key={`${entry.id}:new`}><div className="story-node-shell">{renderNodeEditor()}</div></div> : []; return [column, rightEditor]; })}</div></div> : <div className="story-empty"><p>Add the first main story node to begin planning.</p>{nodeEditor ? renderNodeEditor() : <button className="primary-button" onClick={() => setNodeEditor(emptyNodeEditor())} type="button">+ Main story node</button>}</div>}</section>
      <div className="timeline-system-events"><h3>Structured World Events</h3>{recentEvents.length ? recentEvents.map((event) => <article key={event.id}><strong>{event.type.replaceAll('.', ' ')}</strong><span>{new Date(event.occurredAt).toLocaleString()} · {event.source.kind}</span></article>) : <p>No structured world events yet.</p>}</div>
    </section>
  </main>;
}
