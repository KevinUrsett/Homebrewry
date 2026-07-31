import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createBlankCampaignMap } from '../lib/campaignMap';
import { worldbuildingReferenceMatches } from '../lib/worldbuildingReferences';
import type {
  Brew,
  CampaignEntity,
  CampaignMap,
  CampaignMapLink,
  CampaignMapNode,
  EntityCurrentState,
  EntityReference,
  WorldbuildingEntry
} from '../types';
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

type NodeMeta = { notes: string; width: number; height: number };
type DisplayNode = {
  id: string;
  label: string;
  subtitle: string;
  notes: string;
  width: number;
  height: number;
  x: number;
  y: number;
  tone: string;
  entityId?: string;
};
type DisplayLink = Pick<CampaignMapLink, 'id' | 'sourceId' | 'targetId' | 'label'>;
type ResizeState = {
  id: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

const NODE_META_PREFIX = '__homebrewry_node_meta__:';
const DEFAULT_NODE_META: NodeMeta = { notes: '', width: 132, height: 54 };
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const isNodeMetaLink = (link: CampaignMapLink) => link.sourceId === link.targetId && link.label.startsWith(NODE_META_PREFIX);

function nodeMeta(links: readonly CampaignMapLink[], nodeId: string): NodeMeta {
  const stored = links.find((link) => link.sourceId === nodeId && isNodeMetaLink(link));
  if (!stored) return DEFAULT_NODE_META;
  try {
    const parsed = JSON.parse(stored.label.slice(NODE_META_PREFIX.length)) as Partial<NodeMeta>;
    return {
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      width: clamp(typeof parsed.width === 'number' ? parsed.width : DEFAULT_NODE_META.width, 100, 280),
      height: clamp(typeof parsed.height === 'number' ? parsed.height : DEFAULT_NODE_META.height, 48, 200)
    };
  } catch {
    return DEFAULT_NODE_META;
  }
}

function withNodeMeta(links: readonly CampaignMapLink[], nodeId: string, meta: NodeMeta, timestamp: string): CampaignMapLink[] {
  const remaining = links.filter((link) => !(link.sourceId === nodeId && isNodeMetaLink(link)));
  return [
    ...remaining,
    {
      id: crypto.randomUUID(),
      sourceId: nodeId,
      targetId: nodeId,
      label: `${NODE_META_PREFIX}${JSON.stringify(meta)}`,
      createdAt: timestamp
    }
  ];
}

type MapCanvasProps = {
  nodes: readonly DisplayNode[];
  links: readonly DisplayLink[];
  selectedId?: string | null;
  editable?: boolean;
  onMove?: (id: string, x: number, y: number) => void;
  onMoveEnd?: () => void;
  onResize?: (id: string, width: number, height: number) => void;
  onResizeEnd?: (id: string, width: number, height: number) => void;
  onConnect?: (sourceId: string, targetId: string) => void;
  onNodeClick: (node: DisplayNode) => void;
};

function MapCanvas({
  nodes,
  links,
  selectedId,
  editable = false,
  onMove,
  onMoveEnd,
  onResize,
  onResizeEnd,
  onConnect,
  onNodeClick
}: MapCanvasProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [linkPointer, setLinkPointer] = useState<{ x: number; y: number } | null>(null);
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
  const resizedDimensions = (event: PointerEvent<HTMLElement>, state: ResizeState) => ({
    width: clamp(state.startWidth + event.clientX - state.startX, 100, 280),
    height: clamp(state.startHeight + event.clientY - state.startY, 48, 200)
  });
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const position = pointerPosition(event);
    if (draggingId && onMove && position) onMove(draggingId, clamp(position.x, 4, 96), clamp(position.y, 7, 93));
    if (linkingSourceId && position) setLinkPointer(position);
    if (resizing && onResize) {
      const size = resizedDimensions(event, resizing);
      onResize(resizing.id, size.width, size.height);
    }
  };
  const cancelInteraction = () => {
    if (draggingId) onMoveEnd?.();
    setDraggingId(null);
    setResizing(null);
    setLinkingSourceId(null);
    setLinkPointer(null);
  };
  const finishInteraction = (event: PointerEvent<HTMLDivElement>) => {
    if (draggingId) onMoveEnd?.();
    if (resizing) {
      const size = resizedDimensions(event, resizing);
      onResize?.(resizing.id, size.width, size.height);
      onResizeEnd?.(resizing.id, size.width, size.height);
    }
    if (linkingSourceId && onConnect) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-map-node-id]');
      const targetId = target?.dataset.mapNodeId;
      if (targetId && targetId !== linkingSourceId) onConnect(linkingSourceId, targetId);
    }
    setDraggingId(null);
    setResizing(null);
    setLinkingSourceId(null);
    setLinkPointer(null);
  };
  const linkingSource = linkingSourceId ? nodeById.get(linkingSourceId) : undefined;

  return (
    <div
      className={`campaign-map-canvas ${editable ? 'is-editable' : ''} ${linkingSourceId ? 'is-linking' : ''}`}
      onPointerCancel={cancelInteraction}
      onPointerLeave={(event) => {
        if (draggingId || resizing) finishInteraction(event);
        else if (linkingSourceId) cancelInteraction();
      }}
      onPointerMove={move}
      onPointerUp={finishInteraction}
      ref={surfaceRef}
    >
      <svg aria-hidden="true" className="campaign-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {links.map((link) => {
          const source = nodeById.get(link.sourceId);
          const target = nodeById.get(link.targetId);
          if (!source || !target) return null;
          return (
            <g key={link.id}>
              <line x1={source.x} x2={target.x} y1={source.y} y2={target.y} />
              <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2}>{link.label}</text>
            </g>
          );
        })}
        {linkingSource && linkPointer && (
          <line
            className="campaign-map-link-preview"
            x1={linkingSource.x}
            x2={linkPointer.x}
            y1={linkingSource.y}
            y2={linkPointer.y}
          />
        )}
      </svg>
      {nodes.map((node) => (
        <div
          className={`campaign-map-node tone-${node.tone} ${selectedId === node.id ? 'is-selected' : ''} ${linkingSourceId === node.id ? 'is-link-source' : ''}`}
          data-map-node-id={node.id}
          key={node.id}
          style={{ height: `${node.height}px`, left: `${node.x}%`, top: `${node.y}%`, width: `${node.width}px` }}
        >
          <button
            aria-pressed={selectedId === node.id}
            className="campaign-map-node-select"
            onClick={() => onNodeClick(node)}
            type="button"
          >
            <strong>{node.label}</strong>
            <span>{node.subtitle}</span>
            {node.notes && <small>{node.notes}</small>}
          </button>
          {editable && (
            <div className="campaign-map-node-actions">
              <button
                aria-label={`Move ${node.label}`}
                className="campaign-map-drag-handle"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingId(node.id);
                }}
                type="button"
              >⠿</button>
              <button
                aria-label={`Connect ${node.label} to another node`}
                className="campaign-map-connect-handle"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setLinkingSourceId(node.id);
                  setLinkPointer({ x: node.x, y: node.y });
                }}
                type="button"
              >●</button>
            </div>
          )}
          {editable && selectedId === node.id && (
            <button
              aria-label={`Resize ${node.label}`}
              className="campaign-map-resize-handle"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                setResizing({
                  id: node.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  startWidth: node.width,
                  startHeight: node.height
                });
              }}
              type="button"
            ><span aria-hidden="true" /></button>
          )}
        </div>
      ))}
    </div>
  );
}

