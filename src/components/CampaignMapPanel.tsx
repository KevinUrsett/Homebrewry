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
type PositionedNode = DisplayNode & { left: number; top: number; depth: number };
type MindMapLayout = {
  nodes: PositionedNode[];
  width: number;
  height: number;
  primaryLinkIds: Set<string>;
};

const NODE_META_PREFIX = '__homebrewry_node_meta__:';
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
    {
      id: crypto.randomUUID(),
      sourceId: nodeId,
      targetId: nodeId,
      label: `${NODE_META_PREFIX}${JSON.stringify(meta)}`,
      createdAt: timestamp
    }
  ];
}

function createMindMapLayout(nodes: readonly DisplayNode[], links: readonly CampaignMapLink[]): MindMapLayout {
  if (!nodes.length) return { nodes: [], width: 760, height: 480, primaryLinkIds: new Set() };
  const nodeIds = new Set(nodes.map((node) => node.id));
  const visibleLinks = links.filter((link) => !isNodeMetaLink(link) && nodeIds.has(link.sourceId) && nodeIds.has(link.targetId) && link.sourceId !== link.targetId);
  const primaryParent = new Map<string, CampaignMapLink>();
  for (const link of visibleLinks) if (!primaryParent.has(link.targetId)) primaryParent.set(link.targetId, link);
  const primaryLinkIds = new Set([...primaryParent.values()].map((link) => link.id));
  const children = new Map<string, string[]>();
  for (const link of primaryParent.values()) children.set(link.sourceId, [...(children.get(link.sourceId) ?? []), link.targetId]);
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
  for (const list of children.values()) list.sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));
  const roots = nodes.filter((node) => !primaryParent.has(node.id)).map((node) => node.id);
  if (!roots.length) roots.push(nodes[0].id);
  const placed = new Map<string, { left: number; top: number; depth: number }>();
  let cursorY = 72;
  let maximumDepth = 0;
  const place = (nodeId: string, depth: number, ancestors: Set<string>): number => {
    const existing = placed.get(nodeId);
    if (existing) return existing.top;
    maximumDepth = Math.max(maximumDepth, depth);
    const safeChildren = (children.get(nodeId) ?? []).filter((childId) => !ancestors.has(childId));
    let top: number;
    if (!safeChildren.length) {
      top = cursorY;
      cursorY += 96;
    } else {
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(nodeId);
      const childTops = safeChildren.map((childId) => place(childId, depth + 1, nextAncestors));
      top = (childTops[0] + childTops[childTops.length - 1]) / 2;
    }
    placed.set(nodeId, { left: 116 + depth * 228, top, depth });
    return top;
  };
  for (const rootId of roots) {
    place(rootId, 0, new Set());
    cursorY += 48;
  }
  for (const node of nodes) if (!placed.has(node.id)) {
    place(node.id, 0, new Set());
    cursorY += 48;
  }
  return {
    nodes: nodes.map((node) => ({ ...node, ...(placed.get(node.id) ?? { left: 116, top: cursorY, depth: 0 }) })),
    width: Math.max(760, 332 + maximumDepth * 228),
    height: Math.max(480, cursorY + 32),
    primaryLinkIds
  };
}

type MindMapCanvasProps = {
  nodes: readonly DisplayNode[];
  links: readonly CampaignMapLink[];
  selectedId: string | null;
  onAddChild: (parentId: string) => void;
  onReparent: (nodeId: string, parentId: string) => void;
  onSelect: (nodeId: string) => void;
};

