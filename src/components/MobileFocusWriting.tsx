import { useEffect } from 'react';

const mobileEditorQuery = '(max-width: 820px)';

function isEditorFocused() {
  const active = document.activeElement;
  return active instanceof Element && Boolean(active.closest('.app-shell.mobile-editor .cm-editor'));
}

function isWritingToolFocused() {
  const active = document.activeElement;
  return active instanceof Element && Boolean(active.closest('.mobile-capture-menu'));
}

export function MobileFocusWriting() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let writing = false;
    let largestViewportHeight = Math.round(viewport?.height ?? window.innerHeight);

    const apply = () => {
      document.documentElement.classList.toggle(
        'mobile-focus-writing',
        writing && window.matchMedia(mobileEditorQuery).matches
      );
    };

    const handleFocusIn = () => {
      if (isEditorFocused()) writing = true;
      if (!isEditorFocused() && !isWritingToolFocused() && !writing) writing = false;
      apply();
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        if (isEditorFocused() || isWritingToolFocused()) {
          writing = true;
          apply();
        }
      }, 0);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.cm-editor')) {
        writing = true;
        apply();
        return;
      }
      if (target.closest('.mobile-capture-menu')) return;
      writing = false;
      apply();
    };

    const handleViewportChange = () => {
      const visibleHeight = Math.round(viewport?.height ?? window.innerHeight);
      largestViewportHeight = Math.max(largestViewportHeight, visibleHeight);
      const keyboardOpen = largestViewportHeight - visibleHeight > 90;
      if (!keyboardOpen && !isEditorFocused() && !isWritingToolFocused()) writing = false;
      apply();
    };

    handleViewportChange();
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    viewport?.addEventListener('resize', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      viewport?.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      document.documentElement.classList.remove('mobile-focus-writing');
    };
  }, []);

  return null;
}
