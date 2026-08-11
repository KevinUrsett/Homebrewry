import { useEffect } from 'react';

const mobileEditorQuery = '(max-width: 820px)';
const writingToolSelector = '.mobile-capture-menu, .mobile-outline-scrubber, .mobile-inline-outline, .mobile-inline-outline-backdrop, .mobile-top-menu-button';

function isEditorFocused() {
  const active = document.activeElement;
  return active instanceof Element && Boolean(active.closest('.app-shell.mobile-editor .cm-editor'));
}

function isWritingToolFocused() {
  const active = document.activeElement;
  return active instanceof Element && Boolean(active.closest(writingToolSelector));
}

export function MobileFocusWriting() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let writing = false;
    let keyboardOpen = false;
    let largestViewportHeight = Math.round(viewport?.height ?? window.innerHeight);

    const apply = () => {
      const mobile = window.matchMedia(mobileEditorQuery).matches;
      root.classList.toggle('mobile-focus-writing', writing && mobile);
      root.classList.toggle('mobile-keyboard-open', keyboardOpen && mobile);
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
      if (target.closest(writingToolSelector)) return;
      writing = false;
      apply();
    };

    const handleViewportChange = () => {
      const visibleHeight = Math.round(viewport?.height ?? window.innerHeight);
      const visibleTop = Math.round(viewport?.offsetTop ?? 0);
      largestViewportHeight = Math.max(largestViewportHeight, visibleHeight);
      keyboardOpen = largestViewportHeight - visibleHeight > 90;

      if (keyboardOpen) {
        root.style.setProperty('--mobile-keyboard-top', `${visibleTop + visibleHeight}px`);
      } else {
        root.style.removeProperty('--mobile-keyboard-top');
      }

      if (!keyboardOpen && !isEditorFocused() && !isWritingToolFocused()) writing = false;
      apply();
    };

    handleViewportChange();
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    viewport?.addEventListener('resize', handleViewportChange);
    viewport?.addEventListener('scroll', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      viewport?.removeEventListener('resize', handleViewportChange);
      viewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      root.classList.remove('mobile-focus-writing', 'mobile-keyboard-open');
      root.style.removeProperty('--mobile-keyboard-top');
    };
  }, []);

  return null;
}
