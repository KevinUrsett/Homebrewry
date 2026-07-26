import { useMemo, useState } from 'react';
import { worldbuildingKindLabels, worldbuildingKinds, touchWorldbuildingEntry } from '../lib/worldbuilding';
import type { SyncState, WorldbuildingEntry, WorldbuildingKind } from '../types';

type WorldbuildingPanelProps = {
  entries: WorldbuildingEntry[];
  selectedId: string | null;
  syncState: SyncState;
  onCreate: () => void;
  onDelete: (entry: WorldbuildingEntry) => void;
  onSelect: (id: string) => void;
  onUpdate: (entry: WorldbuildingEntry) => void;
};

const campaignSyncLabel: Record<SyncState, string> = {
  local: 'Local only',
  synced: 'Drive synced',
  pending: 'Needs sync',
  conflict: 'Drive conflict',
  error: 'Sync error'
};

function aliasesFromInput(value: string): string[] {
  return value.split(',').map((alias) => alias.trim()).filter(Boolean);
}

type EntryDraft = Pick<WorldbuildingEntry, 'name' | 'kind' | 'aliases' | 'notes'>;

function toDraft(entry: WorldbuildingEntry | null): EntryDraft {
  return {
    name: entry?.name ?? '',
    kind: entry?.kind ?? 'custom',
    aliases: entry?.aliases ?? [],
    notes: entry?.notes ?? ''
  };
}

type WorldbuildingEntryEditorProps = {
  entry: WorldbuildingEntry;
  onDelete: (entry: WorldbuildingEntry) => void;
  onUpdate: (entry: WorldbuildingEntry) => void;
};

function WorldbuildingEntryEditor({ entry, onDelete, onUpdate }: WorldbuildingEntryEditorProps) {
  const [draft, setDraft] = useState<EntryDraft>(() => toDraft(entry));

  const saveDraft = (nextDraft = draft) => {
    onUpdate(touchWorldbuildingEntry(entry, nextDraft));
  };

  const updateAndSave = (changes: Partial<EntryDraft>) => {
    const nextDraft = { ...draft, ...changes };
    setDraft(nextDraft);
    saveDraft(nextDraft);
  };

  return (
    <article className="worldbuilding-entry">
      <label className="visually-hidden" htmlFor="worldbuilding-name">Entry name</label>
      <input
        className="worldbuilding-name"
        id="worldbuilding-name"
        onBlur={() => saveDraft()}
        onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        value={draft.name}
      />
      <div className="worldbuilding-meta-grid">
        <label>
          Type
          <select onChange={(event) => updateAndSave({ kind: event.target.value as WorldbuildingKind })} value={draft.kind}>
            {worldbuildingKinds.map((item) => <option key={item} value={item}>{worldbuildingKindLabels[item]}</option>)}
          </select>
        </label>
        <label>
          Aliases
          <input
            onBlur={() => saveDraft()}
            onChange={(event) => setDraft((current) => ({ ...current, aliases: aliasesFromInput(event.target.value) }))}
            placeholder="Other names, comma-separated"
            value={draft.aliases.join(', ')}
          />
        </label>
      </div>
      <label className="worldbuilding-notes-label">
        Notes
        <textarea
          onBlur={() => saveDraft()}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Lore, secrets, relationships, adventure hooks…"
          value={draft.notes}
        />
      </label>
      <div className="worldbuilding-entry-footer">
        <span>Last updated {new Date(entry.updatedAt).toLocaleString()}</span>
        <button className="quiet-danger" onClick={() => onDelete(entry)} type="button">Delete entry</button>
      </div>
    </article>
  );
}

export function WorldbuildingPanel({ entries, selectedId, syncState, onCreate, onDelete, onSelect, onUpdate }: WorldbuildingPanelProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<WorldbuildingKind | 'all'>('all');
  const filtered = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (kind !== 'all' && entry.kind !== kind) return false;
      if (!terms) return true;
      return [entry.name, worldbuildingKindLabels[entry.kind], ...entry.aliases, entry.notes]
        .join(' ')
        .toLocaleLowerCase()
        .includes(terms);
    });
  }, [entries, kind, query]);
  const selected = entries.find((entry) => entry.id === selectedId) ?? filtered[0] ?? entries[0] ?? null;

  return (
    <main className="worldbuilding-page" aria-label="Worldbuilding">
      <header className="worldbuilding-page-header">
        <div>
          <p className="eyebrow">Campaign reference</p>
          <h1>Worldbuilding</h1>
          <p>Capture campaign places, people, history, and factions independently from each brew.</p>
        </div>
        <div className="page-header-actions">
          <span className={`sync-badge sync-${syncState}`}>{campaignSyncLabel[syncState]}</span>
          <button className="primary-button" onClick={onCreate} type="button">New entry</button>
        </div>
      </header>

      <section className="worldbuilding-workspace">
        <aside className="worldbuilding-browser" aria-label="Worldbuilding entries">
          <input aria-label="Search worldbuilding" className="search-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search towns, people, roads…" value={query} />
          <label className="visually-hidden" htmlFor="worldbuilding-kind">Filter type</label>
          <select className="worldbuilding-kind-select" id="worldbuilding-kind" onChange={(event) => setKind(event.target.value as WorldbuildingKind | 'all')} value={kind}>
            <option value="all">All types</option>
            {worldbuildingKinds.map((item) => <option key={item} value={item}>{worldbuildingKindLabels[item]}</option>)}
          </select>
          <p className="worldbuilding-count">{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</p>
          <div className="worldbuilding-list">
            {filtered.map((entry) => (
              <button className={`worldbuilding-list-item ${selected?.id === entry.id ? 'is-selected' : ''}`} key={entry.id} onClick={() => onSelect(entry.id)} type="button">
                <strong>{entry.name}</strong>
                <span>{worldbuildingKindLabels[entry.kind]}</span>
                {entry.aliases.length > 0 && <small>{entry.aliases.join(' · ')}</small>}
              </button>
            ))}
            {!filtered.length && <p className="empty-panel">No entries match that search.</p>}
          </div>
        </aside>

        <section className="worldbuilding-details" aria-live="polite">
          {selected ? (
            <WorldbuildingEntryEditor entry={selected} key={selected.id} onDelete={onDelete} onUpdate={onUpdate} />
          ) : (
            <p className="empty-panel">Create an entry, or right-click selected text in the editor to add it directly.</p>
          )}
        </section>
      </section>
    </main>
  );
}
