import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorView } from '@codemirror/view';

type OutlineItem = {
  id?: string;
  level: number;
  title: string;
  position: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
  mode: 'content' | 'outline';
  contentScroller: HTMLElement;
};

type ContentMode = 'editor' | 'preview';

const MOBILE_BREAKPOINT = '(max-width: 820px)';
const LEFT_GESTURE_THRESHOLD = 48;
const SCROLL_DEAD_ZONE = 10;
const SCROLL_SPEED_PER_PIXEL = 0.13;
const MIN_SCROLL_SPEED = 1.1;
const MAX_SCROLL_SPEED = 58;

function editorView() {
  const editor = document.querySelector<HTMLElement>('.app-shell.mobile-editor .cm-editor');
  return editor ? EditorView.findFromDOM(editor) : null;
}

function previewPane() {
  return document.querySelector<HTMLElement>('.app-shell.mobile-preview .preview-pane');
}

function previewPosition(element: HTMLElement, scroller: HTMLElement) {
  return scroller.scrollTop + element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
}

function readPreviewOutline(scroller: HTMLElement): OutlineItem[] {
  return Array.from(scroller.querySelectorAll<HTMLElement>('.brew-preview h1, .brew-preview h2, .brew-preview h3, .brew-preview h4, .brew-preview h5, .brew-preview h6'))
    .map((heading, index) => ({
      id: heading.id || undefined,
      level: Number(heading.tagName.slice(1)),
      title: heading.textContent?.trim() || `Section ${index + 1}`,
      position: previewPosition(heading, scroller)
    }));
}

function contentScroller(mode: ContentMode | null, target: HTMLElement | null) {
  if (mode === 'editor') return editorView()?.scrollDOM ?? null;
  if (mode === 'preview') return previewPane();
  return target;
}

