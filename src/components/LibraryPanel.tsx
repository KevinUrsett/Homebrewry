import type { Brew } from '../types';

type LibraryPanelProps = {
  brews: Brew[];
  activeId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const syncLabel: Record<NonNullable<Brew['syncState']>, string> = {
  local: 'Local only',
  synced: 'Synced',
  pending: 'Needs sync',
  conflict: 'Conflict',
  error: 'Sync error'
};

export function LibraryPanel({
  brews,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onNew,
  onDuplicate,
  onDelete
}: LibraryPanelProps) {
  const filtered = brews.filter((brew) => brew.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <aside className="library-panel side-panel" aria-label="Brew library">
      <div className="panel-heading panel-heading-actions">
        <span>Brews</span>
        <button className="icon-button" onClick={onNew} type="button" title="Create brew">+</button>
      </div>
      <label className="visually-hidden" htmlFor="brew-search">Search brews</label>
      <input
        className="search-input"
        id="brew-search"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search brews"
        value={query}
      />
      <div className="brew-list">
        {filtered.map((brew) => (
          <button
            className={`brew-list-item ${brew.id === activeId ? 'is-active' : ''}`}
            key={brew.id}
            onClick={() => onSelect(brew.id)}
            type="button"
          >
            <strong>{brew.title || 'Untitled Brew'}</strong>
            <span className="brew-meta">
              <span>{formatUpdatedAt(brew.updatedAt)}</span>
              <span className={`sync-badge sync-${brew.syncState ?? 'local'}`}>{syncLabel[brew.syncState ?? 'local']}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="library-actions">
        <button onClick={onDuplicate} type="button">Duplicate</button>
        <button className="danger-button" onClick={onDelete} type="button">Delete</button>
      </div>
    </aside>
  );
}
