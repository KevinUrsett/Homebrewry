import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const MOBILE_EDITOR_QUERY = '(max-width: 820px)';
const LAUNCHER_SIZE = 58;
const LAUNCHER_MARGIN = 14;

function findMobileNavButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-nav button')]
    .find((button) => button.textContent?.trim() === label) ?? null;
}

function findOriginalLauncher() {
  return document.querySelector<HTMLButtonElement>('.app-shell.mobile-editor .mobile-outline-fab');
}

function closeKeyboard() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export function MobileWritingMode() {
  const [appTarget, setAppTarget] = useState<HTMLElement | null>(null);
  const [sheetTarget, setSheetTarget] = useState<HTMLElement | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [launcherTop, setLauncherTop] = useState<number | null>(null);

  useEffect(() => {
    const updateLauncherPosition = () => {
      const viewport = window.visualViewport;
      const top = (viewport?.offsetTop ?? 0)
        + (viewport?.height ?? window.innerHeight)
        - LAUNCHER_SIZE
        - LAUNCHER_MARGIN;
      setLauncherTop(Math.max(LAUNCHER_MARGIN, Math.round(top)));
    };

    const refresh = () => {
      const mobile = window.matchMedia(MOBILE_EDITOR_QUERY).matches;
      const app = mobile ? document.querySelector<HTMLElement>('.app-shell.mobile-editor') : null;
      const sheet = app?.querySelector<HTMLElement>('.mobile-writing-tools') ?? null;
      const originalLauncher = app ? findOriginalLauncher() : null;
      const open = mobile && document.documentElement.classList.contains('mobile-keyboard-open');

      setAppTarget(app);
      setSheetTarget(sheet);
      setKeyboardOpen(open);
      setMenuOpen(originalLauncher?.getAttribute('aria-expanded') === 'true');
      document.documentElement.classList.toggle('mobile-writing-sheet-open', Boolean(sheet));
      updateLauncherPosition();
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'aria-expanded'],
      childList: true,
      subtree: true
    });
    window.addEventListener('resize', refresh);
    window.visualViewport?.addEventListener('resize', updateLauncherPosition);
    window.visualViewport?.addEventListener('scroll', updateLauncherPosition);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
      window.visualViewport?.removeEventListener('resize', updateLauncherPosition);
      window.visualViewport?.removeEventListener('scroll', updateLauncherPosition);
      document.documentElement.classList.remove('mobile-writing-sheet-open');
    };
  }, []);

  const openSection = (label: 'Brews' | 'Preview' | 'Outline') => {
    closeKeyboard();
    findMobileNavButton(label)?.click();
  };

  const toggleSheet = () => {
    findOriginalLauncher()?.click();
  };

  const closeSheet = () => {
    if (findOriginalLauncher()?.getAttribute('aria-expanded') === 'true') toggleSheet();
  };

  return (
    <>
      {appTarget && keyboardOpen && createPortal(
        <nav className="mobile-typing-nav" aria-label="Typing controls">
          <button onClick={() => openSection('Brews')} type="button">Brews</button>
          <button onClick={() => openSection('Preview')} type="button">Preview</button>
          <button onClick={() => openSection('Outline')} type="button">Outline</button>
          <button className="mobile-typing-done" onClick={closeKeyboard} type="button">Done</button>
        </nav>,
        appTarget
      )}

      {appTarget && launcherTop !== null && !menuOpen && createPortal(
        <button
          aria-label="Open writing tools"
          className="mobile-writing-launcher"
          onClick={toggleSheet}
          style={{ top: `${launcherTop}px` }}
          type="button"
        >
          +
        </button>,
        document.body
      )}

      {appTarget && sheetTarget && createPortal(
        <button
          aria-label="Close writing tools"
          className="mobile-writing-sheet-backdrop"
          onClick={closeSheet}
          type="button"
        />,
        appTarget
      )}

      {sheetTarget && createPortal(
        <div className="mobile-writing-sheet-header">
          <strong>Writing tools</strong>
          <button onClick={closeSheet} type="button">Close</button>
        </div>,
        sheetTarget
      )}
    </>
  );
}
