import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PWA_UPDATE_CHECK_EVENT = 'homebrewry-check-pwa-update';
const STARTUP_UPDATE_WINDOW_MS = 30_000;
const FOCUS_UPDATE_INTERVAL_MS = 5 * 60_000;
const PERIODIC_UPDATE_INTERVAL_MS = 60 * 60_000;

async function refreshServiceWorker(registration: ServiceWorkerRegistration, scriptUrl?: string): Promise<void> {
  if (registration.installing || !navigator.onLine) return;
  if (scriptUrl) {
    const response = await fetch(scriptUrl, {
      cache: 'no-store',
      headers: { cache: 'no-store', 'cache-control': 'no-cache' }
    });
    if (!response.ok) throw new Error(`Update check failed with ${response.status}.`);
  }
  await registration.update();
}

export function checkForPwaUpdate() {
  window.dispatchEvent(new Event(PWA_UPDATE_CHECK_EVENT));
}

export function PwaUpdateNotice() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const scriptUrlRef = useRef<string | null>(null);
  const startupDeadlineRef = useRef(0);
  const userInteractedRef = useRef(false);
  const manualApplyRef = useRef(false);
  const checkInFlightRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(scriptUrl, registration) {
      scriptUrlRef.current = scriptUrl;
      registrationRef.current = registration ?? null;
      if (!registration) return;
      lastCheckAtRef.current = Date.now();
      void refreshServiceWorker(registration, scriptUrl).catch(() => undefined);
    }
  });
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const messageTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
  }, []);

  useEffect(() => {
    startupDeadlineRef.current = Date.now() + STARTUP_UPDATE_WINDOW_MS;
    const markInteraction = () => {
      userInteractedRef.current = true;
    };
    window.addEventListener('pointerdown', markInteraction, { once: true });
    window.addEventListener('keydown', markInteraction, { once: true });
    window.addEventListener('input', markInteraction, { once: true });
    return () => {
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('input', markInteraction);
    };
  }, []);

  useEffect(() => {
    if (!needRefresh || applying) return;
    const canApplyWithoutPrompt = manualApplyRef.current
      || (startupDeadlineRef.current > 0 && !userInteractedRef.current && Date.now() <= startupDeadlineRef.current);
    if (!canApplyWithoutPrompt) return;
    manualApplyRef.current = false;
    void Promise.resolve().then(async () => {
      setApplying(true);
      setCheckMessage('Applying the latest Homebrewry update…');
      try {
        await updateServiceWorker(true);
      } catch {
        setApplying(false);
        setCheckMessage('Could not apply the update. Try again shortly.');
      }
    });
  }, [applying, needRefresh, updateServiceWorker]);

  useEffect(() => {
    const showMessage = (message: string) => {
      setCheckMessage(message);
      if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
      messageTimer.current = window.setTimeout(() => setCheckMessage(null), 4000);
    };

    const getRegistration = async () => {
      const registration = registrationRef.current ?? await navigator.serviceWorker.getRegistration();
      if (registration) registrationRef.current = registration;
      return registration;
    };

    const check = async (manual: boolean) => {
      if (!('serviceWorker' in navigator)) {
        if (manual) showMessage('Updates are unavailable in this browser.');
        return;
      }
      if (checkInFlightRef.current) return;

      checkInFlightRef.current = true;
      if (manual) {
        manualApplyRef.current = true;
        setChecking(true);
        setCheckMessage(null);
      }
      try {
        const registration = await getRegistration();
        if (!registration) {
          if (manual) showMessage('The app is not installed yet. Open it again in a moment.');
          return;
        }
        await refreshServiceWorker(registration, scriptUrlRef.current ?? registration.active?.scriptURL);
        lastCheckAtRef.current = Date.now();
        if (registration.waiting) {
          setNeedRefresh(true);
        } else if (manual && !registration.installing) {
          manualApplyRef.current = false;
          showMessage('Homebrewry is up to date.');
        }
      } catch {
        manualApplyRef.current = false;
        if (manual) showMessage('Could not check for updates. Try again shortly.');
      } finally {
        checkInFlightRef.current = false;
        if (manual) setChecking(false);
      }
    };

    const manualCheck = () => void check(true);
    const checkAfterReturn = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastCheckAtRef.current < FOCUS_UPDATE_INTERVAL_MS) return;
      void check(false);
    };
    const interval = window.setInterval(() => void check(false), PERIODIC_UPDATE_INTERVAL_MS);
    window.addEventListener(PWA_UPDATE_CHECK_EVENT, manualCheck);
    window.addEventListener('focus', checkAfterReturn);
    document.addEventListener('visibilitychange', checkAfterReturn);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PWA_UPDATE_CHECK_EVENT, manualCheck);
      window.removeEventListener('focus', checkAfterReturn);
      document.removeEventListener('visibilitychange', checkAfterReturn);
    };
  }, [setNeedRefresh]);

  if (!needRefresh && !checking && !applying && !checkMessage) return null;

  return (
    <div className="pwa-update-notice" role="status">
      {applying ? (
        <span>Applying the latest Homebrewry update…</span>
      ) : needRefresh ? (
        <>
          <span>A new version of Homebrewry is ready.</span>
          <button onClick={() => {
            manualApplyRef.current = true;
            setApplying(true);
            void updateServiceWorker(true).catch(() => {
              setApplying(false);
              setCheckMessage('Could not apply the update. Try again shortly.');
            });
          }} type="button">Update now</button>
          <button aria-label="Dismiss update notice" className="pwa-update-dismiss" onClick={() => setNeedRefresh(false)} type="button">×</button>
        </>
      ) : (
        <><span>{checking ? 'Checking for updates…' : checkMessage}</span><button aria-label="Dismiss update notice" className="pwa-update-dismiss" onClick={() => setCheckMessage(null)} type="button">×</button></>
      )}
    </div>
  );
}
