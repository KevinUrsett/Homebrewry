import { useEffect, useMemo, useRef, useState } from 'react';
import { catalogueDataset } from '../catalogue/catalogueData';
import { createCustomMonster } from '../catalogue/customEntries';
import { entrySummary } from '../catalogue/presentation';
import {
  catalogueCategories,
  catalogueCategoryLabels,
  type CatalogueCategory,
  type CatalogueEntry,
  type CustomCatalogueEntry
} from '../catalogue/types';
import { CustomMonsterEditor } from './CustomMonsterEditor';
import { CatalogueEntryDetails } from './CatalogueEntryDetails';

type CataloguePanelProps = {
  entries: CatalogueEntry[];
  loading: boolean;
  error: string | null;
  onInsertReference: (entry: CatalogueEntry) => void;
  onOpenPrivateMonsterImport: () => void;
  onSaveCustomMonster: (entry: CustomCatalogueEntry) => Promise<void>;
  onDeleteCustomMonster: (entry: CustomCatalogueEntry) => Promise<void>;
  privateMonsterCount: number;
  customEntryCount: number;
  selectedEntry?: CatalogueEntry | null;
};

const MAX_VISIBLE_RESULTS = 250;

type MonsterEditorState = {
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
};

export function CataloguePanel({
  entries,
  loading,
  error,
  onInsertReference,
  onOpenPrivateMonsterImport,
  onSaveCustomMonster,
  onDeleteCustomMonster,
  privateMonsterCount,
  customEntryCount,
  selectedEntry
}: CataloguePanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CatalogueCategory | 'all'>(() => selectedEntry?.category ?? 'monster');
  const [selectedId, setSelectedId] = useState<string | null>(() => selectedEntry?.id ?? null);
  const [monsterEditor, setMonsterEditor] = useState<MonsterEditorState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (!terms) return true;
      return [entry.name, entry.category, ...entrySummary(entry)]
        .join(' ')
        .toLowerCase()
        .includes(terms);
    });
  }, [category, entries, query]);

  const visible = filtered.slice(0, MAX_VISIBLE_RESULTS);
  const selected = filtered.find((entry) => entry.id === selectedId)
    ?? visible[0]
    ?? null;

  useEffect(() => {
    resultsRef.current?.querySelector<HTMLButtonElement>('.catalogue-result.is-selected')?.scrollIntoView?.({ block: 'nearest' });
  }, [selected?.id]);

  const beginNewMonster = () => {
    setActionError(null);
    setCategory('monster');
    setQuery('');
    setMonsterEditor({ entry: createCustomMonster(), mode: 'create' });
  };

  const beginMonsterDuplicate = (entry: CatalogueEntry) => {
    setActionError(null);
    setMonsterEditor({ entry: createCustomMonster(entry), mode: 'create' });
  };

  const beginMonsterEdit = (entry: CustomCatalogueEntry) => {
    setActionError(null);
    setMonsterEditor({ entry, mode: 'edit' });
  };

  const deleteCustomMonster = (entry: CustomCatalogueEntry) => {
    if (!window.confirm(`Delete custom monster “${entry.name}”? This cannot be undone.`)) return;
    void onDeleteCustomMonster(entry)
      .then(() => {
        setMonsterEditor(null);
        setSelectedId(null);
      })
      .catch((reason) => setActionError(reason instanceof Error ? reason.message : 'Could not delete the custom monster.'));
  };

  return (
    <main className="catalogue-page" aria-label="Rules catalogue">
      <header className="catalogue-page-header">
        <div>
          <p className="eyebrow">Offline reference</p>
          <h1>Catalogue</h1>
          <p>
            {loading
              ? 'Loading the SRD reference data…'
              : `${(entries.length - privateMonsterCount - customEntryCount).toLocaleString()} ${catalogueDataset.version} entries available offline.${customEntryCount ? ` ${customEntryCount.toLocaleString()} custom entr${customEntryCount === 1 ? 'y' : 'ies'}.` : ''}${privateMonsterCount ? ` ${privateMonsterCount.toLocaleString()} private monster${privateMonsterCount === 1 ? '' : 's'} in your private catalogue.` : ''}`}
          </p>
        </div>
        <div className="catalogue-header-actions">
          <button onClick={beginNewMonster} type="button">New custom monster</button>
          <button onClick={onOpenPrivateMonsterImport} type="button">Import monster archive</button>
          <a href="https://www.dndbeyond.com/srd/" rel="noreferrer" target="_blank">SRD attribution</a>
        </div>
      </header>

      {error && <p className="catalogue-error">The catalogue could not load: {error}</p>}
      <section className="catalogue-workspace">
        <aside className="catalogue-browser">
          <label className="visually-hidden" htmlFor="catalogue-search">Search catalogue</label>
          <input
            className="search-input"
            id="catalogue-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search monsters, spells, items…"
            value={query}
          />
          <label className="visually-hidden" htmlFor="catalogue-category">Filter category</label>
          <div className="catalogue-category-control">
            <select className="catalogue-category-select" id="catalogue-category" onChange={(event) => setCategory(event.target.value as CatalogueCategory | 'all')} value={category}>
              <option value="all">All categories</option>
              {catalogueCategories.map((item) => <option key={item} value={item}>{catalogueCategoryLabels[item]}</option>)}
            </select>
            <span aria-hidden="true" className="catalogue-category-chevron">⌄</span>
          </div>
          <p className="catalogue-result-count">{filtered.length.toLocaleString()} matches</p>
          <div className="catalogue-results" ref={resultsRef}>
            {visible.map((entry) => (
              <button
                className={`catalogue-result ${selected?.id === entry.id ? 'is-selected' : ''}`}
                key={`${entry.category}-${entry.id}`}
                onClick={() => setSelectedId(entry.id)}
                type="button"
              >
                <strong>{entry.name}</strong>
                <span>{catalogueCategoryLabels[entry.category]}</span>
                {entrySummary(entry).slice(0, 1).map((summary) => <small key={summary}>{summary}</small>)}
              </button>
            ))}
            {!loading && !visible.length && <p className="empty-panel">No matching entries.</p>}
          </div>
          {filtered.length > MAX_VISIBLE_RESULTS && <p className="catalogue-limit">Showing the first {MAX_VISIBLE_RESULTS}; refine your search for the rest.</p>}
        </aside>

        <section className="catalogue-details" aria-live="polite">
          {monsterEditor ? (
            <CustomMonsterEditor
              entry={monsterEditor.entry}
              key={`${monsterEditor.entry.id}-${monsterEditor.entry.version}`}
              mode={monsterEditor.mode}
              onCancel={() => setMonsterEditor(null)}
              onSave={onSaveCustomMonster}
            />
          ) : selected ? (
            <>
              <CatalogueEntryDetails
                actions={
                  <div className="catalogue-entry-action-list">
                    <button className="primary-button" onClick={() => onInsertReference(selected)} type="button">Insert reference into brew</button>
                    {selected.category === 'monster' && <button onClick={() => beginMonsterDuplicate(selected)} type="button">Duplicate as custom monster</button>}
                    {selected.category === 'monster' && selected.source === 'Custom' && (
                      <>
                        <button onClick={() => beginMonsterEdit(selected as CustomCatalogueEntry)} type="button">Edit custom monster</button>
                        <button className="quiet-danger" onClick={() => deleteCustomMonster(selected as CustomCatalogueEntry)} type="button">Delete custom monster</button>
                      </>
                    )}
                  </div>
                }
                entry={selected}
              />
              {actionError && <p className="catalogue-error catalogue-inline-error" role="alert">{actionError}</p>}
            </>
          ) : (
            <p className="empty-panel">Choose an entry to inspect its details.</p>
          )}
        </section>
      </section>
    </main>
  );
}
