import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createBlankPlotBoard } from '../lib/plotBoard';
import type { CampaignEntity, PlotBoard, PlotBoardBeat, PlotBoardLane, PlotBeatStatus } from '../types';
import '../plot-board.css';

export type PlotBeatDraftSeed = { title?: string; entityIds?: string[] };

type PlotBoardPanelProps = {
  board?: PlotBoard;
  entities: readonly CampaignEntity[];
  draftSeed?: PlotBeatDraftSeed | null;
  onDraftSeedApplied?: () => void;
  onSave: (board: PlotBoard) => void;
};

type BeatEditor = {
  id?: string;
  laneId: string;
  spanToPhaseId: string;
  phaseId: string;
  title: string;
  notes: string;
  status: PlotBeatStatus;
  entityId: string;
  linkTargetId: string;
  linkLabel: string;
};

const tones: readonly PlotBoardLane['tone'][] = ['main', 'side', 'character', 'secret'];
const statusLabel: Record<PlotBeatStatus, string> = { seed: 'Seed', planned: 'Planned', active: 'Active', resolved: 'Resolved' };

const ordered = <T extends { order: number }>(items: readonly T[]) => [...items].sort((left, right) => left.order - right.order);
const normalizeOrder = <T extends { order: number }>(items: readonly T[]): T[] => items.map((item, index) => ({ ...item, order: index }));
const moveOrderedItem = <T extends { id: string; order: number }>(items: readonly T[], id: string, offset: number): T[] => {
  const next = ordered(items);
  const currentIndex = next.findIndex((item) => item.id === id);
  const targetIndex = currentIndex + offset;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= next.length) return next;
  [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
  return normalizeOrder(next);
};

