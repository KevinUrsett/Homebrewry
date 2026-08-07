import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getActiveBrewId, getActiveBrewTitle, getEditorView, closeMobileCaptureMenu } from '../lib/mobileEditorState';
import { listBrewRevisions, saveBrewRevision, type BrewRevision } from '../lib/revisionStore';

const minimumAutomaticRevisionGap = 2 * 60 * 1000;
const idleSnapshotDelay = 30 * 1000;

function formatRevisionTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function MobileRevisionHistory() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<BrewRevision[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const lastSnapshotAt = useRef<Record<string, number>>({});
  const idleTimer = useRef<number | null>(null);

  const loadRevisions = async () => {
    const brewId = getActiveBrewId();
    if (!brewId) {
      setRevisions([]);
      return;
    }
    try {
      setRevisions(await listBrewRevisions(brewId));
    } catch {
      setRevisions([]);
    }
  };

  const snapshotCurrent = async (force = false) => {
    const brewId = getActiveBrewId();
    const view = getEditorView();
    if (!brewId || !view) return;

    const now = Date.now();
    if (!force && now - (lastSnapshotAt.current[brewId] ?? 0) < minimumAutomaticRevisionGap) return;

    const content = view.state.doc.toString();
    const existing = await listBrewRevisions(brewId).catch(() => []);
    if (existing[0]?.content === content) {
      lastSnapshotAt.current[brewId] = now;
      return;
    }

    await saveBrewRevision({
      id: crypto.randomUUID(),
      brewId,
      title: getActiveBrewTitle(),
      content,
      createdAt: new Date(now).toISOString()
    }).catch(() => undefined);
    lastSnapshotAt.current[brewId] = now;
    if (open) void loadRevisions();
  };

  useEffect(() => {
    const refreshTarget = () => setTarget(document.querySelector<HTMLElement>('.mobile-writing-tools'));
    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scheduleIdleSnapshot = (event: Event) => {
      const element = event.target;
      if (!(element instanceof Element) || !element.closest('.cm-editor')) return;
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        idleTimer.current = null;
        void snapshotCurrent();
      }, idleSnapshotDelay);
    };

    const snapshotBeforeBrewSwitch = (event: PointerEvent) => {
      const element = event.target;
      if (!(element instanceof Element) || !element.closest('.brew-list-item:not(.is-active)')) return;
      void snapshotCurrent(true);
    };

    const snapshotOnHide = () => {
      if (document.visibilityState === 'hidden') void snapshotCurrent(true);
    };

    document.addEventListener('input', scheduleIdleSnapshot, true);
    document.addEventListener('pointerdown', snapshotBeforeBrewSwitch, true);
    document.addEventListener('visibilitychange', snapshotOnHide);
    return () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      document.removeEventListener('input', scheduleIdleSnapshot, true);
      document.removeEventListener('pointerdown', snapshotBeforeBrewSwitch, true);
      document.removeEventListener('visibilitychange', snapshotOnHide);
    };
  }, [open]);

  const openHistory = () => {
    void snapshotCurrent(true).then(loadRevisions);
    setOpen(true);
  };

  const restoreAsCopy = async (revision: BrewRevision) => {
    const oldBrewId = getActiveBrewId();
    if (!oldBrewId) return;
    setWorkingId(revision.id);

    const duplicate = [...document.querySelectorAll<HTMLButtonElement>('.library-actions button')]
      .find((button) => button.textContent?.trim() === 'Duplicate');
    duplicate?.click();

    const apply = (attempts: number) => {
      const newBrewId = getActiveBrewId();
      const view = getEditorView();
      if ((!newBrewId || newBrewId === oldBrewId || !view) && attempts > 0) {
        window.setTimeout(() => apply(attempts - 1), 55);
        return;
      }
      if (!newBrewId || newBrewId === oldBrewId || !view) {
        setWorkingId(null);
        return;
      }

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: revision.content },
        selection: { anchor: 0 }
      });
      const titleInput = document.querySelector<HTMLInputElement>('.title-input');
      if (titleInput) setNativeInputValue(titleInput, `${revision.title} — restored`);

      window.requestAnimationFrame(() => view.focus());
      setOpen(false);
      setWorkingId(null);
      closeMobileCaptureMenu();
    };

    window.setTimeout(() => apply(12), 60);
  };

  return (
    <>
      {target && createPortal(
        <div className="mobile-writing-tool-group mobile-revision-tools" aria-label="Revision history">
          <button onClick={openHistory} type="button">History</button>
        </div>,
        target
      )}
      {open && createPortal(
        <div className="mobile-revision-backdrop" onClick={() => setOpen(false)} role="presentation">
          <section aria-label="Local revision history" className="mobile-revision-sheet" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><strong>Revision history</strong><small>Stored only on this device. Restoring always creates a new brew copy.</small></div>
              <button onClick={() => setOpen(false)} type="button">Close</button>
            </header>
            <div className="mobile-revision-list">
              {!revisions.length && <p>No earlier revisions yet. Homebrewry captures changes after periods of editing and when you leave a brew.</p>}
              {revisions.map((revision) => (
                <article key={revision.id}>
                  <div><strong>{formatRevisionTime(revision.createdAt)}</strong><small>{revision.content.length.toLocaleString()} characters</small></div>
                  <button disabled={workingId !== null} onClick={() => void restoreAsCopy(revision)} type="button">{workingId === revision.id ? 'Restoring…' : 'Restore as copy'}</button>
                </article>
              ))}
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
