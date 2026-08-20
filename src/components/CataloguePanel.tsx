import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { catalogueDataset } from '../catalogue/catalogueData';
import { createCustomCatalogueEntry, createCustomMonster } from '../catalogue/customEntries';
import { dataString, entrySummary, monsterCreatureType, monsterSourceLabel } from '../catalogue/presentation';
import {
  catalogueCategories,
  catalogueCategoryLabel,
  catalogueEntryKey,
  type CatalogueCategory,
  type CatalogueEntry,
  type CustomCatalogueCategory,
  type CustomCatalogueEntry
} from '../catalogue/types';
import type { WorldbuildingEntry, WorldbuildingKind, WorldbuildingType } from '../types';
import { CustomCatalogueEntryEditor } from './CustomCatalogueEntryEditor';
import { CustomMonsterEditor } from './CustomMonsterEditor';
import { CatalogueEntryDetails } from './CatalogueEntryDetails';

type CataloguePanelProps = {
  entries: CatalogueEntry[];
  loading: boolean;
  error: string | null;
  onInsertReference: (entry: CatalogueEntry) => void;
  onOpenPrivateMonsterImport: () => void;
  onOpenEntries?: () => void;
  onSaveCustomMonster: (entry: CustomCatalogueEntry) => Promise<void>;
  onDeleteCustomMonster: (entry: CustomCatalogueEntry) => Promise<void>;
  onSaveCustomEntry: (entry: CustomCatalogueEntry) => Promise<void>;
  onDeleteCustomEntry: (entry: CustomCatalogueEntry) => Promise<void>;
  onCreateCustomCategory: (name: string) => CustomCatalogueCategory | null;
  customCategories: CustomCatalogueCategory[];
  privateMonsterCount: number;
  customEntryCount: number;
  selectedEntry?: CatalogueEntry | null;
  worldbuilding: ReadonlyMap<string, WorldbuildingEntry>;
  worldbuildingTypes: readonly WorldbuildingType[];
  onCreateWorldbuildingReference: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onCreateCatalogueReference: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
  onReferenceOpen: (entry: CatalogueEntry) => void;
  onWorldbuildingOpen: (entry: WorldbuildingEntry) => void;
};

const MAX_VISIBLE_RESULTS = 250;

type MonsterEditorState = {
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
};

type CatalogueEntryEditorState = {
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
};

type MonsterSort = 'name' | 'cr-ascending' | 'cr-descending' | 'source' | 'type';

function monsterDataList(entry: CatalogueEntry, key: string): string[] {
  const value = entry.data[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string | number => typeof item === 'string' || typeof item === 'number').map(String).map((item) => item.trim()).filter(Boolean);
  }
  const single = dataString(entry, key)?.trim();
  return single ? [single] : [];
}

