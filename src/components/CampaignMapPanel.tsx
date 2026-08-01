import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createBlankCampaignMap } from '../lib/campaignMap';
import { worldbuildingReferenceMatches } from '../lib/worldbuildingReferences';
import type { Brew, CampaignEntity, CampaignMap, CampaignMapLink, CampaignMapNode, EntityCurrentState, EntityReference, WorldbuildingEntry } from '../types';
import '../campaign-map.css';

type CampaignMapPanelProps = {
  brews: readonly Brew[];
  campaignMap?: CampaignMap;
  currentStateByEntityId: ReadonlyMap<string, EntityCurrentState>;
  entities: readonly CampaignEntity[];
  entityReferences: readonly EntityReference[];
  worldbuildingEntries: readonly WorldbuildingEntry[];
  onSave: (map: CampaignMap) => void;
};

type NodeMeta = { notes: string; mapId?: string };
type DisplayNode = CampaignMapNode & { subtitle: string; notes: string; tone: 'entity' | 'note' };
type MapTab = { id: string; title: string };
type MapWorkspace = { tabs: MapTab[]; activeMapId: string };
type WorldbuildingSort = 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc' | 'kind';

type FreeformMindMapProps = {
  nodes: readonly DisplayNode[];
  links: readonly CampaignMapLink[];
  selectedId: string | null;
  onAddConnected: (nodeId: string) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onMoveEnd: () => void;
  onSelect: (nodeId: string) => void;
};

const NODE_META_PREFIX = '__homebrewry_node_meta__:';
const MAP_WORKSPACE_PREFIX = '__homebrewry_map_workspace__:';
const MAP_WORKSPACE_NODE_ID = '__homebrewry_map_workspace__';
const DEFAULT_MAP_ID = 'campaign-map-default';
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const isNodeMetaLink = (link: CampaignMapLink) => link.sourceId === link.targetId && link.label.startsWith(NODE_META_PREFIX);
const isMapWorkspaceLink = (link: CampaignMapLink) => link.sourceId === MAP_WORKSPACE_NODE_ID && link.targetId === MAP_WORKSPACE_NODE_ID && link.label.startsWith(MAP_WORKSPACE_PREFIX);
const isInternalLink = (link: CampaignMapLink) => isNodeMetaLink(link) || isMapWorkspaceLink(link);

function defaultWorkspace(): MapWorkspace {
  return { tabs: [{ id: DEFAULT_MAP_ID, title: 'Main map' }], activeMapId: DEFAULT_MAP_ID };
}

function readMapWorkspace(links: readonly CampaignMapLink[]): MapWorkspace {
  const stored = links.find(isMapWorkspaceLink);
  if (!stored) return defaultWorkspace();
  try {
    const parsed = JSON.parse(stored.label.slice(MAP_WORKSPACE_PREFIX.length)) as Partial<MapWorkspace>;
    const tabs = Array.isArray(parsed.tabs)
      ? parsed.tabs.flatMap((tab) => tab && typeof tab.id === 'string' && typeof tab.title === 'string' && tab.id.trim() && tab.title.trim()
        ? [{ id: tab.id, title: tab.title.trim() }]
        : [])
      : [];
    if (!tabs.length) return defaultWorkspace();
    const activeMapId = typeof parsed.activeMapId === 'string' && tabs.some((tab) => tab.id === parsed.activeMapId)
      ? parsed.activeMapId
      : tabs[0].id;
    return { tabs, activeMapId };
  } catch {
    return defaultWorkspace();
  }
}

function writeMapWorkspace(links: readonly CampaignMapLink[], workspace: MapWorkspace, timestamp: string): CampaignMapLink[] {
  return [
    ...links.filter((link) => !isMapWorkspaceLink(link)),
    {
      id: crypto.randomUUID(),
      sourceId: MAP_WORKSPACE_NODE_ID,
      targetId: MAP_WORKSPACE_NODE_ID,
      label: `${MAP_WORKSPACE_PREFIX}${JSON.stringify(workspace)}`,
      createdAt: timestamp
    }
  ];
}

