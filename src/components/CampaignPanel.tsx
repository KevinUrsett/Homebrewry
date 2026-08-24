import { useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { CampaignPosition, DerivedPartyLocation } from '../lib/campaignProgress';
import { CampaignMapPanel } from './CampaignMapPanel';
import { PlotBoardPanel, type PlotBeatDraftSeed } from './PlotBoardPanel';
import type { Brew, CampaignEntity, CampaignMap, Encounter, EntityCurrentState, EntityReference, PlotBoard, WorldEvent, WorldbuildingEntry } from '../types';
import '../campaign.css';

export type { PlotBeatDraftSeed } from './PlotBoardPanel';

type CampaignPanelProps = {
  position: CampaignPosition | null;
  partyLocation: DerivedPartyLocation;
  brews: readonly Brew[];
  encounters: readonly Encounter[];
  entities: readonly CampaignEntity[];
  currentStateByEntityId: ReadonlyMap<string, EntityCurrentState>;
  worldEvents: readonly WorldEvent[];
  campaignMap?: CampaignMap;
  plotBoard?: PlotBoard;
  entityReferences: readonly EntityReference[];
  worldbuildingEntries: readonly WorldbuildingEntry[];
  currentBrewId?: string;
  onOpenEncounter: (encounter: Encounter) => void;
  onOpenEntity: (entity: CampaignEntity) => void;
  onSetCurrentBrew: (brewId: string | null) => void;
  plotBeatDraftSeed?: PlotBeatDraftSeed | null;
  onPlotBeatDraftSeedApplied?: () => void;
  onSaveCampaignMap: (map: CampaignMap) => void;
  onSavePlotBoard: (board: PlotBoard) => void;
};

const entityLabel = (entity: CampaignEntity) => entity.kind === 'npc' ? 'NPC' : entity.kind;
const campaignCardOrderStorageKey = 'homebrewry-campaign-card-order-v1';

const campaignCardDefaults = {
  overview: ['current-brew', 'party-location', 'campaign-now'],
  details: ['encounter-path', 'active-quests', 'important-entities', 'recent-events'],
  workspaces: ['plot-board', 'campaign-map']
} as const;

type CampaignCardGroup = keyof typeof campaignCardDefaults;
type OverviewCardId = (typeof campaignCardDefaults.overview)[number];
type DetailCardId = (typeof campaignCardDefaults.details)[number];
type WorkspaceCardId = (typeof campaignCardDefaults.workspaces)[number];
type CampaignCardId = OverviewCardId | DetailCardId | WorkspaceCardId;
type CampaignCardOrder = Record<CampaignCardGroup, CampaignCardId[]>;
type CardDrag = { group: CampaignCardGroup; id: CampaignCardId };

function normaliseCardOrder(group: CampaignCardGroup, saved: unknown): CampaignCardId[] {
  const defaults = campaignCardDefaults[group] as readonly CampaignCardId[];
  const allowed = new Set<CampaignCardId>(defaults);
  const values = Array.isArray(saved)
    ? saved.filter((item): item is CampaignCardId => typeof item === 'string' && allowed.has(item as CampaignCardId))
    : [];
  return [...values, ...defaults.filter((id) => !values.includes(id))];
}

function readCampaignCardOrder(): CampaignCardOrder {
  const fallback = (): CampaignCardOrder => ({
    overview: [...campaignCardDefaults.overview],
    details: [...campaignCardDefaults.details],
    workspaces: [...campaignCardDefaults.workspaces]
  });
  if (typeof window === 'undefined') return fallback();
  try {
    const saved = JSON.parse(window.localStorage.getItem(campaignCardOrderStorageKey) ?? '{}') as Partial<CampaignCardOrder>;
    return {
      overview: normaliseCardOrder('overview', saved.overview),
      details: normaliseCardOrder('details', saved.details),
      workspaces: normaliseCardOrder('workspaces', saved.workspaces)
    };
  } catch {
    return fallback();
  }
}

function persistCampaignCardOrder(order: CampaignCardOrder) {
  try {
    window.localStorage.setItem(campaignCardOrderStorageKey, JSON.stringify(order));
  } catch {
    // The order is a convenience preference; Campaign remains usable without local storage.
  }
}

type SortableCampaignCardProps = {
  id: CampaignCardId;
  group: CampaignCardGroup;
  label: string;
  className: string;
  children: ReactNode;
  arranging: boolean;
  dragging: boolean;
  onMove: (group: CampaignCardGroup, id: CampaignCardId, direction: -1 | 1) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, drag: CardDrag) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, target: CardDrag) => void;
  onPointerStart: (event: ReactPointerEvent<HTMLButtonElement>, drag: CardDrag) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

