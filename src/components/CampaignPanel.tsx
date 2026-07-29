import type { CampaignPosition, DerivedPartyLocation } from '../lib/campaignProgress';
import type { Brew, CampaignEntity, Encounter, EntityCurrentState, WorldEvent } from '../types';
import '../campaign.css';

type CampaignPanelProps = {
  position: CampaignPosition | null;
  partyLocation: DerivedPartyLocation;
  brews: readonly Brew[];
  encounters: readonly Encounter[];
  entities: readonly CampaignEntity[];
  currentStateByEntityId: ReadonlyMap<string, EntityCurrentState>;
  worldEvents: readonly WorldEvent[];
  onOpenEncounter: (encounter: Encounter) => void;
  onOpenEntity: (entity: CampaignEntity) => void;
};

const entityLabel = (entity: CampaignEntity) => entity.kind === 'npc' ? 'NPC' : entity.kind;

export function CampaignPanel({ position, partyLocation, brews, encounters, entities, currentStateByEntityId, worldEvents, onOpenEncounter, onOpenEntity }: CampaignPanelProps) {
  const brew = brews.find((item) => item.id === position?.brewId);
  const active = encounters.find((item) => item.id === position?.activeEncounterId);
  const previous = encounters.find((item) => item.id === position?.previousEncounterId);
  const next = encounters.find((item) => item.id === position?.nextEncounterId);
  const activeQuests = entities.filter((entity) => entity.kind === 'quest' && !['complete', 'completed', 'failed'].includes(String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? 'active').toLowerCase()));
  const notable = entities.filter((entity) => entity.kind === 'npc' || entity.kind === 'faction').filter((entity) => currentStateByEntityId.get(entity.id)?.fields.status?.value !== 'dead').slice(0, 8);
  const recentEvents = [...worldEvents].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 8);

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
  </main>;
}
