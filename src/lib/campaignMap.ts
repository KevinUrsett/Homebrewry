import type { Brew, CampaignEntity, CampaignMap, CampaignMapLink, CampaignMapNode, Encounter, EntityCurrentState, EntityReference, TimelineEntry, WorldbuildingEntry } from '../types';
import { worldbuildingReferenceMatches } from './worldbuildingReferences';

export type ReferenceMapNode = {
  id: string;
  label: string;
  kind: 'entity' | 'brew' | 'encounter' | 'timeline';
  subtitle: string;
  x: number;
  y: number;
  entityId?: string;
  brewId?: string;
  encounterId?: string;
};

export type ReferenceMapLink = { id: string; sourceId: string; targetId: string; label: string };
export type ReferenceMap = { nodes: ReferenceMapNode[]; links: ReferenceMapLink[] };

const positionNodes = <T extends { id: string }>(nodes: T[]): (T & { x: number; y: number })[] => nodes.map((node, index) => {
  const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length) - Math.PI / 2;
  const radius = nodes.length < 5 ? 27 : 39;
  return { ...node, x: Math.round(50 + Math.cos(angle) * radius), y: Math.round(50 + Math.sin(angle) * radius) };
});

export function deriveReferenceMap(
  entities: readonly CampaignEntity[],
  entries: readonly WorldbuildingEntry[],
  entityReferences: readonly EntityReference[],
  timelineEntries: readonly TimelineEntry[],
  brews: readonly Brew[],
  encounters: readonly Encounter[],
  currentState: ReadonlyMap<string, EntityCurrentState>
): ReferenceMap {
  const entryEntityId = new Map(entities.flatMap((entity) => entity.source.kind === 'worldbuilding' ? [[entity.source.id.toLowerCase(), entity.id] as const] : []));
  const nodes: Omit<ReferenceMapNode, 'x' | 'y'>[] = entities.map((entity) => ({
    id: entity.id,
    label: entity.name,
    kind: 'entity',
    subtitle: String(currentState.get(entity.id)?.fields.status?.value ?? entity.kind),
    entityId: entity.id
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const addNode = (node: Omit<ReferenceMapNode, 'x' | 'y'>) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };
  const links: ReferenceMapLink[] = [];
  const addLink = (sourceId: string, targetId: string, label: string) => {
    if (sourceId === targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) return;
    const id = `${sourceId}|${targetId}|${label}`;
    if (!links.some((link) => link.id === id)) links.push({ id, sourceId, targetId, label });
  };

  for (const reference of entityReferences) {
    if (reference.source.kind === 'brew') {
      const source = reference.source;
      const targetId = `brew:${source.brewId}`;
      const brew = brews.find((item) => item.id === source.brewId);
      addNode({ id: targetId, label: brew?.title || 'Untitled Brew', kind: 'brew', subtitle: 'Brew', brewId: source.brewId });
      addLink(reference.entityId, targetId, 'referenced in');
    } else {
      const source = reference.source;
      const targetId = `encounter:${source.encounterId}`;
      const encounter = encounters.find((item) => item.id === source.encounterId);
      addNode({ id: targetId, label: encounter?.name || 'Untitled encounter', kind: 'encounter', subtitle: 'Encounter', encounterId: source.encounterId });
      addLink(reference.entityId, targetId, 'referenced in');
    }
  }

  for (const entry of entries) {
    const sourceId = entryEntityId.get(entry.id.toLowerCase());
    if (!sourceId) continue;
    for (const reference of worldbuildingReferenceMatches(entry.notes)) {
      const targetId = entryEntityId.get(reference.id);
      if (targetId) addLink(sourceId, targetId, 'links to');
    }
  }

  for (const entry of timelineEntries) {
    const id = `timeline:${entry.id}`;
    addNode({ id, label: entry.title, kind: 'timeline', subtitle: entry.status });
    for (const entityId of entry.entityIds) addLink(id, entityId, 'involves');
    if (entry.brewId) {
      const brewId = `brew:${entry.brewId}`;
      const brew = brews.find((item) => item.id === entry.brewId);
      addNode({ id: brewId, label: brew?.title || 'Untitled Brew', kind: 'brew', subtitle: 'Brew', brewId: entry.brewId });
      addLink(id, brewId, 'points to');
    }
    if (entry.encounterId) {
      const encounterId = `encounter:${entry.encounterId}`;
      const encounter = encounters.find((item) => item.id === entry.encounterId);
      addNode({ id: encounterId, label: encounter?.name || 'Untitled encounter', kind: 'encounter', subtitle: 'Encounter', encounterId: entry.encounterId });
      addLink(id, encounterId, 'records');
    }
  }

  return { nodes: positionNodes(nodes), links };
}

export function createBlankCampaignMap(timestamp = new Date().toISOString()): CampaignMap {
  return { nodes: [], links: [], updatedAt: timestamp };
}

export function createCampaignMapFromReferenceMap(reference: ReferenceMap, timestamp = new Date().toISOString()): CampaignMap {
  const nodes: CampaignMapNode[] = reference.nodes.map((node) => ({ id: crypto.randomUUID(), label: node.label, kind: node.entityId ? 'entity' : 'note', ...(node.entityId ? { entityId: node.entityId } : {}), x: node.x, y: node.y, createdAt: timestamp, updatedAt: timestamp }));
  const mapId = new Map(reference.nodes.map((node, index) => [node.id, nodes[index]!.id]));
  const links: CampaignMapLink[] = reference.links.flatMap((link) => {
    const sourceId = mapId.get(link.sourceId);
    const targetId = mapId.get(link.targetId);
    return sourceId && targetId ? [{ id: crypto.randomUUID(), sourceId, targetId, label: link.label, createdAt: timestamp }] : [];
  });
  return { nodes, links, updatedAt: timestamp };
}
