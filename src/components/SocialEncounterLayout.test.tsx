/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { SocialEncounterLayout } from './SocialEncounterLayout';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('SocialEncounterLayout', () => {
  it('opens the NPC overview above the grid without moving its cards', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => root?.render(<SocialEncounterLayout />));

    const talon = Array.from(container.querySelectorAll<HTMLButtonElement>('.social-character-card-button'))
      .find((button) => button.textContent?.includes('Talon Bloodwing'));
    const cardsBefore = Array.from(container.querySelectorAll('.social-character-card strong')).map((name) => name.textContent);
    expect(talon?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => talon?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(talon?.getAttribute('aria-expanded')).toBe('true');
    const overview = container.querySelector('.social-character-overview');
    const grid = container.querySelector('.social-character-grid');
    expect(overview?.textContent).toContain('guarded military leader');
    expect(Array.from(container.querySelectorAll('.social-character-card strong')).map((name) => name.textContent)).toEqual(cardsBefore);
    expect(Boolean(overview && grid && (overview.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

    await act(async () => talon?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('.social-character-overview')).toBeNull();
  });

  it('keeps an add card last and opens search or create choices above the grid', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => root?.render(<SocialEncounterLayout />));
    const grid = container.querySelector('.social-character-grid');
    expect(grid?.lastElementChild?.classList.contains('social-character-add-card')).toBe(true);

    await act(async () => container?.querySelector<HTMLButtonElement>('.social-character-add-card')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const picker = container?.querySelector('.social-npc-picker');
    expect(container?.querySelector<HTMLInputElement>('[aria-label="Search NPCs"]')).not.toBeNull();
    expect(Array.from(container?.querySelectorAll('button') ?? []).some((button) => button.textContent === 'Create new NPC')).toBe(true);
    expect(Boolean(picker && grid && (picker.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  });
});
