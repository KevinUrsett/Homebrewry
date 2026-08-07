import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [version, setVersion] = useState(0);
  const entriesRef = useRef<MobileLocation[]>([]);
  const indexRef = useRef(-1);
  const replayingRef = useRef(false);

  useEffect(() => {
    const findTarget = () => setTarget(document.querySelector<HTMLElement>('.mobile-nav'));
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const initial = readLocation();
    if (initial) {
      entriesRef.current = [initial];
      indexRef.current = 0;
      setVersion((value) => value + 1);
    }

    const record = () => {
      if (replayingRef.current) return;
      const location = readLocation();
      const current = entriesRef.current[indexRef.current] ?? null;
      if (!location || sameLocation(location, current)) return;
      entriesRef.current = [...entriesRef.current.slice(0, indexRef.current + 1), location].slice(-60);
      indexRef.current = entriesRef.current.length - 1;
      setVersion((value) => value + 1);
    };

    const handleClick = (event: MouseEvent) => {
      const element = event.target;
      if (!(element instanceof Element) || element.closest('.mobile-history-controls')) return;
      window.setTimeout(record, 70);
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
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
    setVersion((value) => value + 1);
    replay(location);
  };

  const goForward = () => {
    if (indexRef.current >= entriesRef.current.length - 1) return;
    indexRef.current += 1;
    const location = entriesRef.current[indexRef.current];
    setVersion((value) => value + 1);
    replay(location);
  };

  if (!target) return null;
  void version;

  return createPortal(
    <span className="mobile-history-controls" aria-label="Navigation history">
      <button aria-label="Back" disabled={indexRef.current <= 0} onClick={goBack} type="button">‹</button>
      <button aria-label="Forward" disabled={indexRef.current >= entriesRef.current.length - 1} onClick={goForward} type="button">›</button>
    </span>,
    target
  );
}
