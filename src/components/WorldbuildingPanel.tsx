import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CatalogueCategory, CustomCatalogueCategory } from '../catalogue/types';
import { MarkdownEditor } from './MarkdownEditor';
import { ReferenceContent } from './ReferenceContent';
import { campaignStoragePresentation } from '../lib/campaignStorageStatus';
import { seedBrews } from '../lib/brewStore';
import { listEncounters } from '../lib/encounterStore';
import { findUnresolvedNames } from '../lib/unresolvedReferences';
import { findWorldbuildingConnections, type WorldbuildingConnection } from '../lib/worldbuildingConnections';
import { createWorldbuildingEntry, worldbuildingKindLabel, worldbuildingKindLabels, worldbuildingKinds, touchWorldbuildingEntry } from '../lib/worldbuilding';
import type { CatalogueEntry } from '../catalogue/types';
import type { Brew, CampaignEntity, Encounter, EntityCurrentState, SyncState, WorldbuildingEntry, WorldbuildingKind, WorldbuildingType } from '../types';
import '../unresolved-references.css';

type WorldbuildingPanelProps = {
  entries: WorldbuildingEntry[];
  selectedId: string | null;
  syncState: SyncState;
  hasDriveBackup?: boolean;
  types: WorldbuildingType[];
  catalogue: ReadonlyMap<string, CatalogueEntry>;
  worldbuilding: ReadonlyMap<string, WorldbuildingEntry>;
  catalogueCategories: readonly CustomCatalogueCategory[];
  onCreate: () => string | null | void;
  onCreateType: (name: string) => string | null;
  onCreateWorldbuildingReference: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onCreateCatalogueReference: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
  onDelete: (entry: WorldbuildingEntry) => void;
  onSelect: (id: string) => void;
  onUpdate: (entry: WorldbuildingEntry) => void;
  onReferenceOpen: (entry: CatalogueEntry) => void;
  onWorldbuildingOpen: (entry: WorldbuildingEntry) => void;
  entitiesByWorldbuildingId?: ReadonlyMap<string, CampaignEntity>;
  currentStateByEntityId?: ReadonlyMap<string, EntityCurrentState>;
  onSetNpcStatus?: (entry: WorldbuildingEntry, status: string) => void;
};

function aliasesFromInput(value: string): string[] {
  return value.split(',').map((alias) => alias.trim()).filter(Boolean);
}

type EntryDraft = Pick<WorldbuildingEntry, 'name' | 'kind' | 'aliases' | 'notes'>;

function toDraft(entry: WorldbuildingEntry): EntryDraft {
  return { name: entry.name, kind: entry.kind, aliases: entry.aliases, notes: entry.notes };
}

type EntryEditorProps = {
  entry: WorldbuildingEntry;
  types: readonly WorldbuildingType[];
  catalogueCategories: readonly CustomCatalogueCategory[];
  onCancel: () => void;
  onSave: (entry: WorldbuildingEntry) => void;
  onCreateWorldbuildingReference: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onCreateCatalogueReference: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
};

function WorldbuildingEntryEditor({ entry, types, catalogueCategories, onCancel, onSave, onCreateWorldbuildingReference, onCreateCatalogueReference }: EntryEditorProps) {
  const [draft, setDraft] = useState<EntryDraft>(() => toDraft(entry));
  const options = useMemo(() => [
    ...worldbuildingKinds.map((kind) => ({ id: kind, name: worldbuildingKindLabels[kind] })),
    ...types
  ], [types]);

  return (
    <article className="worldbuilding-entry" aria-label={`Edit ${entry.name}`}>
      <label className="visually-hidden" htmlFor="worldbuilding-name">Entry name</label>
      <input className="worldbuilding-name" id="worldbuilding-name" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} value={draft.name} />
      <div className="worldbuilding-meta-grid">
        <label>Type<select onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as WorldbuildingKind }))} value={draft.kind}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Aliases<input onChange={(event) => setDraft((current) => ({ ...current, aliases: aliasesFromInput(event.target.value) }))} placeholder="Other names, comma-separated" value={draft.aliases.join(', ')} /></label>
      </div>
      <div className="worldbuilding-notes-label">
        <span>Notes</span>
        <MarkdownEditor ariaLabel="Worldbuilding notes" compact content={draft.notes} customCatalogueCategories={catalogueCategories} onChange={(notes) => setDraft((current) => ({ ...current, notes }))} onCreateCatalogueReference={onCreateCatalogueReference} onCreateWorldbuildingReference={onCreateWorldbuildingReference} worldbuildingTypes={types} />
        <small>Right-click selected text to link it to Worldbuilding or the catalogue.</small>
      </div>
      <div className="worldbuilding-entry-footer">
        <span>Changes are saved only when you choose Save.</span>
        <div className="worldbuilding-edit-actions"><button onClick={onCancel} type="button">Cancel</button><button className="primary-button" onClick={() => onSave(touchWorldbuildingEntry(entry, draft))} type="button">Save</button></div>
      </div>
    </article>
  );
}