export function CampaignMapPanel({
  brews,
  campaignMap,
  currentStateByEntityId,
  entities,
  entityReferences,
  worldbuildingEntries,
  onSave
}: CampaignMapPanelProps) {
  const [draft, setDraft] = useState<CampaignMap | null>(campaignMap ?? null);
  const draftRef = useRef<CampaignMap | null>(draft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedNotes, setSelectedNotes] = useState('');
  const [selectedWidth, setSelectedWidth] = useState(DEFAULT_NODE_META.width);
  const [selectedHeight, setSelectedHeight] = useState(DEFAULT_NODE_META.height);
  const [note, setNote] = useState('');
  const [entityId, setEntityId] = useState('');
  const [referenceBrewId, setReferenceBrewId] = useState('');
  const [referencedEntityId, setReferencedEntityId] = useState('');
  const [loadKind, setLoadKind] = useState<'brew' | 'worldbuilding'>('brew');
  const [loadSourceId, setLoadSourceId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [linkLabel, setLinkLabel] = useState('related to');

  useEffect(() => {
    setDraft(campaignMap ?? null);
    draftRef.current = campaignMap ?? null;
  }, [campaignMap]);

  const replaceDraft = (next: CampaignMap, save = true) => {
    draftRef.current = next;
    setDraft(next);
    if (save) onSave(next);
  };
  const visibleLinks = useMemo(() => (draft?.links ?? []).filter((link) => !isNodeMetaLink(link)), [draft?.links]);
  const referencedEntities = useMemo(() => {
    const ids = new Set(
      entityReferences.flatMap((reference) =>
        reference.source.kind === 'brew' && reference.source.brewId === referenceBrewId ? [reference.entityId] : []
      )
    );
    return entities.filter((entity) => ids.has(entity.id) && !draft?.nodes.some((node) => node.entityId === entity.id));
  }, [draft?.nodes, entities, entityReferences, referenceBrewId]);
  const entityByWorldbuildingId = useMemo(
    () => new Map(entities.flatMap((entity) => entity.source.kind === 'worldbuilding' ? [[entity.source.id.toLowerCase(), entity] as const] : [])),
    [entities]
  );
  const boardNodes: DisplayNode[] = (draft?.nodes ?? []).map((node) => {
    const entity = node.entityId ? entities.find((item) => item.id === node.entityId) : undefined;
    const storedMeta = nodeMeta(draft?.links ?? [], node.id);
    const isSelected = node.id === selectedId;
    return {
      id: node.id,
      label: isSelected ? selectedLabel || node.label : node.label,
      subtitle: entity ? String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? entity.kind) : 'Note',
      notes: isSelected ? selectedNotes : storedMeta.notes,
      width: isSelected ? selectedWidth : storedMeta.width,
      height: isSelected ? selectedHeight : storedMeta.height,
      x: node.x,
      y: node.y,
      tone: entity ? 'entity' : 'note',
      entityId: node.entityId
    };
  });
  const selectedConnections = visibleLinks.filter((link) => link.sourceId === selectedId || link.targetId === selectedId);

  const selectNode = (id: string) => {
    const current = draftRef.current;
    const node = current?.nodes.find((item) => item.id === id);
    if (!current || !node) return;
    const meta = nodeMeta(current.links, id);
    setSelectedId(id);
    setSelectedLabel(node.label);
    setSelectedNotes(meta.notes);
    setSelectedWidth(meta.width);
    setSelectedHeight(meta.height);
  };
  const addNote = () => {
    const label = note.trim();
    if (!label || !draft) return;
    const timestamp = new Date().toISOString();
    const node: CampaignMapNode = {
      id: crypto.randomUUID(),
      label,
      kind: 'note',
      x: 50,
      y: 50,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = { ...draft, nodes: [...draft.nodes, node], updatedAt: timestamp };
    replaceDraft(next);
    setNote('');
    setSelectedId(node.id);
    setSelectedLabel(node.label);
    setSelectedNotes('');
    setSelectedWidth(DEFAULT_NODE_META.width);
    setSelectedHeight(DEFAULT_NODE_META.height);
  };
  const addEntity = (id = entityId) => {
    const entity = entities.find((item) => item.id === id);
    if (!entity || !draft || draft.nodes.some((node) => node.entityId === entity.id)) return;
    const timestamp = new Date().toISOString();
    const node: CampaignMapNode = {
      id: crypto.randomUUID(),
      label: entity.name,
      kind: 'entity',
      entityId: entity.id,
      x: 50,
      y: 50,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = { ...draft, nodes: [...draft.nodes, node], updatedAt: timestamp };
    replaceDraft(next);
    setEntityId('');
    setReferencedEntityId('');
    setSelectedId(node.id);
    setSelectedLabel(node.label);
    setSelectedNotes('');
    setSelectedWidth(DEFAULT_NODE_META.width);
    setSelectedHeight(DEFAULT_NODE_META.height);
  };
  const connectNodes = (fromId: string, toId: string) => {
    const current = draftRef.current;
    if (!current || fromId === toId || current.links.some((link) => !isNodeMetaLink(link) && link.sourceId === fromId && link.targetId === toId)) return;
    const timestamp = new Date().toISOString();
    const link: CampaignMapLink = {
      id: crypto.randomUUID(),
      sourceId: fromId,
      targetId: toId,
      label: linkLabel.trim() || 'related to',
      createdAt: timestamp
    };
    replaceDraft({ ...current, links: [...current.links, link], updatedAt: timestamp });
  };
  const addLink = () => {
    if (!sourceId || !targetId) return;
    connectNodes(sourceId, targetId);
    setSourceId('');
    setTargetId('');
    setLinkLabel('related to');
  };
  const saveSelectedNode = (size?: { width: number; height: number }) => {
    const current = draftRef.current;
    if (!current || !selectedId || !selectedLabel.trim()) return;
    const timestamp = new Date().toISOString();
    const width = clamp(size?.width ?? selectedWidth, 100, 280);
    const height = clamp(size?.height ?? selectedHeight, 48, 200);
    const meta: NodeMeta = { notes: selectedNotes.trim(), width, height };
    replaceDraft({
      ...current,
      nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, label: selectedLabel.trim(), updatedAt: timestamp } : node),
      links: withNodeMeta(current.links, selectedId, meta, timestamp),
      updatedAt: timestamp
    });
  };
  const removeConnection = (linkId: string) => {
    const current = draftRef.current;
    if (!current) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...current, links: current.links.filter((link) => link.id !== linkId), updatedAt: timestamp });
  };
  const loadReferenceCluster = () => {
    if (!draft || !loadSourceId) return;
    const timestamp = new Date().toISOString();
    const nodes = [...draft.nodes];
    const links = [...draft.links];
    const ensureEntity = (entity: CampaignEntity, x = 50, y = 50) => {
      const existing = nodes.find((node) => node.entityId === entity.id);
      if (existing) return existing;
      const node: CampaignMapNode = {
        id: crypto.randomUUID(),
        label: entity.name,
        kind: 'entity',
        entityId: entity.id,
        x,
        y,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      nodes.push(node);
      return node;
    };
    const ensureNote = (label: string) => {
      const existing = nodes.find((node) => node.kind === 'note' && node.label === label);
      if (existing) return existing;
      const node: CampaignMapNode = {
        id: crypto.randomUUID(),
        label,
        kind: 'note',
        x: 50,
        y: 50,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      nodes.push(node);
      return node;
    };
    const ensureLink = (fromId: string, toId: string, label: string) => {
      if (fromId === toId || links.some((link) => !isNodeMetaLink(link) && link.sourceId === fromId && link.targetId === toId && link.label === label)) return;
      links.push({ id: crypto.randomUUID(), sourceId: fromId, targetId: toId, label, createdAt: timestamp });
    };

    let source: CampaignMapNode;
    let targets: CampaignEntity[] = [];
    if (loadKind === 'brew') {
      const brew = brews.find((item) => item.id === loadSourceId);
      if (!brew) return;
      source = ensureNote(`Brew: ${brew.title || 'Untitled Brew'}`);
      const ids = new Set(
        entityReferences.flatMap((reference) =>
          reference.source.kind === 'brew' && reference.source.brewId === brew.id ? [reference.entityId] : []
        )
      );
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
    targets.forEach((entity, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, targets.length) - Math.PI / 2;
      const target = ensureEntity(
        entity,
        Math.round(clamp(source.x + Math.cos(angle) * 28, 8, 92)),
        Math.round(clamp(source.y + Math.sin(angle) * 28, 10, 90))
      );
      ensureLink(source.id, target.id, loadKind === 'brew' ? 'references' : 'links to');
    });
    replaceDraft({ ...draft, nodes, links, updatedAt: timestamp });
    selectNode(source.id);
  };
  const moveBoardNode = (id: string, x: number, y: number) => {
    const current = draftRef.current;
    if (!current) return;
    const timestamp = new Date().toISOString();
    replaceDraft(
      {
        ...current,
        nodes: current.nodes.map((node) => node.id === id ? { ...node, x, y, updatedAt: timestamp } : node),
        updatedAt: timestamp
      },
      false
    );
  };
  const resizeBoardNode = (id: string, width: number, height: number) => {
    if (id !== selectedId) return;
    setSelectedWidth(width);
    setSelectedHeight(height);
  };
  const nudgeSelected = (x: number, y: number) => {
    if (!selectedId || !draft) return;
    const node = draft.nodes.find((item) => item.id === selectedId);
    if (!node) return;
    const timestamp = new Date().toISOString();
    replaceDraft({
      ...draft,
      nodes: draft.nodes.map((item) => item.id === node.id
        ? { ...item, x: clamp(item.x + x, 4, 96), y: clamp(item.y + y, 7, 93), updatedAt: timestamp }
        : item),
      updatedAt: timestamp
    });
  };
  const saveMovedBoard = () => {
    if (draftRef.current) onSave(draftRef.current);
  };
  const removeSelected = () => {
    if (!draft || !selectedId) return;
    const timestamp = new Date().toISOString();
    replaceDraft({
      ...draft,
      nodes: draft.nodes.filter((node) => node.id !== selectedId),
      links: draft.links.filter((link) => link.sourceId !== selectedId && link.targetId !== selectedId),
      updatedAt: timestamp
    });
    setSelectedId(null);
  };
  const createBoard = () => replaceDraft(createBlankCampaignMap());

  return (
    <section className="campaign-map-section" aria-label="Campaign map">
      <header>
        <div>
          <p className="eyebrow">Connections and planning</p>
          <h2>Campaign map</h2>
          <small>Your planning board starts empty. Nothing is added from campaign references automatically.</small>
        </div>
      </header>
      {!draft ? (
        <div className="campaign-map-empty">
          <h3>Create a campaign board</h3>
          <p>Start with an empty planning space, then add only the notes and world items you choose.</p>
          <div><button className="primary-button" onClick={createBoard} type="button">Start board</button></div>
        </div>
      ) : (
        <>
          <div className="campaign-map-board-tools">
            <label>Add note<input onChange={(event) => setNote(event.target.value)} placeholder="Loose thread, secret, plan…" value={note} /></label>
            <button onClick={addNote} type="button">Add note</button>
            <label>Add world item<select onChange={(event) => setEntityId(event.target.value)} value={entityId}><option value="">Choose entity</option>{entities.filter((entity) => !draft.nodes.some((node) => node.entityId === entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
            <button disabled={!entityId} onClick={() => addEntity()} type="button">Add item</button>
          </div>
          <div className="campaign-map-brew-tools">
            <label>From brew<select onChange={(event) => { setReferenceBrewId(event.target.value); setReferencedEntityId(''); }} value={referenceBrewId}><option value="">Choose brew</option>{brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>)}</select></label>
            <label>Referenced item<select disabled={!referenceBrewId} onChange={(event) => setReferencedEntityId(event.target.value)} value={referencedEntityId}><option value="">Choose a reference</option>{referencedEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
            <button disabled={!referencedEntityId} onClick={() => addEntity(referencedEntityId)} type="button">Add from brew</button>
          </div>
          <div className="campaign-map-load-tools">
            <label>Load references from<select onChange={(event) => { setLoadKind(event.target.value as 'brew' | 'worldbuilding'); setLoadSourceId(''); }} value={loadKind}><option value="brew">Brew</option><option value="worldbuilding">Worldbuilding</option></select></label>
            <label>{loadKind === 'brew' ? 'Brew' : 'Worldbuilding entry'}<select onChange={(event) => setLoadSourceId(event.target.value)} value={loadSourceId}><option value="">Choose source</option>{loadKind === 'brew' ? brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>) : worldbuildingEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <button disabled={!loadSourceId} onClick={loadReferenceCluster} type="button">Load source + references</button>
          </div>
          <p className="campaign-map-help">This adds only direct, confirmed references from the selected source—never the whole campaign.</p>
          <div className="campaign-map-link-tools">
            <label>From<select onChange={(event) => setSourceId(event.target.value)} value={sourceId}><option value="">Choose node</option>{draft.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>
            <label>To<select onChange={(event) => setTargetId(event.target.value)} value={targetId}><option value="">Choose node</option>{draft.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>
            <label>Link<input onChange={(event) => setLinkLabel(event.target.value)} value={linkLabel} /></label>
            <button disabled={!sourceId || !targetId || sourceId === targetId} onClick={addLink} type="button">Connect</button>
            <button className="quiet-danger" disabled={!selectedId} onClick={removeSelected} type="button">Remove selected</button>
          </div>
          {selectedId && (
            <>
              <section className="campaign-map-node-editor" aria-label="Edit selected node">
                <div>
                  <h3>Edit node</h3>
                  <small>Drag the corner grip on the selected card to resize it.</small>
                </div>
                <label>Title<input onChange={(event) => setSelectedLabel(event.target.value)} value={selectedLabel} /></label>
                <label className="campaign-map-node-notes">Notes<textarea onChange={(event) => setSelectedNotes(event.target.value)} placeholder="Context, secrets, unresolved questions…" value={selectedNotes} /></label>
                <div className="campaign-map-node-editor-actions">
                  <button className="primary-button" disabled={!selectedLabel.trim()} onClick={() => saveSelectedNode()} type="button">Save node</button>
                </div>
                <div className="campaign-map-node-connections">
                  <h4>Connections</h4>
                  {!selectedConnections.length ? (
                    <small>No connections attached to this node.</small>
                  ) : (
                    <div>
                      {selectedConnections.map((link) => {
                        const outgoing = link.sourceId === selectedId;
                        const otherId = outgoing ? link.targetId : link.sourceId;
                        const other = draft.nodes.find((node) => node.id === otherId);
                        return (
                          <div className="campaign-map-node-connection" key={link.id}>
                            <span>{outgoing ? '→' : '←'} {other?.label ?? 'Unknown node'} <em>{link.label}</em></span>
                            <button className="quiet-danger" onClick={() => removeConnection(link.id)} type="button">Remove</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
              <div className="campaign-map-nudge-controls" aria-label="Move selected node">
                <span>Move selected</span>
                <button aria-label="Move selected node up" onClick={() => nudgeSelected(0, -4)} type="button">↑</button>
                <button aria-label="Move selected node left" onClick={() => nudgeSelected(-4, 0)} type="button">←</button>
                <button aria-label="Move selected node right" onClick={() => nudgeSelected(4, 0)} type="button">→</button>
                <button aria-label="Move selected node down" onClick={() => nudgeSelected(0, 4)} type="button">↓</button>
              </div>
            </>
          )}
          <p className="campaign-map-help">Tap a card to edit it. Drag the dotted handle to move it, the round handle to connect it, or the corner grip to resize it.</p>
          <MapCanvas
            editable
            links={visibleLinks}
            nodes={boardNodes}
            onConnect={connectNodes}
            onMove={moveBoardNode}
            onMoveEnd={saveMovedBoard}
            onNodeClick={(node) => selectNode(node.id)}
            onResize={resizeBoardNode}
            onResizeEnd={(_id, width, height) => {
              setSelectedWidth(width);
              setSelectedHeight(height);
              saveSelectedNode({ width, height });
            }}
            selectedId={selectedId}
          />
        </>
      )}
    </section>
  );
}