function readNodeMeta(links: readonly CampaignMapLink[], nodeId: string, fallbackMapId = DEFAULT_MAP_ID): Required<NodeMeta> {
  const stored = links.find((link) => link.sourceId === nodeId && isNodeMetaLink(link));
  if (!stored) return { notes: '', mapId: fallbackMapId };
  try {
    const parsed = JSON.parse(stored.label.slice(NODE_META_PREFIX.length)) as Partial<NodeMeta>;
    return {
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      mapId: typeof parsed.mapId === 'string' && parsed.mapId ? parsed.mapId : fallbackMapId
    };
  } catch {
    return { notes: '', mapId: fallbackMapId };
  }
}

function writeNodeMeta(links: readonly CampaignMapLink[], nodeId: string, meta: Required<NodeMeta>, timestamp: string): CampaignMapLink[] {
  return [
    ...links.filter((link) => !(link.sourceId === nodeId && isNodeMetaLink(link))),
    { id: crypto.randomUUID(), sourceId: nodeId, targetId: nodeId, label: `${NODE_META_PREFIX}${JSON.stringify(meta)}`, createdAt: timestamp }
  ];
}

function FreeformMindMap({ nodes, links, selectedId, onAddConnected, onConnect, onMove, onMoveEnd, onSelect }: FreeformMindMapProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const pointerPosition = (event: PointerEvent<HTMLElement>) => {
    const bounds = surfaceRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100)
    };
  };

  const updateInteraction = (event: PointerEvent<HTMLDivElement>) => {
    const position = pointerPosition(event);
    if (!position) return;
    if (draggingId) onMove(draggingId, clamp(position.x, 3, 97), clamp(position.y, 5, 95));
    if (linkingSourceId) {
      setPointer(position);
      const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-mindmap-node-id]');
      const targetId = element?.dataset.mindmapNodeId;
      setDropTargetId(targetId && targetId !== linkingSourceId ? targetId : null);
    }
  };

  const finishInteraction = () => {
    if (draggingId) onMoveEnd();
    if (linkingSourceId && dropTargetId) onConnect(linkingSourceId, dropTargetId);
    setDraggingId(null);
    setLinkingSourceId(null);
    setDropTargetId(null);
    setPointer(null);
  };

  const cancelInteraction = () => {
    if (draggingId) onMoveEnd();
    setDraggingId(null);
    setLinkingSourceId(null);
    setDropTargetId(null);
    setPointer(null);
  };

  const linkingSource = linkingSourceId ? nodeById.get(linkingSourceId) : undefined;

  return <div className="campaign-mindmap-viewport"><div
    className={`campaign-mindmap-surface ${draggingId ? 'is-moving' : ''} ${linkingSourceId ? 'is-linking' : ''}`}
    onPointerCancel={cancelInteraction}
    onPointerMove={updateInteraction}
    onPointerUp={finishInteraction}
    ref={surfaceRef}
  >
    <svg aria-hidden="true" className="campaign-mindmap-lines" preserveAspectRatio="none" viewBox="0 0 100 100">
      {links.map((link) => {
        const source = nodeById.get(link.sourceId);
        const target = nodeById.get(link.targetId);
        if (!source || !target) return null;
        const bend = Math.max(4, Math.abs(target.x - source.x) * 0.42);
        const direction = target.x >= source.x ? 1 : -1;
        return <path d={`M ${source.x} ${source.y} C ${source.x + bend * direction} ${source.y}, ${target.x - bend * direction} ${target.y}, ${target.x} ${target.y}`} key={link.id} />;
      })}
      {linkingSource && pointer && <path className="campaign-mindmap-drag-line" d={`M ${linkingSource.x} ${linkingSource.y} C ${linkingSource.x + 8} ${linkingSource.y}, ${pointer.x - 8} ${pointer.y}, ${pointer.x} ${pointer.y}`} />}
    </svg>
    {nodes.map((node) => {
      const selected = selectedId === node.id;
      return <article
        className={`campaign-mindmap-node tone-${node.tone} ${selected ? 'is-selected' : ''} ${dropTargetId === node.id ? 'is-drop-target' : ''}`}
        data-mindmap-node-id={node.id}
        key={node.id}
        style={{ left: `${node.x}%`, top: `${node.y}%` }}
      >
        <button className="campaign-mindmap-node-main" onClick={() => onSelect(node.id)} type="button">
          <strong>{node.label}</strong><span>{node.subtitle}</span>{node.notes && <small aria-label="Has notes">Notes</small>}
        </button>
        {selected && <div className="campaign-mindmap-node-controls">
          <button aria-label={`Move ${node.label}`} className="campaign-mindmap-move-handle" onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDraggingId(node.id);
          }} type="button">⠿</button>
          <button aria-label={`Add a connected node to ${node.label}`} className="campaign-mindmap-add-child" onClick={() => onAddConnected(node.id)} type="button">+</button>
          <button aria-label={`Connect ${node.label} to another node`} className="campaign-mindmap-connect-handle" onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setLinkingSourceId(node.id);
            setPointer({ x: node.x, y: node.y });
          }} type="button">●</button>
        </div>}
      </article>;
    })}
  </div></div>;
}

