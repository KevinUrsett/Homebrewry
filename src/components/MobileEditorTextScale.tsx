import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type EditorTextScale = 1 | 0.5 | 0.2;

const storageKey = 'homebrewry-mobile-editor-text-scale';
const scaleOptions: readonly EditorTextScale[] = [1, 0.5, 0.2];

function readSavedScale(): EditorTextScale {
  if (typeof window === 'undefined') return 1;
  try {
    const saved = Number(window.localStorage.getItem(storageKey));
    return scaleOptions.includes(saved as EditorTextScale) ? saved as EditorTextScale : 1;
  } catch {
    return 1;
  }
}

function applyScale(scale: EditorTextScale) {
  document.documentElement.style.setProperty('--mobile-editor-font-size', `${16 * scale}px`);
}

export function MobileEditorTextScale() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState<EditorTextScale>(readSavedScale);

  useEffect(() => {
    applyScale(scale);
    try {
      window.localStorage.setItem(storageKey, String(scale));
    } catch {
      // The display preference can remain session-only if storage is unavailable.
    }
  }, [scale]);

  useEffect(() => {
    const refreshTarget = () => {
      setTarget(document.querySelector<HTMLElement>('.mobile-writing-tools'));
    };

    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  const chooseScale = (next: EditorTextScale) => {
    setScale(next);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('.mobile-outline-fab[aria-expanded="true"]')?.click();
    });
  };

  return createPortal(
    <div className="mobile-writing-tool-group mobile-editor-text-size" aria-label="Editor text size">
      <span className="mobile-editor-text-size-label">Text size</span>
      {scaleOptions.map((option) => (
        <button
          aria-pressed={scale === option}
          key={option}
          onClick={() => chooseScale(option)}
          type="button"
        >
          {Math.round(option * 100)}%
        </button>
      ))}
    </div>,
    target
  );
}
