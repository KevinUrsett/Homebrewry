import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createBlankCampaignMap, createCampaignMapFromReferenceMap, deriveReferenceMap, type ReferenceMapLink, type ReferenceMapNode } from '../lib/campaignMap';
import type { Brew, CampaignEntity, CampaignMap, CampaignMapLink, CampaignMapNode, Encounter, EntityCurrentState, EntityReference, TimelineEntry, WorldbuildingEntry } from '../types';
import '../campaign-map.css';

type CampaignMapPanelProps = {
  brews: readonly Brew[];
  campaignMap?: CampaignMap;
  currentStateByEntityId: ReadonlyMap<string, EntityCurrentState>;
  encounters: readonly Encounter[];
  entities: readonly CampaignEntity[];
  entityReferences: readonly EntityReference[];
  timelineEntries: readonly TimelineEntry[];
  worldbuildingEntries: readonly WorldbuildingEntry[];
  onOpenBrew: (brewId: string) => void;
  onOpenEncounter: (encounter: Encounter) => void;
  onOpenEntity: (entity: CampaignEntity) => void;
  onSave: (map: CampaignMap) => void;
};

type DisplayNode = { id: string; label: string; subtitle: string; x: number; y: number; tone: string; entityId?: string; brewId?: string; encounterId?: string };
type DisplayLink = Pick<ReferenceMapLink, 'id' | 'sourceId' | 'targetId' | 'label'>;

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