function readOutline(view: EditorView): OutlineItem[] {
  const source = view.state.doc.toString();
  const headings: OutlineItem[] = [];
  const expression = /^(#{1,6})\s+(.+?)\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(source))) {
    headings.push({
      level: match[1].length,
      title: match[2].replace(/\s+#+\s*$/, '').trim(),
      position: match.index
    });
  }

  return headings;
}

function closeWritingTools() {
  document.querySelector<HTMLButtonElement>('.mobile-outline-fab[aria-expanded="true"]')?.click();
}

export function MobileOutlineScrubber() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [contentMode, setContentMode] = useState<ContentMode | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activePosition, setActivePosition] = useState(0);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [viewport, setViewport] = useState(() => ({ top: 0, height: window.innerHeight }));
  const dragRef = useRef<DragState | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const outlineListRef = useRef<HTMLDivElement | null>(null);

  const activeIndex = useMemo(() => {
    let index = -1;
    outline.forEach((item, itemIndex) => {
      if (item.position <= activePosition) index = itemIndex;
    });
    return index;
  }, [activePosition, outline]);

  useEffect(() => {
    const refresh = () => {
      const mobile = window.matchMedia(MOBILE_BREAKPOINT).matches;
      const menu = mobile
        ? document.querySelector<HTMLElement>('.app-shell.mobile-editor .mobile-capture-menu')
        : null;
      const preview = mobile ? previewPane() : null;

      setTarget(menu ?? preview);
      setContentMode(menu ? 'editor' : preview ? 'preview' : null);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => {
      const visual = window.visualViewport;
      setViewport({
        top: Math.round(visual?.offsetTop ?? 0),
        height: Math.round(visual?.height ?? window.innerHeight)
      });
    };

    update();
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const scroller = contentScroller(contentMode, target);
    if (!scroller) return undefined;

    const updateScrollPercent = () => {
      const maximum = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      setScrollPercent(Math.round((scroller.scrollTop / maximum) * 100));
    };

    updateScrollPercent();
    scroller.addEventListener('scroll', updateScrollPercent, { passive: true });
    return () => scroller.removeEventListener('scroll', updateScrollPercent);
  }, [contentMode, target]);

  useEffect(() => {
    if (!outlineOpen) return undefined;

    const handleOutsidePointer = (event: PointerEvent) => {
      const node = event.target;
      if (!(node instanceof Node)) return;
      if (panelRef.current?.contains(node)) return;
      if (node instanceof Element && node.closest('.mobile-outline-scrubber')) return;
      setOutlineOpen(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [outlineOpen]);

  useEffect(() => {
    if (!outlineOpen || activeIndex < 0) return;
    const frame = window.requestAnimationFrame(() => {
      outlineListRef.current
        ?.querySelector<HTMLElement>('.is-current')
        ?.scrollIntoView({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, outlineOpen]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const openOutline = (continueGesture = false) => {
    if (contentMode === 'editor') {
      const view = editorView();
      if (!view) return;
      closeWritingTools();
      setOutline(readOutline(view));
      setActivePosition(view.state.selection.main.head);
    } else if (contentMode === 'preview') {
      const pane = previewPane();
      if (!pane) return;
      setOutline(readPreviewOutline(pane));
      setActivePosition(pane.scrollTop);
    } else {
      return;
    }
    setOutlineOpen(true);

    if (continueGesture) {
      const drag = dragRef.current;
      if (drag) {
        drag.mode = 'outline';
        drag.startY = drag.currentY;
        drag.moved = true;
      }
    }
  };

  const stopContinuousScroll = () => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  };

  const continueScrolling = () => {
    const drag = dragRef.current;
    if (!drag) {
      scrollFrameRef.current = null;
      return;
    }

    const vertical = drag.currentY - drag.startY;
    const distance = Math.abs(vertical) - SCROLL_DEAD_ZONE;
    const scroller = drag.mode === 'outline' ? outlineListRef.current : drag.contentScroller;

    if (distance > 0 && scroller) {
      const direction = Math.sign(vertical);
      // Keep the centre precise, then accelerate sharply as the pointer moves
      // farther from it. This makes long brews practical without losing the
      // ability to nudge through nearby headings.
      const speed = Math.min(MAX_SCROLL_SPEED, MIN_SCROLL_SPEED + Math.pow(distance, 1.38) * SCROLL_SPEED_PER_PIXEL);
      const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTop = Math.max(0, Math.min(maximum, scroller.scrollTop + direction * speed));
    }

    scrollFrameRef.current = window.requestAnimationFrame(continueScrolling);
  };

  const startContinuousScroll = () => {
    stopContinuousScroll();
    scrollFrameRef.current = window.requestAnimationFrame(continueScrolling);
  };

  const endDrag = () => {
    dragRef.current = null;
    stopContinuousScroll();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const scroller = contentScroller(contentMode, target);
    if (!scroller) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      moved: false,
      mode: outlineOpen ? 'outline' : 'content',
      contentScroller: scroller
    };
    startContinuousScroll();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();

    drag.currentX = event.clientX;
    drag.currentY = event.clientY;

    const horizontal = drag.currentX - drag.startX;
    const vertical = drag.currentY - drag.startY;

    if (
      drag.mode === 'content'
      && horizontal <= -LEFT_GESTURE_THRESHOLD
      && Math.abs(horizontal) > Math.abs(vertical)
    ) {
      openOutline(true);
      return;
    }

    if (Math.abs(vertical) >= 5 || Math.abs(horizontal) >= 5) drag.moved = true;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    endDrag();
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
    if (!moved) openOutline();
  };

  const handlePointerCancel = () => {
    endDrag();
  };

  const navigateTo = (item: OutlineItem) => {
    if (contentMode === 'editor') {
      const view = editorView();
      if (!view) return;
      view.dispatch({
        selection: { anchor: item.position },
        effects: EditorView.scrollIntoView(item.position, { y: 'start', yMargin: 28 })
      });
      view.focus();
    } else if (contentMode === 'preview') {
      const pane = previewPane();
      const heading = item.id ? document.getElementById(item.id) : null;
      if (!pane || !heading || !pane.contains(heading)) return;
      const next = previewPosition(heading, pane) - 18;
      pane.scrollTo({ behavior: 'smooth', top: Math.max(0, next) });
    } else {
      return;
    }
    setActivePosition(item.position);
    setOutlineOpen(false);
  };

  const scrubberTop = viewport.top + viewport.height / 2;

  return (
    <>
      {target && createPortal(
        <button
          aria-label="Scroll brew or drag left for outline"
          className="mobile-outline-scrubber"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ top: `${Math.round(scrubberTop)}px` }}
          title="Hold above or below to keep scrolling · drag left for outline"
          type="button"
        >
          <span aria-hidden="true">☰</span>
          <small>{scrollPercent}%</small>
        </button>,
        document.body
      )}

      {outlineOpen && createPortal(
        <>
          <button
            aria-label="Close outline"
            className="mobile-inline-outline-backdrop"
            onPointerDown={(event) => {
              event.preventDefault();
              setOutlineOpen(false);
            }}
            style={{ top: `${viewport.top}px`, height: `${viewport.height}px` }}
            type="button"
          />
          <section
            aria-label="Brew outline"
            className="mobile-inline-outline"
            ref={panelRef}
            style={{
              top: `${viewport.top + 10}px`,
              maxHeight: `${Math.max(180, viewport.height - 20)}px`
            }}
          >
            <header>
              <div>
                <strong>Outline</strong>
                <small>Hold to scroll · drag left for this outline</small>
              </div>
              <button onPointerDown={(event) => event.preventDefault()} onClick={() => setOutlineOpen(false)} type="button">Close</button>
            </header>
            <div className="mobile-inline-outline-list" ref={outlineListRef}>
              {outline.map((item, index) => (
                <button
                  className={index === activeIndex ? 'is-current' : ''}
                  key={`${item.position}-${item.title}`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => navigateTo(item)}
                  style={{ paddingLeft: `${12 + Math.max(0, item.level - 1) * 12}px` }}
                  type="button"
                >
                  {item.title}
                </button>
              ))}
              {!outline.length && <p>No headings in this brew yet.</p>}
            </div>
          </section>
        </>,
        document.body
      )}
    </>
  );
}