function challengeRatingValue(challengeRating: string): number {
  const fraction = challengeRating.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const parsed = Number.parseFloat(challengeRating);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CataloguePanel({
  entries,
  loading,
  error,
  onInsertReference,
  onOpenPrivateMonsterImport,
  onOpenEntries = () => undefined,
  onSaveCustomMonster,
  onDeleteCustomMonster,
  onSaveCustomEntry,
  onDeleteCustomEntry,
  onCreateCustomCategory,
  customCategories,
  privateMonsterCount,
  customEntryCount,
  selectedEntry,
  worldbuilding,
  worldbuildingTypes,
  onCreateWorldbuildingReference,
  onCreateCatalogueReference,
  onReferenceOpen,
  onWorldbuildingOpen
}: CataloguePanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CatalogueCategory | 'all'>(() => selectedEntry?.category ?? 'monster');
  const [monsterSource, setMonsterSource] = useState('all');
  const [monsterType, setMonsterType] = useState('all');
  const [monsterCr, setMonsterCr] = useState('all');
  const [monsterSize, setMonsterSize] = useState('all');
  const [monsterEnvironment, setMonsterEnvironment] = useState('all');
  const [monsterSort, setMonsterSort] = useState<MonsterSort>('name');
  const [selectedId, setSelectedId] = useState<string | null>(() => selectedEntry?.id ?? null);
  const [monsterEditor, setMonsterEditor] = useState<MonsterEditorState | null>(null);
  const [entryEditor, setEntryEditor] = useState<CatalogueEntryEditorState | null>(null);
  const [categoryCreatorOpen, setCategoryCreatorOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const monsters = useMemo(() => entries.filter((entry) => entry.category === 'monster'), [entries]);
  const sourceOptions = useMemo(() => Array.from(new Set(monsters.map((entry) => entry.source).filter(Boolean)))
    .sort((left, right) => monsterSourceLabel({ ...monsters[0], source: left }).localeCompare(monsterSourceLabel({ ...monsters[0], source: right }))), [monsters]);
  const typeOptions = useMemo(() => Array.from(new Set(monsters.map(monsterCreatureType).filter(Boolean))).sort(), [monsters]);
  const crOptions = useMemo(() => Array.from(new Set(monsters.map((entry) => dataString(entry, 'cr')?.trim()).filter((value): value is string => Boolean(value))))
    .sort((left, right) => challengeRatingValue(left) - challengeRatingValue(right) || left.localeCompare(right)), [monsters]);
  const sizeOptions = useMemo(() => Array.from(new Set(monsters.map((entry) => dataString(entry, 'size')?.trim()).filter((value): value is string => Boolean(value)))).sort(), [monsters]);
  const environmentOptions = useMemo(() => Array.from(new Set(monsters.flatMap((entry) => monsterDataList(entry, 'environments')))).sort(), [monsters]);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase();
    const matchingEntries = entries.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (category === 'monster') {
        if (monsterSource !== 'all' && entry.source !== monsterSource) return false;
        if (monsterType !== 'all' && monsterCreatureType(entry) !== monsterType) return false;
        if (monsterCr !== 'all' && dataString(entry, 'cr')?.trim() !== monsterCr) return false;
        if (monsterSize !== 'all' && dataString(entry, 'size')?.trim() !== monsterSize) return false;
        if (monsterEnvironment !== 'all' && !monsterDataList(entry, 'environments').includes(monsterEnvironment)) return false;
      }
      if (!terms) return true;
      return [entry.name, entry.category, entry.source, ...entrySummary(entry)]
        .join(' ')
        .toLowerCase()
        .includes(terms);
    });
    if (category !== 'monster') return matchingEntries;
    return matchingEntries.sort((left, right) => {
      if (monsterSort === 'cr-ascending' || monsterSort === 'cr-descending') {
        const comparison = challengeRatingValue(dataString(left, 'cr') ?? '') - challengeRatingValue(dataString(right, 'cr') ?? '');
        if (comparison) return monsterSort === 'cr-ascending' ? comparison : -comparison;
      }
      if (monsterSort === 'source') {
        const comparison = monsterSourceLabel(left).localeCompare(monsterSourceLabel(right));
        if (comparison) return comparison;
      }
      if (monsterSort === 'type') {
        const comparison = monsterCreatureType(left).localeCompare(monsterCreatureType(right));
        if (comparison) return comparison;
      }
      return left.name.localeCompare(right.name);
    });
  }, [category, entries, monsterCr, monsterEnvironment, monsterSize, monsterSort, monsterSource, monsterType, query]);
  const monsterFiltersActive = [monsterSource, monsterType, monsterCr, monsterSize, monsterEnvironment].some((value) => value !== 'all');
  const resetMonsterFilters = () => {
    setMonsterSource('all');
    setMonsterType('all');
    setMonsterCr('all');
    setMonsterSize('all');
    setMonsterEnvironment('all');
  };

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

  const beginNewEntry = () => {
    const selectedCategory = category === 'all' ? (customCategories[0]?.id ?? 'rule') : category;
    if (selectedCategory === 'monster') {
      beginNewMonster();
      return;
    }
    setActionError(null);
    setEntryEditor({ entry: createCustomCatalogueEntry('Untitled entry', selectedCategory), mode: 'create' });
  };

  const beginMonsterDuplicate = (entry: CatalogueEntry) => {
    setActionError(null);
    setMonsterEditor({ entry: createCustomMonster(entry), mode: 'create' });
  };

  const beginMonsterEdit = (entry: CustomCatalogueEntry) => {
    setActionError(null);
    setMonsterEditor({ entry, mode: 'edit' });
  };

  const beginEntryEdit = (entry: CustomCatalogueEntry) => {
    setActionError(null);
    setEntryEditor({ entry, mode: 'edit' });
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

  const deleteCustomEntry = (entry: CustomCatalogueEntry) => {
    if (!window.confirm(`Delete custom entry “${entry.name}”? This cannot be undone.`)) return;
    void onDeleteCustomEntry(entry)
      .then(() => {
        setEntryEditor(null);
        setSelectedId(null);
      })
      .catch((reason) => setActionError(reason instanceof Error ? reason.message : 'Could not delete the custom entry.'));
  };

  const createCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCategory = onCreateCustomCategory(categoryName);
    if (!nextCategory) {
      setActionError('Enter a new category name that is not already in use.');
      return;
    }
    setCategory(nextCategory.id);
    setCategoryName('');
    setCategoryCreatorOpen(false);
    setActionError(null);
  };

  return (
    <main className="catalogue-page" aria-label="Compendium rules and monsters">
      <header className="catalogue-page-header">
        <div>
          <p className="eyebrow">Compendium</p>
          <h1>Rules &amp; monsters</h1>
          <p>
            {loading
              ? 'Loading the SRD reference data…'
              : `${(entries.length - privateMonsterCount - customEntryCount).toLocaleString()} ${catalogueDataset.version} entries available offline.${customEntryCount ? ` ${customEntryCount.toLocaleString()} custom entr${customEntryCount === 1 ? 'y' : 'ies'}.` : ''}${privateMonsterCount ? ` ${privateMonsterCount.toLocaleString()} private monster${privateMonsterCount === 1 ? '' : 's'} in your private catalogue.` : ''}`}
          </p>
        </div>
        <div className="catalogue-header-actions">
          <button className="compendium-switch-button" onClick={onOpenEntries} type="button">Entries</button>
          <button onClick={beginNewEntry} type="button">New entry</button>
          <button onClick={beginNewMonster} type="button">New custom monster</button>
          <button onClick={() => setCategoryCreatorOpen((open) => !open)} type="button">New category</button>
          <button onClick={onOpenPrivateMonsterImport} type="button">Import monster archive</button>
          <a href="https://www.dndbeyond.com/srd/" rel="noreferrer" target="_blank">SRD attribution</a>
        </div>
      </header>

      {error && <p className="catalogue-error">The catalogue could not load: {error}</p>}
      {categoryCreatorOpen && (
        <form className="catalogue-new-category" onSubmit={createCategory}>
          <label>New catalogue category<input autoFocus onChange={(event) => setCategoryName(event.target.value)} placeholder="Deities, locations, factions…" value={categoryName} /></label>
          <button onClick={() => setCategoryCreatorOpen(false)} type="button">Cancel</button>
          <button className="primary-button" type="submit">Add category</button>
        </form>
      )}
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
              {[...catalogueCategories, ...customCategories.map((item) => item.id)].map((item) => <option key={item} value={item}>{catalogueCategoryLabel(item, customCategories)}</option>)}
            </select>
            <span aria-hidden="true" className="catalogue-category-chevron">⌄</span>
          </div>
          {category === 'monster' && (
            <fieldset className="catalogue-monster-filters">
              <legend>Monster filters</legend>
              <label>Source
                <select aria-label="Filter monsters by source" onChange={(event) => setMonsterSource(event.target.value)} value={monsterSource}>
                  <option value="all">All sources</option>
                  {sourceOptions.map((source) => <option key={source} value={source}>{monsterSourceLabel({ ...monsters[0], source })}</option>)}
                </select>
              </label>
              <label>Type
                <select aria-label="Filter monsters by type" onChange={(event) => setMonsterType(event.target.value)} value={monsterType}>
                  <option value="all">All types</option>
                  {typeOptions.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                </select>
              </label>
              <label>CR
                <select aria-label="Filter monsters by challenge rating" onChange={(event) => setMonsterCr(event.target.value)} value={monsterCr}>
                  <option value="all">All CRs</option>
                  {crOptions.map((cr) => <option key={cr} value={cr}>CR {cr}</option>)}
                </select>
              </label>
              <label>Size
                <select aria-label="Filter monsters by size" onChange={(event) => setMonsterSize(event.target.value)} value={monsterSize}>
                  <option value="all">All sizes</option>
                  {sizeOptions.map((size) => <option key={size} value={size}>{titleCase(size)}</option>)}
                </select>
              </label>
              <label>Environment
                <select aria-label="Filter monsters by environment" onChange={(event) => setMonsterEnvironment(event.target.value)} value={monsterEnvironment}>
                  <option value="all">All environments</option>
                  {environmentOptions.map((environment) => <option key={environment} value={environment}>{titleCase(environment)}</option>)}
                </select>
              </label>
              <label>Sort
                <select aria-label="Sort monsters" onChange={(event) => setMonsterSort(event.target.value as MonsterSort)} value={monsterSort}>
                  <option value="name">Name A–Z</option>
                  <option value="cr-ascending">CR low → high</option>
                  <option value="cr-descending">CR high → low</option>
                  <option value="type">Creature type</option>
                  <option value="source">Source</option>
                </select>
              </label>
              {monsterFiltersActive && <button className="catalogue-clear-monster-filters" onClick={resetMonsterFilters} type="button">Clear filters</button>}
            </fieldset>
          )}
          <p className="catalogue-result-count">{filtered.length.toLocaleString()} matches{category === 'monster' && monsterSource === 'all' ? ' · all sources' : ''}</p>
          <div className="catalogue-results" ref={resultsRef}>
            {visible.map((entry) => (
              <button
                className={`catalogue-result ${selected?.id === entry.id ? 'is-selected' : ''}`}
                key={`${entry.category}-${entry.id}`}
                onClick={() => setSelectedId(entry.id)}
                type="button"
              >
                <strong>{entry.name}</strong>
                <span>{catalogueCategoryLabel(entry.category, customCategories)}</span>
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
              customCategories={customCategories}
              entry={monsterEditor.entry}
              key={`${monsterEditor.entry.id}-${monsterEditor.entry.version}`}
              mode={monsterEditor.mode}
              onCancel={() => setMonsterEditor(null)}
              onCreateCatalogueReference={onCreateCatalogueReference}
              onCreateWorldbuildingReference={onCreateWorldbuildingReference}
              onSave={onSaveCustomMonster}
              worldbuildingTypes={worldbuildingTypes}
            />
          ) : entryEditor ? (
            <CustomCatalogueEntryEditor
              categoryLabel={catalogueCategoryLabel(entryEditor.entry.category, customCategories)}
              customCategories={customCategories}
              entry={entryEditor.entry}
              key={`${entryEditor.entry.id}-${entryEditor.entry.version}`}
              mode={entryEditor.mode}
              onCancel={() => setEntryEditor(null)}
              onCreateCatalogueReference={onCreateCatalogueReference}
              onCreateWorldbuildingReference={onCreateWorldbuildingReference}
              onSave={onSaveCustomEntry}
              worldbuildingTypes={worldbuildingTypes}
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
                    {selected.category !== 'monster' && selected.source === 'Custom' && (
                      <>
                        <button onClick={() => beginEntryEdit(selected as CustomCatalogueEntry)} type="button">Edit custom entry</button>
                        <button className="quiet-danger" onClick={() => deleteCustomEntry(selected as CustomCatalogueEntry)} type="button">Delete custom entry</button>
                      </>
                    )}
                  </div>
                }
                categoryLabel={catalogueCategoryLabel(selected.category, customCategories)}
                entry={selected}
                references={{
                  catalogue: new Map(entries.map((entry) => [catalogueEntryKey(entry), entry])),
                  catalogueCategories: customCategories,
                  onReferenceOpen,
                  onWorldbuildingOpen,
                  worldbuilding,
                  worldbuildingTypes
                }}
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
