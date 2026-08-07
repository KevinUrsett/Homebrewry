import { useEffect } from 'react';

const MOBILE_BREAKPOINT = '(max-width: 820px)';

export function MobileVisualViewportInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const root = document.documentElement;
    let expandedViewportBottom = Math.round(viewport.offsetTop + viewport.height);

    const updateInset = () => {
      if (!window.matchMedia(MOBILE_BREAKPOINT).matches) {
        root.style.removeProperty('--mobile-visual-keyboard-inset');
        return;
      }

      const visibleBottom = Math.round(viewport.offsetTop + viewport.height);
      expandedViewportBottom = Math.max(expandedViewportBottom, visibleBottom);
      const inset = Math.max(0, expandedViewportBottom - visibleBottom);
      root.style.setProperty('--mobile-visual-keyboard-inset', `${inset}px`);
    };

    const resetForOrientation = () => {
      expandedViewportBottom = Math.round(viewport.offsetTop + viewport.height);
      window.setTimeout(updateInset, 250);
    };

    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);
    window.addEventListener('orientationchange', resetForOrientation);

    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
      window.removeEventListener('orientationchange', resetForOrientation);
      root.style.removeProperty('--mobile-visual-keyboard-inset');
    };
  }, []);

  return null;
}
