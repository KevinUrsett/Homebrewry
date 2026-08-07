import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { closeMobileCaptureMenu, getEditorView } from '../lib/mobileEditorState';

function wrapSelection(before: string, after: string) {
  const view = getEditorView();
  if (!view) return;
  const selection = view.state.selection.main;
  if (selection.empty) return;
  const selected = view.state.sliceDoc(selection.from, selection.to);
  const inserted = `${before}${selected}${after}`;
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: inserted },
    selection: { anchor: selection.from + before.length, head: selection.from + before.length + selected.length }
  });
  closeMobileCaptureMenu();
  window.requestAnimationFrame(() => view.focus());
}

function openReferenceForSelection() {
  const button = [...document.querySelectorAll<HTMLButtonElement>('.mobile-writing-tool-group[aria-label="Insert content"] button')]
    .find((item) => item.textContent?.trim() === 'Reference');
  button?.click();
}

export function MobileContextTools() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const tools = document.querySelector<HTMLElement>('.mobile-writing-tools');
      setTarget(tools);
      const view = getEditorView();
      const selected = Boolean(view && !view.state.selection.main.empty);
      setHasSelection(selected);
      tools?.classList.toggle('has-editor-selection', selected);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('selectionchange', refresh);
    document.addEventListener('pointerup', refresh, true);
    document.addEventListener('keyup', refresh, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('selectionchange', refresh);
      document.removeEventListener('pointerup', refresh, true);
      document.removeEventListener('keyup', refresh, true);
      document.querySelector<HTMLElement>('.mobile-writing-tools')?.classList.remove('has-editor-selection');
    };
  }, []);

  if (!target || !hasSelection) return null;

  return createPortal(
    <div className="mobile-writing-tool-group mobile-context-tools" aria-label="Selected text">
      <span className="mobile-context-label">Selected text</span>
      <button onClick={() => wrapSelection('**', '**')} type="button"><strong>Bold</strong></button>
      <button onClick={() => wrapSelection('_', '_')} type="button"><em>Italic</em></button>
      <button onClick={() => wrapSelection('[', '](https://)')} type="button">Link</button>
      <button onClick={openReferenceForSelection} type="button">Reference</button>
    </div>,
    target
  );
}