function SortableCampaignCard({ id, group, label, className, children, arranging, dragging, onMove, onDragStart, onDragEnd, onDrop, onPointerStart, onPointerMove, onPointerEnd }: SortableCampaignCardProps) {
  const drag = { group, id };
  return <article
    className={`${className} campaign-sortable-card ${arranging ? 'is-arranging' : ''} ${dragging ? 'is-dragging' : ''}`}
    data-campaign-card-group={group}
    data-campaign-card-id={id}
    onDragOver={arranging ? (event) => event.preventDefault() : undefined}
    onDrop={arranging ? (event) => onDrop(event, drag) : undefined}
  >
    {arranging && <div className="campaign-card-arrange-controls" aria-label={`Arrange ${label}`}>
      <button aria-label={`Move ${label} up`} onClick={() => onMove(group, id, -1)} type="button">↑</button>
      <button
        aria-label={`Drag ${label} to reposition`}
        className="campaign-card-arrange-handle"
        draggable
        onDragEnd={onDragEnd}
        onDragStart={(event) => onDragStart(event, drag)}
        onPointerCancel={onPointerEnd}
        onPointerDown={(event) => onPointerStart(event, drag)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        type="button"
      >⋮⋮</button>
      <button aria-label={`Move ${label} down`} onClick={() => onMove(group, id, 1)} type="button">↓</button>
    </div>}
    {children}
  </article>;
}

export function CampaignPanel({ position, partyLocation, brews, encounters, entities, currentStateByEntityId, worldEvents, campaignMap, plotBoard, entityReferences, worldbuildingEntries, currentBrewId, onOpenEncounter, onOpenEntity, onSetCurrentBrew, plotBeatDraftSeed, onPlotBeatDraftSeedApplied, onSaveCampaignMap, onSavePlotBoard }: CampaignPanelProps) {
  const [arrangingCards, setArrangingCards] = useState(false);
  const [cardOrder, setCardOrder] = useState<CampaignCardOrder>(readCampaignCardOrder);
  const [draggingCard, setDraggingCard] = useState<CampaignCardId | null>(null);
  const pointerDragRef = useRef<CardDrag | null>(null);
  const brew = brews.find((item) => item.id === currentBrewId) ?? brews.find((item) => item.id === position?.brewId);
  const active = encounters.find((item) => item.id === position?.activeEncounterId);
  const previous = encounters.find((item) => item.id === position?.previousEncounterId);
  const next = encounters.find((item) => item.id === position?.nextEncounterId);
  const activeQuests = useMemo(() => entities.filter((entity) => entity.kind === 'quest' && !['complete', 'completed', 'failed'].includes(String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active').toLowerCase())), [currentStateByEntityId, entities]);
  const notable = useMemo(() => entities.filter((entity) => entity.kind === 'npc' || entity.kind === 'faction').filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value !== 'dead').slice(0, 8), [currentStateByEntityId, entities]);
  const recentEvents = useMemo(() => [...worldEvents].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 8), [worldEvents]);

  const saveCardOrder = (nextOrder: CampaignCardOrder) => {
    setCardOrder(nextOrder);
    persistCampaignCardOrder(nextOrder);
  };

  const reorderCards = (source: CardDrag, target: CardDrag) => {
    if (source.group !== target.group || source.id === target.id) return;
    const nextGroupOrder = [...cardOrder[source.group]];
    const sourceIndex = nextGroupOrder.indexOf(source.id);
    if (sourceIndex < 0) return;
    nextGroupOrder.splice(sourceIndex, 1);
    const targetIndex = nextGroupOrder.indexOf(target.id);
    if (targetIndex < 0) return;
    nextGroupOrder.splice(targetIndex, 0, source.id);
    saveCardOrder({ ...cardOrder, [source.group]: nextGroupOrder });
  };

  const moveCard = (group: CampaignCardGroup, id: CampaignCardId, direction: -1 | 1) => {
    const groupOrder = [...cardOrder[group]];
    const currentIndex = groupOrder.indexOf(id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= groupOrder.length) return;
    [groupOrder[currentIndex], groupOrder[nextIndex]] = [groupOrder[nextIndex], groupOrder[currentIndex]];
    saveCardOrder({ ...cardOrder, [group]: groupOrder });
  };

  const dragFromPoint = (clientX: number, clientY: number): CardDrag | null => {
    const card = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-campaign-card-id]');
    const group = card?.dataset.campaignCardGroup as CampaignCardGroup | undefined;
    const id = card?.dataset.campaignCardId as CampaignCardId | undefined;
    return group && id && campaignCardDefaults[group].includes(id as never) ? { group, id } : null;
  };

  const startPointerDrag = (event: ReactPointerEvent<HTMLButtonElement>, drag: CardDrag) => {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    pointerDragRef.current = drag;
    setDraggingCard(drag.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const movePointerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pointerDragRef.current || event.pointerType === 'mouse') return;
    event.preventDefault();
  };

  const finishPointerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const source = pointerDragRef.current;
    if (!source) return;
    const target = dragFromPoint(event.clientX, event.clientY);
    if (target) reorderCards(source, target);
    pointerDragRef.current = null;
    setDraggingCard(null);
  };

  const overviewCards: Record<OverviewCardId, ReactNode> = {
    'current-brew': <><span>Current brew</span><select aria-label="Current campaign brew" onChange={(event) => onSetCurrentBrew(event.target.value || null)} value={currentBrewId ?? ''}><option value="">Automatic from encounter flow</option>{brews.map((item) => <option key={item.id} value={item.id}>{item.title || 'Untitled Brew'}</option>)}</select><small>{currentBrewId ? (position?.brewId === brew?.id ? position?.headingPath.join(' › ') || 'No current section' : 'Saved campaign selection') : position?.headingPath.join(' › ') || 'No current section'}</small></>,
    'party-location': <><span>Party location</span><strong>{partyLocation?.name ?? 'Not established'}</strong><small>{partyLocation ? (partyLocation.source === 'manual' ? 'Manual override' : 'Derived from current section') : 'Link a location in the current section or set an override.'}</small></>,
    'campaign-now': <><span>Campaign now</span><strong>{active ? `Active: ${active.name}` : previous ? `After: ${previous.name}` : 'Opening position'}</strong><small>{next ? `Next: ${next.name}` : 'No required encounter is queued.'}</small></>
  };

  const detailCards: Record<DetailCardId, ReactNode> = {
    'encounter-path': <><h2>Encounter path</h2>{active && <button onClick={() => onOpenEncounter(active)} type="button"><span>Active</span><strong>{active.name}</strong></button>}{previous && !active && <button onClick={() => onOpenEncounter(previous)} type="button"><span>Previous</span><strong>{previous.name}</strong></button>}{next && <button onClick={() => onOpenEncounter(next)} type="button"><span>Next</span><strong>{next.name}</strong></button>}{!active && !previous && !next && <p>No linked encounters yet.</p>}</>,
    'active-quests': <><h2>Active quests</h2>{activeQuests.length ? activeQuests.map((entity) => <button key={entity.id} onClick={() => onOpenEntity(entity)} type="button"><span>{String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active')}</span><strong>{entity.name}</strong></button>) : <p>No active quests have been classified yet.</p>}</>,
    'important-entities': <><h2>Important entities</h2>{notable.length ? notable.map((entity) => <button key={entity.id} onClick={() => onOpenEntity(entity)} type="button"><span>{entityLabel(entity)} · {String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'unknown')}</span><strong>{entity.name}</strong></button>) : <p>No confirmed NPCs or factions yet.</p>}</>,
    'recent-events': <><h2>Recent world events</h2>{recentEvents.length ? recentEvents.map((event) => <div key={event.id}><strong>{event.type.replaceAll('.', ' ')}</strong><span>{new Date(event.occurredAt).toLocaleString()}</span></div>) : <p>No structured world events yet.</p>}</>
  };

  const overviewLabels: Record<OverviewCardId, string> = { 'current-brew': 'Current brew', 'party-location': 'Party location', 'campaign-now': 'Campaign now' };
  const detailLabels: Record<DetailCardId, string> = { 'encounter-path': 'Encounter path', 'active-quests': 'Active quests', 'important-entities': 'Important entities', 'recent-events': 'Recent world events' };
  const workspaceLabels: Record<WorkspaceCardId, string> = { 'plot-board': 'Plot board', 'campaign-map': 'Campaign map' };
  const workspaceCards: Record<WorkspaceCardId, ReactNode> = {
    'plot-board': <PlotBoardPanel board={plotBoard} draftSeed={plotBeatDraftSeed} entities={entities} onDraftSeedApplied={onPlotBeatDraftSeedApplied} onSave={onSavePlotBoard} />,
    'campaign-map': <CampaignMapPanel brews={brews} campaignMap={campaignMap} currentStateByEntityId={currentStateByEntityId} entities={entities} entityReferences={entityReferences} worldbuildingEntries={worldbuildingEntries} onSave={onSaveCampaignMap} />
  };
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, drag: CardDrag) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-homebrewry-campaign-card', JSON.stringify(drag)); setDraggingCard(drag.id); };
  const handleDrop = (event: DragEvent<HTMLElement>, target: CardDrag) => { event.preventDefault(); try { const source = JSON.parse(event.dataTransfer.getData('application/x-homebrewry-campaign-card')) as CardDrag; if (source?.group && source?.id) reorderCards(source, target); } catch { /* Ignore items dragged from outside the dashboard. */ } setDraggingCard(null); };

  return <main className="campaign-page" aria-label="Campaign dashboard">
    <header className="campaign-page-header"><div><p className="eyebrow">Generated campaign state</p><h1>Campaign</h1><p>Current status assembled from encounters, explicit links, and World Events.</p></div><div className="campaign-page-actions"><button aria-pressed={arrangingCards} className={arrangingCards ? 'is-selected' : ''} onClick={() => { setArrangingCards((current) => !current); setDraggingCard(null); pointerDragRef.current = null; }} type="button">{arrangingCards ? 'Done arranging' : 'Arrange cards'}</button>{arrangingCards && <><small>Drag ⋮⋮, or use ↑ and ↓.</small><button onClick={() => saveCardOrder({ overview: [...campaignCardDefaults.overview], details: [...campaignCardDefaults.details], workspaces: [...campaignCardDefaults.workspaces] })} type="button">Reset order</button></>}</div></header>
    <section className="campaign-hero-grid">
      {cardOrder.overview.map((id) => <SortableCampaignCard className={id === 'current-brew' ? 'campaign-current-brew' : ''} dragging={draggingCard === id} group="overview" id={id as OverviewCardId} key={id} label={overviewLabels[id as OverviewCardId]} arranging={arrangingCards} onDragEnd={() => setDraggingCard(null)} onDragStart={handleDragStart} onDrop={handleDrop} onMove={moveCard} onPointerEnd={finishPointerDrag} onPointerMove={movePointerDrag} onPointerStart={startPointerDrag}>{overviewCards[id as OverviewCardId]}</SortableCampaignCard>)}
    </section>
    <section className="campaign-grid">
      {cardOrder.details.map((id) => <SortableCampaignCard className="campaign-card" dragging={draggingCard === id} group="details" id={id as DetailCardId} key={id} label={detailLabels[id as DetailCardId]} arranging={arrangingCards} onDragEnd={() => setDraggingCard(null)} onDragStart={handleDragStart} onDrop={handleDrop} onMove={moveCard} onPointerEnd={finishPointerDrag} onPointerMove={movePointerDrag} onPointerStart={startPointerDrag}>{detailCards[id as DetailCardId]}</SortableCampaignCard>)}
    </section>
    <section className="campaign-workspace-stack" aria-label="Campaign workspaces">
      {cardOrder.workspaces.map((id) => <SortableCampaignCard className="campaign-workspace" dragging={draggingCard === id} group="workspaces" id={id as WorkspaceCardId} key={id} label={workspaceLabels[id as WorkspaceCardId]} arranging={arrangingCards} onDragEnd={() => setDraggingCard(null)} onDragStart={handleDragStart} onDrop={handleDrop} onMove={moveCard} onPointerEnd={finishPointerDrag} onPointerMove={movePointerDrag} onPointerStart={startPointerDrag}>{workspaceCards[id as WorkspaceCardId]}</SortableCampaignCard>)}
    </section>
  </main>;
}
