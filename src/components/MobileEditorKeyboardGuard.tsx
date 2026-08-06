import { useEffect } from 'react';
import { EditorView } from '@codemirror/view';

const MOBILE_EDITOR_QUERY = '(max-width: 820px)';
const CARET_MARGIN = 64;
const CARET_REQUEST_EVENT = 'homebrewry-mobile-editor-caret-request';

function isMobileEditorActive() {
  return window.matchMedia(MOBILE_EDITOR_QUERY).matches
    && Boolean(document.querySelector('.app-shell.mobile-editor'));
}

function focusedEditorView() {
  const editor = document.querySelector<HTMLElement>('.app-shell.mobile-editor .cm-editor.cm-focused');
  return editor ? EditorView.findFromDOM(editor) : null;
}

function applyDomScrollFallback() {
  const editor = document.querySelector<HTMLElement>('.app-shell.mobile-editor .cm-editor.cm-focused');
  const scroller = editor?.querySelector<HTMLElement>('.cm-scroller');
  const cursor = editor?.querySelector<HTMLElement>('.cm-cursor-primary, .cm-cursor');
  if (!scroller || !cursor) return;

  const cursorRect = cursor.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const visibleTop = Math.max(scrollerRect.top, 0) + CARET_MARGIN;
  const visibleBottom = Math.min(scrollerRect.bottom, viewportHeight) - CARET_MARGIN;

  if (visibleBottom <= visibleTop) return;
  if (cursorRect.bottom > visibleBottom) {
    scroller.scrollTop += cursorRect.bottom - visibleBottom + CARET_MARGIN;
  } else if (cursorRect.top < visibleTop) {
    scroller.scrollTop -= visibleTop - cursorRect.top + CARET_MARGIN;
  }
}

function scrollCaretIntoVisibleEditor(center = false) {
  if (!isMobileEditorActive()) return;

  const view = focusedEditorView();
  if (!view) return;

  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.selection.main.head, {
      y: center ? 'center' : 'nearest',
      yMargin: CARET_MARGIN
    })
  });
  window.requestAnimationFrame(applyDomScrollFallback);
}

export function MobileEditorKeyboardGuard() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const pendingTimers = new Set<number>();
    let largestViewportHeight = viewport?.height ?? window.innerHeight;

    const scheduleCaretAdjustment = (center = false) => {
      [0, 90, 220, 420, 650].forEach((delay) => {
        const timer = window.setTimeout(() => {
          pendingTimers.delete(timer);
          window.requestAnimationFrame(() => scrollCaretIntoVisibleEditor(center));
        }, delay);
        pendingTimers.add(timer);
      });
    };

    const updateViewportState = () => {
      const visibleHeight = viewport?.height ?? window.innerHeight;
      largestViewportHeight = Math.max(largestViewportHeight, visibleHeight);
      const keyboardOpen = largestViewportHeight - visibleHeight > 100;
      document.documentElement.style.setProperty('--mobile-visible-height', `${visibleHeight}px`);
      document.documentElement.classList.toggle('mobile-keyboard-open', keyboardOpen);
      scheduleCaretAdjustment(true);
    };

    const handleOrientationChange = () => {
      largestViewportHeight = viewport?.height ?? window.innerHeight;
      window.setTimeout(updateViewportState, 200);
    };

    const handleEditorInteraction = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.cm-editor')) return;
      scheduleCaretAdjustment(event.type === 'focusin' || event.type === 'pointerup');
    };

    const handleSelectionChange = () => {
      if (!focusedEditorView()) return;
      scheduleCaretAdjustment(false);
    };

    const handleExplicitCaretRequest = () => scheduleCaretAdjustment(true);

    updateViewportState();
    viewport?.addEventListener('resize', updateViewportState);
    viewport?.addEventListener('scroll', updateViewportState);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener(CARET_REQUEST_EVENT, handleExplicitCaretRequest);
    document.addEventListener('focusin', handleEditorInteraction, true);
    document.addEventListener('input', handleEditorInteraction, true);
    document.addEventListener('keyup', handleEditorInteraction, true);
    document.addEventListener('pointerup', handleEditorInteraction, true);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      viewport?.removeEventListener('resize', updateViewportState);
      viewport?.removeEventListener('scroll', updateViewportState);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener(CARET_REQUEST_EVENT, handleExplicitCaretRequest);
      document.removeEventListener('focusin', handleEditorInteraction, true);
      document.removeEventListener('input', handleEditorInteraction, true);
      document.removeEventListener('keyup', handleEditorInteraction, true);
      document.removeEventListener('pointerup', handleEditorInteraction, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      pendingTimers.forEach((timer) => window.clearTimeout(timer));
      document.documentElement.classList.remove('mobile-keyboard-open');
      document.documentElement.style.removeProperty('--mobile-visible-height');
    };
  }, []);

  return null;
}