export function PlotBoardPanel({ board, entities, draftSeed, onDraftSeedApplied, onSave }: PlotBoardPanelProps) {
  const [draft, setDraft] = useState<PlotBoard | null>(board ?? null);
  const [phaseTitle, setPhaseTitle] = useState('');
  const [phaseInsertAfterId, setPhaseInsertAfterId] = useState<string | null>(null);
  const [laneTitle, setLaneTitle] = useState('');
  const [laneTone, setLaneTone] = useState<PlotBoardLane['tone']>('main');
  const [laneInsertAfterId, setLaneInsertAfterId] = useState<string | null>(null);
  const [editor, setEditor] = useState<BeatEditor | null>(null);
  const phaseInputRef = useRef<HTMLInputElement>(null);
  const laneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(board ?? null); }, [board]);
  const phases = useMemo(() => ordered(draft?.phases ?? []), [draft?.phases]);
  const lanes = useMemo(() => ordered(draft?.lanes ?? []), [draft?.lanes]);
  const beats = useMemo(() => ordered(draft?.beats ?? []), [draft?.beats]);
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const beatById = useMemo(() => new Map(beats.map((beat) => [beat.id, beat])), [beats]);
  const phaseById = useMemo(() => new Map(phases.map((phase) => [phase.id, phase])), [phases]);
  const laneById = useMemo(() => new Map(lanes.map((lane) => [lane.id, lane])), [lanes]);

  useEffect(() => {
    if (!draftSeed || !draft || !lanes[0] || !phases[0]) return;
    setEditor({ id: undefined, laneId: lanes[0].id, spanToPhaseId: '', phaseId: phases[0].id, title: draftSeed.title ?? '', notes: '', status: 'seed', entityId: draftSeed.entityIds?.find((id) => entityById.has(id)) ?? '', linkTargetId: '', linkLabel: 'leads to' });
    onDraftSeedApplied?.();
  }, [draft, draftSeed, entityById, lanes, onDraftSeedApplied, phases]);

  const replaceDraft = (next: PlotBoard) => { setDraft(next); onSave(next); };
  const createBoard = () => replaceDraft(createBlankPlotBoard());
  const addPhase = () => {
    if (!draft || !phaseTitle.trim()) return;
    const timestamp = new Date().toISOString();
    const nextPhases = ordered(draft.phases);
    const insertIndex = phaseInsertAfterId
      ? Math.max(0, nextPhases.findIndex((phase) => phase.id === phaseInsertAfterId) + 1)
      : nextPhases.length;
    nextPhases.splice(insertIndex, 0, { id: crypto.randomUUID(), title: phaseTitle.trim(), order: insertIndex, createdAt: timestamp, updatedAt: timestamp });
    replaceDraft({ ...draft, phases: normalizeOrder(nextPhases), updatedAt: timestamp });
    setPhaseTitle('');
    setPhaseInsertAfterId(null);
  };
  const addLane = () => {
    if (!draft || !laneTitle.trim()) return;
    const timestamp = new Date().toISOString();
    const nextLanes = ordered(draft.lanes);
    const insertIndex = laneInsertAfterId
      ? Math.max(0, nextLanes.findIndex((lane) => lane.id === laneInsertAfterId) + 1)
      : nextLanes.length;
    nextLanes.splice(insertIndex, 0, { id: crypto.randomUUID(), title: laneTitle.trim(), tone: laneTone, order: insertIndex, createdAt: timestamp, updatedAt: timestamp });
    replaceDraft({ ...draft, lanes: normalizeOrder(nextLanes), updatedAt: timestamp });
    setLaneTitle('');
    setLaneInsertAfterId(null);
  };
  const preparePhaseInsert = (phaseId: string) => {
    setPhaseInsertAfterId(phaseId);
    setPhaseTitle('');
    requestAnimationFrame(() => {
      phaseInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      phaseInputRef.current?.focus();
    });
  };
  const prepareLaneInsert = (laneId: string) => {
    setLaneInsertAfterId(laneId);
    setLaneTitle('');
    requestAnimationFrame(() => {
      laneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      laneInputRef.current?.focus();
    });
  };
  const movePhase = (phaseId: string, offset: number) => {
    if (!draft) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, phases: moveOrderedItem(draft.phases, phaseId, offset), updatedAt: timestamp });
  };
  const moveLane = (laneId: string, offset: number) => {
    if (!draft) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, lanes: moveOrderedItem(draft.lanes, laneId, offset), updatedAt: timestamp });
  };
  const openNewBeat = (laneId: string, phaseId: string) => setEditor({ laneId, spanToPhaseId: '', phaseId, title: '', notes: '', status: 'seed', entityId: '', linkTargetId: '', linkLabel: 'leads to' });
  const openBeat = (beat: PlotBoardBeat) => {
    const outgoing = draft?.links.find((link) => link.sourceBeatId === beat.id);
    const spanEnd = [...(beat.spanPhaseIds ?? [])].filter((phaseId) => phaseId !== beat.phaseId).at(-1) ?? '';
    setEditor({ id: beat.id, laneId: beat.laneId, spanToPhaseId: spanEnd, phaseId: beat.phaseId, title: beat.title, notes: beat.notes, status: beat.status, entityId: beat.entityIds[0] ?? '', linkTargetId: outgoing?.targetBeatId ?? '', linkLabel: outgoing?.label ?? 'leads to' });
  };
  const saveBeat = () => {
    if (!draft || !editor?.title.trim()) return;
    const timestamp = new Date().toISOString();
    const entityIds = editor.entityId ? [editor.entityId] : [];
    const existing = editor.id ? draft.beats.find((beat) => beat.id === editor.id) : undefined;
    const anchorIndex = phases.findIndex((phase) => phase.id === editor.phaseId);
    const endIndex = phases.findIndex((phase) => phase.id === editor.spanToPhaseId);
    const spanPhaseIds = endIndex > anchorIndex ? phases.slice(anchorIndex, endIndex + 1).map((phase) => phase.id) : [];
    const beat: PlotBoardBeat = existing
      ? { ...existing, laneId: editor.laneId, ...(spanPhaseIds.length > 1 ? { spanPhaseIds } : { spanPhaseIds: undefined }), phaseId: editor.phaseId, title: editor.title.trim(), notes: editor.notes.trim(), status: editor.status, entityIds, updatedAt: timestamp }
      : { id: crypto.randomUUID(), laneId: editor.laneId, ...(spanPhaseIds.length > 1 ? { spanPhaseIds } : {}), phaseId: editor.phaseId, title: editor.title.trim(), notes: editor.notes.trim(), status: editor.status, entityIds, order: draft.beats.filter((item) => item.laneId === editor.laneId && item.phaseId === editor.phaseId).length, createdAt: timestamp, updatedAt: timestamp };
    const nextBeats = existing ? draft.beats.map((item) => item.id === beat.id ? beat : item) : [...draft.beats, beat];
    const withoutSourceLinks = draft.links.filter((link) => link.sourceBeatId !== beat.id);
    const links = editor.linkTargetId && editor.linkTargetId !== beat.id ? [...withoutSourceLinks, { id: crypto.randomUUID(), sourceBeatId: beat.id, targetBeatId: editor.linkTargetId, label: editor.linkLabel.trim() || 'leads to', createdAt: timestamp }] : withoutSourceLinks;
    replaceDraft({ ...draft, beats: nextBeats, links, updatedAt: timestamp });
    setEditor(null);
  };
  const removeBeat = () => {
    if (!draft || !editor?.id) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, beats: draft.beats.filter((beat) => beat.id !== editor.id), links: draft.links.filter((link) => link.sourceBeatId !== editor.id && link.targetBeatId !== editor.id), updatedAt: timestamp });
    setEditor(null);
  };
  const removePhase = (phaseId: string) => {
    if (!draft || draft.beats.some((beat) => beat.phaseId === phaseId || beat.spanPhaseIds?.includes(phaseId))) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, phases: normalizeOrder(draft.phases.filter((phase) => phase.id !== phaseId)), updatedAt: timestamp });
  };
  const removeLane = (laneId: string) => {
    if (!draft || draft.beats.some((beat) => beat.laneId === laneId)) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, lanes: normalizeOrder(draft.lanes.filter((lane) => lane.id !== laneId)), updatedAt: timestamp });
  };

  const beatConnections = (beatId: string) => (draft?.links ?? []).filter((link) => link.sourceBeatId === beatId).flatMap((link) => {
    const target = beatById.get(link.targetBeatId);
    return target ? [`${link.label} ${target.title}`] : [];
  });
  const isSpanning = (beat: PlotBoardBeat) => (beat.spanPhaseIds?.length ?? 0) > 1;
  const spanEndIndex = (beat: PlotBoardBeat) => Math.max(...(beat.spanPhaseIds ?? [beat.phaseId]).map((phaseId) => phases.findIndex((phase) => phase.id === phaseId)));
  const renderBeat = (beat: PlotBoardBeat, className = 'plot-board-beat') => <button className={`${className} status-${beat.status}`} key={beat.id} onClick={() => openBeat(beat)} type="button"><span>{statusLabel[beat.status]}</span><strong>{beat.title}</strong>{beat.entityIds.length > 0 && <small>{beat.entityIds.map((id) => entityById.get(id)?.name).filter(Boolean).join(', ')}</small>}{beatConnections(beat.id).map((connection) => <em key={connection}>→ {connection}</em>)}</button>;

  return <section className="plot-board-section" aria-label="Plot board">
    <header><div><p className="eyebrow">Campaign narrative</p><h2>Plot board</h2><small>Outline story arcs and plot beats. This is independent from Campaign Now and World State.</small></div></header>
    {!draft ? <div className="plot-board-empty"><h3>Start a plot board</h3><p>Build the campaign outline manually. Existing timeline entries are not included.</p><button className="primary-button" onClick={createBoard} type="button">Start plot board</button></div> : <>
      <div className="plot-board-tools">
        <div className="plot-board-tool-group">
          <label>{phaseInsertAfterId ? `Insert phase after ${phaseById.get(phaseInsertAfterId)?.title ?? 'selected phase'}` : 'New phase'}<input ref={phaseInputRef} onChange={(event) => setPhaseTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addPhase(); }} placeholder="Opening, Act II, Finale…" value={phaseTitle} /></label>
          <div><button disabled={!phaseTitle.trim()} onClick={addPhase} type="button">{phaseInsertAfterId ? 'Insert phase' : 'Add phase'}</button>{phaseInsertAfterId && <button className="plot-board-cancel-insert" onClick={() => { setPhaseInsertAfterId(null); setPhaseTitle(''); }} type="button">Cancel</button>}</div>
        </div>
        <div className="plot-board-tool-group plot-board-tool-group-lane">
          <label>{laneInsertAfterId ? `Insert arc after ${laneById.get(laneInsertAfterId)?.title ?? 'selected arc'}` : 'New story arc'}<input ref={laneInputRef} onChange={(event) => setLaneTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addLane(); }} placeholder="Main plot, Rowan, War…" value={laneTitle} /></label>
          <label>Tone<select onChange={(event) => setLaneTone(event.target.value as PlotBoardLane['tone'])} value={laneTone}>{tones.map((tone) => <option key={tone} value={tone}>{tone}</option>)}</select></label>
          <div><button disabled={!laneTitle.trim()} onClick={addLane} type="button">{laneInsertAfterId ? 'Insert arc' : 'Add arc'}</button>{laneInsertAfterId && <button className="plot-board-cancel-insert" onClick={() => { setLaneInsertAfterId(null); setLaneTitle(''); }} type="button">Cancel</button>}</div>
        </div>
      </div>
      {!phases.length || !lanes.length ? <div className="plot-board-guidance"><strong>{!phases.length ? 'Add your first phase.' : 'Add your first story arc.'}</strong><span>Phases are vertical campaign sections; arcs are horizontal narrative tracks.</span></div> : <>
        <p className="plot-board-scroll-hint">Swipe sideways to view more phases.</p>
        <div className="plot-board-scroll"><div className="plot-board-grid" style={{ '--phase-count': phases.length } as CSSProperties}>
          <div className="plot-board-corner" style={{ gridColumn: 1, gridRow: 1 }}>Story arcs</div>{phases.map((phase, phaseIndex) => <div className="plot-board-phase" key={phase.id} style={{ gridColumn: phaseIndex + 2, gridRow: 1 }}><strong>{phase.title}</strong><div className="plot-board-item-actions"><button aria-label={`Move ${phase.title} left`} disabled={phaseIndex === 0} onClick={() => movePhase(phase.id, -1)} type="button">←</button><button aria-label={`Insert a phase after ${phase.title}`} onClick={() => preparePhaseInsert(phase.id)} type="button">+</button><button aria-label={`Move ${phase.title} right`} disabled={phaseIndex === phases.length - 1} onClick={() => movePhase(phase.id, 1)} type="button">→</button><button aria-label={`Remove ${phase.title}`} disabled={draft.beats.some((beat) => beat.phaseId === phase.id || beat.spanPhaseIds?.includes(phase.id))} onClick={() => removePhase(phase.id)} type="button">×</button></div></div>)}
          {lanes.flatMap((lane, laneIndex) => [
            <div className={`plot-board-lane tone-${lane.tone}`} key={`${lane.id}:label`} style={{ gridColumn: 1, gridRow: laneIndex + 2 }}><strong>{lane.title}</strong><span>{lane.tone}</span><div className="plot-board-item-actions plot-board-lane-actions"><button aria-label={`Move ${lane.title} up`} disabled={laneIndex === 0} onClick={() => moveLane(lane.id, -1)} type="button">↑</button><button aria-label={`Insert a story arc after ${lane.title}`} onClick={() => prepareLaneInsert(lane.id)} type="button">+</button><button aria-label={`Move ${lane.title} down`} disabled={laneIndex === lanes.length - 1} onClick={() => moveLane(lane.id, 1)} type="button">↓</button><button aria-label={`Remove ${lane.title}`} disabled={draft.beats.some((beat) => beat.laneId === lane.id)} onClick={() => removeLane(lane.id)} type="button">×</button></div></div>,
            ...phases.map((phase, phaseIndex) => <div className="plot-board-cell" key={`${lane.id}:${phase.id}`} style={{ gridColumn: phaseIndex + 2, gridRow: laneIndex + 2 }}><div className="plot-board-beats">{beats.filter((beat) => beat.laneId === lane.id && beat.phaseId === phase.id && !isSpanning(beat)).map((beat) => renderBeat(beat))}</div><button aria-label={`Add a beat to ${lane.title} in ${phase.title}`} className="plot-board-add-beat" onClick={() => openNewBeat(lane.id, phase.id)} type="button">+ Beat</button></div>)
          ])}
          {beats.filter(isSpanning).map((beat) => {
            const laneIndex = lanes.findIndex((lane) => lane.id === beat.laneId);
            const phaseIndex = phases.findIndex((phase) => phase.id === beat.phaseId);
            const endIndex = spanEndIndex(beat);
            if (laneIndex < 0 || phaseIndex < 0 || endIndex <= laneIndex) return null;
            return <div className="plot-board-span" key={`span:${beat.id}`} style={{ gridColumn: `${phaseIndex + 2} / ${endIndex + 3}`, gridRow: laneIndex + 2 }}>{renderBeat(beat, 'plot-board-beat plot-board-span-beat')}</div>;
          })}
        </div></div>
      </>}
      {editor && <section className="plot-beat-editor" aria-label="Plot beat editor"><div><h3>{editor.id ? 'Edit plot beat' : 'New plot beat'}</h3><button onClick={() => setEditor(null)} type="button">Close</button></div><label>Story arc<select onChange={(event) => setEditor({ ...editor, laneId: event.target.value })} value={editor.laneId}>{lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}</select></label><label>Phase<select onChange={(event) => setEditor({ ...editor, phaseId: event.target.value, spanToPhaseId: '' })} value={editor.phaseId}>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.title}</option>)}</select></label><label>To<select onChange={(event) => setEditor({ ...editor, spanToPhaseId: event.target.value })} value={editor.spanToPhaseId}><option value="">This phase only</option>{phases.slice(Math.max(0, phases.findIndex((phase) => phase.id === editor.phaseId) + 1)).map((phase) => <option key={phase.id} value={phase.id}>Through {phase.title}</option>)}</select></label><label>Status<select onChange={(event) => setEditor({ ...editor, status: event.target.value as PlotBeatStatus })} value={editor.status}>{(Object.keys(statusLabel) as PlotBeatStatus[]).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label><label>Title<input autoFocus onChange={(event) => setEditor({ ...editor, title: event.target.value })} placeholder="The discovery, betrayal, revelation…" value={editor.title} /></label><label>Reference<select onChange={(event) => setEditor({ ...editor, entityId: event.target.value })} value={editor.entityId}><option value="">No Worldbuilding reference</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><label>Connect to<select onChange={(event) => setEditor({ ...editor, linkTargetId: event.target.value })} value={editor.linkTargetId}><option value="">No direct connection</option>{beats.filter((beat) => beat.id !== editor.id).map((beat) => <option key={beat.id} value={beat.id}>{beat.title}</option>)}</select></label><label>Connection label<input disabled={!editor.linkTargetId} onChange={(event) => setEditor({ ...editor, linkLabel: event.target.value })} value={editor.linkLabel} /></label><label className="plot-beat-notes">Notes<textarea onChange={(event) => setEditor({ ...editor, notes: event.target.value })} placeholder="What happens, why it matters, what can change…" value={editor.notes} /></label><div className="plot-beat-editor-actions"><button className="primary-button" onClick={saveBeat} type="button">Save beat</button>{editor.id && <button className="quiet-danger" onClick={removeBeat} type="button">Remove beat</button>}</div></section>}
    </>}
  </section>;
}
