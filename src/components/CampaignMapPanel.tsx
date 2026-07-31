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

type NodeMeta = { notes: string };
type DisplayNode = CampaignMapNode & { subtitle: string; notes: string; tone: 'entity' | 'note' };

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
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const isNodeMetaLink = (link: CampaignMapLink) => link.sourceId === link.targetId && link.label.startsWith(NODE_META_PREFIX);

function readNodeMeta(links: readonly CampaignMapLink[], nodeId: string): NodeMeta {
  const stored = links.find((link) => link.sourceId === nodeId && isNodeMetaLink(link));
  if (!stored) return { notes: '' };
  try {
    const parsed = JSON.parse(stored.label.slice(NODE_META_PREFIX.length)) as Partial<NodeMeta>;
    return { notes: typeof parsed.notes === 'string' ? parsed.notes : '' };
  } catch {
    return { notes: '' };
  }
}

function writeNodeMeta(links: readonly CampaignMapLink[], nodeId: string, meta: NodeMeta, timestamp: string): CampaignMapLink[] {
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
  const visibleLinks = links.filter((link) => !isNodeMetaLink(link));

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
      {visibleLinks.map((link) => {
        const source = nodeById.get(link.sourceId);
        const target = nodeById.get(link.targetId);
        if (!source || !target) return null;
        const bend = Math.max(4, Math.abs(target.x - source.x) * 0.42);
        const direction = target.x >= source.x ? 1 : -1;
        return <g key={link.id}>
          <path d={`M ${source.x} ${source.y} C ${source.x + bend * direction} ${source.y}, ${target.x - bend * direction} ${target.y}, ${target.x} ${target.y}`} />
          {link.label && link.label !== 'branch' && <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 1}>{link.label}</text>}
        </g>;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedNotes, setSelectedNotes] = useState('');
  const [entityId, setEntityId] = useState('');
  const [referenceBrewId, setReferenceBrewId] = useState('');
  const [referencedEntityId, setReferencedEntityId] = useState('');
  const [loadKind, setLoadKind] = useState<'brew' | 'worldbuilding'>('brew');
  const [loadSourceId, setLoadSourceId] = useState('');

  useEffect(() => {
    setDraft(campaignMap ?? null);
    draftRef.current = campaignMap ?? null;
    setSelectedId((current) => current && campaignMap?.nodes.some((node) => node.id === current) ? current : null);
  }, [campaignMap]);

  const replaceDraft = (next: CampaignMap, save = true) => {
    draftRef.current = next;
    setDraft(next);
    if (save) onSave(next);
  };
  const visibleLinks = useMemo(() => (draft?.links ?? []).filter((link) => !isNodeMetaLink(link)), [draft?.links]);
  const entityByWorldbuildingId = useMemo(() => new Map(entities.flatMap((entity) => entity.source.kind === 'worldbuilding' ? [[entity.source.id.toLowerCase(), entity] as const] : [])), [entities]);
  const referencedEntities = useMemo(() => {
    const ids = new Set(entityReferences.flatMap((reference) => reference.source.kind === 'brew' && reference.source.brewId === referenceBrewId ? [reference.entityId] : []));
    return entities.filter((entity) => ids.has(entity.id) && !draft?.nodes.some((node) => node.entityId === entity.id));
  }, [draft?.nodes, entities, entityReferences, referenceBrewId]);
  const boardNodes: DisplayNode[] = (draft?.nodes ?? []).map((node) => {
    const entity = node.entityId ? entities.find((item) => item.id === node.entityId) : undefined;
    return {
      ...node,
      label: node.id === selectedId ? selectedLabel || node.label : node.label,
      notes: node.id === selectedId ? selectedNotes : readNodeMeta(draft?.links ?? [], node.id).notes,
      subtitle: entity ? String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? entity.kind) : 'Note',
      tone: entity ? 'entity' : 'note'
    };
  });
  const selectedNode = draft?.nodes.find((node) => node.id === selectedId);
  const selectedConnections = selectedId ? visibleLinks.filter((link) => link.sourceId === selectedId || link.targetId === selectedId) : [];
  const selectedParentLink = selectedId ? visibleLinks.find((link) => link.targetId === selectedId) : undefined;

  const selectNode = (nodeId: string, focusTitle = false) => {
    const current = draftRef.current;
    const node = current?.nodes.find((item) => item.id === nodeId);
    if (!current || !node) return;
    setSelectedId(nodeId);
    setSelectedLabel(node.label);
    setSelectedNotes(readNodeMeta(current.links, nodeId).notes);
    if (focusTitle) requestAnimationFrame(() => { titleInputRef.current?.focus(); titleInputRef.current?.select(); });
  };

  const suggestedPosition = (current: CampaignMap, connectedToId?: string) => {
    const connectedTo = connectedToId ? current.nodes.find((node) => node.id === connectedToId) : undefined;
    if (connectedTo) {
      const connections = current.links.filter((link) => !isNodeMetaLink(link) && (link.sourceId === connectedTo.id || link.targetId === connectedTo.id)).length;
      const angle = ((connections % 6) - 2.5) * 0.42;
      return { x: clamp(connectedTo.x + Math.cos(angle) * 18, 6, 94), y: clamp(connectedTo.y + Math.sin(angle) * 22, 8, 92) };
    }
    const index = current.nodes.length;
    return { x: 14 + (index % 4) * 23, y: 16 + (Math.floor(index / 4) % 4) * 22 };
  };

  const createNode = (label: string, connectedToId?: string, entity?: CampaignEntity) => {
    const current = draftRef.current;
    if (!current) return;
    const timestamp = new Date().toISOString();
    const position = suggestedPosition(current, connectedToId);
    const node: CampaignMapNode = {
      id: crypto.randomUUID(), label, kind: entity ? 'entity' : 'note', ...(entity ? { entityId: entity.id } : {}),
      x: position.x, y: position.y, createdAt: timestamp, updatedAt: timestamp
    };
    const links = connectedToId ? [...current.links, { id: crypto.randomUUID(), sourceId: connectedToId, targetId: node.id, label: 'branch', createdAt: timestamp }] : current.links;
    replaceDraft({ ...current, nodes: [...current.nodes, node], links, updatedAt: timestamp });
    selectNode(node.id, true);
  };
  const addRoot = () => createNode('New idea');
  const addConnected = (nodeId = selectedId ?? undefined) => createNode('New idea', nodeId);
  const addSibling = () => createNode('New idea', selectedParentLink?.sourceId);
  const addEntity = (id = entityId) => {
    const entity = entities.find((item) => item.id === id);
    const current = draftRef.current;
    if (!entity || !current || current.nodes.some((node) => node.entityId === entity.id)) return;
    createNode(entity.name, selectedId ?? undefined, entity);
    setEntityId('');
    setReferencedEntityId('');
  };
  const saveSelectedNode = () => {
    const current = draftRef.current;
    if (!current || !selectedId || !selectedLabel.trim()) return;
    const timestamp = new Date().toISOString();
    replaceDraft({
      ...current,
      nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, label: selectedLabel.trim(), updatedAt: timestamp } : node),
      links: writeNodeMeta(current.links, selectedId, { notes: selectedNotes.trim() }, timestamp),
      updatedAt: timestamp
    });
  };
  const connectNodes = (sourceId: string, targetId: string) => {
    const current = draftRef.current;
    if (!current || sourceId === targetId || current.links.some((link) => !isNodeMetaLink(link) && ((link.sourceId === sourceId && link.targetId === targetId) || (link.sourceId === targetId && link.targetId === sourceId)))) return;
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
    replaceDraft({ ...current, links: current.links.filter((link) => isNodeMetaLink(link) || (link.sourceId !== selectedId && link.targetId !== selectedId)), updatedAt: new Date().toISOString() });
  };
  const removeSelected = () => {
    const current = draftRef.current;
    if (!current || !selectedId) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...current, nodes: current.nodes.filter((node) => node.id !== selectedId), links: current.links.filter((link) => link.sourceId !== selectedId && link.targetId !== selectedId), updatedAt: timestamp });
    setSelectedId(null);
  };

  const loadReferenceCluster = () => {
    const current = draftRef.current;
    if (!current || !loadSourceId) return;
    const timestamp = new Date().toISOString();
    const nodes = [...current.nodes];
    const links = [...current.links];
    const ensureEntity = (entity: CampaignEntity, x: number, y: number) => {
      const existing = nodes.find((node) => node.entityId === entity.id);
      if (existing) return existing;
      const node: CampaignMapNode = { id: crypto.randomUUID(), label: entity.name, kind: 'entity', entityId: entity.id, x, y, createdAt: timestamp, updatedAt: timestamp };
      nodes.push(node);
      return node;
    };
    const ensureNote = (label: string, x = 50, y = 50) => {
      const existing = nodes.find((node) => node.kind === 'note' && node.label === label);
      if (existing) return existing;
      const node: CampaignMapNode = { id: crypto.randomUUID(), label, kind: 'note', x, y, createdAt: timestamp, updatedAt: timestamp };
      nodes.push(node);
      return node;
    };
    const ensureLink = (sourceId: string, targetId: string, label: string) => {
      if (sourceId === targetId || links.some((link) => !isNodeMetaLink(link) && ((link.sourceId === sourceId && link.targetId === targetId) || (link.sourceId === targetId && link.targetId === sourceId)))) return;
      links.push({ id: crypto.randomUUID(), sourceId, targetId, label, createdAt: timestamp });
    };
    let source: CampaignMapNode;
    let targets: CampaignEntity[];
    if (loadKind === 'brew') {
      const brew = brews.find((item) => item.id === loadSourceId);
      if (!brew) return;
      source = ensureNote(`Brew: ${brew.title || 'Untitled Brew'}`);
      const ids = new Set(entityReferences.flatMap((reference) => reference.source.kind === 'brew' && reference.source.brewId === brew.id ? [reference.entityId] : []));
      targets = entities.filter((entity) => ids.has(entity.id));
    } else {
      const entry = worldbuildingEntries.find((item) => item.id === loadSourceId);
      const origin = entry ? entityByWorldbuildingId.get(entry.id.toLowerCase()) : undefined;
      if (!entry || !origin) return;
      source = ensureEntity(origin, 50, 50);
      targets = worldbuildingReferenceMatches(entry.notes).flatMap((reference) => {
        const target = entityByWorldbuildingId.get(reference.id);
        return target ? [target] : [];
      });
    }
    targets.forEach((entity, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, targets.length);
      const target = ensureEntity(entity, clamp(source.x + Math.cos(angle) * 24, 7, 93), clamp(source.y + Math.sin(angle) * 30, 9, 91));
      ensureLink(source.id, target.id, loadKind === 'brew' ? 'references' : 'links to');
    });
    replaceDraft({ ...current, nodes, links, updatedAt: timestamp });
    selectNode(source.id);
  };
  const createBoard = () => replaceDraft(createBlankCampaignMap());

  return <section className="campaign-map-section" aria-label="Campaign map">
    <header><div><p className="eyebrow">Connections and planning</p><h2>Campaign map</h2><small>A flexible mind map for campaign relationships, secrets and ideas.</small></div></header>
    {!draft ? <div className="campaign-map-empty"><h3>Create a campaign mind map</h3><p>Start empty, then place and connect only the nodes you need.</p><button className="primary-button" onClick={createBoard} type="button">Start map</button></div> : <>
      <div className="campaign-mindmap-toolbar" role="toolbar" aria-label="Mind map tools">
        <button onClick={addRoot} type="button">+ Root</button><button disabled={!selectedId} onClick={() => addConnected()} type="button">+ Connected</button><button disabled={!selectedId} onClick={addSibling} type="button">+ Sibling</button><button disabled={!selectedConnections.length} onClick={detachSelected} type="button">Remove all links</button><button className="quiet-danger" disabled={!selectedId} onClick={removeSelected} type="button">Delete node</button>
      </div>
      <div className="campaign-mindmap-add-existing"><label>Add world item<select onChange={(event) => setEntityId(event.target.value)} value={entityId}><option value="">Choose entity</option>{entities.filter((entity) => !draft.nodes.some((node) => node.entityId === entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><button disabled={!entityId} onClick={() => addEntity()} type="button">Add {selectedId ? 'connected' : 'as root'}</button></div>
      <details className="campaign-mindmap-imports"><summary>Import references</summary>
        <div className="campaign-map-brew-tools"><label>From brew<select onChange={(event) => { setReferenceBrewId(event.target.value); setReferencedEntityId(''); }} value={referenceBrewId}><option value="">Choose brew</option>{brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>)}</select></label><label>Referenced item<select disabled={!referenceBrewId} onChange={(event) => setReferencedEntityId(event.target.value)} value={referencedEntityId}><option value="">Choose a reference</option>{referencedEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><button disabled={!referencedEntityId} onClick={() => addEntity(referencedEntityId)} type="button">Add item</button></div>
        <div className="campaign-map-load-tools"><label>Load references from<select onChange={(event) => { setLoadKind(event.target.value as 'brew' | 'worldbuilding'); setLoadSourceId(''); }} value={loadKind}><option value="brew">Brew</option><option value="worldbuilding">Worldbuilding</option></select></label><label>{loadKind === 'brew' ? 'Brew' : 'Worldbuilding entry'}<select onChange={(event) => setLoadSourceId(event.target.value)} value={loadSourceId}><option value="">Choose source</option>{loadKind === 'brew' ? brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>) : worldbuildingEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button disabled={!loadSourceId} onClick={loadReferenceCluster} type="button">Load cluster</button></div>
      </details>
      <div className="campaign-mindmap-workspace"><FreeformMindMap links={visibleLinks} nodes={boardNodes} onAddConnected={addConnected} onConnect={connectNodes} onMove={moveNode} onMoveEnd={saveMovedMap} onSelect={selectNode} selectedId={selectedId} />
        <aside className="campaign-mindmap-inspector">{selectedNode ? <>
          <div><p className="eyebrow">Selected node</p><h3>{selectedLabel || selectedNode.label}</h3></div>
          <label>Title<input ref={titleInputRef} onChange={(event) => setSelectedLabel(event.target.value)} value={selectedLabel} /></label>
          <label>Notes<textarea onChange={(event) => setSelectedNotes(event.target.value)} placeholder="Context, secrets, unresolved questions…" value={selectedNotes} /></label>
          <button className="primary-button" disabled={!selectedLabel.trim()} onClick={saveSelectedNode} type="button">Save node</button>
          <section className="campaign-mindmap-connections"><div><strong>Connections</strong><small>Use the dotted handle to move. Drag the round handle onto any node to add another connection.</small></div>
            {!selectedConnections.length ? <p>No connections.</p> : selectedConnections.map((link) => {
              const otherId = link.sourceId === selectedId ? link.targetId : link.sourceId;
              const other = draft.nodes.find((node) => node.id === otherId);
              return <div className="campaign-mindmap-connection" key={link.id}><span>{other?.label ?? 'Unknown node'}{link.label && link.label !== 'branch' ? ` · ${link.label}` : ''}</span><button onClick={() => removeLink(link.id)} type="button">Remove</button></div>;
            })}
          </section>
        </> : <div className="campaign-mindmap-inspector-empty"><strong>Select a node</strong><p>Edit it, drag it anywhere, or connect it to several other nodes.</p></div>}</aside>
      </div>
    </>}
  </section>;
}
