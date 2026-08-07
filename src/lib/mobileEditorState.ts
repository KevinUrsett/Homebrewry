import { EditorView } from '@codemirror/view';

export function getActiveBrewId() {
  return document.querySelector<HTMLElement>('.brew-list-item.is-active[data-brew-id]')?.dataset.brewId ?? null;
}

export function getActiveBrewTitle() {
  return document.querySelector<HTMLElement>('.brew-list-item.is-active strong')?.textContent?.trim() || 'Untitled Brew';
}

export function getMobileSection() {
  const app = document.querySelector<HTMLElement>('.app-shell');
  if (!app) return null;
  const token = [...app.classList].find((name) => name.startsWith('mobile-'));
  return token?.slice('mobile-'.length) ?? null;
}

export function getEditorView() {
  const editor = document.querySelector<HTMLElement>('.app-shell .markdown-editor .cm-editor');
  return editor ? EditorView.findFromDOM(editor) : null;
}

export function closeMobileCaptureMenu() {
  document.querySelector<HTMLButtonElement>('.mobile-outline-fab[aria-expanded="true"]')?.click();
}

export function clickMobileNav(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('.mobile-nav button')]
    .find((item) => item.textContent?.trim() === label);
  button?.click();
}
