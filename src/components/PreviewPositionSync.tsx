import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { getOutlineLocations } from '../lib/outline';

type PreviewAnchor = {
  sourcePosition: number;
  sourceLength: number;
  currentHeadingId: string | null;
  currentHeadingFrom: number;
  nextHeadingId: string | null;
  nextHeadingFrom: number;
};

function isPreviewButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>('button');
  if (!button || button.textContent?.trim() !== 'Preview') return false;
  return Boolean(button.closest('.mobile-nav, .desktop-view-controls'));
}

function readEditorAnchor(): PreviewAnchor | null {
  const editor = document.querySelector<HTMLElement>('.app-shell .markdown-editor .cm-editor');
  if (!editor) return null;

  const view = EditorView.findFromDOM(editor);
  if (!view) return null;

  const source = view.state.doc.toString();
  const sourcePosition = view.state.selection.main.head;
  const headings = getOutlineLocations(source);
  const currentIndex = headings.findLastIndex((heading) => heading.from <= sourcePosition);
  const current = currentIndex >= 0 ? headings[currentIndex] : null;
  const next = currentIndex >= 0 ? headings[currentIndex + 1] ?? null : headings[0] ?? null;

  return {
    sourcePosition,
    sourceLength: source.length,
    currentHeadingId: current?.id ?? null,
    currentHeadingFrom: current?.from ?? 0,
    nextHeadingId: next?.id ?? null,
    nextHeadingFrom: next?.from ?? source.length
  };
}

function elementTopInsideScroller(element: HTMLElement, scroller: HTMLElement) {
  const scrollerRect = scroller.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return scroller.scrollTop + elementRect.top - scrollerRect.top;
}

function applyPreviewAnchor(anchor: PreviewAnchor) {
  const pane = document.querySelector<HTMLElement>('.app-shell .preview-pane');
  if (!pane || pane.offsetParent === null) return false;

  const maxScroll = Math.max(0, pane.scrollHeight - pane.clientHeight);
  const currentHeading = anchor.currentHeadingId
    ? document.getElementById(anchor.currentHeadingId)
    : null;

  if (!currentHeading) {
    const overallProgress = anchor.sourceLength > 0 ? anchor.sourcePosition / anchor.sourceLength : 0;
    pane.scrollTo({ top: maxScroll * Math.max(0, Math.min(1, overallProgress)), behavior: 'auto' });
    return true;
  }

  const currentTop = elementTopInsideScroller(currentHeading, pane);
  const nextHeading = anchor.nextHeadingId ? document.getElementById(anchor.nextHeadingId) : null;
  const nextTop = nextHeading ? elementTopInsideScroller(nextHeading, pane) : maxScroll + pane.clientHeight;
  const sectionLength = Math.max(1, anchor.nextHeadingFrom - anchor.currentHeadingFrom);
  const sectionProgress = Math.max(0, Math.min(1, (anchor.sourcePosition - anchor.currentHeadingFrom) / sectionLength));
  const targetTop = currentTop + (nextTop - currentTop) * sectionProgress;

  pane.scrollTo({ top: Math.max(0, Math.min(maxScroll, targetTop - 16)), behavior: 'auto' });
  return true;
}

export function PreviewPositionSync() {
  const lastAnchorRef = useRef<PreviewAnchor | null>(null);

  useEffect(() => {
    const handlePointer = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.markdown-editor .cm-editor')) return;
      const anchor = readEditorAnchor();
      if (anchor) lastAnchorRef.current = anchor;
    };

    const handlePreviewNavigation = (event: MouseEvent) => {
      if (!isPreviewButton(event.target)) return;

      const anchor = readEditorAnchor() ?? lastAnchorRef.current;
      if (!anchor) return;
      lastAnchorRef.current = anchor;

      let attempts = 0;
      const align = () => {
        attempts += 1;
        if (applyPreviewAnchor(anchor) || attempts >= 8) return;
        window.setTimeout(align, 35);
      };

      window.setTimeout(align, 0);
    };

    document.addEventListener('pointerup', handlePointer, true);
    document.addEventListener('keyup', handlePointer, true);
    document.addEventListener('click', handlePreviewNavigation, true);

    return () => {
      document.removeEventListener('pointerup', handlePointer, true);
      document.removeEventListener('keyup', handlePointer, true);
      document.removeEventListener('click', handlePreviewNavigation, true);
    };
  }, []);

  return null;
}
