import { useEffect } from 'react';
import { EditorView } from '@codemirror/view';

const MOBILE_EDITOR_QUERY = '(max-width: 820px)';
const CARET_TOP_MARGIN = 32;
const CARET_BOTTOM_MARGIN = 96;
const CARET_REQUEST_EVENT = 'homebrewry-mobile-editor-caret-request';

function isMobileEditorActive() {
  return window.matchMedia(MOBILE_EDITOR_QUERY).matches
    && Boolean(document.querySelector('.app-shell.mobile-editor'));
}

function focusedEditorView() {
  const editor = document.querySelector<HTMLElement>('.app-shell.mobile-editor .cm-editor.cm-focused');
  return editor ? EditorView.findFromDOM(editor) : null;
}

function scrollCaretIntoVisibleEditor() {
  if (!isMobileEditorActive()) return;

  const view = focusedEditorView();
  if (!view) return;

  const scroller = view.scrollDOM;
  const caret = view.coordsAtPos(view.state.selection.main.head);
  if (!caret) return;

  const scrollerRect = scroller.getBoundingClientRect();
  const viewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
  const visibleTop = Math.max(scrollerRect.top, 0) + CARET_TOP_MARGIN;
  const visibleBottom = Math.min(scrollerRect.bottom, viewportHeight) - CARET_BOTTOM_MARGIN;

  if (visibleBottom <= visibleTop) return;
  if (caret.top >= visibleTop && caret.bottom <= visibleBottom) return;

  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.selection.main.head, {
      y: 'center',
      yMargin: 48
    })
  });
}

export function MobileEditorKeyboardGuard() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const pendingTimers = new Set<number>();
    let largestViewportHeight = Math.round(viewport?.height ?? window.innerHeight);
    let lastVisibleHeight = 0;

    const clearPendingAdjustments = () => {
      pendingTimers.forEach((timer) => window.clearTimeout(timer));
      pendingTimers.clear();
    };

    const scheduleCaretAdjustment = (delays: readonly number[]) => {
      clearPendingAdjustments();
      delays.forEach((delay) => {
        const timer = window.setTimeout(() => {
          pendingTimers.delete(timer);
          window.requestAnimationFrame(scrollCaretIntoVisibleEditor);
        }, delay);
        pendingTimers.add(timer);
      });
    };

    const updateViewportState = () => {
      const visibleHeight = Math.round(viewport?.height ?? window.innerHeight);
      largestViewportHeight = Math.max(largestViewportHeight, visibleHeight);
      const keyboardOpen = largestViewportHeight - visibleHeight > 100;

      if (Math.abs(visibleHeight - lastVisibleHeight) > 1) {
        lastVisibleHeight = visibleHeight;
        document.documentElement.style.setProperty('--mobile-visible-height', `${visibleHeight}px`);
      }
      document.documentElement.classList.toggle('mobile-keyboard-open', keyboardOpen);

      if (focusedEditorView()) scheduleCaretAdjustment([120, 320]);
    };

    const handleOrientationChange = () => {
      clearPendingAdjustments();
      largestViewportHeight = Math.round(viewport?.height ?? window.innerHeight);
      window.setTimeout(updateViewportState, 250);
    };

    const handleEditorFocus = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.cm-editor')) return;
      scheduleCaretAdjustment([80, 280, 560]);
    };

    const handleEditorTap = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.cm-editor')) return;
      scheduleCaretAdjustment([0, 140]);
    };

    const handleExplicitCaretRequest = () => scheduleCaretAdjustment([0, 180]);

    updateViewportState();
    viewport?.addEventListener('resize', updateViewportState);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener(CARET_REQUEST_EVENT, handleExplicitCaretRequest);
    document.addEventListener('focusin', handleEditorFocus, true);
    document.addEventListener('pointerup', handleEditorTap, true);

    return () => {
      viewport?.removeEventListener('resize', updateViewportState);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener(CARET_REQUEST_EVENT, handleExplicitCaretRequest);
      document.removeEventListener('focusin', handleEditorFocus, true);
      document.removeEventListener('pointerup', handleEditorTap, true);
      clearPendingAdjustments();
      document.documentElement.classList.remove('mobile-keyboard-open');
      document.documentElement.style.removeProperty('--mobile-visible-height');
    };
  }, []);

  return null;
}
