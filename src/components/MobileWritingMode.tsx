import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const MOBILE_EDITOR_QUERY = '(max-width: 820px)';

function findMobileNavButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-nav button')]
    .find((button) => button.textContent?.trim() === label) ?? null;
}

function closeKeyboard() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export function MobileWritingMode() {
  const [appTarget, setAppTarget] = useState<HTMLElement | null>(null);
  const [sheetTarget, setSheetTarget] = useState<HTMLElement | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const mobile = window.matchMedia(MOBILE_EDITOR_QUERY).matches;
      const app = mobile ? document.querySelector<HTMLElement>('.app-shell.mobile-editor') : null;
      const sheet = app?.querySelector<HTMLElement>('.mobile-writing-tools') ?? null;
      const open = mobile && document.documentElement.classList.contains('mobile-keyboard-open');

      setAppTarget(app);
      setSheetTarget(sheet);
      setKeyboardOpen(open);
      document.documentElement.classList.toggle('mobile-writing-sheet-open', Boolean(sheet));
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
    window.addEventListener('resize', refresh);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
      document.documentElement.classList.remove('mobile-writing-sheet-open');
    };
  }, []);

  const openSection = (label: 'Brews' | 'Preview' | 'Outline') => {
    closeKeyboard();
    findMobileNavButton(label)?.click();
  };

  const closeSheet = () => {
    document.querySelector<HTMLButtonElement>('.mobile-outline-fab[aria-expanded="true"]')?.click();
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
