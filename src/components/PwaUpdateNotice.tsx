import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PWA_UPDATE_CHECK_EVENT = 'homebrewry-check-pwa-update';

export function checkForPwaUpdate() {
  window.dispatchEvent(new Event(PWA_UPDATE_CHECK_EVENT));
}

export function PwaUpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({ immediate: true });
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const messageTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
  }, []);

  useEffect(() => {
    const showMessage = (message: string) => {
      setCheckMessage(message);
      if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
      messageTimer.current = window.setTimeout(() => setCheckMessage(null), 4000);
    };

    const check = async () => {
      if (!('serviceWorker' in navigator)) {
        showMessage('Updates are unavailable in this browser.');
        return;
      }

      setChecking(true);
      setCheckMessage(null);
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          showMessage('The app is not installed yet. Open it again in a moment.');
          return;
        }
        await registration.update();
        if (registration.waiting) {
          setNeedRefresh(true);
        } else {
          showMessage('Homebrewry is up to date.');
        }
      } catch {
        showMessage('Could not check for updates. Try again shortly.');
      } finally {
        setChecking(false);
      }
    };

    window.addEventListener(PWA_UPDATE_CHECK_EVENT, check);
    return () => window.removeEventListener(PWA_UPDATE_CHECK_EVENT, check);
  }, [setNeedRefresh]);

  if (!needRefresh && !checking && !checkMessage) return null;

  return (
    <div className="pwa-update-notice" role="status">
      {needRefresh ? (
        <>
          <span>A new version of Homebrewry is ready.</span>
          <button onClick={() => { void updateServiceWorker(true); }} type="button">Update now</button>
          <button aria-label="Dismiss update notice" className="pwa-update-dismiss" onClick={() => setNeedRefresh(false)} type="button">×</button>
        </>
      ) : (
        <><span>{checking ? 'Checking for updates…' : checkMessage}</span><button aria-label="Dismiss update notice" className="pwa-update-dismiss" onClick={() => setCheckMessage(null)} type="button">×</button></>
      )}
    </div>
  );
}
