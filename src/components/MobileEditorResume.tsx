import { useEffect } from 'react';
import { getActiveBrewId, getEditorView, getMobileSection } from '../lib/mobileEditorState';

type ResumeState = {
  cursor: number;
  editorScrollTop: number;
  previewScrollTop: number;
};

type ResumeMap = Record<string, ResumeState>;

const storageKey = 'homebrewry-mobile-editor-resume-v1';

function readState(): ResumeMap {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed as ResumeMap : {};
  } catch {
    return {};
  }
}

function writeState(state: ResumeMap) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Resume position is a convenience only.
  }
}

export function MobileEditorResume() {
  useEffect(() => {
    let state = readState();
    let currentId = getActiveBrewId();
    let lastSection = getMobileSection();
    let saveTimer: number | null = null;
    let restoreToken = 0;

    const scheduleWrite = () => {
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        writeState(state);
      }, 180);
    };

    const saveCurrent = () => {
      const brewId = getActiveBrewId() ?? currentId;
      if (!brewId) return;
      const view = getEditorView();
      const previous = state[brewId] ?? { cursor: 0, editorScrollTop: 0, previewScrollTop: 0 };
      const preview = document.querySelector<HTMLElement>('.preview-pane');
      state = {
        ...state,
        [brewId]: {
          cursor: view?.state.selection.main.head ?? previous.cursor,
          editorScrollTop: view?.scrollDOM.scrollTop ?? previous.editorScrollTop,
          previewScrollTop: preview?.scrollTop ?? previous.previewScrollTop
        }
      };
      scheduleWrite();
    };

    const restoreEditor = (brewId: string) => {
      const saved = state[brewId];
      if (!saved) return;
      const token = ++restoreToken;
      const attempt = (remaining: number) => {
        if (token !== restoreToken || getActiveBrewId() !== brewId) return;
        const view = getEditorView();
        if (!view) {
          if (remaining > 0) window.setTimeout(() => attempt(remaining - 1), 55);
          return;
        }
        const cursor = Math.max(0, Math.min(saved.cursor, view.state.doc.length));
        view.dispatch({ selection: { anchor: cursor } });
        window.requestAnimationFrame(() => {
          if (token !== restoreToken) return;
          view.scrollDOM.scrollTop = Math.max(0, Math.min(saved.editorScrollTop, view.scrollDOM.scrollHeight));
        });
      };
      window.setTimeout(() => attempt(7), 35);
    };

    const restorePreview = (brewId: string) => {
      const saved = state[brewId];
      if (!saved) return;
      const pane = document.querySelector<HTMLElement>('.preview-pane');
      if (!pane) return;
      window.requestAnimationFrame(() => {
        pane.scrollTop = Math.max(0, Math.min(saved.previewScrollTop, pane.scrollHeight));
      });
    };

    const refresh = () => {
      const nextId = getActiveBrewId();
      const nextSection = getMobileSection();
      const brewChanged = Boolean(nextId && nextId !== currentId);

      if (brewChanged) {
        currentId = nextId;
        restoreEditor(nextId!);
        if (nextSection === 'preview') restorePreview(nextId!);
      }

      lastSection = nextSection;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.brew-list-item:not(.is-active)')) saveCurrent();
    };

    const handleEditorActivity = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.cm-editor') || target.closest('.cm-scroller')) saveCurrent();
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.matches('.cm-scroller') || target.matches('.preview-pane')) saveCurrent();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrent();
        writeState(state);
      }
    };

    currentId && restoreEditor(currentId);

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handleEditorActivity, true);
    document.addEventListener('keyup', handleEditorActivity, true);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      saveCurrent();
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      writeState(state);
      observer.disconnect();
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointerup', handleEditorActivity, true);
      document.removeEventListener('keyup', handleEditorActivity, true);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('visibilitychange', handleVisibility);
      void lastSection;
    };
  }, []);

  return null;
}
