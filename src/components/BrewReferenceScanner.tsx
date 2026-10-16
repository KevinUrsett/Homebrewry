import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Brew, BrewReferenceReview, WorldbuildingEntry, WorldbuildingKind, WorldbuildingType } from '../types';
import { getOutline } from '../lib/outline';
import { pendingBrewReferences, referenceScanSection, scanNewBrewReferences } from '../lib/brewReferenceScan';
import { worldbuildingKindLabel, worldbuildingKindLabels, worldbuildingKinds } from '../lib/worldbuilding';
import { OutlinePanel } from './OutlinePanel';

export type BrewReferenceScannerProps = {
  brews: readonly Brew[];
  activeBrewId?: string | null;
  knownNames: readonly string[];
  reviews: readonly BrewReferenceReview[];
  types: readonly WorldbuildingType[];
  query: string;
  onQueryChange?: (query: string) => void;
  onReview: (updates: BrewReferenceReview[]) => void;
  onCreate: (entries: readonly Pick<WorldbuildingEntry, 'name' | 'kind'>[]) => void;
};

export function BrewReferenceScanner({ brews, activeBrewId, knownNames, reviews, types, query, onQueryChange, onReview, onCreate }: BrewReferenceScannerProps) {
  const [brewId, setBrewId] = useState<string | null>(activeBrewId ?? null);
  const [scope, setScope] = useState<{ brewId: string; sectionId: string } | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const outlineAnchor = useRef<HTMLDivElement>(null);
  const outlineTrigger = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState('Choose where to check, then get new references. Nothing is scanned automatically.');
  const [error, setError] = useState<string | null>(null);
  const [latestIds, setLatestIds] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [kinds, setKinds] = useState<Record<string, WorldbuildingKind>>({});
  const id = useId();
  const brew = brews.find((item) => item.id === brewId) ?? brews.find((item) => item.id === activeBrewId) ?? brews[0];
  const sectionId = scope && scope.brewId === brew?.id ? scope.sectionId : null;
  const outline = useMemo(() => getOutline(brew?.content ?? ''), [brew?.content]);
  const sectionTitle = sectionId ? outline.find((item) => item.id === sectionId)?.text ?? 'Section unavailable' : 'Whole brew';
  const pending = pendingBrewReferences(reviews, knownNames);
  const terms = query.trim().toLocaleLowerCase();
  const visible = pending.filter((review) => !terms || [review.name, review.brewTitle, review.context].join(' ').toLocaleLowerCase().includes(terms));
  const selected = visible.filter((review) => selectedIds.has(review.id));

  useEffect(() => {
    if (!outlineOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !outlineAnchor.current?.contains(event.target)) setOutlineOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [outlineOpen]);

  const chooseSection = (nextSectionId: string | null) => {
    setScope(brew && nextSectionId ? { brewId: brew.id, sectionId: nextSectionId } : null);
    setError(null);
    setOutlineOpen(false);
    outlineTrigger.current?.focus();
  };

  const scan = (event: FormEvent) => {
    event.preventDefault();
    if (!brew) return;
    setError(null);
    try {
      // Validate the selected scope against the current document; never fall back
      // to scanning the whole brew after a heading has been removed or renamed.
      referenceScanSection(brew.content, sectionId);
      const found = scanNewBrewReferences(brew, sectionId, knownNames, reviews);
      if (found.length) onReview(found);
      setLatestIds(new Set(found.map((review) => review.id)));
      setStatus(`${found.length ? `Found ${found.length}` : 'No'} new reference${found.length === 1 ? '' : 's'} in ${brew.title} · ${sectionTitle}. Existing and previously found names were skipped.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The reference check failed. Try again.');
    }
  };
  const create = (items: readonly BrewReferenceReview[]) => {
    if (!items.length) return;
    onCreate(items.map((item) => ({ name: item.name, kind: kinds[item.id] ?? 'npc' })));
    setSelectedIds((current) => new Set([...current].filter((key) => !items.some((item) => item.id === key))));
  };
  const dismiss = (review: BrewReferenceReview) => {
    onReview([{ ...review, status: 'dismissed', updatedAt: new Date().toISOString() }]);
    setSelectedIds((current) => new Set([...current].filter((key) => key !== review.id)));
  };

  return (
    <section aria-label="Brew reference discovery" className="brew-reference-scanner">
      <header><h2>Get references</h2><p>Choose a brew and a section, then check for new names.</p></header>
      <form className="brew-reference-scan-controls" onSubmit={scan}>
        <label htmlFor={`${id}-brew`}>Brew</label>
        <select id={`${id}-brew`} onChange={(event) => { setBrewId(event.target.value); setScope(null); setOutlineOpen(false); setError(null); }} value={brew?.id ?? ''}>
          {!brews.length && <option value="">No brew available</option>}
          {brews.map((item) => <option key={item.id} value={item.id}>{item.title || 'Untitled brew'}{item.id === activeBrewId ? ' · open brew' : ''}</option>)}
        </select>
        <div className="brew-reference-scan-actions">
          <div className="brew-reference-scope" ref={outlineAnchor} onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOutlineOpen(false); outlineTrigger.current?.focus(); }
          }}>
            <button aria-controls={`${id}-outline-panel`} aria-expanded={outlineOpen} className="brew-reference-outline-toggle" disabled={!brew} onClick={() => setOutlineOpen((open) => !open)} ref={outlineTrigger} type="button">
              <span>Outline</span><strong>{sectionTitle}</strong><span aria-hidden="true">▾</span>
            </button>
            {outlineOpen && <div aria-label="Choose scan location from outline" className="brew-reference-outline-dropdown" id={`${id}-outline-panel`} role="region">
              <button aria-pressed={!sectionId} className="brew-reference-whole-brew" onClick={() => chooseSection(null)} type="button">Whole brew</button>
              <OutlinePanel outline={outline} onNavigate={(item) => chooseSection(item.id)} />
              <p>Choose a heading to check that section and its subsections.</p>
            </div>}
          </div>
          <button className="primary-button" disabled={!brew} type="submit">Get new references</button>
        </div>
        <p className="brew-reference-selected-scope">Checking: <strong>{sectionTitle}</strong>{sectionId ? ' and its subsections' : ''}</p>
      </form>
      <p className="brew-reference-scan-status" role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
      {onQueryChange && pending.length > 0 && <label className="brew-reference-result-search">Filter results<input aria-label="Filter discovered references" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search names or source text…" type="search" value={query} /></label>}
      <div className="brew-reference-pending-heading"><h4>To create <span>{pending.length}</span></h4><button disabled={!visible.length} onClick={() => setSelectedIds((current) => {
        const next = new Set(current);
        visible.forEach((item) => selected.length === visible.length ? next.delete(item.id) : next.add(item.id));
        return next;
      })} type="button">{visible.length && selected.length === visible.length ? 'Clear selection' : 'Select all'}</button><button disabled={!selected.length} onClick={() => create(selected)} type="button">Create selected ({selected.length})</button></div>
      <div className="brew-reference-results">
        {visible.map((review) => {
          const kind = kinds[review.id] ?? 'npc';
          const label = worldbuildingKindLabel(kind, types);
          return <article aria-label={`Reference ${review.name}`} key={review.id}>
            <div className="brew-reference-result-title"><label><input aria-label={`Select ${review.name}`} checked={selectedIds.has(review.id)} onChange={() => setSelectedIds((current) => { const next = new Set(current); if (next.has(review.id)) next.delete(review.id); else next.add(review.id); return next; })} type="checkbox" /><strong>{review.name}</strong></label>{latestIds.has(review.id) && <span>New</span>}</div>
            <small>{review.brewTitle} · {review.sectionTitle} · {review.count} mention{review.count === 1 ? '' : 's'}</small>
            {review.context && <p className="brew-reference-context">{review.context}</p>}
            <div className="brew-reference-result-actions">
              <label><span className="visually-hidden">Type for {review.name}</span><select aria-label={`Type for ${review.name}`} onChange={(event) => setKinds((current) => ({ ...current, [review.id]: event.target.value }))} value={kind}>{worldbuildingKinds.map((type) => <option key={type} value={type}>{worldbuildingKindLabels[type]}</option>)}{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
              <button aria-label={`Create ${review.name} as ${label}`} onClick={() => create([review])} type="button">Create {label}</button>
              <button aria-label={`Dismiss ${review.name}`} onClick={() => dismiss(review)} type="button">Dismiss</button>
            </div>
          </article>;
        })}
        {!visible.length && <p className="brew-reference-empty">{pending.length ? 'No pending names match your search.' : 'No references waiting to be created. Use Get new references to check your brew.'}</p>}
      </div>
    </section>
  );
}
