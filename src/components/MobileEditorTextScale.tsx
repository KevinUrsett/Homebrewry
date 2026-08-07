import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const storageKey = 'homebrewry-mobile-editor-text-scale';
const minScale = 0.7;
const maxScale = 1.3;
const step = 0.05;

function clampScale(value: number) {
  return Math.min(maxScale, Math.max(minScale, value));
}

function readSavedScale() {
  if (typeof window === 'undefined') return 1;
  try {
    const saved = Number(window.localStorage.getItem(storageKey));
    if (!Number.isFinite(saved) || saved < minScale || saved > maxScale) return 1;
    return clampScale(saved);
  } catch {
    return 1;
  }
}

function applyScale(scale: number) {
  document.documentElement.style.setProperty('--mobile-editor-font-size', `${16 * scale}px`);
}

export function MobileEditorTextScale() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(readSavedScale);

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

  const percentage = Math.round(scale * 100);

  return createPortal(
    <div className="mobile-editor-text-size" aria-label="Editor text size">
      <div className="mobile-editor-text-size-heading">
        <span>Text size</span>
        <strong>{percentage}%</strong>
      </div>
      <input
        aria-label="Editor text size"
        max={maxScale}
        min={minScale}
        onChange={(event) => setScale(clampScale(Number(event.target.value)))}
        step={step}
        type="range"
        value={scale}
      />
      <div className="mobile-editor-text-size-range" aria-hidden>
        <span>70%</span>
        <span>100%</span>
        <span>130%</span>
      </div>
    </div>,
    target
  );
}