type EntryPreviewProps = {
  entry: WorldbuildingEntry;
  types: readonly WorldbuildingType[];
  catalogue: ReadonlyMap<string, CatalogueEntry>;
  worldbuilding: ReadonlyMap<string, WorldbuildingEntry>;
  catalogueCategories: readonly CustomCatalogueCategory[];
  onDelete: (entry: WorldbuildingEntry) => void;
  onEdit: () => void;
  onReferenceOpen: (entry: CatalogueEntry) => void;
  onWorldbuildingOpen: (entry: WorldbuildingEntry) => void;
  entity?: CampaignEntity;
  currentState?: EntityCurrentState;
  onSetNpcStatus: (status: string) => void;
  connections: readonly WorldbuildingConnection[];
};

function NpcStateControls({ currentState, onSetStatus }: { currentState?: EntityCurrentState; onSetStatus: (status: string) => void }) {
  const status = String(currentState?.fields.status?.value ?? 'unknown');
  const [draft, setDraft] = useState(status);
  return (
    <section className="worldbuilding-current-state" aria-label="Current NPC state">
      <div><p className="eyebrow">Current world state</p><h3>{status}</h3></div>
      <div className="worldbuilding-state-editor">
        <label>Status<input list="npc-status-options" onChange={(event) => setDraft(event.target.value)} value={draft} /></label>
        <datalist id="npc-status-options"><option value="alive" /><option value="dead" /><option value="missing" /><option value="unknown" /></datalist>
        <button disabled={!draft.trim() || draft.trim() === status} onClick={() => onSetStatus(draft.trim().toLocaleLowerCase())} type="button">Update status</button>
      </div>
      <small>{currentState?.fields.status ? `Last changed ${new Date(currentState.fields.status.updatedAt).toLocaleString()} · manual DM override` : 'No status event recorded yet.'}</small>
    </section>
  );
}

function WorldbuildingEntryPreview({ entry, types, catalogue, worldbuilding, catalogueCategories, onDelete, onEdit, onReferenceOpen, onWorldbuildingOpen, entity, currentState, onSetNpcStatus, connections }: EntryPreviewProps) {
  return (
    <article className="worldbuilding-entry worldbuilding-entry-preview" aria-label={entry.name}>
      <header className="worldbuilding-preview-header"><div><p className="eyebrow">{worldbuildingKindLabel(entry.kind, types)}</p><h2>{entry.name}</h2>{entry.aliases.length > 0 && <p className="worldbuilding-preview-aliases">Also known as {entry.aliases.join(' · ')}</p>}</div><button className="primary-button" onClick={onEdit} type="button">Edit</button></header>
      {entity?.kind === 'npc' && <NpcStateControls currentState={currentState} key={currentState?.fields.status?.eventId ?? 'no-status'} onSetStatus={onSetNpcStatus} />}
      <section className="worldbuilding-connections">
        <div className="worldbuilding-connections-heading"><h3>Connections</h3><span>{connections.length}</span></div>
        {connections.length ? (
          <div className="worldbuilding-connection-list">
            {connections.map((connection) => {
              const related = connection.kind === 'worldbuilding' ? worldbuilding.get(connection.id) : undefined;
              const content = <><span>{connection.kind}</span><strong>{connection.label}</strong><small>{connection.count} mention{connection.count === 1 ? '' : 's'}</small></>;
              return related
                ? <button key={`${connection.kind}:${connection.id}`} onClick={() => onWorldbuildingOpen(related)} type="button">{content}</button>
                : <article key={`${connection.kind}:${connection.id}`}>{content}</article>;
            })}
          </div>
        ) : <p>No connections found yet.</p>}
      </section>
      <section className="worldbuilding-preview-notes"><h3>Notes</h3>{entry.notes.trim() ? <ReferenceContent catalogue={catalogue} catalogueCategories={catalogueCategories} content={entry.notes} onReferenceOpen={onReferenceOpen} onWorldbuildingOpen={onWorldbuildingOpen} worldbuilding={worldbuilding} worldbuildingTypes={types} /> : <p>No notes yet.</p>}</section>
      <div className="worldbuilding-entry-footer"><span>Last updated {new Date(entry.updatedAt).toLocaleString()}</span><button className="quiet-danger" onClick={() => onDelete(entry)} type="button">Delete entry</button></div>
    </article>
  );
}

