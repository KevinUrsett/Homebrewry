import { useEffect } from 'react';

const MOBILE_EDITOR_QUERY = '(max-width: 820px)';
const CARET_MARGIN = 28;

function isMobileEditorActive() {
  return window.matchMedia(MOBILE_EDITOR_QUERY).matches
    && Boolean(document.querySelector('.app-shell.mobile-editor'));
}

function scrollCaretIntoVisibleEditor() {
  if (!isMobileEditorActive()) return;

  const editor = document.querySelector<HTMLElement>('.app-shell.mobile-editor .cm-editor.cm-focused');
  const scroller = editor?.querySelector<HTMLElement>('.cm-scroller');
  const cursor = editor?.querySelector<HTMLElement>('.cm-cursor-primary, .cm-cursor');
  if (!editor || !scroller || !cursor) return;

  const cursorRect = cursor.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
  const visibleTop = Math.max(scrollerRect.top, viewportTop) + CARET_MARGIN;
  const visibleBottom = Math.min(scrollerRect.bottom, viewportBottom) - CARET_MARGIN;

  if (visibleBottom <= visibleTop) return;

  if (cursorRect.bottom > visibleBottom) {
    scroller.scrollTop += cursorRect.bottom - visibleBottom + CARET_MARGIN;
  } else if (cursorRect.top < visibleTop) {
    scroller.scrollTop -= visibleTop - cursorRect.top + CARET_MARGIN;
  }
}

export function MobileEditorKeyboardGuard() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const pendingTimers = new Set<number>();

    const scheduleCaretAdjustment = () => {
      [0, 90, 280].forEach((delay) => {
        const timer = window.setTimeout(() => {
          pendingTimers.delete(timer);
          window.requestAnimationFrame(scrollCaretIntoVisibleEditor);
        }, delay);
        pendingTimers.add(timer);
      });
    };

    const updateViewportState = () => {
      const visibleHeight = viewport?.height ?? window.innerHeight;
      const keyboardInset = Math.max(0, window.innerHeight - visibleHeight - (viewport?.offsetTop ?? 0));
      document.documentElement.style.setProperty('--mobile-visible-height', `${visibleHeight}px`);
      document.documentElement.classList.toggle('mobile-keyboard-open', keyboardInset > 120);
      scheduleCaretAdjustment();
    };

    const handleEditorInteraction = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.cm-editor')) return;
      scheduleCaretAdjustment();
    };

    const handleSelectionChange = () => {
      const active = document.activeElement;
      if (!(active instanceof Element) || !active.closest('.cm-editor')) return;
      scheduleCaretAdjustment();
    };

    updateViewportState();
    viewport?.addEventListener('resize', updateViewportState);
    viewport?.addEventListener('scroll', updateViewportState);
    window.addEventListener('orientationchange', updateViewportState);
    document.addEventListener('focusin', handleEditorInteraction, true);
    document.addEventListener('input', handleEditorInteraction, true);
    document.addEventListener('keyup', handleEditorInteraction, true);
    document.addEventListener('pointerup', handleEditorInteraction, true);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      viewport?.removeEventListener('resize', updateViewportState);
      viewport?.removeEventListener('scroll', updateViewportState);
      window.removeEventListener('orientationchange', updateViewportState);
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
