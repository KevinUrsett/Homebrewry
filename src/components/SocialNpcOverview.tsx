import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NpcRoleplayCategory, NpcRoleplayCue, WorldbuildingEntry } from '../types';
import { touchWorldbuildingEntry } from '../lib/worldbuilding';

const categories: { key: NpcRoleplayCategory; label: string; placeholder: string }[] = [
  { key: 'mannerisms', label: 'Mannerisms / speech', placeholder: 'e.g. Soft voice; always checks the door' },
  { key: 'fearSecret', label: 'Fear / secret', placeholder: 'e.g. Hiding a debt to the guild' },
  { key: 'attitude', label: 'Attitude', placeholder: 'e.g. Friendly, but slow to trust' }
];

type Props = {
  entry: WorldbuildingEntry;
  onClose: () => void;
  onOpenWorldbuilding: () => void;
  onRemove: () => void;
  onUpdate: (entry: WorldbuildingEntry) => void;
};

export function SocialNpcOverview({ entry, onClose, onOpenWorldbuilding, onRemove, onUpdate }: Props) {
  const [openCategory, setOpenCategory] = useState<NpcRoleplayCategory | null>(null);
  const category = categories.find(({ key }) => key === openCategory);

  return (
    <article className="social-character-overview">
      <header>
        <span aria-hidden="true">{entry.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase() || '?'}</span>
        <div><small>{entry.kind.replaceAll('-', ' ')}</small><h3>{entry.name}</h3>{entry.aliases.length > 0 && <p>Also known as {entry.aliases.join(', ')}</p>}</div>
        <button aria-label={`Close ${entry.name} overview`} onClick={onClose} type="button">×</button>
      </header>
      <div aria-label="NPC at a glance" className="social-npc-cues">
        {categories.map(({ key, label }) => {
          const cue = entry.roleplay?.[key];
          const text = cue?.summary.trim() || cue?.details.trim();
          return (
            <button aria-haspopup="dialog" aria-label={label} className="social-npc-cue" key={key} onClick={() => setOpenCategory(key)} type="button">
              <span className="social-npc-cue-label">{label}</span>
              <strong className={text ? '' : 'is-empty'}>{text || 'Add a cue'}</strong>
              <small>{text ? 'View details' : 'Tap to add'} <span aria-hidden="true">↗</span></small>
            </button>
          );
        })}
        <div aria-label="Reserved slot" className="social-npc-cue-placeholder" />
      </div>
      {entry.notes.trim() && <details className="social-npc-general-notes"><summary>General notes</summary><p>{entry.notes}</p></details>}
      <footer>
        <button onClick={onOpenWorldbuilding} type="button">Worldbuilding entry</button>
        <button className="is-danger" onClick={onRemove} type="button">Remove from encounter</button>
      </footer>
      {category && <NpcCueDialog
        key={category.key}
        category={category}
        cue={entry.roleplay?.[category.key]}
        name={entry.name}
        onClose={() => setOpenCategory(null)}
        onSave={(cue) => {
          onUpdate(touchWorldbuildingEntry(entry, { roleplay: { ...entry.roleplay, [category.key]: cue } }));
          setOpenCategory(null);
        }}
      />}
    </article>
  );
}

function NpcCueDialog({ category, cue, name, onClose, onSave }: {
  category: typeof categories[number];
  cue?: NpcRoleplayCue;
  name: string;
  onClose: () => void;
  onSave: (cue: NpcRoleplayCue) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(!cue?.summary.trim() && !cue?.details.trim());
  const [summary, setSummary] = useState(cue?.summary ?? '');
  const [details, setDetails] = useState(cue?.details ?? '');
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (editing) summaryRef.current?.focus();
    else headingRef.current?.focus();
  }, [editing]);

  return createPortal(
    <dialog aria-labelledby={`${id}-title`} className="social-npc-cue-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} ref={dialogRef}>
      <header>
        <div><p>{name}</p><h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{category.label}</h2></div>
        <button aria-label="Close details" onClick={onClose} type="button">×</button>
      </header>
      {editing ? (
        <form onSubmit={(event) => { event.preventDefault(); onSave({ summary: summary.trim(), details: details.trim() }); }}>
          <label htmlFor={`${id}-summary`}>At-a-glance cue</label>
          <input id={`${id}-summary`} maxLength={140} onChange={(event) => setSummary(event.target.value)} placeholder={category.placeholder} ref={summaryRef} value={summary} />
          <label htmlFor={`${id}-details`}>More information</label>
          <textarea id={`${id}-details`} onChange={(event) => setDetails(event.target.value)} placeholder="Details to reveal when you need them…" rows={6} value={details} />
          <p className="social-npc-cue-save-hint">Saved with this NPC in every social encounter.</p>
          <footer><button onClick={onClose} type="button">Cancel</button><button className="is-primary" type="submit">Save</button></footer>
        </form>
      ) : (
        <>
          <div className="social-npc-cue-reading">
            {cue?.summary.trim() && <p className="social-npc-cue-lead">{cue.summary}</p>}
            {cue?.details.trim() ? <p>{cue.details}</p> : <p className="is-empty">No further details yet.</p>}
          </div>
          <footer><button onClick={() => setEditing(true)} type="button">Edit</button><button className="is-primary" onClick={onClose} type="button">Done</button></footer>
        </>
      )}
    </dialog>,
    document.body
  );
}
