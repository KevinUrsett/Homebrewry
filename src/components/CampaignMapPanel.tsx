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

type DisplayNode = { id: string; label: string; subtitle: string; x: number; y: number; tone: string; entityId?: string; brewId?: string; encounterId?: string };
type DisplayLink = Pick<CampaignMapLink, 'id' | 'sourceId' | 'targetId' | 'label'>;

function MapCanvas({ nodes, links, selectedId, editable = false, onMove, onMoveEnd, onNodeClick }: { nodes: readonly DisplayNode[]; links: readonly DisplayLink[]; selectedId?: string | null; editable?: boolean; onMove?: (id: string, x: number, y: number) => void; onMoveEnd?: () => void; onNodeClick: (node: DisplayNode) => void }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingId || !onMove || !surfaceRef.current) return;
    const bounds = surfaceRef.current.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(7, Math.min(93, ((event.clientY - bounds.top) / bounds.height) * 100));
    onMove(draggingId, x, y);
  };
  const finishMove = () => {
    if (!draggingId) return;
    setDraggingId(null);
    onMoveEnd?.();
  };
  return <div className={`campaign-map-canvas ${editable ? 'is-editable' : ''}`} onPointerMove={move} onPointerUp={finishMove} onPointerLeave={finishMove} ref={surfaceRef}>
    <svg aria-hidden="true" className="campaign-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">{links.map((link) => {
      const source = nodeById.get(link.sourceId); const target = nodeById.get(link.targetId);
      if (!source || !target) return null;
      return <g key={link.id}><line x1={source.x} x2={target.x} y1={source.y} y2={target.y} /><text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2}>{link.label}</text></g>;
    })}</svg>
    {nodes.map((node) => <div className={`campaign-map-node tone-${node.tone} ${selectedId === node.id ? 'is-selected' : ''}`} key={node.id} style={{ left: `${node.x}%`, top: `${node.y}%` }}>
      <button aria-pressed={selectedId === node.id} className="campaign-map-node-select" onClick={() => onNodeClick(node)} type="button"><strong>{node.label}</strong><span>{node.subtitle}</span></button>
      {editable && <button aria-label={`Move ${node.label}`} className="campaign-map-drag-handle" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDraggingId(node.id); }} type="button">⠿</button>}
    </div>)}
  </div>;
}

