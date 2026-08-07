import { useEffect } from 'react';

const MOBILE_BREAKPOINT = '(max-width: 820px)';
const CONTROL_MARGIN = 12;

export function MobileVisualViewportInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    let resizeObserver: ResizeObserver | null = null;
    let observedMenu: HTMLElement | null = null;

    const positionMenu = () => {
      const menu = document.querySelector<HTMLElement>('.app-shell.mobile-editor .mobile-capture-menu');

      if (!window.matchMedia(MOBILE_BREAKPOINT).matches || !menu) {
        if (observedMenu) {
          observedMenu.style.removeProperty('top');
          observedMenu.style.removeProperty('bottom');
        }
        return;
      }

      if (menu !== observedMenu) {
        resizeObserver?.disconnect();
        observedMenu = menu;
        resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(positionMenu));
        resizeObserver.observe(menu);
      }

      /* iOS may pan the layout viewport as the caret moves. Fixed controls that
         are positioned only with `bottom` therefore appear to follow the text.
         Anchor the menu's bottom edge to the visual viewport instead. Subtracting
         offsetTop when Safari pans leaves the controls at the same screen position. */
      const visualBottom = viewport.offsetTop + viewport.height;
      const menuHeight = menu.getBoundingClientRect().height;
      const top = Math.max(viewport.offsetTop + CONTROL_MARGIN, visualBottom - menuHeight - CONTROL_MARGIN);

      menu.style.setProperty('bottom', 'auto', 'important');
      menu.style.setProperty('top', `${Math.round(top)}px`, 'important');
    };

    const mutationObserver = new MutationObserver(() => window.requestAnimationFrame(positionMenu));
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    positionMenu();
    viewport.addEventListener('resize', positionMenu);
    viewport.addEventListener('scroll', positionMenu);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('orientationchange', positionMenu);

    return () => {
      viewport.removeEventListener('resize', positionMenu);
      viewport.removeEventListener('scroll', positionMenu);
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('orientationchange', positionMenu);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      observedMenu?.style.removeProperty('top');
      observedMenu?.style.removeProperty('bottom');
    };
  }, []);

  return null;
}
