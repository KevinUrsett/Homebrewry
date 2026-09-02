import { useEffect, useRef } from 'react';
import { clickMobileNav, getActiveBrewId, getMobileSection } from '../lib/mobileEditorState';

type MobileLocation = {
  section: string;
  brewId: string | null;
  itemKey: string | null;
};

const sectionLabels: Record<string, string> = {
  library: 'Brews',
  editor: 'Edit',
  preview: 'Preview',
  outline: 'Outline',
  catalogue: 'Catalogue',
  campaign: 'Campaign',
  encounters: 'Encounters',
  worldbuilding: 'Worldbuilding'
};

const MOBILE_BREAKPOINT = '(max-width: 820px)';
const EDGE_SWIPE_WIDTH = 36;
const SWIPE_DISTANCE = 64;

type SwipeStart = {
  pointerId: number;
  x: number;
  y: number;
};

function isGestureBlocked(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest([
    'input',
    'textarea',
    'select',
    'button',
    'a',
    '[contenteditable="true"]',
    '.cm-editor',
    '.cm-scroller',
    '[role="dialog"]',
    '[aria-modal="true"]',
    '.mobile-tools-sheet',
    '.cloud-menu-panel',
    '.reference-menu',
    '.plot-board-scroll',
    '.campaign-mindmap-viewport',
    '.maps-canvas',
    '.dungeon-map-canvas'
  ].join(',')));
}

function selectedItemKey(section: string) {
  if (section === 'encounters') {
    return document.querySelector<HTMLElement>('.encounter-list-item.is-selected strong')?.textContent?.trim() ?? null;
  }
  if (section === 'worldbuilding') {
    return document.querySelector<HTMLElement>('.worldbuilding-list-item.is-selected strong')?.textContent?.trim() ?? null;
  }
  if (section === 'catalogue') {
    const selected = document.querySelector<HTMLElement>('.catalogue-result.is-selected');
    if (!selected) return null;
    const name = selected.querySelector('strong')?.textContent?.trim() ?? '';
    const category = selected.querySelector('span')?.textContent?.trim() ?? '';
    return `${name}\u0000${category}`;
  }
  return null;
}

function readLocation(): MobileLocation | null {
  const section = getMobileSection();
  if (!section) return null;
  return {
    section,
    brewId: getActiveBrewId(),
    itemKey: selectedItemKey(section)
  };
}

function sameLocation(left: MobileLocation | null, right: MobileLocation | null) {
  return Boolean(left && right && left.section === right.section && left.brewId === right.brewId && left.itemKey === right.itemKey);
}

function clickItem(location: MobileLocation) {
  if (!location.itemKey) return;

  if (location.section === 'encounters') {
    [...document.querySelectorAll<HTMLButtonElement>('.encounter-list-item')]
      .find((button) => button.querySelector('strong')?.textContent?.trim() === location.itemKey)
      ?.click();
    return;
  }

  if (location.section === 'worldbuilding') {
    [...document.querySelectorAll<HTMLButtonElement>('.worldbuilding-list-item')]
      .find((button) => button.querySelector('strong')?.textContent?.trim() === location.itemKey)
      ?.click();
    return;
  }

  if (location.section === 'catalogue') {
    const [name, category] = location.itemKey.split('\u0000');
    [...document.querySelectorAll<HTMLButtonElement>('.catalogue-result')]
      .find((button) => button.querySelector('strong')?.textContent?.trim() === name && button.querySelector('span')?.textContent?.trim() === category)
      ?.click();
  }
}

export function MobileNavigationHistory() {
  const entriesRef = useRef<MobileLocation[]>([]);
  const indexRef = useRef(-1);
  const replayingRef = useRef(false);
  const swipeStartRef = useRef<SwipeStart | null>(null);

  useEffect(() => {
    const rememberInitial = () => {
      if (indexRef.current >= 0) return;
      const initial = readLocation();
      if (!initial) return;
      entriesRef.current = [initial];
      indexRef.current = 0;
    };

    rememberInitial();
    const observer = new MutationObserver(rememberInitial);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });

    const record = () => {
      if (replayingRef.current) return;
      rememberInitial();
      const location = readLocation();
      const current = entriesRef.current[indexRef.current] ?? null;
      if (!location || sameLocation(location, current)) return;
      entriesRef.current = [...entriesRef.current.slice(0, indexRef.current + 1), location].slice(-60);
      indexRef.current = entriesRef.current.length - 1;
    };

    const handleClick = (event: MouseEvent) => {
      const element = event.target;
      if (!(element instanceof Element) || element.closest('.mobile-history-controls')) return;
      window.setTimeout(record, 70);
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  const replay = (location: MobileLocation) => {
    replayingRef.current = true;

    const openTargetSection = () => {
      clickMobileNav(sectionLabels[location.section] ?? 'Edit');
      window.setTimeout(() => {
        clickItem(location);
        window.setTimeout(() => {
          replayingRef.current = false;
        }, 90);
      }, 70);
    };

    if (location.brewId) {
      clickMobileNav('Edit');
      window.setTimeout(() => {
        document.querySelector<HTMLButtonElement>(`.brew-list-item[data-brew-id="${CSS.escape(location.brewId!)}"]`)?.click();
        window.setTimeout(openTargetSection, 70);
      }, 70);
      return;
    }

    openTargetSection();
  };

  const goBack = () => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    const location = entriesRef.current[indexRef.current];
    replay(location);
  };

  const goForward = () => {
    if (indexRef.current >= entriesRef.current.length - 1) return;
    indexRef.current += 1;
    const location = entriesRef.current[indexRef.current];
    replay(location);
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!window.matchMedia(MOBILE_BREAKPOINT).matches || event.pointerType !== 'touch' || !event.isPrimary || isGestureBlocked(event.target)) {
        swipeStartRef.current = null;
        return;
      }

      const fromLeft = event.clientX <= EDGE_SWIPE_WIDTH;
      const fromRight = event.clientX >= window.innerWidth - EDGE_SWIPE_WIDTH;
      swipeStartRef.current = fromLeft || fromRight
        ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
        : null;
    };

    const onPointerUp = (event: PointerEvent) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start || start.pointerId !== event.pointerId || event.pointerType !== 'touch') return;

      const horizontal = event.clientX - start.x;
      const vertical = event.clientY - start.y;
      if (Math.abs(horizontal) < SWIPE_DISTANCE || Math.abs(horizontal) <= Math.abs(vertical)) return;

      if (start.x <= EDGE_SWIPE_WIDTH && horizontal > 0) goBack();
      if (start.x >= window.innerWidth - EDGE_SWIPE_WIDTH && horizontal < 0) goForward();
    };

    const clearSwipe = () => { swipeStartRef.current = null; };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', clearSwipe, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', clearSwipe, true);
    };
  });

  return null;
}
