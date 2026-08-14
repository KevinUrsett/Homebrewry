import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CatalogueCategory, CustomCatalogueCategory } from '../catalogue/types';
import { BelentorCalendar } from './BelentorCalendar';
import { MarkdownEditor } from './MarkdownEditor';
import { ReferenceContent } from './ReferenceContent';
import { campaignStoragePresentation } from '../lib/campaignStorageStatus';
import { seedBrews } from '../lib/brewStore';
import { listEncounters } from '../lib/encounterStore';
import { findUnresolvedNames } from '../lib/unresolvedReferences';
import { remainingTalesOnUnwrittenTomesReferences, type CuratedReference } from '../lib/talesOnUnwrittenTomesReferences';
import { findWorldbuildingConnections, type WorldbuildingConnection } from '../lib/worldbuildingConnections';
import { worldbuildingKindLabel, worldbuildingKindLabels, worldbuildingKinds, touchWorldbuildingEntry } from '../lib/worldbuilding';
import type { CatalogueEntry } from '../catalogue/types';
import type { Brew, CampaignEntity, Encounter, EntityCurrentState, SyncState, WorldbuildingEntry, WorldbuildingKind, WorldbuildingType, WorldEvent } from '../types';
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
  onOpenNameGenerator?: () => void;
  onCreateType: (name: string) => string | null;
  onCreateWorldbuildingReference: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onCreateCatalogueReference: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
  onDelete: (entry: WorldbuildingEntry) => void;
  onSelect: (id: string) => void;
  onUpdate: (entry: WorldbuildingEntry) => void;
  onReferenceOpen: (entry: CatalogueEntry) => void;
  onWorldbuildingOpen: (entry: WorldbuildingEntry) => void;
  onEncounterOpen?: (encounterId: string) => void;
  entitiesByWorldbuildingId?: ReadonlyMap<string, CampaignEntity>;
  currentStateByEntityId?: ReadonlyMap<string, EntityCurrentState>;
  worldEvents?: readonly WorldEvent[];
  onSetNpcStatus?: (entry: WorldbuildingEntry, status: string) => void;
  onCreatePlotBeat?: (entry: WorldbuildingEntry, entity?: CampaignEntity) => void;
  onCreateCuratedReferences?: (references: readonly CuratedReference[]) => void;
  onCreateSuggestedEntries?: (references: readonly Pick<WorldbuildingEntry, 'name' | 'kind'>[]) => void;
};

type WorldbuildingSort = 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc' | 'created-desc' | 'kind';
type WorldbuildingPageMode = 'entries' | 'calendar';
type ReferenceInboxTab = 'pantheon' | 'people' | 'places' | 'factions' | 'other' | 'this-brew';
const worldbuildingCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const referenceInboxTabs: readonly { id: ReferenceInboxTab; label: string }[] = [
  { id: 'pantheon', label: 'Pantheon' },
  { id: 'people', label: 'People' },
  { id: 'places', label: 'Places' },
  { id: 'factions', label: 'Factions' },
  { id: 'other', label: 'Other' },
  { id: 'this-brew', label: 'This brew' }
];

function curatedInboxTab(reference: CuratedReference): Exclude<ReferenceInboxTab, 'this-brew'> {
  if (reference.kind === 'deity') return 'pantheon';
  if (['character', 'historical-figure', 'npc'].includes(reference.kind)) return 'people';
  if (['town', 'road', 'landmark', 'region'].includes(reference.kind)) return 'places';
  if (['faction', 'organization'].includes(reference.kind)) return 'factions';
  return 'other';
}

function referenceSelectionKey(source: 'curated' | 'brew', name: string) {
  return `${source}:${name.toLocaleLowerCase()}`;
}

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
  onEncounterOpen: (encounterId: string) => void;
  onCreatePlotBeat: () => void;
  entity?: CampaignEntity;
  currentState?: EntityCurrentState;
  onSetNpcStatus: (status: string) => void;
  connections: readonly WorldbuildingConnection[];
  combatNotes: readonly { id: string; encounterId: string; encounterName: string; occurredAt: string }[];
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
      <small>
        {currentState?.fields.status
          ? `Last changed ${new Date(currentState.fields.status.updatedAt).toLocaleString()} · ${currentState.fields.status.authority === 'manual' ? 'manual DM override' : 'structured combat update'}`
          : 'No status event recorded yet.'}
      </small>
    </section>
  );
}

