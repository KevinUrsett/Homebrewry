/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorldbuildingEntry } from '../types';
import { SocialNpcOverview } from './SocialNpcOverview';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry: WorldbuildingEntry = {
  id: 'bart', name: 'Bart', kind: 'npc', aliases: ['The Broker'], notes: 'Original notes.',
  createdAt: '2026-01-01', updatedAt: '2026-01-01', version: 1,
  roleplay: {
    mannerisms: { summary: 'Quiet voice', details: 'Looks at the door before speaking.\nNever uses real names.' },
    attitude: { summary: 'Wary', details: 'Warms up when offered tea.' }
  }
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  // jsdom has no top-layer implementation; emulate open/close for component tests.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function renderOverview(npc = entry) {
  const props = { entry: npc, onClose: vi.fn(), onOpenWorldbuilding: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
  act(() => root.render(<SocialNpcOverview {...props} key={npc.id} />));
  return props;
}
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.getAttribute('aria-label') === label || item.textContent === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}
function click(label: string) {
  act(() => { const target = button(label); target.focus(); target.click(); });
}
function fill(selector: string, value: string) {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  act(() => {
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('NPC at-a-glance overview', () => {
  it('shows three concise cues and one empty reserved slot, with full details only in the popup', () => {
    renderOverview();
    expect(container.querySelectorAll('.social-npc-cues > *')).toHaveLength(4);
    expect(container.querySelectorAll('.social-npc-cue')).toHaveLength(3);
    expect(container.querySelector('.social-npc-cue-placeholder')?.textContent).toBe('');
    expect(container.textContent).toContain('Quiet voice');
    expect(container.textContent).not.toContain('Never uses real names.');
    expect(container.querySelector('details')?.open).toBe(false);
    click('Mannerisms / speech');
    const dialog = document.querySelector('dialog');
    expect(dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain('Never uses real names.');
    expect(document.activeElement?.tagName).toBe('H2');
    click('Done');
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(button('Mannerisms / speech'));
    expect(document.body.style.overflow).toBe('');
  });

  it('edits a cue without altering the other cues, notes, or NPC identity', () => {
    const props = renderOverview();
    click('Mannerisms / speech');
    click('Edit');
    expect(document.activeElement?.tagName).toBe('INPUT');
    fill('dialog input', '  Speaks in whispers  ');
    fill('dialog textarea', '  Only near strangers.  ');
    click('Save');
    expect(props.onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'bart', version: 2, notes: entry.notes, aliases: entry.aliases,
      roleplay: { ...entry.roleplay, mannerisms: { summary: 'Speaks in whispers', details: 'Only near strangers.' } }
    }));
    expect(document.querySelector('dialog')).toBeNull();
    const saved = props.onUpdate.mock.calls[0][0];
    act(() => root.render(<SocialNpcOverview {...props} entry={saved} key={saved.id} />));
    expect(button('Mannerisms / speech').textContent).toContain('Speaks in whispers');
    click('Mannerisms / speech');
    expect(document.querySelector('dialog')?.textContent).toContain('Only near strangers.');
  });

  it('opens empty categories for entry and discards changes on Cancel or Escape', () => {
    const props = renderOverview();
    click('Fear / secret');
    expect(document.querySelector('dialog input')).not.toBeNull();
    fill('dialog input', 'Uncommitted secret');
    click('Cancel');
    expect(props.onUpdate).not.toHaveBeenCalled();
    click('Fear / secret');
    expect(document.querySelector<HTMLInputElement>('dialog input')?.value).toBe('');
    act(() => document.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true })));
    expect(document.querySelector('dialog')).toBeNull();
    expect(props.onUpdate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button('Fear / secret'));
  });

  it('saves empty cues to allow clearing and resets the popup when the NPC changes', () => {
    const props = renderOverview();
    click('Attitude');
    click('Edit');
    fill('dialog input', '');
    fill('dialog textarea', '');
    click('Save');
    expect(props.onUpdate.mock.calls[0][0].roleplay?.attitude).toEqual({ summary: '', details: '' });
    click('Fear / secret');
    renderOverview({ ...entry, id: 'other', name: 'Other NPC', roleplay: undefined });
    expect(document.querySelector('dialog')).toBeNull();
    expect(container.textContent).not.toContain('Quiet voice');
  });
});
