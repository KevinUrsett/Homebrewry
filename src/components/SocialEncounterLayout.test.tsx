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
  it('expands one NPC overview at a time and collapses it when selected again', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => root?.render(<SocialEncounterLayout />));

    const talon = Array.from(container.querySelectorAll<HTMLButtonElement>('.social-character-card-button'))
      .find((button) => button.textContent?.includes('Talon Bloodwing'));
    expect(talon?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => talon?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(talon?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.social-character-overview')?.textContent).toContain('guarded military leader');

    await act(async () => talon?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('.social-character-overview')).toBeNull();
  });
});
