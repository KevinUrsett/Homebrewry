import { useEffect, useMemo, useState } from 'react';
import type { Brew, IdeaDraft } from '../types';
import '../ideas.css';

type IdeasPanelProps = {
  brews: Brew[];
  ideas: IdeaDraft[];
  initialBrewId: string | null;
  onClose: () => void;
  onCreate: (brewId: string) => void;
  onDelete: (idea: IdeaDraft) => void;
  onCreateContent: (idea: IdeaDraft) => void;
  onCreateEncounter: (idea: IdeaDraft) => void;
  onSave: (idea: IdeaDraft) => void;
};

export function IdeasPanel({ brews, ideas, initialBrewId, onClose, onCreate, onDelete, onCreateContent, onCreateEncounter, onSave }: IdeasPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(ideas[0]?.id ?? null);
  const selected = ideas.find((idea) => idea.id === selectedId) ?? null;
  const [text, setText] = useState(selected?.text ?? '');
  const brewNames = useMemo(() => new Map(brews.map((brew) => [brew.id, brew.title || 'Untitled Brew'])), [brews]);

  useEffect(() => {
    if (selectedId && ideas.some((idea) => idea.id === selectedId)) return;
    setSelectedId(ideas[0]?.id ?? null);
  }, [ideas, selectedId]);

  useEffect(() => {
    setText(selected?.text ?? '');
  }, [selected?.id]);

  const prepared = selected ? { ...selected, text: text.trim(), updatedAt: new Date().toISOString() } : null;

  return (
    <main className="ideas-page" aria-label="My ideas">
      <header className="ideas-header">
        <div><p className="eyebrow">Capture first, place later</p><h1>My ideas</h1><p>Ideas stay separate from your brews until you deliberately create them.</p></div>
        <div><button onClick={() => { setSelectedId(null); onCreate(initialBrewId ?? brews[0]?.id ?? ''); }} type="button">New idea</button><button className="primary-button" onClick={onClose} type="button">Back to writing</button></div>
      </header>
      <section className="ideas-workspace">
        <aside className="ideas-list" aria-label="Saved ideas">
          {ideas.map((idea) => <button className={idea.id === selected?.id ? 'is-selected' : ''} key={idea.id} onClick={() => setSelectedId(idea.id)} type="button"><strong>{idea.text.split(/\r?\n/)[0] || 'Untitled idea'}</strong><span>{brewNames.get(idea.brewId) ?? 'Missing brew'}</span></button>)}
          {!ideas.length && <p>No ideas yet. Capture one from a brew’s plus button.</p>}
        </aside>
        <section className="ideas-editor">
          {selected ? <>
            <label>Brew<select onChange={(event) => onSave({ ...selected, brewId: event.target.value, text, updatedAt: new Date().toISOString() })} value={selected.brewId}>{brews.map((brew) => <option key={brew.id} value={brew.id}>{brew.title || 'Untitled Brew'}</option>)}</select></label>
            <label>Idea<textarea onChange={(event) => setText(event.target.value)} placeholder="A scene, clue, encounter, or loose thread…" value={text} /></label>
            <div className="ideas-actions"><button disabled={!text.trim()} onClick={() => prepared && onSave(prepared)} type="button">Save idea</button><span /><button disabled={!text.trim()} onClick={() => prepared && onCreateContent(prepared)} type="button">Create text</button><button className="primary-button" disabled={!text.trim()} onClick={() => prepared && onCreateEncounter(prepared)} type="button">Create encounter</button><button className="quiet-danger" onClick={() => onDelete(selected)} type="button">Delete</button></div>
          </> : <p className="empty-panel">Choose or create an idea to start expanding it.</p>}
        </section>
      </section>
    </main>
  );
}
