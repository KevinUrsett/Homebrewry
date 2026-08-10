import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ScrollerBounds = {
  top: number;
  height: number;
};

const MOBILE_BREAKPOINT = '(max-width: 820px)';
const CONTROL_HEIGHT = 48;
const EDGE_GAP = 10;

export function MobilePreviewScroller() {
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const [percent, setPercent] = useState(0);
  const [bounds, setBounds] = useState<ScrollerBounds | null>(null);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      const isMobile = window.matchMedia(MOBILE_BREAKPOINT).matches;
      setPane(isMobile ? document.querySelector<HTMLElement>('.app-shell.mobile-preview .preview-pane') : null);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
    };
  }, []);

  useEffect(() => {
    if (!pane) return undefined;

    const update = () => {
      const maximum = Math.max(1, pane.scrollHeight - pane.clientHeight);
      setPercent(Math.round((pane.scrollTop / maximum) * 100));
      const rect = pane.getBoundingClientRect();
      setBounds({ top: rect.top, height: rect.height });
    };

    update();
    pane.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      pane.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [pane]);

  const scrollToPointer = (clientY: number) => {
    if (!pane || !bounds) return;
    const usableHeight = Math.max(1, bounds.height - CONTROL_HEIGHT - EDGE_GAP * 2);
    const position = Math.max(0, Math.min(1, (clientY - bounds.top - EDGE_GAP - CONTROL_HEIGHT / 2) / usableHeight));
    pane.scrollTo({ top: position * Math.max(0, pane.scrollHeight - pane.clientHeight), behavior: 'auto' });
  };

  if (!pane || !bounds || bounds.height <= CONTROL_HEIGHT + EDGE_GAP * 2) return null;

  const usableHeight = bounds.height - CONTROL_HEIGHT - EDGE_GAP * 2;
  const top = bounds.top + EDGE_GAP + usableHeight * (percent / 100);

  return createPortal(
    <button
      aria-label={`Preview scroll position: ${percent} percent. Drag to scroll.`}
      className="mobile-preview-scroller"
      onPointerCancel={() => { pointerId.current = null; }}
      onPointerDown={(event) => {
        event.preventDefault();
        pointerId.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrollToPointer(event.clientY);
      }}
      onPointerMove={(event) => {
        if (pointerId.current !== event.pointerId) return;
        event.preventDefault();
        scrollToPointer(event.clientY);
      }}
      onPointerUp={(event) => {
        if (pointerId.current !== event.pointerId) return;
        pointerId.current = null;
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
      }}
      style={{ top: `${Math.round(top)}px` }}
      title="Drag to scroll the preview"
      type="button"
    >
      <span aria-hidden="true">☰</span>
      <small>{percent}%</small>
    </button>,
    document.body
  );
}