export function CampaignMapPanel({ brews, campaignMap, currentStateByEntityId, entities, entityReferences, worldbuildingEntries, onSave }: CampaignMapPanelProps) {
  const [draft, setDraft] = useState<CampaignMap | null>(campaignMap ?? null);
  const draftRef = useRef<CampaignMap | null>(draft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [entityId, setEntityId] = useState('');
  const [referenceBrewId, setReferenceBrewId] = useState('');
  const [referencedEntityId, setReferencedEntityId] = useState('');
  const [loadKind, setLoadKind] = useState<'brew' | 'worldbuilding'>('brew');
  const [loadSourceId, setLoadSourceId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [linkLabel, setLinkLabel] = useState('related to');
  useEffect(() => { setDraft(campaignMap ?? null); draftRef.current = campaignMap ?? null; }, [campaignMap]);
  const replaceDraft = (next: CampaignMap, save = true) => { draftRef.current = next; setDraft(next); if (save) onSave(next); };
  const referencedEntities = useMemo(() => {
    const ids = new Set(entityReferences.flatMap((reference) => reference.source.kind === 'brew' && reference.source.brewId === referenceBrewId ? [reference.entityId] : []));
    return entities.filter((entity) => ids.has(entity.id) && !draft?.nodes.some((node) => node.entityId === entity.id));
  }, [draft?.nodes, entities, entityReferences, referenceBrewId]);
  const entityByWorldbuildingId = useMemo(() => new Map(entities.flatMap((entity) => entity.source.kind === 'worldbuilding' ? [[entity.source.id.toLowerCase(), entity] as const] : [])), [entities]);
  const boardNodes: DisplayNode[] = (draft?.nodes ?? []).map((node) => {
    const entity = node.entityId ? entities.find((item) => item.id === node.entityId) : undefined;
    return { id: node.id, label: node.label, subtitle: entity ? String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? entity.kind) : 'Note', x: node.x, y: node.y, tone: entity ? 'entity' : 'note', entityId: node.entityId };
  });
  const addNote = () => {
    const label = note.trim(); if (!label || !draft) return;
    const timestamp = new Date().toISOString();
    const node: CampaignMapNode = { id: crypto.randomUUID(), label, kind: 'note', x: 50, y: 50, createdAt: timestamp, updatedAt: timestamp };
    replaceDraft({ ...draft, nodes: [...draft.nodes, node], updatedAt: timestamp }); setNote(''); setSelectedId(node.id);
  };
  const addEntity = (id = entityId) => {
    const entity = entities.find((item) => item.id === id); if (!entity || !draft || draft.nodes.some((node) => node.entityId === entity.id)) return;
    const timestamp = new Date().toISOString();
    const node: CampaignMapNode = { id: crypto.randomUUID(), label: entity.name, kind: 'entity', entityId: entity.id, x: 50, y: 50, createdAt: timestamp, updatedAt: timestamp };
    replaceDraft({ ...draft, nodes: [...draft.nodes, node], updatedAt: timestamp }); setEntityId(''); setReferencedEntityId(''); setSelectedId(node.id);
  };
  const addLink = () => {
    if (!draft || !sourceId || !targetId || sourceId === targetId || draft.links.some((link) => link.sourceId === sourceId && link.targetId === targetId)) return;
    const timestamp = new Date().toISOString();
    const link: CampaignMapLink = { id: crypto.randomUUID(), sourceId, targetId, label: linkLabel.trim() || 'related to', createdAt: timestamp };
    replaceDraft({ ...draft, links: [...draft.links, link], updatedAt: timestamp }); setSourceId(''); setTargetId(''); setLinkLabel('related to');
  };
  const loadReferenceCluster = () => {
    if (!draft || !loadSourceId) return;
    const timestamp = new Date().toISOString();
    const nodes = [...draft.nodes];
    const links = [...draft.links];
    const ensureEntity = (entity: CampaignEntity, x = 50, y = 50) => {
      const existing = nodes.find((node) => node.entityId === entity.id);
      if (existing) return existing;
      const node: CampaignMapNode = { id: crypto.randomUUID(), label: entity.name, kind: 'entity', entityId: entity.id, x, y, createdAt: timestamp, updatedAt: timestamp };
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
      if (sourceId === targetId || links.some((link) => link.sourceId === sourceId && link.targetId === targetId && link.label === label)) return;
      links.push({ id: crypto.randomUUID(), sourceId, targetId, label, createdAt: timestamp });
    };
    let source: CampaignMapNode;
    let targets: CampaignEntity[] = [];
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
    targets.forEach((entity, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, targets.length) - Math.PI / 2;
      const target = ensureEntity(entity, Math.round(Math.max(8, Math.min(92, source.x + Math.cos(angle) * 28))), Math.round(Math.max(10, Math.min(90, source.y + Math.sin(angle) * 28))));
      ensureLink(source.id, target.id, loadKind === 'brew' ? 'references' : 'links to');
    });
    replaceDraft({ ...draft, nodes, links, updatedAt: timestamp });
    setSelectedId(source.id);
  };
  const moveBoardNode = (id: string, x: number, y: number) => {
    const current = draftRef.current; if (!current) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, x, y, updatedAt: timestamp } : node), updatedAt: timestamp }, false);
  };
  const nudgeSelected = (x: number, y: number) => {
    if (!selectedId || !draft) return;
    const node = draft.nodes.find((item) => item.id === selectedId);
    if (!node) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, nodes: draft.nodes.map((item) => item.id === node.id ? { ...item, x: Math.max(4, Math.min(96, item.x + x)), y: Math.max(7, Math.min(93, item.y + y)), updatedAt: timestamp } : item), updatedAt: timestamp });
  };
  const saveMovedBoard = () => { if (draftRef.current) onSave(draftRef.current); };
  const removeSelected = () => {
    if (!draft || !selectedId) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, nodes: draft.nodes.filter((node) => node.id !== selectedId), links: draft.links.filter((link) => link.sourceId !== selectedId && link.targetId !== selectedId), updatedAt: timestamp }); setSelectedId(null);
  };
  const createBoard = () => replaceDraft(createBlankCampaignMap());

  return <section className="campaign-map-section" aria-label="Campaign map">
    <header><div><p className="eyebrow">Connections and planning</p><h2>Campaign map</h2><small>Your planning board starts empty. Nothing is added from campaign references automatically.</small></div></header>
    {!draft ? <div className="campaign-map-empty"><h3>Create a campaign board</h3><p>Start with an empty planning space, then add only the notes and world items you choose.</p><div><button className="primary-button" onClick={createBoard} type="button">Start board</button></div></div> : <><div className="campaign-map-board-tools"><label>Add note<input onChange={(event) => setNote(event.target.value)} placeholder="Loose thread, secret, plan…" value={note} /></label><button onClick={addNote} type="button">Add note</button><label>Add world item<select onChange={(event) => setEntityId(event.target.value)} value={entityId}><option value="">Choose entity</option>{entities.filter((entity) => !draft.nodes.some((node) => node.entityId === entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><button disabled={!entityId} onClick={() => addEntity()} type="button">Add item</button></div><div className="campaign-map-brew-tools"><label>From brew<select onChange={(event) => { setReferenceBrewId(event.target.value); setReferencedEntityId(''); }} value={referenceBrewId}><option value="">Choose brew</option>{brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>)}</select></label><label>Referenced item<select disabled={!referenceBrewId} onChange={(event) => setReferencedEntityId(event.target.value)} value={referencedEntityId}><option value="">Choose a reference</option>{referencedEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><button disabled={!referencedEntityId} onClick={() => addEntity(referencedEntityId)} type="button">Add from brew</button></div><div className="campaign-map-load-tools"><label>Load references from<select onChange={(event) => { setLoadKind(event.target.value as 'brew' | 'worldbuilding'); setLoadSourceId(''); }} value={loadKind}><option value="brew">Brew</option><option value="worldbuilding">Worldbuilding</option></select></label><label>{loadKind === 'brew' ? 'Brew' : 'Worldbuilding entry'}<select onChange={(event) => setLoadSourceId(event.target.value)} value={loadSourceId}><option value="">Choose source</option>{loadKind === 'brew' ? brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>) : worldbuildingEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button disabled={!loadSourceId} onClick={loadReferenceCluster} type="button">Load source + references</button></div><p className="campaign-map-help">This adds only direct, confirmed references from the selected source—never the whole campaign.</p><div className="campaign-map-link-tools"><label>From<select onChange={(event) => setSourceId(event.target.value)} value={sourceId}><option value="">Choose node</option>{draft.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>To<select onChange={(event) => setTargetId(event.target.value)} value={targetId}><option value="">Choose node</option>{draft.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>Link<input onChange={(event) => setLinkLabel(event.target.value)} value={linkLabel} /></label><button disabled={!sourceId || !targetId || sourceId === targetId} onClick={addLink} type="button">Connect</button><button className="quiet-danger" disabled={!selectedId} onClick={removeSelected} type="button">Remove selected</button></div>{selectedId && <div className="campaign-map-nudge-controls" aria-label="Move selected node"><span>Move selected</span><button aria-label="Move selected node up" onClick={() => nudgeSelected(0, -4)} type="button">↑</button><button aria-label="Move selected node left" onClick={() => nudgeSelected(-4, 0)} type="button">←</button><button aria-label="Move selected node right" onClick={() => nudgeSelected(4, 0)} type="button">→</button><button aria-label="Move selected node down" onClick={() => nudgeSelected(0, 4)} type="button">↓</button></div>}<p className="campaign-map-help">Tap a card to select it. Drag the dotted handle, or use the move buttons for precise placement.</p><MapCanvas editable links={draft.links} nodes={boardNodes} onMove={moveBoardNode} onMoveEnd={saveMovedBoard} onNodeClick={(node) => setSelectedId(node.id)} selectedId={selectedId} /></>}</section>;
}
