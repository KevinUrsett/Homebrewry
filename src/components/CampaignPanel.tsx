import { useMemo } from 'react';
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

export function CampaignPanel({ position, partyLocation, brews, encounters, entities, currentStateByEntityId, worldEvents, campaignMap, plotBoard, entityReferences, worldbuildingEntries, currentBrewId, onOpenEncounter, onOpenEntity, onSetCurrentBrew, plotBeatDraftSeed, onPlotBeatDraftSeedApplied, onSaveCampaignMap, onSavePlotBoard }: CampaignPanelProps) {
  const brew = brews.find((item) => item.id === currentBrewId) ?? brews.find((item) => item.id === position?.brewId);
  const active = encounters.find((item) => item.id === position?.activeEncounterId);
  const previous = encounters.find((item) => item.id === position?.previousEncounterId);
  const next = encounters.find((item) => item.id === position?.nextEncounterId);
  const activeQuests = useMemo(() => entities.filter((entity) => entity.kind === 'quest' && !['complete', 'completed', 'failed'].includes(String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active').toLowerCase())), [currentStateByEntityId, entities]);
  const notable = useMemo(() => entities.filter((entity) => entity.kind === 'npc' || entity.kind === 'faction').filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value !== 'dead').slice(0, 8), [currentStateByEntityId, entities]);
  const recentEvents = useMemo(() => [...worldEvents].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 8), [worldEvents]);

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
    <PlotBoardPanel board={plotBoard} draftSeed={plotBeatDraftSeed} entities={entities} onDraftSeedApplied={onPlotBeatDraftSeedApplied} onSave={onSavePlotBoard} />
    <CampaignMapPanel brews={brews} campaignMap={campaignMap} currentStateByEntityId={currentStateByEntityId} entities={entities} entityReferences={entityReferences} worldbuildingEntries={worldbuildingEntries} onSave={onSaveCampaignMap} />
  </main>;
}