export function CampaignMapPanel({ brews, campaignMap, currentStateByEntityId, encounters, entities, entityReferences, timelineEntries, worldbuildingEntries, onOpenBrew, onOpenEncounter, onOpenEntity, onSave }: CampaignMapPanelProps) {
  const [mode, setMode] = useState<'reference' | 'board'>('reference');
  const [draft, setDraft] = useState<CampaignMap | null>(campaignMap ?? null);
  const draftRef = useRef<CampaignMap | null>(draft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [entityId, setEntityId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [linkLabel, setLinkLabel] = useState('related to');
  const referenceMap = useMemo(() => deriveReferenceMap(entities, worldbuildingEntries, entityReferences, timelineEntries, brews, encounters, currentStateByEntityId), [brews, currentStateByEntityId, encounters, entities, entityReferences, timelineEntries, worldbuildingEntries]);
  useEffect(() => { setDraft(campaignMap ?? null); draftRef.current = campaignMap ?? null; }, [campaignMap]);
  const replaceDraft = (next: CampaignMap, save = true) => { draftRef.current = next; setDraft(next); if (save) onSave(next); };
  const referenceNodes: DisplayNode[] = referenceMap.nodes.map((node: ReferenceMapNode) => ({ ...node, tone: node.kind }));
  const boardNodes: DisplayNode[] = (draft?.nodes ?? []).map((node) => {
    const entity = node.entityId ? entities.find((item) => item.id === node.entityId) : undefined;
    return { id: node.id, label: node.label, subtitle: entity ? String(currentStateByEntityId.get(entity.id)?.fields.status?.value ?? entity.kind) : 'Note', x: node.x, y: node.y, tone: entity ? 'entity' : 'note', entityId: node.entityId };
  });
  const openReferenceNode = (node: DisplayNode) => {
    if (node.entityId) { const entity = entities.find((item) => item.id === node.entityId); if (entity) onOpenEntity(entity); return; }
    if (node.brewId) { onOpenBrew(node.brewId); return; }
    if (node.encounterId) { const encounter = encounters.find((item) => item.id === node.encounterId); if (encounter) onOpenEncounter(encounter); }
  };
  const addNote = () => {
    const label = note.trim(); if (!label || !draft) return;
    const timestamp = new Date().toISOString();
    const node: CampaignMapNode = { id: crypto.randomUUID(), label, kind: 'note', x: 50, y: 50, createdAt: timestamp, updatedAt: timestamp };
    replaceDraft({ ...draft, nodes: [...draft.nodes, node], updatedAt: timestamp }); setNote(''); setSelectedId(node.id);
  };
  const addEntity = () => {
    const entity = entities.find((item) => item.id === entityId); if (!entity || !draft || draft.nodes.some((node) => node.entityId === entity.id)) return;
    const timestamp = new Date().toISOString();
    const node: CampaignMapNode = { id: crypto.randomUUID(), label: entity.name, kind: 'entity', entityId: entity.id, x: 50, y: 50, createdAt: timestamp, updatedAt: timestamp };
    replaceDraft({ ...draft, nodes: [...draft.nodes, node], updatedAt: timestamp }); setSelectedId(node.id);
  };
  const addLink = () => {
    if (!draft || !sourceId || !targetId || sourceId === targetId || draft.links.some((link) => link.sourceId === sourceId && link.targetId === targetId)) return;
    const timestamp = new Date().toISOString();
    const link: CampaignMapLink = { id: crypto.randomUUID(), sourceId, targetId, label: linkLabel.trim() || 'related to', createdAt: timestamp };
    replaceDraft({ ...draft, links: [...draft.links, link], updatedAt: timestamp }); setSourceId(''); setTargetId(''); setLinkLabel('related to');
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
  const createBoard = (seed: boolean) => { const next = seed ? createCampaignMapFromReferenceMap(referenceMap) : createBlankCampaignMap(); replaceDraft(next); setMode('board'); };

  return <section className="campaign-map-section" aria-label="Campaign map">
    <header><div><p className="eyebrow">Connections and planning</p><h2>Campaign map</h2><small>Reference links are generated; your campaign board is an editable planning layer.</small></div><div className="campaign-map-tabs"><button className={mode === 'reference' ? 'is-selected' : ''} onClick={() => setMode('reference')} type="button">Reference map</button><button className={mode === 'board' ? 'is-selected' : ''} onClick={() => setMode('board')} type="button">Campaign board</button></div></header>
    {mode === 'reference' ? <><p className="campaign-map-help">Generated from confirmed entities, stable references, Worldbuilding links, encounters, and timeline entries. Select a node to open its source.</p><MapCanvas links={referenceMap.links} nodes={referenceNodes} onNodeClick={openReferenceNode} /></> : !draft ? <div className="campaign-map-empty"><h3>Create a campaign board</h3><p>Start with an empty planning space, or copy the current reference map as a movable working board.</p><div><button onClick={() => createBoard(false)} type="button">Start blank</button><button className="primary-button" onClick={() => createBoard(true)} type="button">Seed from references</button></div></div> : <><div className="campaign-map-board-tools"><label>Add note<input onChange={(event) => setNote(event.target.value)} placeholder="Loose thread, secret, plan…" value={note} /></label><button onClick={addNote} type="button">Add note</button><label>Add world item<select onChange={(event) => setEntityId(event.target.value)} value={entityId}><option value="">Choose entity</option>{entities.filter((entity) => !draft.nodes.some((node) => node.entityId === entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><button disabled={!entityId} onClick={addEntity} type="button">Add item</button></div><div className="campaign-map-link-tools"><label>From<select onChange={(event) => setSourceId(event.target.value)} value={sourceId}><option value="">Choose node</option>{draft.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>To<select onChange={(event) => setTargetId(event.target.value)} value={targetId}><option value="">Choose node</option>{draft.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>Link<input onChange={(event) => setLinkLabel(event.target.value)} value={linkLabel} /></label><button disabled={!sourceId || !targetId || sourceId === targetId} onClick={addLink} type="button">Connect</button><button className="quiet-danger" disabled={!selectedId} onClick={removeSelected} type="button">Remove selected</button></div>{selectedId && <div className="campaign-map-nudge-controls" aria-label="Move selected node"><span>Move selected</span><button aria-label="Move selected node up" onClick={() => nudgeSelected(0, -4)} type="button">↑</button><button aria-label="Move selected node left" onClick={() => nudgeSelected(-4, 0)} type="button">←</button><button aria-label="Move selected node right" onClick={() => nudgeSelected(4, 0)} type="button">→</button><button aria-label="Move selected node down" onClick={() => nudgeSelected(0, 4)} type="button">↓</button></div>}<p className="campaign-map-help">Tap a card to select it. Drag the dotted handle, or use the move buttons for precise placement.</p><MapCanvas editable links={draft.links} nodes={boardNodes} onMove={moveBoardNode} onMoveEnd={saveMovedBoard} onNodeClick={(node) => setSelectedId(node.id)} selectedId={selectedId} /></>}</section>;
}