function WorldbuildingEntryPreview({ entry, types, catalogue, worldbuilding, catalogueCategories, onDelete, onEdit, onReferenceOpen, onWorldbuildingOpen, onEncounterOpen, onCreatePlotBeat, entity, currentState, onSetNpcStatus, connections, combatNotes }: EntryPreviewProps) {
  return (
    <article className="worldbuilding-entry worldbuilding-entry-preview" aria-label={entry.name}>
      <header className="worldbuilding-preview-header"><div><p className="eyebrow">{worldbuildingKindLabel(entry.kind, types)}</p><h2>{entry.name}</h2>{entry.aliases.length > 0 && <p className="worldbuilding-preview-aliases">Also known as {entry.aliases.join(' · ')}</p>}</div><button className="primary-button" onClick={onEdit} type="button">Edit</button></header>
      {entity?.kind === 'npc' && <NpcStateControls currentState={currentState} key={currentState?.fields.status?.eventId ?? 'no-status'} onSetStatus={onSetNpcStatus} />}
      {combatNotes.length > 0 && (
        <section className="worldbuilding-combat-notes" aria-label="Combat notes">
          <h3>Combat notes</h3>
          <div>
            {combatNotes.map((note) => (
              <article key={note.id}>
                <strong>Dead</strong>
                <span>Died during <button onClick={() => onEncounterOpen(note.encounterId)} type="button">{note.encounterName}</button></span>
                <small>{new Date(note.occurredAt).toLocaleString()} · Combat tracker</small>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="worldbuilding-connections">
        <div className="worldbuilding-connections-heading"><h3>Connections</h3><span>{connections.length}</span></div>
        {connections.length ? (
          <div className="worldbuilding-connection-list">
            {connections.map((connection) => {
              const related = connection.kind === 'worldbuilding' ? worldbuilding.get(connection.id) : undefined;
              const direction = connection.direction === 'mutual'
                ? 'Mutual references'
                : connection.direction === 'outgoing'
                  ? 'Mentioned in this entry'
                  : connection.direction === 'incoming'
                    ? 'Mentions this entry'
                    : `${connection.count} mention${connection.count === 1 ? '' : 's'}`;
              const content = <><span>{connection.kind}</span><strong>{connection.label}</strong><small>{direction}</small></>;
              return related
                ? <button key={`${connection.kind}:${connection.id}`} onClick={() => onWorldbuildingOpen(related)} type="button">{content}</button>
                : connection.kind === 'encounter'
                  ? <button key={`${connection.kind}:${connection.id}`} onClick={() => onEncounterOpen(connection.id)} type="button">{content}</button>
                  : <article key={`${connection.kind}:${connection.id}`}>{content}</article>;
            })}
          </div>
        ) : <p>No connections found yet.</p>}
      </section>
      <section className="worldbuilding-preview-notes"><h3>Notes</h3>{entry.notes.trim() ? <ReferenceContent catalogue={catalogue} catalogueCategories={catalogueCategories} content={entry.notes} onReferenceOpen={onReferenceOpen} onWorldbuildingOpen={onWorldbuildingOpen} worldbuilding={worldbuilding} worldbuildingTypes={types} /> : <p>No notes yet.</p>}</section>
      <div className="worldbuilding-entry-footer"><span>Last updated {new Date(entry.updatedAt).toLocaleString()}</span><div className="worldbuilding-edit-actions"><button onClick={onCreatePlotBeat} type="button">Add plot beat</button><button className="quiet-danger" onClick={() => onDelete(entry)} type="button">Delete entry</button></div></div>
    </article>
  );
}

type ReferenceInboxProps = {
  curatedReferences: readonly CuratedReference[];
  query: string;
  types: readonly WorldbuildingType[];
  unresolved: readonly { name: string; count: number }[];
  onCreateCuratedReferences: (references: readonly CuratedReference[]) => void;
  onCreateSuggestedEntries: (references: readonly Pick<WorldbuildingEntry, 'name' | 'kind'>[]) => void;
  onDismissNames: (names: readonly string[]) => void;
};

function ReferenceInbox({ curatedReferences, query, types, unresolved, onCreateCuratedReferences, onCreateSuggestedEntries, onDismissNames }: ReferenceInboxProps) {
  const [tab, setTab] = useState<ReferenceInboxTab>('pantheon');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [suggestedKinds, setSuggestedKinds] = useState<Record<string, WorldbuildingKind>>({});
  const terms = query.trim().toLocaleLowerCase();
  const grouped = useMemo(() => {
    const groups: Record<Exclude<ReferenceInboxTab, 'this-brew'>, CuratedReference[]> = { pantheon: [], people: [], places: [], factions: [], other: [] };
    curatedReferences.forEach((reference) => groups[curatedInboxTab(reference)].push(reference));
    return groups;
  }, [curatedReferences]);
  const currentCurated = tab === 'this-brew' ? [] : grouped[tab].filter((reference) => !terms || [reference.name, reference.notes, ...(reference.aliases ?? [])].join(' ').toLocaleLowerCase().includes(terms));
  const currentUnresolved = tab === 'this-brew' ? unresolved.filter((reference) => !terms || reference.name.toLocaleLowerCase().includes(terms)) : [];
  const currentKeys = tab === 'this-brew'
    ? currentUnresolved.map((reference) => referenceSelectionKey('brew', reference.name))
    : currentCurated.map((reference) => referenceSelectionKey('curated', reference.name));
  const selectedCount = currentKeys.filter((key) => selected.has(key)).length;
  const countFor = (id: ReferenceInboxTab) => id === 'this-brew' ? unresolved.length : grouped[id].length;
  const toggle = (key: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const selectAll = () => setSelected((current) => {
    const next = new Set(current);
    const allSelected = currentKeys.every((key) => next.has(key));
    currentKeys.forEach((key) => allSelected ? next.delete(key) : next.add(key));
    return next;
  });
  const addCurated = (references: readonly CuratedReference[]) => {
    if (!references.length) return;
    onCreateCuratedReferences(references);
    setSelected((current) => {
      const next = new Set(current);
      references.forEach((reference) => next.delete(referenceSelectionKey('curated', reference.name)));
      return next;
    });
  };
  const addSuggested = (references: readonly { name: string }[]) => {
    if (!references.length) return;
    onCreateSuggestedEntries(references.map((reference) => ({ name: reference.name, kind: suggestedKinds[reference.name] ?? 'landmark' })));
    setSelected((current) => {
      const next = new Set(current);
      references.forEach((reference) => next.delete(referenceSelectionKey('brew', reference.name)));
      return next;
    });
  };

  const selectedCurated = currentCurated.filter((reference) => selected.has(referenceSelectionKey('curated', reference.name)));
  const selectedUnresolved = currentUnresolved.filter((reference) => selected.has(referenceSelectionKey('brew', reference.name)));

  return <div className="reference-inbox" aria-label="Reference inbox">
    <div className="reference-inbox-tabs" role="tablist" aria-label="Reference groups">
      {referenceInboxTabs.map((item) => <button aria-selected={tab === item.id} className={tab === item.id ? 'is-selected' : ''} key={item.id} onClick={() => setTab(item.id)} role="tab" type="button">{item.label} <span>{countFor(item.id)}</span></button>)}
    </div>
    <section className="reference-inbox-panel">
      <header>
        <div><h3>{referenceInboxTabs.find((item) => item.id === tab)?.label}</h3><p>{tab === 'this-brew' ? 'Possible names found in this brew. Choose their type before adding.' : 'Reviewed campaign references, ready to add when useful.'}</p></div>
        <div className="reference-inbox-bulk-actions"><button disabled={!currentKeys.length} onClick={selectAll} type="button">{selectedCount === currentKeys.length && currentKeys.length ? 'Clear selection' : 'Select all'}</button><button className="primary-button" disabled={!selectedCount} onClick={() => tab === 'this-brew' ? addSuggested(selectedUnresolved) : addCurated(selectedCurated)} type="button">Add selected ({selectedCount})</button></div>
      </header>
      {tab === 'this-brew' ? <div className="reference-inbox-list">{currentUnresolved.map((reference) => {
        const key = referenceSelectionKey('brew', reference.name);
        return <article key={reference.name}><label className="reference-inbox-check"><input checked={selected.has(key)} onChange={() => toggle(key)} type="checkbox" /><span className="visually-hidden">Select {reference.name}</span></label><div><strong>{reference.name}</strong><span>{reference.count} mention{reference.count === 1 ? '' : 's'}</span></div><select aria-label={`Type for ${reference.name}`} onChange={(event) => setSuggestedKinds((current) => ({ ...current, [reference.name]: event.target.value }))} value={suggestedKinds[reference.name] ?? 'landmark'}>{worldbuildingKinds.map((kind) => <option key={kind} value={kind}>{worldbuildingKindLabels[kind]}</option>)}{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><button onClick={() => addSuggested([reference])} type="button">Add</button><button aria-label={`Dismiss ${reference.name}`} onClick={() => onDismissNames([reference.name])} type="button">×</button></article>;
      })}{!currentUnresolved.length && <p className="unresolved-reference-empty">No likely names found in this brew.</p>}</div> : <div className="reference-inbox-list">{currentCurated.map((reference) => {
        const key = referenceSelectionKey('curated', reference.name);
        return <article key={reference.name}><label className="reference-inbox-check"><input checked={selected.has(key)} onChange={() => toggle(key)} type="checkbox" /><span className="visually-hidden">Select {reference.name}</span></label><div><strong>{reference.name}</strong><span>{worldbuildingKindLabel(reference.kind, types)}</span>{reference.aliases?.length ? <small>{reference.aliases.join(' · ')}</small> : null}</div><button aria-label={`Create ${reference.name}`} onClick={() => addCurated([reference])} type="button">Add</button></article>;
      })}{!currentCurated.length && <p className="unresolved-reference-empty">No references in this group.</p>}</div>}
    </section>
  </div>;
}

export function WorldbuildingPanel({ entries, selectedId, syncState, hasDriveBackup = false, types, catalogue, worldbuilding, catalogueCategories, onCreate, onOpenNameGenerator = () => undefined, onCreateType, onCreateWorldbuildingReference, onCreateCatalogueReference, onDelete, onSelect, onUpdate, onReferenceOpen, onWorldbuildingOpen, onEncounterOpen = () => undefined, entitiesByWorldbuildingId = new Map(), currentStateByEntityId = new Map(), worldEvents = [], onSetNpcStatus = () => undefined, onCreatePlotBeat = () => undefined, onCreateCuratedReferences = () => undefined, onCreateSuggestedEntries = () => undefined }: WorldbuildingPanelProps) {
  const [pageMode, setPageMode] = useState<WorldbuildingPageMode>('entries');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<WorldbuildingKind | 'all'>('all');
  const [sort, setSort] = useState<WorldbuildingSort>('name-asc');
  const [browserMode, setBrowserMode] = useState<'library' | 'suggestions'>('library');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingType, setAddingType] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);
  const [brews, setBrews] = useState<Brew[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [dismissedNames, setDismissedNames] = useState<Set<string>>(() => new Set());

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
    const matches = entries.filter((entry) => {
      if (kind !== 'all' && entry.kind !== kind) return false;
      if (!terms) return true;
      return [entry.name, worldbuildingKindLabel(entry.kind, types), ...entry.aliases, entry.notes].join(' ').toLocaleLowerCase().includes(terms);
    });
    return [...matches].sort((left, right) => {
      if (sort === 'name-desc') return worldbuildingCollator.compare(right.name, left.name);
      if (sort === 'updated-desc') return right.updatedAt.localeCompare(left.updatedAt) || worldbuildingCollator.compare(left.name, right.name);
      if (sort === 'updated-asc') return left.updatedAt.localeCompare(right.updatedAt) || worldbuildingCollator.compare(left.name, right.name);
      if (sort === 'created-desc') return right.createdAt.localeCompare(left.createdAt) || worldbuildingCollator.compare(left.name, right.name);
      if (sort === 'kind') return worldbuildingCollator.compare(worldbuildingKindLabel(left.kind, types), worldbuildingKindLabel(right.kind, types)) || worldbuildingCollator.compare(left.name, right.name);
      return worldbuildingCollator.compare(left.name, right.name);
    });
  }, [entries, kind, query, sort, types]);

  const typeOptions = useMemo(() => [
    ...worldbuildingKinds.map((item) => ({ id: item, name: worldbuildingKindLabels[item] })),
    ...types
  ], [types]);

  const knownNames = useMemo(() => [
    ...entries.flatMap((entry) => [entry.name, ...entry.aliases]),
    ...[...catalogue.values()].map((entry) => entry.name),
    ...encounters.map((encounter) => encounter.name)
  ], [catalogue, encounters, entries]);

  const allUnresolved = useMemo(
    () => findUnresolvedNames(brews.map((brew) => brew.content), knownNames).filter((item) => !dismissedNames.has(item.name.toLocaleLowerCase())).slice(0, 30),
    [brews, dismissedNames, knownNames]
  );
  const unresolved = allUnresolved;
  const curatedReferences = useMemo(() => remainingTalesOnUnwrittenTomesReferences(entries), [entries]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? filtered[0] ?? entries[0] ?? null;
  const editing = editingId === selected?.id;
  const storage = campaignStoragePresentation(syncState, hasDriveBackup);
  const selectedEntity = selected ? entitiesByWorldbuildingId.get(selected.id) : undefined;
  const selectedCurrentState = selectedEntity ? currentStateByEntityId.get(selectedEntity.id) : undefined;
  const connections = useMemo(
    () => selected ? findWorldbuildingConnections(selected, brews, encounters, entries) : [],
    [brews, encounters, entries, selected]
  );
  const combatNotes = useMemo(() => {
    if (!selectedEntity) return [];
    const encountersById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
    return worldEvents
      .filter((event) => event.entityId === selectedEntity.id && event.type === 'npc.died' && event.source.kind === 'combat')
      .map((event) => ({
        id: event.id,
        encounterId: event.source.kind === 'combat' ? event.source.encounterId : '',
        encounterName: encountersById.get(event.source.kind === 'combat' ? event.source.encounterId : '')?.name ?? 'an unavailable encounter',
        occurredAt: event.occurredAt
      }))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }, [encounters, selectedEntity, worldEvents]);

  const selectEntry = (id: string) => {
    if (editing && id !== selected?.id && !window.confirm('Discard unsaved Worldbuilding changes?')) return;
    setEditingId(null);
    onSelect(id);
  };

  const switchPage = (next: WorldbuildingPageMode) => {
    if (next === pageMode) return;
    if (editing && !window.confirm('Discard unsaved Worldbuilding changes?')) return;
    setEditingId(null);
    setAddingType(false);
    setPageMode(next);
  };

  const submitType = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = onCreateType(typeName);
    if (!id) { setTypeError('That type already exists, or its name is invalid.'); return; }
    setKind(id); setTypeName(''); setTypeError(null); setAddingType(false);
  };

  const createEntry = () => {
    const id = onCreate();
    if (!id) return;
    onSelect(id);
    setEditingId(id);
  };

  return (
    <main className="worldbuilding-page" aria-label="Worldbuilding">
      <header className="worldbuilding-page-header">
        <div>
          <p className="eyebrow">Campaign reference</p>
          <h1>Worldbuilding</h1>
          <p>{pageMode === 'entries' ? 'Capture campaign places, people, history, and factions independently from each brew.' : 'Review the shared calendar of Belentor and the Celestial Handful.'}</p>
        </div>
        <div className="page-header-actions">
          <div className="worldbuilding-view-switcher" role="tablist" aria-label="Worldbuilding views">
            <button aria-selected={pageMode === 'entries'} className={pageMode === 'entries' ? 'is-selected' : ''} onClick={() => switchPage('entries')} role="tab" type="button">Entries</button>
            <button aria-selected={pageMode === 'calendar'} className={pageMode === 'calendar' ? 'is-selected' : ''} onClick={() => switchPage('calendar')} role="tab" type="button">Calendar</button>
          </div>
          <span className={`sync-badge sync-${storage.tone}`} title={storage.title}>{storage.label}</span>
          {pageMode === 'entries' && <><button onClick={onOpenNameGenerator} type="button">Name generator</button><button onClick={() => setAddingType((open) => !open)} type="button">New type</button><button className="primary-button" onClick={createEntry} type="button">New entry</button></>}
        </div>
      </header>

      {pageMode === 'entries' && addingType && <form className="worldbuilding-new-type" onSubmit={submitType}><label>New Worldbuilding type<input autoFocus onChange={(event) => setTypeName(event.target.value)} placeholder="Tavern, deity, ship…" value={typeName} /></label><button type="button" onClick={() => { setAddingType(false); setTypeError(null); }}>Cancel</button><button className="primary-button" type="submit">Add type</button>{typeError && <p role="alert">{typeError}</p>}</form>}

      {pageMode === 'calendar' ? <BelentorCalendar /> : (
        <section className="worldbuilding-workspace">
          <aside className="worldbuilding-browser" aria-label="Worldbuilding entries">
            <input aria-label="Search worldbuilding" className="search-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search towns, people, roads…" value={query} />
            <div className="worldbuilding-browser-tabs" role="tablist" aria-label="Worldbuilding browser"><button aria-selected={browserMode === 'library'} className={browserMode === 'library' ? 'is-selected' : ''} onClick={() => setBrowserMode('library')} role="tab" type="button">Entries <span>{entries.length}</span></button><button aria-selected={browserMode === 'suggestions'} className={browserMode === 'suggestions' ? 'is-selected' : ''} onClick={() => setBrowserMode('suggestions')} role="tab" type="button">Reference inbox <span>{curatedReferences.length + unresolved.length}</span></button></div>
            {browserMode === 'library' ? <><label className="visually-hidden" htmlFor="worldbuilding-kind">Filter type</label><select className="worldbuilding-kind-select" id="worldbuilding-kind" onChange={(event) => setKind(event.target.value as WorldbuildingKind | 'all')} value={kind}><option value="all">All types</option>{typeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><label className="visually-hidden" htmlFor="worldbuilding-sort">Sort entries</label><select className="worldbuilding-kind-select" id="worldbuilding-sort" onChange={(event) => setSort(event.target.value as WorldbuildingSort)} value={sort}><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="updated-desc">Recently updated</option><option value="updated-asc">Oldest updated</option><option value="created-desc">Recently created</option><option value="kind">Type, then name</option></select><p className="worldbuilding-count">{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</p><div className="worldbuilding-list">{filtered.map((entry) => <button className={`worldbuilding-list-item ${selected?.id === entry.id ? 'is-selected' : ''}`} key={entry.id} onClick={() => selectEntry(entry.id)} type="button"><strong>{entry.name}</strong><span>{worldbuildingKindLabel(entry.kind, types)}</span>{entry.aliases.length > 0 && <small>{entry.aliases.join(' · ')}</small>}</button>)}{!filtered.length && <p className="empty-panel">No entries match that search.</p>}</div></> : <ReferenceInbox curatedReferences={curatedReferences} onCreateCuratedReferences={onCreateCuratedReferences} onCreateSuggestedEntries={onCreateSuggestedEntries} onDismissNames={(names) => setDismissedNames((current) => new Set([...current, ...names.map((name) => name.toLocaleLowerCase())]))} query={query} types={types} unresolved={unresolved} />}
          </aside>

          <section className="worldbuilding-details" aria-live="polite">{selected ? (editing ? <WorldbuildingEntryEditor catalogueCategories={catalogueCategories} entry={selected} key={selected.id} onCancel={() => setEditingId(null)} onCreateCatalogueReference={onCreateCatalogueReference} onCreateWorldbuildingReference={onCreateWorldbuildingReference} onSave={(entry) => { onUpdate(entry); setEditingId(null); }} types={types} /> : <WorldbuildingEntryPreview catalogue={catalogue} catalogueCategories={catalogueCategories} combatNotes={combatNotes} connections={connections} currentState={selectedCurrentState} entity={selectedEntity} entry={selected} onCreatePlotBeat={() => onCreatePlotBeat(selected, selectedEntity)} onDelete={onDelete} onEdit={() => setEditingId(selected.id)} onEncounterOpen={onEncounterOpen} onReferenceOpen={onReferenceOpen} onSetNpcStatus={(status) => onSetNpcStatus(selected, status)} onWorldbuildingOpen={onWorldbuildingOpen} types={types} worldbuilding={worldbuilding} />) : <p className="empty-panel">Create an entry, or review an unresolved name from the list.</p>}</section>
        </section>
      )}
    </main>
  );
}
