import { useEffect } from 'react';

const mobileEditorQuery = '(max-width: 820px)';

function isEditorFocused() {
  const active = document.activeElement;
  return active instanceof Element && Boolean(active.closest('.app-shell.mobile-editor .cm-editor'));
}

export function MobileFocusWriting() {
  useEffect(() => {
    const update = () => {
      const active = window.matchMedia(mobileEditorQuery).matches && isEditorFocused();
      document.documentElement.classList.toggle('mobile-focus-writing', active);
    };

    const handleFocusOut = () => window.setTimeout(update, 0);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.mobile-capture-menu')) return;
      if (!target.closest('.cm-editor')) document.documentElement.classList.remove('mobile-focus-writing');
    };

    update();
    document.addEventListener('focusin', update, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', update);

    return () => {
      document.removeEventListener('focusin', update, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', update);
      document.documentElement.classList.remove('mobile-focus-writing');
    };
  }, []);

  return null;
}
