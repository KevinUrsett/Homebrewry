import { useId, useMemo, useState, type FormEvent } from 'react';
import type { Brew, BrewReferenceReview, WorldbuildingEntry, WorldbuildingKind, WorldbuildingType } from '../types';
import { getOutline } from '../lib/outline';
import { pendingBrewReferences, referenceScanSection, scanNewBrewReferences } from '../lib/brewReferenceScan';
import { worldbuildingKindLabel, worldbuildingKindLabels, worldbuildingKinds } from '../lib/worldbuilding';

export type BrewReferenceScannerProps = {
  brews: readonly Brew[];
  activeBrewId?: string | null;
  knownNames: readonly string[];
  reviews: readonly BrewReferenceReview[];
  types: readonly WorldbuildingType[];
  query: string;
  onReview: (updates: BrewReferenceReview[]) => void;
  onCreate: (entries: readonly Pick<WorldbuildingEntry, 'name' | 'kind'>[]) => void;
};

export function BrewReferenceScanner({ brews, activeBrewId, knownNames, reviews, types, query, onReview, onCreate }: BrewReferenceScannerProps) {
  const [brewId, setBrewId] = useState<string | null>(activeBrewId ?? null);
  const [scope, setScope] = useState<{ brewId: string; sectionId: string } | null>(null);
  const [outlineQuery, setOutlineQuery] = useState('');
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
  const visibleOutline = outline.filter((item) => item.text.toLocaleLowerCase().includes(outlineQuery.trim().toLocaleLowerCase()));
  const pending = pendingBrewReferences(reviews, knownNames);
  const terms = query.trim().toLocaleLowerCase();
  const visible = pending.filter((review) => !terms || [review.name, review.brewTitle, review.context].join(' ').toLocaleLowerCase().includes(terms));
  const selected = visible.filter((review) => selectedIds.has(review.id));

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
      <header><h3>Get references from a brew</h3><p>Check only when you choose. Review new names before creating entries.</p></header>
      <form className="brew-reference-scan-controls" onSubmit={scan}>
        <label htmlFor={`${id}-brew`}>Brew</label>
        <select id={`${id}-brew`} onChange={(event) => { setBrewId(event.target.value); setScope(null); setOutlineQuery(''); setError(null); }} value={brew?.id ?? ''}>
          {!brews.length && <option value="">No brew available</option>}
          {brews.map((item) => <option key={item.id} value={item.id}>{item.title || 'Untitled brew'}{item.id === activeBrewId ? ' · open brew' : ''}</option>)}
        </select>
        <details className="brew-reference-scope">
          <summary>Where to check: <strong>{sectionTitle}</strong></summary>
          <label className="visually-hidden" htmlFor={`${id}-outline`}>Search outline</label>
          <input id={`${id}-outline`} onChange={(event) => setOutlineQuery(event.target.value)} placeholder="Search the outline…" type="search" value={outlineQuery} />
          <div className="brew-reference-outline" role="group" aria-label="Outline section to check">
            <label><input checked={!sectionId} name={`${id}-scope`} onChange={() => { setScope(null); setError(null); }} type="radio" /><span>Whole brew</span></label>
            {visibleOutline.map((item) => <label key={item.id} style={{ paddingInlineStart: `${8 + (item.level - 1) * 12}px` }}><input checked={sectionId === item.id} name={`${id}-scope`} onChange={() => { if (brew) setScope({ brewId: brew.id, sectionId: item.id }); setError(null); }} type="radio" /><span>{item.text}</span></label>)}
            {!visibleOutline.length && <p>{outline.length ? 'No headings match.' : 'Add headings to the brew to check a specific section.'}</p>}
          </div>
          <p>A section includes its subsections, stopping at the next heading of the same or higher level.</p>
        </details>
        <button className="primary-button" disabled={!brew} type="submit">Get new references</button>
      </form>
      <p className="brew-reference-scan-status" role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
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
