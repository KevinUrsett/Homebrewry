import { useEffect, useMemo, useState } from 'react';
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

export function PlotBoardPanel({ board, entities, draftSeed, onDraftSeedApplied, onSave }: PlotBoardPanelProps) {
  const [draft, setDraft] = useState<PlotBoard | null>(board ?? null);
  const [phaseTitle, setPhaseTitle] = useState('');
  const [laneTitle, setLaneTitle] = useState('');
  const [laneTone, setLaneTone] = useState<PlotBoardLane['tone']>('main');
  const [editor, setEditor] = useState<BeatEditor | null>(null);

  useEffect(() => { setDraft(board ?? null); }, [board]);
  const phases = useMemo(() => ordered(draft?.phases ?? []), [draft?.phases]);
  const lanes = useMemo(() => ordered(draft?.lanes ?? []), [draft?.lanes]);
  const beats = useMemo(() => ordered(draft?.beats ?? []), [draft?.beats]);
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const beatById = useMemo(() => new Map(beats.map((beat) => [beat.id, beat])), [beats]);

  useEffect(() => {
    if (!draftSeed || !draft || !lanes[0] || !phases[0]) return;
    setEditor({ id: undefined, laneId: lanes[0].id, phaseId: phases[0].id, title: draftSeed.title ?? '', notes: '', status: 'seed', entityId: draftSeed.entityIds?.find((id) => entityById.has(id)) ?? '', linkTargetId: '', linkLabel: 'leads to' });
    onDraftSeedApplied?.();
  }, [draft, draftSeed, entityById, lanes, onDraftSeedApplied, phases]);

  const replaceDraft = (next: PlotBoard) => { setDraft(next); onSave(next); };
  const createBoard = () => replaceDraft(createBlankPlotBoard());
  const addPhase = () => {
    if (!draft || !phaseTitle.trim()) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, phases: [...draft.phases, { id: crypto.randomUUID(), title: phaseTitle.trim(), order: draft.phases.length, createdAt: timestamp, updatedAt: timestamp }], updatedAt: timestamp });
    setPhaseTitle('');
  };
  const addLane = () => {
    if (!draft || !laneTitle.trim()) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, lanes: [...draft.lanes, { id: crypto.randomUUID(), title: laneTitle.trim(), tone: laneTone, order: draft.lanes.length, createdAt: timestamp, updatedAt: timestamp }], updatedAt: timestamp });
    setLaneTitle('');
  };
  const openNewBeat = (laneId: string, phaseId: string) => setEditor({ laneId, phaseId, title: '', notes: '', status: 'seed', entityId: '', linkTargetId: '', linkLabel: 'leads to' });
  const openBeat = (beat: PlotBoardBeat) => {
    const outgoing = draft?.links.find((link) => link.sourceBeatId === beat.id);
    setEditor({ id: beat.id, laneId: beat.laneId, phaseId: beat.phaseId, title: beat.title, notes: beat.notes, status: beat.status, entityId: beat.entityIds[0] ?? '', linkTargetId: outgoing?.targetBeatId ?? '', linkLabel: outgoing?.label ?? 'leads to' });
  };
  const saveBeat = () => {
    if (!draft || !editor?.title.trim()) return;
    const timestamp = new Date().toISOString();
    const entityIds = editor.entityId ? [editor.entityId] : [];
    const existing = editor.id ? draft.beats.find((beat) => beat.id === editor.id) : undefined;
    const beat: PlotBoardBeat = existing
      ? { ...existing, laneId: editor.laneId, phaseId: editor.phaseId, title: editor.title.trim(), notes: editor.notes.trim(), status: editor.status, entityIds, updatedAt: timestamp }
      : { id: crypto.randomUUID(), laneId: editor.laneId, phaseId: editor.phaseId, title: editor.title.trim(), notes: editor.notes.trim(), status: editor.status, entityIds, order: draft.beats.filter((item) => item.laneId === editor.laneId && item.phaseId === editor.phaseId).length, createdAt: timestamp, updatedAt: timestamp };
    const beats = existing ? draft.beats.map((item) => item.id === beat.id ? beat : item) : [...draft.beats, beat];
    const withoutSourceLinks = draft.links.filter((link) => link.sourceBeatId !== beat.id);
    const links = editor.linkTargetId && editor.linkTargetId !== beat.id ? [...withoutSourceLinks, { id: crypto.randomUUID(), sourceBeatId: beat.id, targetBeatId: editor.linkTargetId, label: editor.linkLabel.trim() || 'leads to', createdAt: timestamp }] : withoutSourceLinks;
    replaceDraft({ ...draft, beats, links, updatedAt: timestamp });
    setEditor(null);
  };
  const removeBeat = () => {
    if (!draft || !editor?.id) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, beats: draft.beats.filter((beat) => beat.id !== editor.id), links: draft.links.filter((link) => link.sourceBeatId !== editor.id && link.targetBeatId !== editor.id), updatedAt: timestamp });
    setEditor(null);
  };
  const removePhase = (phaseId: string) => {
    if (!draft || draft.beats.some((beat) => beat.phaseId === phaseId)) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, phases: draft.phases.filter((phase) => phase.id !== phaseId), updatedAt: timestamp });
  };
  const removeLane = (laneId: string) => {
    if (!draft || draft.beats.some((beat) => beat.laneId === laneId)) return;
    const timestamp = new Date().toISOString();
    replaceDraft({ ...draft, lanes: draft.lanes.filter((lane) => lane.id !== laneId), updatedAt: timestamp });
  };

  const beatConnections = (beatId: string) => (draft?.links ?? []).filter((link) => link.sourceBeatId === beatId).flatMap((link) => {
    const target = beatById.get(link.targetBeatId);
    return target ? [`${link.label} ${target.title}`] : [];
  });

  return <section className="plot-board-section" aria-label="Plot board">
    <header><div><p className="eyebrow">Campaign narrative</p><h2>Plot board</h2><small>Outline story arcs and plot beats. This is independent from Campaign Now and World State.</small></div></header>
    {!draft ? <div className="plot-board-empty"><h3>Start a plot board</h3><p>Build the campaign outline manually. Existing timeline entries are not included.</p><button className="primary-button" onClick={createBoard} type="button">Start plot board</button></div> : <>
      <div className="plot-board-tools"><label>New phase<input onChange={(event) => setPhaseTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addPhase(); }} placeholder="Opening, Act II, Finale…" value={phaseTitle} /></label><button disabled={!phaseTitle.trim()} onClick={addPhase} type="button">Add phase</button><label>New story arc<input onChange={(event) => setLaneTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addLane(); }} placeholder="Main plot, Rowan, War…" value={laneTitle} /></label><label>Tone<select onChange={(event) => setLaneTone(event.target.value as PlotBoardLane['tone'])} value={laneTone}>{tones.map((tone) => <option key={tone} value={tone}>{tone}</option>)}</select></label><button disabled={!laneTitle.trim()} onClick={addLane} type="button">Add arc</button></div>
      {!phases.length || !lanes.length ? <div className="plot-board-guidance"><strong>{!phases.length ? 'Add your first phase.' : 'Add your first story arc.'}</strong><span>Phases are vertical campaign sections; arcs are horizontal narrative tracks.</span></div> : <div className="plot-board-scroll"><div className="plot-board-grid" style={{ gridTemplateColumns: `minmax(152px, .8fr) repeat(${phases.length}, minmax(210px, 1fr))` }}>
        <div className="plot-board-corner">Story arcs</div>{phases.map((phase) => <div className="plot-board-phase" key={phase.id}><strong>{phase.title}</strong><button aria-label={`Remove ${phase.title}`} disabled={draft.beats.some((beat) => beat.phaseId === phase.id)} onClick={() => removePhase(phase.id)} type="button">×</button></div>)}
        {lanes.flatMap((lane) => [<div className={`plot-board-lane tone-${lane.tone}`} key={`${lane.id}:label`}><strong>{lane.title}</strong><span>{lane.tone}</span><button aria-label={`Remove ${lane.title}`} disabled={draft.beats.some((beat) => beat.laneId === lane.id)} onClick={() => removeLane(lane.id)} type="button">×</button></div>, ...phases.map((phase) => <div className="plot-board-cell" key={`${lane.id}:${phase.id}`}><div className="plot-board-beats">{beats.filter((beat) => beat.laneId === lane.id && beat.phaseId === phase.id).map((beat) => <button className={`plot-board-beat status-${beat.status}`} key={beat.id} onClick={() => openBeat(beat)} type="button"><span>{statusLabel[beat.status]}</span><strong>{beat.title}</strong>{beat.entityIds.length > 0 && <small>{beat.entityIds.map((id) => entityById.get(id)?.name).filter(Boolean).join(', ')}</small>}{beatConnections(beat.id).map((connection) => <em key={connection}>→ {connection}</em>)}</button>)}</div><button aria-label={`Add a beat to ${lane.title} in ${phase.title}`} className="plot-board-add-beat" onClick={() => openNewBeat(lane.id, phase.id)} type="button">+ Beat</button></div>)])}
      </div></div>}
      {editor && <section className="plot-beat-editor" aria-label="Plot beat editor"><div><h3>{editor.id ? 'Edit plot beat' : 'New plot beat'}</h3><button onClick={() => setEditor(null)} type="button">Close</button></div><label>Story arc<select onChange={(event) => setEditor({ ...editor, laneId: event.target.value })} value={editor.laneId}>{lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}</select></label><label>Phase<select onChange={(event) => setEditor({ ...editor, phaseId: event.target.value })} value={editor.phaseId}>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.title}</option>)}</select></label><label>Status<select onChange={(event) => setEditor({ ...editor, status: event.target.value as PlotBeatStatus })} value={editor.status}>{(Object.keys(statusLabel) as PlotBeatStatus[]).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label><label>Title<input autoFocus onChange={(event) => setEditor({ ...editor, title: event.target.value })} placeholder="The discovery, betrayal, revelation…" value={editor.title} /></label><label>Reference<select onChange={(event) => setEditor({ ...editor, entityId: event.target.value })} value={editor.entityId}><option value="">No Worldbuilding reference</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><label>Connect to<select onChange={(event) => setEditor({ ...editor, linkTargetId: event.target.value })} value={editor.linkTargetId}><option value="">No direct connection</option>{beats.filter((beat) => beat.id !== editor.id).map((beat) => <option key={beat.id} value={beat.id}>{beat.title}</option>)}</select></label><label>Connection label<input disabled={!editor.linkTargetId} onChange={(event) => setEditor({ ...editor, linkLabel: event.target.value })} value={editor.linkLabel} /></label><label className="plot-beat-notes">Notes<textarea onChange={(event) => setEditor({ ...editor, notes: event.target.value })} placeholder="What happens, why it matters, what can change…" value={editor.notes} /></label><div className="plot-beat-editor-actions"><button className="primary-button" onClick={saveBeat} type="button">Save beat</button>{editor.id && <button className="quiet-danger" onClick={removeBeat} type="button">Remove beat</button>}</div></section>}
    </>}
  </section>;
}
