import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorView } from '@codemirror/view';

const removedActions = new Set(['Stat block', 'Item', 'Spell']);

function insertDescriptiveBlock() {
  const editor = document.querySelector<HTMLElement>('.app-shell.mobile-editor .cm-editor');
  if (!editor) return;

  const view = EditorView.findFromDOM(editor);
  if (!view) return;

  const selection = view.state.selection.main;
  const selectedText = view.state.sliceDoc(selection.from, selection.to);
  const opening = '{{descriptive\n\n';
  const closing = '}}';
  const insertedText = `${opening}${selectedText}${closing}`;
  const cursor = selection.from + opening.length + selectedText.length;

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: insertedText },
    selection: { anchor: cursor }
  });

  document.querySelector<HTMLButtonElement>('.mobile-outline-fab[aria-expanded="true"]')?.click();
  window.requestAnimationFrame(() => {
    view.focus();
    window.dispatchEvent(new Event('homebrewry-mobile-editor-caret-request'));
  });
}

export function MobileQuickMenuEnhancements() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      const group = document.querySelector<HTMLElement>('.mobile-writing-tool-group[aria-label="Insert blocks"]');
      setTarget(group);
      group?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        button.hidden = removedActions.has(button.textContent?.trim() ?? '');
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <button onClick={insertDescriptiveBlock} type="button">Descr</button>,
    target
  );
}