export function CampaignMapPanel({ brews, campaignMap, currentStateByEntityId, entities, entityReferences, worldbuildingEntries, onSave }: CampaignMapPanelProps) {
  const [draft, setDraft] = useState<CampaignMap | null>(campaignMap ?? null);
  const draftRef = useRef<CampaignMap | null>(draft);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [activeMapId, setActiveMapId] = useState(DEFAULT_MAP_ID);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedNotes, setSelectedNotes] = useState('');
  const [worldbuildingQuery, setWorldbuildingQuery] = useState('');
  const [worldbuildingSort, setWorldbuildingSort] = useState<WorldbuildingSort>('name-asc');
  const [selectedWorldbuildingId, setSelectedWorldbuildingId] = useState('');
  const [referenceBrewId, setReferenceBrewId] = useState('');
  const [referencedEntityId, setReferencedEntityId] = useState('');
  const [loadKind, setLoadKind] = useState<'brew' | 'worldbuilding'>('brew');
  const [loadSourceId, setLoadSourceId] = useState('');

  useEffect(() => {
    setDraft(campaignMap ?? null);
    draftRef.current = campaignMap ?? null;
    const workspace = readMapWorkspace(campaignMap?.links ?? []);
    setActiveMapId((current) => workspace.tabs.some((tab) => tab.id === current) ? current : workspace.activeMapId);
    setSelectedId((current) => current && campaignMap?.nodes.some((node) => node.id === current) ? current : null);
  }, [campaignMap]);

  const replaceDraft = (next: CampaignMap, save = true) => {
    draftRef.current = next;
    setDraft(next);
    if (save) onSave(next);
  };

  const workspace = useMemo(() => readMapWorkspace(draft?.links ?? []), [draft?.links]);
  const fallbackMapId = workspace.tabs[0]?.id ?? DEFAULT_MAP_ID;
  const activeTab = workspace.tabs.find((tab) => tab.id === activeMapId) ?? workspace.tabs[0];
  const activeNodes = useMemo(() => (draft?.nodes ?? []).filter((node) => readNodeMeta(draft?.links ?? [], node.id, fallbackMapId).mapId === activeMapId), [activeMapId, draft?.links, draft?.nodes, fallbackMapId]);
  const activeNodeIds = useMemo(() => new Set(activeNodes.map((node) => node.id)), [activeNodes]);
  const visibleLinks = useMemo(() => (draft?.links ?? []).filter((link) => !isInternalLink(link) && activeNodeIds.has(link.sourceId) && activeNodeIds.has(link.targetId)), [activeNodeIds, draft?.links]);
  const entityByWorldbuildingId = useMemo(() => new Map(entities.flatMap((entity) => entity.source.kind === 'worldbuilding' ? [[entity.source.id.toLowerCase(), entity] as const] : [])), [entities]);
  const worldbuildingByEntityId = useMemo(() => {
    const entryById = new Map(worldbuildingEntries.map((entry) => [entry.id.toLowerCase(), entry]));
    return new Map(entities.flatMap((entity) => {
      if (entity.source.kind !== 'worldbuilding') return [];
      const entry = entryById.get(entity.source.id.toLowerCase());
      return entry ? [[entity.id, entry] as const] : [];
    }));
  }, [entities, worldbuildingEntries]);
  const referencedEntities = useMemo(() => {
    const ids = new Set(entityReferences.flatMap((reference) => reference.source.kind === 'brew' && reference.source.brewId === referenceBrewId ? [reference.entityId] : []));
    return entities.filter((entity) => ids.has(entity.id) && !activeNodes.some((node) => node.entityId === entity.id));
  }, [activeNodes, entities, entityReferences, referenceBrewId]);

  const sortedWorldbuildingEntries = useMemo(() => {
    const terms = worldbuildingQuery.trim().toLocaleLowerCase();
    const filtered = worldbuildingEntries.filter((entry) => !terms || [entry.name, entry.kind, ...entry.aliases, entry.notes].join(' ').toLocaleLowerCase().includes(terms));
    return [...filtered].sort((left, right) => {
      if (worldbuildingSort === 'name-desc') return collator.compare(right.name, left.name);
      if (worldbuildingSort === 'updated-desc') return right.updatedAt.localeCompare(left.updatedAt) || collator.compare(left.name, right.name);
      if (worldbuildingSort === 'updated-asc') return left.updatedAt.localeCompare(right.updatedAt) || collator.compare(left.name, right.name);
      if (worldbuildingSort === 'kind') return collator.compare(left.kind, right.kind) || collator.compare(left.name, right.name);
      return collator.compare(left.name, right.name);
    });
  }, [worldbuildingEntries, worldbuildingQuery, worldbuildingSort]);

  useEffect(() => {
    if (selectedWorldbuildingId && sortedWorldbuildingEntries.some((entry) => entry.id === selectedWorldbuildingId)) return;
    setSelectedWorldbuildingId(sortedWorldbuildingEntries[0]?.id ?? '');
  }, [selectedWorldbuildingId, sortedWorldbuildingEntries]);

  const selectedWorldbuilding = worldbuildingEntries.find((entry) => entry.id === selectedWorldbuildingId) ?? null;
  const boardNodes: DisplayNode[] = activeNodes.map((node) => {
    const entity = node.entityId ? entities.find((item) => item.id === node.entityId) : undefined;
    return {
      ...node,
      label: node.id === selectedId ? selectedLabel || node.label : node.label,
      notes: node.id === selectedId ? selectedNotes : readNodeMeta(draft?.links ?? [], node.id, fallbackMapId).notes,
      subtitle: entity ? String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? entity.kind) : 'Note',
      tone: entity ? 'entity' : 'note'
    };
  });
  const selectedNode = activeNodes.find((node) => node.id === selectedId);
  const selectedConnections = selectedId ? visibleLinks.filter((link) => link.sourceId === selectedId || link.targetId === selectedId) : [];
  const selectedParentLink = selectedId ? visibleLinks.find((link) => link.targetId === selectedId) : undefined;

  const selectMap = (mapId: string) => {
    const current = draftRef.current;
    if (!current || !workspace.tabs.some((tab) => tab.id === mapId)) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...current, links: writeMapWorkspace(current.links, { ...workspace, activeMapId: mapId }, timestamp), updatedAt: timestamp });
    setActiveMapId(mapId);
    setSelectedId(null);
  };

  const addMap = () => {
    const current = draftRef.current;
    if (!current) return;
    const title = window.prompt('Name this map', `Map ${workspace.tabs.length + 1}`)?.trim();
    if (!title) return;
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const nextWorkspace = { tabs: [...workspace.tabs, { id, title }], activeMapId: id };
    replaceDraft({ ...current, links: writeMapWorkspace(current.links, nextWorkspace, timestamp), updatedAt: timestamp });
    setActiveMapId(id);
    setSelectedId(null);
  };

  const renameMap = () => {
    const current = draftRef.current;
    if (!current || !activeTab) return;
    const title = window.prompt('Rename map', activeTab.title)?.trim();
    if (!title || title === activeTab.title) return;
    const timestamp = new Date().toISOString();
    const nextWorkspace = { ...workspace, tabs: workspace.tabs.map((tab) => tab.id === activeTab.id ? { ...tab, title } : tab) };
    replaceDraft({ ...current, links: writeMapWorkspace(current.links, nextWorkspace, timestamp), updatedAt: timestamp });
  };

  const deleteMap = () => {
    const current = draftRef.current;
    if (!current || !activeTab || workspace.tabs.length <= 1 || !window.confirm(`Delete “${activeTab.title}” and every node on it?`)) return;
    const nodeIds = new Set(current.nodes.filter((node) => readNodeMeta(current.links, node.id, fallbackMapId).mapId === activeTab.id).map((node) => node.id));
    const remainingTabs = workspace.tabs.filter((tab) => tab.id !== activeTab.id);
    const nextMapId = remainingTabs[0].id;
    const timestamp = new Date().toISOString();
    const links = current.links.filter((link) => !nodeIds.has(link.sourceId) && !nodeIds.has(link.targetId));
    replaceDraft({
      ...current,
      nodes: current.nodes.filter((node) => !nodeIds.has(node.id)),
      links: writeMapWorkspace(links, { tabs: remainingTabs, activeMapId: nextMapId }, timestamp),
      updatedAt: timestamp
    });
    setActiveMapId(nextMapId);
    setSelectedId(null);
  };

  const selectNode = (nodeId: string, focusTitle = false) => {
    const current = draftRef.current;
    const node = current?.nodes.find((item) => item.id === nodeId);
    if (!current || !node) return;
    setSelectedId(nodeId);
    setSelectedLabel(node.label);
    setSelectedNotes(readNodeMeta(current.links, nodeId, fallbackMapId).notes);
    if (node.entityId) {
      const entry = worldbuildingByEntityId.get(node.entityId);
      if (entry) setSelectedWorldbuildingId(entry.id);
    }
    if (focusTitle) requestAnimationFrame(() => { titleInputRef.current?.focus(); titleInputRef.current?.select(); });
  };

  const suggestedPosition = (connectedToId?: string) => {
    const connectedTo = connectedToId ? activeNodes.find((node) => node.id === connectedToId) : undefined;
    if (connectedTo) {
      const connections = visibleLinks.filter((link) => link.sourceId === connectedTo.id || link.targetId === connectedTo.id).length;
      const angle = ((connections % 6) - 2.5) * 0.42;
      return { x: clamp(connectedTo.x + Math.cos(angle) * 18, 6, 94), y: clamp(connectedTo.y + Math.sin(angle) * 22, 8, 92) };
    }
    const index = activeNodes.length;
    return { x: 14 + (index % 4) * 23, y: 16 + (Math.floor(index / 4) % 4) * 22 };
  };

  const createNode = (label: string, connectedToId?: string, entity?: CampaignEntity) => {
    const current = draftRef.current;
    if (!current) return;
    const timestamp = new Date().toISOString();
    const position = suggestedPosition(connectedToId);
    const node: CampaignMapNode = {
      id: crypto.randomUUID(), label, kind: entity ? 'entity' : 'note', ...(entity ? { entityId: entity.id } : {}),
      x: position.x, y: position.y, createdAt: timestamp, updatedAt: timestamp
    };
    let links = connectedToId ? [...current.links, { id: crypto.randomUUID(), sourceId: connectedToId, targetId: node.id, label: 'branch', createdAt: timestamp }] : current.links;
    links = writeNodeMeta(links, node.id, { notes: '', mapId: activeMapId }, timestamp);
    replaceDraft({ ...current, nodes: [...current.nodes, node], links, updatedAt: timestamp });
    selectNode(node.id, true);
  };

  const addRoot = () => createNode('New idea');
  const addConnected = (nodeId = selectedId ?? undefined) => createNode('New idea', nodeId);
  const addSibling = () => createNode('New idea', selectedParentLink?.sourceId);

  const addEntity = (id: string) => {
    const entity = entities.find((item) => item.id === id);
    if (!entity) return;
    const existing = activeNodes.find((node) => node.entityId === entity.id);
    if (existing) { selectNode(existing.id); return; }
    createNode(entity.name, selectedId ?? undefined, entity);
    setReferencedEntityId('');
  };

  const saveSelectedNode = () => {
    const current = draftRef.current;
    if (!current || !selectedId || !selectedLabel.trim()) return;
    const timestamp = new Date().toISOString();
    replaceDraft({
      ...current,
      nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, label: selectedLabel.trim(), updatedAt: timestamp } : node),
      links: writeNodeMeta(current.links, selectedId, { notes: selectedNotes.trim(), mapId: activeMapId }, timestamp),
      updatedAt: timestamp
    });
  };

  const connectNodes = (sourceId: string, targetId: string) => {
    const current = draftRef.current;
    if (!current || sourceId === targetId || current.links.some((link) => !isInternalLink(link) && ((link.sourceId === sourceId && link.targetId === targetId) || (link.sourceId === targetId && link.targetId === sourceId)))) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...current, links: [...current.links, { id: crypto.randomUUID(), sourceId, targetId, label: 'related to', createdAt: timestamp }], updatedAt: timestamp });
  };

  const moveNode = (nodeId: string, x: number, y: number) => {
    const current = draftRef.current;
    if (!current) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, x, y, updatedAt: timestamp } : node), updatedAt: timestamp }, false);
  };
  const saveMovedMap = () => { if (draftRef.current) onSave(draftRef.current); };
  const removeLink = (linkId: string) => {
    const current = draftRef.current;
    if (!current) return;
    replaceDraft({ ...current, links: current.links.filter((link) => link.id !== linkId), updatedAt: new Date().toISOString() });
  };
  const detachSelected = () => {
    const current = draftRef.current;
    if (!current || !selectedId) return;
    replaceDraft({ ...current, links: current.links.filter((link) => isInternalLink(link) || (link.sourceId !== selectedId && link.targetId !== selectedId)), updatedAt: new Date().toISOString() });
  };
  const removeSelected = () => {
    const current = draftRef.current;
    if (!current || !selectedId) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...current, nodes: current.nodes.filter((node) => node.id !== selectedId), links: current.links.filter((link) => link.sourceId !== selectedId && link.targetId !== selectedId), updatedAt: timestamp });
    setSelectedId(null);
  };

  const loadWorldbuildingEntry = (withConnections: boolean, entryId = selectedWorldbuildingId) => {
    const current = draftRef.current;
    const entry = worldbuildingEntries.find((item) => item.id === entryId);
    if (!current || !entry) return;
    const timestamp = new Date().toISOString();
    const nodes = [...current.nodes];
    let links = [...current.links];
    const mapNodes = () => nodes.filter((node) => readNodeMeta(links, node.id, fallbackMapId).mapId === activeMapId);
    const ensureEntryNode = (targetEntry: WorldbuildingEntry, x?: number, y?: number) => {
      const entity = entityByWorldbuildingId.get(targetEntry.id.toLowerCase());
      const existing = entity ? mapNodes().find((node) => node.entityId === entity.id) : mapNodes().find((node) => node.kind === 'note' && node.label === targetEntry.name);
      if (existing) return existing;
      const position = x === undefined || y === undefined ? suggestedPosition() : { x, y };
      const node: CampaignMapNode = {
        id: crypto.randomUUID(), label: targetEntry.name, kind: entity ? 'entity' : 'note', ...(entity ? { entityId: entity.id } : {}),
        x: position.x, y: position.y, createdAt: timestamp, updatedAt: timestamp
      };
      nodes.push(node);
      links = writeNodeMeta(links, node.id, { notes: '', mapId: activeMapId }, timestamp);
      return node;
    };
    const source = ensureEntryNode(entry);
    if (withConnections) {
      const references = worldbuildingReferenceMatches(entry.notes);
      references.forEach((reference, index) => {
        const targetEntry = worldbuildingEntries.find((candidate) => candidate.id.toLowerCase() === reference.id.toLowerCase());
        if (!targetEntry) return;
        const angle = (Math.PI * 2 * index) / Math.max(1, references.length);
        const target = ensureEntryNode(targetEntry, clamp(source.x + Math.cos(angle) * 24, 7, 93), clamp(source.y + Math.sin(angle) * 30, 9, 91));
        if (!links.some((link) => !isInternalLink(link) && ((link.sourceId === source.id && link.targetId === target.id) || (link.sourceId === target.id && link.targetId === source.id)))) {
          links.push({ id: crypto.randomUUID(), sourceId: source.id, targetId: target.id, label: 'links to', createdAt: timestamp });
        }
      });
    }
    replaceDraft({ ...current, nodes, links, updatedAt: timestamp });
    setSelectedWorldbuildingId(entry.id);
    selectNode(source.id);
  };

  const loadReferenceCluster = () => {
    const current = draftRef.current;
    if (!current || !loadSourceId) return;
    if (loadKind === 'worldbuilding') {
      loadWorldbuildingEntry(true, loadSourceId);
      return;
    }
    const brew = brews.find((item) => item.id === loadSourceId);
    if (!brew) return;
    const timestamp = new Date().toISOString();
    const nodes = [...current.nodes];
    let links = [...current.links];
    const existingSource = activeNodes.find((node) => node.kind === 'note' && node.label === `Brew: ${brew.title || 'Untitled Brew'}`);
    const position = suggestedPosition();
    const source = existingSource ?? { id: crypto.randomUUID(), label: `Brew: ${brew.title || 'Untitled Brew'}`, kind: 'note' as const, x: position.x, y: position.y, createdAt: timestamp, updatedAt: timestamp };
    if (!existingSource) {
      nodes.push(source);
      links = writeNodeMeta(links, source.id, { notes: '', mapId: activeMapId }, timestamp);
    }
    const ids = new Set(entityReferences.flatMap((reference) => reference.source.kind === 'brew' && reference.source.brewId === brew.id ? [reference.entityId] : []));
    const targets = entities.filter((entity) => ids.has(entity.id));
    targets.forEach((entity, index) => {
      let target = nodes.find((node) => node.entityId === entity.id && readNodeMeta(links, node.id, fallbackMapId).mapId === activeMapId);
      if (!target) {
        const angle = (Math.PI * 2 * index) / Math.max(1, targets.length);
        target = { id: crypto.randomUUID(), label: entity.name, kind: 'entity', entityId: entity.id, x: clamp(source.x + Math.cos(angle) * 24, 7, 93), y: clamp(source.y + Math.sin(angle) * 30, 9, 91), createdAt: timestamp, updatedAt: timestamp };
        nodes.push(target);
        links = writeNodeMeta(links, target.id, { notes: '', mapId: activeMapId }, timestamp);
      }
      if (!links.some((link) => !isInternalLink(link) && ((link.sourceId === source.id && link.targetId === target!.id) || (link.sourceId === target!.id && link.targetId === source.id)))) {
        links.push({ id: crypto.randomUUID(), sourceId: source.id, targetId: target.id, label: 'references', createdAt: timestamp });
      }
    });
    replaceDraft({ ...current, nodes, links, updatedAt: timestamp });
    selectNode(source.id);
  };

  const createBoard = () => replaceDraft(createBlankCampaignMap());

  return <section className="campaign-map-section" aria-label="Campaign map">
    <header><div><p className="eyebrow">Connections and planning</p><h2>Campaign map</h2><small>Separate, flexible mind maps for campaign relationships, secrets and ideas.</small></div></header>
    {!draft ? <div className="campaign-map-empty"><h3>Create a campaign mind map</h3><p>Start empty, then place and connect only the nodes you need.</p><button className="primary-button" onClick={createBoard} type="button">Start map</button></div> : <>
      <div className="campaign-map-tab-row">
        <div className="campaign-map-tabs" role="tablist" aria-label="Campaign maps">{workspace.tabs.map((tab) => <button aria-selected={tab.id === activeMapId} className={tab.id === activeMapId ? 'is-selected' : ''} key={tab.id} onClick={() => selectMap(tab.id)} role="tab" type="button">{tab.title}</button>)}</div>
        <div className="campaign-map-tab-actions"><button onClick={addMap} type="button">+ Map</button><button onClick={renameMap} type="button">Rename</button><button className="quiet-danger" disabled={workspace.tabs.length <= 1} onClick={deleteMap} type="button">Delete map</button></div>
      </div>

      <section className="campaign-map-worldbuilding-loader" aria-label="Add Worldbuilding entry to map">
        <label>Search Worldbuilding<input onChange={(event) => setWorldbuildingQuery(event.target.value)} placeholder="Name, alias, type, or note…" value={worldbuildingQuery} /></label>
        <label>Sort<select onChange={(event) => setWorldbuildingSort(event.target.value as WorldbuildingSort)} value={worldbuildingSort}><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="updated-desc">Recently updated</option><option value="updated-asc">Oldest updated</option><option value="kind">Type, then name</option></select></label>
        <label>Entry<select onChange={(event) => setSelectedWorldbuildingId(event.target.value)} value={selectedWorldbuildingId}><option value="">Choose entry</option>{sortedWorldbuildingEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.kind}</option>)}</select></label>
        <div className="campaign-map-worldbuilding-actions"><button disabled={!selectedWorldbuilding} onClick={() => loadWorldbuildingEntry(false)} type="button">Add entry</button><button className="primary-button" disabled={!selectedWorldbuilding} onClick={() => loadWorldbuildingEntry(true)} type="button">Load with connections</button></div>
      </section>

      <div className="campaign-mindmap-toolbar" role="toolbar" aria-label="Mind map tools">
        <button onClick={addRoot} type="button">+ Root</button><button disabled={!selectedId} onClick={() => addConnected()} type="button">+ Connected</button><button disabled={!selectedId} onClick={addSibling} type="button">+ Sibling</button><button disabled={!selectedConnections.length} onClick={detachSelected} type="button">Remove all links</button><button className="quiet-danger" disabled={!selectedId} onClick={removeSelected} type="button">Delete node</button>
      </div>

      <details className="campaign-mindmap-imports"><summary>Import references</summary>
        <div className="campaign-map-brew-tools"><label>From brew<select onChange={(event) => { setReferenceBrewId(event.target.value); setReferencedEntityId(''); }} value={referenceBrewId}><option value="">Choose brew</option>{brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>)}</select></label><label>Referenced item<select disabled={!referenceBrewId} onChange={(event) => setReferencedEntityId(event.target.value)} value={referencedEntityId}><option value="">Choose a reference</option>{referencedEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><button disabled={!referencedEntityId} onClick={() => addEntity(referencedEntityId)} type="button">Add item</button></div>
        <div className="campaign-map-load-tools"><label>Load references from<select onChange={(event) => { setLoadKind(event.target.value as 'brew' | 'worldbuilding'); setLoadSourceId(''); }} value={loadKind}><option value="brew">Brew</option><option value="worldbuilding">Worldbuilding</option></select></label><label>{loadKind === 'brew' ? 'Brew' : 'Worldbuilding entry'}<select onChange={(event) => setLoadSourceId(event.target.value)} value={loadSourceId}><option value="">Choose source</option>{loadKind === 'brew' ? brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>) : sortedWorldbuildingEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button disabled={!loadSourceId} onClick={loadReferenceCluster} type="button">Load cluster</button></div>
      </details>

      <div className="campaign-mindmap-workspace"><FreeformMindMap links={visibleLinks} nodes={boardNodes} onAddConnected={addConnected} onConnect={connectNodes} onMove={moveNode} onMoveEnd={saveMovedMap} onSelect={selectNode} selectedId={selectedId} />
        <div className="campaign-mindmap-sidebar"><aside className="campaign-mindmap-inspector">{selectedNode ? <>
          <div><p className="eyebrow">Selected node</p><h3>{selectedLabel || selectedNode.label}</h3></div>
          <label>Title<input ref={titleInputRef} onChange={(event) => setSelectedLabel(event.target.value)} value={selectedLabel} /></label>
          <label>Notes<textarea onChange={(event) => setSelectedNotes(event.target.value)} placeholder="Context, secrets, unresolved questions…" value={selectedNotes} /></label>
          <button className="primary-button" disabled={!selectedLabel.trim()} onClick={saveSelectedNode} type="button">Save node</button>
          <section className="campaign-mindmap-connections"><div><strong>Connections</strong><small>Use the dotted handle to move. Drag the round handle onto any node to add another connection.</small></div>
            {!selectedConnections.length ? <p>No connections.</p> : selectedConnections.map((link) => {
              const otherId = link.sourceId === selectedId ? link.targetId : link.sourceId;
              const other = activeNodes.find((node) => node.id === otherId);
              return <div className="campaign-mindmap-connection" key={link.id}><span>{other?.label ?? 'Unknown node'}{link.label && link.label !== 'branch' ? ` · ${link.label}` : ''}</span><button onClick={() => removeLink(link.id)} type="button">Remove</button></div>;
            })}
          </section>
        </> : <div className="campaign-mindmap-inspector-empty"><strong>Select a node</strong><p>Edit it, drag it anywhere, or connect it to several other nodes.</p></div>}</aside>
        <section className="campaign-map-worldbuilding-notes" aria-label="Selected Worldbuilding notes"><div><p className="eyebrow">Worldbuilding entry</p><h3>{selectedWorldbuilding?.name ?? 'No entry selected'}</h3></div><textarea aria-label="Worldbuilding notes preview" placeholder="Select an entry above to preview its notes." readOnly value={selectedWorldbuilding?.notes ?? ''} /></section></div>
      </div>
    </>}
  </section>;
}
