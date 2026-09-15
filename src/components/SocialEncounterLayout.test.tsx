/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SocialEncounter, WorldbuildingEntry } from '../types';
import { SocialEncounterLayout } from './SocialEncounterLayout';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entries: WorldbuildingEntry[] = [
  { id: 'talon', name: 'Talon Bloodwing', kind: 'npc', aliases: ['The Falcon'], notes: 'A guarded military leader.', createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1 },
  { id: 'orren', name: 'Orren Vey', kind: 'character', aliases: [], notes: 'An obsessive scholar.', createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1 },
  { id: 'place', name: 'Sund', kind: 'town', aliases: [], notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1 }
];
const encounter: SocialEncounter = { id: 'social-1', name: 'Council meeting', npcEntryIds: ['talon'], createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1 };

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderLayout(overrides: Partial<React.ComponentProps<typeof SocialEncounterLayout>> = {}) {
  const props = {
    encounters: [encounter],
    worldbuildingEntries: entries,
    onCreateNpc: vi.fn((name: string) => ({ ...entries[1], id: 'created', name })),
    onDeleteEncounter: vi.fn(),
    onOpenWorldbuildingEntry: vi.fn(),
    onUpdateEncounter: vi.fn(),
    ...overrides
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<SocialEncounterLayout {...props} />));
  return props;
}

describe('SocialEncounterLayout', () => {
  it('opens actual Worldbuilding information above the grid without moving cards', () => {
    renderLayout();
    const talon = container?.querySelector<HTMLButtonElement>('.social-character-card-button');
    act(() => talon?.click());
    const overview = container?.querySelector('.social-character-overview');
    const grid = container?.querySelector('.social-character-grid');
    expect(overview?.textContent).toContain('A guarded military leader.');
    expect(overview?.textContent).toContain('The Falcon');
    expect(Boolean(overview && grid && (overview.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  });

  it('keeps the add card last and searches only eligible Worldbuilding people', () => {
    const props = renderLayout();
    const grid = container?.querySelector('.social-character-grid');
    expect(grid?.lastElementChild?.classList.contains('social-character-add-card')).toBe(true);
    act(() => container?.querySelector<HTMLButtonElement>('.social-character-add-card')?.click());
    const search = container?.querySelector<HTMLInputElement>('[aria-label="Search NPCs"]');
    expect(container?.querySelector('.social-npc-picker')?.textContent).toContain('Orren Vey');
    expect(container?.querySelector('.social-npc-picker')?.textContent).not.toContain('Sund');
    act(() => {
      if (search) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(search, 'Orren');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    act(() => Array.from(container?.querySelectorAll<HTMLButtonElement>('.social-npc-search-results button') ?? [])[0]?.click());
    expect(props.onUpdateEncounter).toHaveBeenCalledWith(expect.objectContaining({ npcEntryIds: ['talon', 'orren'] }));
  });

  it('creates and saves a new empty social encounter', () => {
    const props = renderLayout({ encounters: [] });
    act(() => container?.querySelector<HTMLButtonElement>('.social-encounter-welcome button')?.click());
    expect(props.onUpdateEncounter).toHaveBeenCalledWith(expect.objectContaining({ name: 'New social encounter', npcEntryIds: [] }));
  });

  it('creates an unmatched NPC directly from the search text', () => {
    const props = renderLayout();
    act(() => container?.querySelector<HTMLButtonElement>('.social-character-add-card')?.click());
    const search = container?.querySelector<HTMLInputElement>('[aria-label="Search NPCs"]');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'Mara Quill');
      search?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const create = container?.querySelector<HTMLButtonElement>('.social-npc-create-result');
    expect(create?.textContent).toContain('Create “Mara Quill”');
    expect(container?.querySelector('[aria-label="New NPC name"]')).toBeNull();
    act(() => create?.click());
    expect(props.onCreateNpc).toHaveBeenCalledWith('Mara Quill');
    expect(props.onUpdateEncounter).toHaveBeenCalledWith(expect.objectContaining({ npcEntryIds: ['talon', 'created'] }));
  });
});
