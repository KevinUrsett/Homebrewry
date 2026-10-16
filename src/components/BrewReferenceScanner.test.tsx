/* @vitest-environment jsdom */
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Brew, BrewReferenceReview } from '../types';
import * as scanModule from '../lib/brewReferenceScan';
import { BrewReferenceScanner, type BrewReferenceScannerProps } from './BrewReferenceScanner';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const brew: Brew = { id: 'brew-1', title: 'Open draft', content: '# Arrival\nWe meet Mara Quill.\n## Library\nWe meet Orren Vey.\n# Departure\nWe meet Talon Bloodwing.', createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1, syncState: 'local', rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' } };
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });
function render(overrides: Partial<BrewReferenceScannerProps> = {}) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const props: BrewReferenceScannerProps = { brews: [brew], activeBrewId: brew.id, knownNames: [], reviews: [], types: [], query: '', onReview: vi.fn(), onCreate: vi.fn(), ...overrides };
  act(() => root.render(<BrewReferenceScanner {...props} />));
  return props;
}
function button(text: string) {
  const item = [...container.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent === text || el.getAttribute('aria-label') === text);
  if (!item) throw new Error(`Missing button ${text}`);
  act(() => item.click());
}
function input(selector: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  act(() => {
    const prototype = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
function reviewProps(props: BrewReferenceScannerProps): BrewReferenceScannerProps {
  return { ...props, reviews: vi.mocked(props.onReview).mock.calls.flatMap((call) => call[0]) };
}

describe('BrewReferenceScanner', () => {
  it('never scans on mount, search, or typing changes; the button scans current draft content', () => {
    const spy = vi.spyOn(scanModule, 'scanNewBrewReferences');
    const props = render();
    expect(spy).not.toHaveBeenCalled();
    button('OutlineWhole brew▾');
    act(() => root.render(<BrewReferenceScanner {...props} query="Mara" brews={[{ ...brew, content: 'We meet Hester Flinn.' }]} />));
    expect(spy).not.toHaveBeenCalled();
    button('Get new references');
    expect(props.onReview).toHaveBeenCalledWith([expect.objectContaining({ name: 'Hester Flinn' })]);
  });

  it('opens a keyboard-free outline and selects a section including subsections', () => {
    const props = render();
    button('OutlineWhole brew▾');
    expect(container.querySelector('.brew-reference-outline-dropdown input')).toBeNull();
    expect(document.activeElement).not.toBeInstanceOf(HTMLInputElement);
    const heading = [...container.querySelectorAll<HTMLButtonElement>('.outline-item')].find((item) => item.textContent === 'Arrival');
    act(() => heading?.click());
    expect(container.querySelector('[aria-label="Choose scan location from outline"]')).toBeNull();
    expect(container.querySelector('.brew-reference-selected-scope')?.textContent).toContain('Arrival and its subsections');
    expect(props.onReview).not.toHaveBeenCalled();
    button('Get new references');
    const found = vi.mocked(props.onReview).mock.calls[0][0];
    expect(found.map((item) => item.name)).toEqual(['Mara Quill', 'Orren Vey']);
    expect(found[0].sectionId).toBe('arrival');
    expect(container.textContent).toContain('Found 2 new references');
  });

  it('creates a result as NPC or the chosen custom type and supports bulk creation', () => {
    const props = render({ types: [{ id: 'ship', name: 'Ship', createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1 }] });
    button('Get new references');
    const updated = reviewProps(props);
    act(() => root.render(<BrewReferenceScanner {...updated} />));
    button('Create Mara Quill as NPC');
    expect(props.onCreate).toHaveBeenLastCalledWith([{ name: 'Mara Quill', kind: 'npc' }]);
    input('[aria-label="Type for Orren Vey"]', 'ship');
    button('Create Orren Vey as Ship');
    expect(props.onCreate).toHaveBeenLastCalledWith([{ name: 'Orren Vey', kind: 'ship' }]);
    button('Select all'); button('Create selected (3)');
    expect(props.onCreate).toHaveBeenLastCalledWith(expect.arrayContaining([{ name: 'Orren Vey', kind: 'ship' }, { name: 'Mara Quill', kind: 'npc' }]));
  });

  it('keeps pending results, never duplicates old ones, and persists dismissal across remounts', () => {
    const props = render();
    function Harness() {
      const [reviews, setReviews] = useState<BrewReferenceReview[]>([]);
      return <BrewReferenceScanner {...props} reviews={reviews} onReview={(updates) => { props.onReview(updates); setReviews((current) => scanModule.mergeReferenceReviews(current, updates)); }} />;
    }
    act(() => root.render(<Harness />));
    button('Get new references');
    button('Dismiss Mara Quill');
    button('Get new references');
    expect(container.textContent).toContain('No new references');
    expect(container.querySelectorAll('.brew-reference-results article')).toHaveLength(2);
    const saved = scanModule.mergeReferenceReviews([], vi.mocked(props.onReview).mock.calls.flatMap((call) => call[0]));
    act(() => root.render(<BrewReferenceScanner {...props} reviews={saved} />));
    expect(container.textContent).not.toContain('Mara Quill');
    button('Get new references');
    expect(container.textContent).toContain('No new references');
  });

  it('does not silently widen the scope when a chosen heading is removed', () => {
    const props = render();
    button('OutlineWhole brew▾');
    const heading = [...container.querySelectorAll<HTMLButtonElement>('.outline-item')].find((item) => item.textContent === 'Library');
    act(() => heading?.click());
    act(() => root.render(<BrewReferenceScanner {...props} brews={[{ ...brew, content: '# Different\nWe meet Hester Flinn.' }]} />));
    button('Get new references');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('no longer exists');
    expect(props.onReview).not.toHaveBeenCalled();
  });

  it('switches brews without carrying over the previous section and disables scanning without a brew', () => {
    const other = { ...brew, id: 'other', title: 'Other notes', content: 'We meet Hester Flinn.' };
    const props = render({ brews: [brew, other] });
    input('select', 'other'); button('Get new references');
    expect(props.onReview).toHaveBeenCalledWith([expect.objectContaining({ name: 'Hester Flinn', sectionId: null, brewId: 'other' })]);
    act(() => root.render(<BrewReferenceScanner {...props} brews={[]} />));
    expect([...container.querySelectorAll('button')].find((item) => item.textContent === 'Get new references')?.disabled).toBe(true);
  });

  it('reuses the editor outline hierarchy and dismisses the dropdown without running a scan', () => {
    const props = render();
    button('OutlineWhole brew▾');
    expect(container.querySelector('[aria-label="Document outline"]')).not.toBeNull();
    const headings = [...container.querySelectorAll<HTMLButtonElement>('.outline-item')];
    expect(headings.map((item) => item.textContent)).toEqual(['Arrival', 'Library', 'Departure']);
    expect(headings[1].style.paddingInlineStart).toBe('22px');
    act(() => container.querySelector('.brew-reference-outline-toggle')?.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})));
    expect(container.querySelector('[aria-label="Choose scan location from outline"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('.brew-reference-outline-toggle'));
    expect(props.onReview).not.toHaveBeenCalled();
  });
});
