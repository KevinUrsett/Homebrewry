import { useEffect } from 'react';

const mobileEditorQuery = '(max-width: 820px)';
export function MobileFocusWriting() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let keyboardOpen = false;
    let largestViewportHeight = Math.round(viewport?.height ?? window.innerHeight);

    const apply = () => {
      const mobile = window.matchMedia(mobileEditorQuery).matches;
      root.classList.toggle('mobile-keyboard-open', keyboardOpen && mobile);
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

      apply();
    };

    handleViewportChange();
    viewport?.addEventListener('resize', handleViewportChange);
    viewport?.addEventListener('scroll', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      viewport?.removeEventListener('resize', handleViewportChange);
      viewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      root.classList.remove('mobile-keyboard-open');
      root.style.removeProperty('--mobile-keyboard-top');
    };
  }, []);

  return null;
}