function MindMapCanvas({ nodes, links, selectedId, onAddChild, onReparent, onSelect }: MindMapCanvasProps) {
  const layout = useMemo(() => createMindMapLayout(nodes, links), [nodes, links]);
  const nodeById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const updateDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingId || !surfaceRef.current) return;
    const bounds = surfaceRef.current.getBoundingClientRect();
    setPointer({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-mindmap-node-id]');
    const targetId = element?.dataset.mindmapNodeId;
    setDropTargetId(targetId && targetId !== draggingId ? targetId : null);
  };
  const finishDrag = () => {
    if (draggingId && dropTargetId) onReparent(draggingId, dropTargetId);
    setDraggingId(null);
    setDropTargetId(null);
    setPointer(null);
  };
  const cancelDrag = () => {
    setDraggingId(null);
    setDropTargetId(null);
    setPointer(null);
  };
  const visibleLinks = links.filter((link) => !isNodeMetaLink(link));
  const draggingNode = draggingId ? nodeById.get(draggingId) : undefined;
  return <div className="campaign-mindmap-viewport"><div
    className={`campaign-mindmap-surface ${draggingId ? 'is-reparenting' : ''}`}
    onPointerCancel={cancelDrag}
    onPointerLeave={cancelDrag}
    onPointerMove={updateDrag}
    onPointerUp={finishDrag}
    ref={surfaceRef}
    style={{ height: `${layout.height}px`, width: `${layout.width}px` }}
  >
    <svg aria-hidden="true" className="campaign-mindmap-lines" height={layout.height} width={layout.width}>
      {visibleLinks.map((link) => {
        const source = nodeById.get(link.sourceId);
        const target = nodeById.get(link.targetId);
        if (!source || !target) return null;
        const startX = source.left + 82;
        const endX = target.left - 82;
        const control = Math.max(42, Math.abs(endX - startX) * 0.42);
        return <g className={layout.primaryLinkIds.has(link.id) ? 'is-primary' : 'is-secondary'} key={link.id}>
          <path d={`M ${startX} ${source.top} C ${startX + control} ${source.top}, ${endX - control} ${target.top}, ${endX} ${target.top}`} />
          {link.label && link.label !== 'branch' && <text x={(startX + endX) / 2} y={(source.top + target.top) / 2 - 5}>{link.label}</text>}
        </g>;
      })}
      {draggingNode && pointer && <path className="campaign-mindmap-drag-line" d={`M ${draggingNode.left} ${draggingNode.top} C ${draggingNode.left + 60} ${draggingNode.top}, ${pointer.x - 60} ${pointer.y}, ${pointer.x} ${pointer.y}`} />}
    </svg>
    {layout.nodes.map((node) => {
      const selected = selectedId === node.id;
      return <article
        className={`campaign-mindmap-node tone-${node.tone} ${selected ? 'is-selected' : ''} ${dropTargetId === node.id ? 'is-drop-target' : ''}`}
        data-depth={node.depth}
        data-mindmap-node-id={node.id}
        key={node.id}
        style={{ left: `${node.left}px`, top: `${node.top}px` }}
      >
        <button className="campaign-mindmap-node-main" onClick={() => onSelect(node.id)} type="button">
          <strong>{node.label}</strong><span>{node.subtitle}</span>{node.notes && <small aria-label="Has notes">Notes</small>}
        </button>
        {selected && <button aria-label={`Add child to ${node.label}`} className="campaign-mindmap-add-child" onClick={() => onAddChild(node.id)} type="button">+</button>}
        {selected && <button aria-label={`Move ${node.label} under another node`} className="campaign-mindmap-reparent-handle" onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDraggingId(node.id);
          setPointer({ x: node.left, y: node.top });
        }} type="button">⠿</button>}
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

  const replaceDraft = (next: CampaignMap) => {
    draftRef.current = next;
    setDraft(next);
    onSave(next);
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
  const createNode = (label: string, parentId?: string, entity?: CampaignEntity) => {
    const current = draftRef.current;
    if (!current) return;
    const timestamp = new Date().toISOString();
    const node: CampaignMapNode = {
      id: crypto.randomUUID(), label, kind: entity ? 'entity' : 'note', ...(entity ? { entityId: entity.id } : {}),
      x: 50, y: 50, createdAt: timestamp, updatedAt: timestamp
    };
    const links = parentId ? [...current.links, { id: crypto.randomUUID(), sourceId: parentId, targetId: node.id, label: 'branch', createdAt: timestamp }] : current.links;
    replaceDraft({ ...current, nodes: [...current.nodes, node], links, updatedAt: timestamp });
    selectNode(node.id, true);
  };
  const addRoot = () => createNode('New idea');
  const addChild = (parentId = selectedId ?? undefined) => createNode('New idea', parentId);
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
  const removeLink = (linkId: string) => {
    const current = draftRef.current;
    if (!current) return;
    replaceDraft({ ...current, links: current.links.filter((link) => link.id !== linkId), updatedAt: new Date().toISOString() });
  };
  const detachSelected = () => {
    const current = draftRef.current;
    if (!current || !selectedId) return;
    replaceDraft({ ...current, links: current.links.filter((link) => isNodeMetaLink(link) || link.targetId !== selectedId), updatedAt: new Date().toISOString() });
  };
  const isDescendant = (candidateParentId: string, nodeId: string, links: readonly CampaignMapLink[]) => {
    const children = new Map<string, string[]>();
    for (const link of links) if (!isNodeMetaLink(link)) children.set(link.sourceId, [...(children.get(link.sourceId) ?? []), link.targetId]);
    const pending = [...(children.get(nodeId) ?? [])];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.shift()!;
      if (current === candidateParentId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(children.get(current) ?? []));
    }
    return false;
  };
  const reparentNode = (nodeId: string, parentId: string) => {
    const current = draftRef.current;
    if (!current || nodeId === parentId || isDescendant(parentId, nodeId, current.links)) return;
    const timestamp = new Date().toISOString();
    const linksWithoutOldParent = current.links.filter((link) => isNodeMetaLink(link) || link.targetId !== nodeId);
    replaceDraft({ ...current, links: [...linksWithoutOldParent, { id: crypto.randomUUID(), sourceId: parentId, targetId: nodeId, label: 'branch', createdAt: timestamp }], updatedAt: timestamp });
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
    const ensureEntity = (entity: CampaignEntity) => {
      const existing = nodes.find((node) => node.entityId === entity.id);
      if (existing) return existing;
      const node: CampaignMapNode = { id: crypto.randomUUID(), label: entity.name, kind: 'entity', entityId: entity.id, x: 50, y: 50, createdAt: timestamp, updatedAt: timestamp };
      nodes.push(node);
      return node;
    };
    const ensureNote = (label: string) => {
      const existing = nodes.find((node) => node.kind === 'note' && node.label === label);
      if (existing) return existing;
      const node: CampaignMapNode = { id: crypto.randomUUID(), label, kind: 'note', x: 50, y: 50, createdAt: timestamp, updatedAt: timestamp };
      nodes.push(node);
      return node;
    };
    const ensureLink = (sourceId: string, targetId: string, label: string) => {
      if (sourceId === targetId || links.some((link) => !isNodeMetaLink(link) && link.sourceId === sourceId && link.targetId === targetId)) return;
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
      source = ensureEntity(origin);
      targets = worldbuildingReferenceMatches(entry.notes).flatMap((reference) => {
        const target = entityByWorldbuildingId.get(reference.id);
        return target ? [target] : [];
      });
    }
    targets.forEach((entity) => ensureLink(source.id, ensureEntity(entity).id, loadKind === 'brew' ? 'references' : 'links to'));
    replaceDraft({ ...current, nodes, links, updatedAt: timestamp });
    selectNode(source.id);
  };
  const createBoard = () => replaceDraft(createBlankCampaignMap());

  return <section className="campaign-map-section" aria-label="Campaign map">
    <header><div><p className="eyebrow">Connections and planning</p><h2>Campaign map</h2><small>A compact mind map for campaign relationships, secrets and ideas.</small></div></header>
    {!draft ? <div className="campaign-map-empty"><h3>Create a campaign mind map</h3><p>Start empty, then build branches manually or add selected campaign references.</p><button className="primary-button" onClick={createBoard} type="button">Start map</button></div> : <>
      <div className="campaign-mindmap-toolbar" role="toolbar" aria-label="Mind map tools">
        <button onClick={addRoot} type="button">+ Root</button><button disabled={!selectedId} onClick={() => addChild()} type="button">+ Child</button><button disabled={!selectedId} onClick={addSibling} type="button">+ Sibling</button><button disabled={!selectedParentLink} onClick={detachSelected} type="button">Detach</button><button className="quiet-danger" disabled={!selectedId} onClick={removeSelected} type="button">Delete node</button>
      </div>
      <div className="campaign-mindmap-add-existing"><label>Add world item<select onChange={(event) => setEntityId(event.target.value)} value={entityId}><option value="">Choose entity</option>{entities.filter((entity) => !draft.nodes.some((node) => node.entityId === entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><button disabled={!entityId} onClick={() => addEntity()} type="button">Add {selectedId ? 'as child' : 'as root'}</button></div>
      <details className="campaign-mindmap-imports"><summary>Import references</summary>
        <div className="campaign-map-brew-tools"><label>From brew<select onChange={(event) => { setReferenceBrewId(event.target.value); setReferencedEntityId(''); }} value={referenceBrewId}><option value="">Choose brew</option>{brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>)}</select></label><label>Referenced item<select disabled={!referenceBrewId} onChange={(event) => setReferencedEntityId(event.target.value)} value={referencedEntityId}><option value="">Choose a reference</option>{referencedEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><button disabled={!referencedEntityId} onClick={() => addEntity(referencedEntityId)} type="button">Add item</button></div>
        <div className="campaign-map-load-tools"><label>Load references from<select onChange={(event) => { setLoadKind(event.target.value as 'brew' | 'worldbuilding'); setLoadSourceId(''); }} value={loadKind}><option value="brew">Brew</option><option value="worldbuilding">Worldbuilding</option></select></label><label>{loadKind === 'brew' ? 'Brew' : 'Worldbuilding entry'}<select onChange={(event) => setLoadSourceId(event.target.value)} value={loadSourceId}><option value="">Choose source</option>{loadKind === 'brew' ? brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>) : worldbuildingEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button disabled={!loadSourceId} onClick={loadReferenceCluster} type="button">Load branch</button></div>
      </details>
      <div className="campaign-mindmap-workspace"><MindMapCanvas links={visibleLinks} nodes={boardNodes} onAddChild={addChild} onReparent={reparentNode} onSelect={selectNode} selectedId={selectedId} />
        <aside className="campaign-mindmap-inspector">{selectedNode ? <>
          <div><p className="eyebrow">Selected node</p><h3>{selectedLabel || selectedNode.label}</h3></div>
          <label>Title<input ref={titleInputRef} onChange={(event) => setSelectedLabel(event.target.value)} value={selectedLabel} /></label>
          <label>Notes<textarea onChange={(event) => setSelectedNotes(event.target.value)} placeholder="Context, secrets, unresolved questions…" value={selectedNotes} /></label>
          <button className="primary-button" disabled={!selectedLabel.trim()} onClick={saveSelectedNode} type="button">Save node</button>
          <section className="campaign-mindmap-connections"><div><strong>Connections</strong><small>Drag the dotted handle onto another node to change its parent.</small></div>
            {!selectedConnections.length ? <p>No connections.</p> : selectedConnections.map((link) => {
              const otherId = link.sourceId === selectedId ? link.targetId : link.sourceId;
              const other = draft.nodes.find((node) => node.id === otherId);
              return <div className="campaign-mindmap-connection" key={link.id}><span>{link.sourceId === selectedId ? 'Child' : 'Parent'} · {other?.label ?? 'Unknown node'}{link.label && link.label !== 'branch' ? ` · ${link.label}` : ''}</span><button onClick={() => removeLink(link.id)} type="button">Remove</button></div>;
            })}
          </section>
        </> : <div className="campaign-mindmap-inspector-empty"><strong>Select a node</strong><p>Edit its title and notes, add children, or drag it under another node.</p></div>}</aside>
      </div>
    </>}
  </section>;
}