export function WorldbuildingPanel({ entries, selectedId, syncState, hasDriveBackup = false, types, catalogue, worldbuilding, catalogueCategories, onCreate, onCreateType, onCreateWorldbuildingReference, onCreateCatalogueReference, onDelete, onSelect, onUpdate, onReferenceOpen, onWorldbuildingOpen, entitiesByWorldbuildingId = new Map(), currentStateByEntityId = new Map(), onSetNpcStatus = () => undefined }: WorldbuildingPanelProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<WorldbuildingKind | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingType, setAddingType] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);
  const [brews, setBrews] = useState<Brew[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [dismissedNames, setDismissedNames] = useState<Set<string>>(() => new Set());
  const [suggestedKinds, setSuggestedKinds] = useState<Record<string, WorldbuildingKind>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([seedBrews(), listEncounters()]).then(([brews, encounters]) => {
      if (cancelled) return;
      setBrews(brews);
      setEncounters(encounters);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (kind !== 'all' && entry.kind !== kind) return false;
      if (!terms) return true;
      return [entry.name, worldbuildingKindLabel(entry.kind, types), ...entry.aliases, entry.notes].join(' ').toLocaleLowerCase().includes(terms);
    });
  }, [entries, kind, query, types]);

  const typeOptions = useMemo(() => [
    ...worldbuildingKinds.map((item) => ({ id: item, name: worldbuildingKindLabels[item] })),
    ...types
  ], [types]);

  const knownNames = useMemo(() => [
    ...entries.flatMap((entry) => [entry.name, ...entry.aliases]),
    ...[...catalogue.values()].map((entry) => entry.name),
    ...encounters.map((encounter) => encounter.name)
  ], [catalogue, encounters, entries]);

  const unresolved = useMemo(
    () => findUnresolvedNames(brews.map((brew) => brew.content), knownNames).filter((item) => !dismissedNames.has(item.name.toLocaleLowerCase())).slice(0, 30),
    [brews, dismissedNames, knownNames]
  );

  const selected = entries.find((entry) => entry.id === selectedId) ?? filtered[0] ?? entries[0] ?? null;
  const editing = editingId === selected?.id;
  const storage = campaignStoragePresentation(syncState, hasDriveBackup);
  const selectedEntity = selected ? entitiesByWorldbuildingId.get(selected.id) : undefined;
  const selectedCurrentState = selectedEntity ? currentStateByEntityId.get(selectedEntity.id) : undefined;
  const connections = useMemo(
    () => selected ? findWorldbuildingConnections(selected, brews, encounters, entries) : [],
    [brews, encounters, entries, selected]
  );

  const selectEntry = (id: string) => {
    if (editing && id !== selected?.id && !window.confirm('Discard unsaved Worldbuilding changes?')) return;
    setEditingId(null);
    onSelect(id);
  };

  const submitType = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = onCreateType(typeName);
    if (!id) { setTypeError('That type already exists, or its name is invalid.'); return; }
    setKind(id); setTypeName(''); setTypeError(null); setAddingType(false);
  };

  const createSuggestedEntry = (name: string) => {
    const entry = createWorldbuildingEntry(name, suggestedKinds[name] ?? 'place');
    onUpdate(entry);
    onSelect(entry.id);
    setEditingId(entry.id);
  };

  const createEntry = () => {
    const id = onCreate();
    if (!id) return;
    onSelect(id);
    setEditingId(id);
  };

  return (
    <main className="worldbuilding-page" aria-label="Worldbuilding">
      <header className="worldbuilding-page-header"><div><p className="eyebrow">Campaign reference</p><h1>Worldbuilding</h1><p>Capture campaign places, people, history, and factions independently from each brew.</p></div><div className="page-header-actions"><span className={`sync-badge sync-${storage.tone}`} title={storage.title}>{storage.label}</span><button onClick={() => setAddingType((open) => !open)} type="button">New type</button><button className="primary-button" onClick={createEntry} type="button">New entry</button></div></header>

      {addingType && <form className="worldbuilding-new-type" onSubmit={submitType}><label>New Worldbuilding type<input autoFocus onChange={(event) => setTypeName(event.target.value)} placeholder="Tavern, deity, ship…" value={typeName} /></label><button type="button" onClick={() => { setAddingType(false); setTypeError(null); }}>Cancel</button><button className="primary-button" type="submit">Add type</button>{typeError && <p role="alert">{typeError}</p>}</form>}

      <section className="worldbuilding-workspace">
        <aside className="worldbuilding-browser" aria-label="Worldbuilding entries">
          <input aria-label="Search worldbuilding" className="search-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search towns, people, roads…" value={query} />
          <label className="visually-hidden" htmlFor="worldbuilding-kind">Filter type</label>
          <select className="worldbuilding-kind-select" id="worldbuilding-kind" onChange={(event) => setKind(event.target.value as WorldbuildingKind | 'all')} value={kind}><option value="all">All types</option>{typeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <p className="worldbuilding-count">{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</p>
          <div className="worldbuilding-list">{filtered.map((entry) => <button className={`worldbuilding-list-item ${selected?.id === entry.id ? 'is-selected' : ''}`} key={entry.id} onClick={() => selectEntry(entry.id)} type="button"><strong>{entry.name}</strong><span>{worldbuildingKindLabel(entry.kind, types)}</span>{entry.aliases.length > 0 && <small>{entry.aliases.join(' · ')}</small>}</button>)}{!filtered.length && <p className="empty-panel">No entries match that search.</p>}</div>

          <section className="unresolved-references" aria-label="Unresolved names">
            <div className="unresolved-references-header"><h3>Unresolved names</h3><span>{unresolved.length}</span></div>
            {unresolved.length ? <div className="unresolved-reference-list">{unresolved.map((item) => <div className="unresolved-reference-item" key={item.name}><div className="unresolved-reference-name"><strong>{item.name}</strong><span>{item.count} mention{item.count === 1 ? '' : 's'}</span></div><div className="unresolved-reference-actions"><select aria-label={`Type for ${item.name}`} onChange={(event) => setSuggestedKinds((current) => ({ ...current, [item.name]: event.target.value as WorldbuildingKind }))} value={suggestedKinds[item.name] ?? 'place'}>{typeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select><button className="primary-button" onClick={() => createSuggestedEntry(item.name)} type="button">Create</button><button aria-label={`Dismiss ${item.name}`} onClick={() => setDismissedNames((current) => new Set(current).add(item.name.toLocaleLowerCase()))} type="button">×</button></div></div>)}</div> : <p className="unresolved-reference-empty">No likely unresolved names found. Detection is deliberately conservative.</p>}
          </section>
        </aside>

        <section className="worldbuilding-details" aria-live="polite">{selected ? (editing ? <WorldbuildingEntryEditor catalogueCategories={catalogueCategories} entry={selected} key={selected.id} onCancel={() => setEditingId(null)} onCreateCatalogueReference={onCreateCatalogueReference} onCreateWorldbuildingReference={onCreateWorldbuildingReference} onSave={(entry) => { onUpdate(entry); setEditingId(null); }} types={types} /> : <WorldbuildingEntryPreview catalogue={catalogue} catalogueCategories={catalogueCategories} connections={connections} currentState={selectedCurrentState} entity={selectedEntity} entry={selected} onDelete={onDelete} onEdit={() => setEditingId(selected.id)} onReferenceOpen={onReferenceOpen} onSetNpcStatus={(status) => onSetNpcStatus(selected, status)} onWorldbuildingOpen={onWorldbuildingOpen} types={types} worldbuilding={worldbuilding} />) : <p className="empty-panel">Create an entry, or review an unresolved name from the list.</p>}</section>
      </section>
    </main>
  );
}
