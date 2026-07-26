import { useEffect, useMemo, useRef, useState } from 'react';
import { catalogueDataset } from '../catalogue/catalogueData';
import { entrySummary } from '../catalogue/presentation';
import {
  catalogueCategories,
  catalogueCategoryLabels,
  type CatalogueCategory,
  type CatalogueEntry
} from '../catalogue/types';
import { CatalogueEntryDetails } from './CatalogueEntryDetails';

type CataloguePanelProps = {
  entries: CatalogueEntry[];
  loading: boolean;
  error: string | null;
  onInsertReference: (entry: CatalogueEntry) => void;
  onOpenPrivateMonsterImport: () => void;
  privateMonsterCount: number;
  customEntryCount: number;
  selectedEntry?: CatalogueEntry | null;
};

const MAX_VISIBLE_RESULTS = 250;

export function CataloguePanel({
  entries,
  loading,
  error,
  onInsertReference,
  onOpenPrivateMonsterImport,
  privateMonsterCount,
  customEntryCount,
  selectedEntry
}: CataloguePanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CatalogueCategory | 'all'>(() => selectedEntry?.category ?? 'monster');
  const [selectedId, setSelectedId] = useState<string | null>(() => selectedEntry?.id ?? null);
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

  return (
    <main className="catalogue-page" aria-label="Rules catalogue">
      <header className="catalogue-page-header">
        <div>
          <p className="eyebrow">Offline reference</p>
          <h1>Catalogue</h1>
          <p>
            {loading
              ? 'Loading the SRD reference data…'
              : `${(entries.length - privateMonsterCount - customEntryCount).toLocaleString()} ${catalogueDataset.version} entries available offline.${customEntryCount ? ` ${customEntryCount.toLocaleString()} custom entr${customEntryCount === 1 ? 'y' : 'ies'}.` : ''}${privateMonsterCount ? ` ${privateMonsterCount.toLocaleString()} private monster${privateMonsterCount === 1 ? '' : 's'} on this device.` : ''}`}
          </p>
        </div>
        <div className="catalogue-header-actions">
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
          {selected ? (
            <>
              <CatalogueEntryDetails
                actions={<button className="primary-button" onClick={() => onInsertReference(selected)} type="button">Insert reference into brew</button>}
                entry={selected}
              />
            </>
          ) : (
            <p className="empty-panel">Choose an entry to inspect its details.</p>
          )}
        </section>
      </section>
    </main>
  );
}
