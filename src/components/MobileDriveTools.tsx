import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DRIVE_AUTH_EXPIRED_EVENT,
  getDriveAccessToken,
  isGoogleConfigured,
  requestDriveAccess
} from '../lib/googleIdentity';
import { isLocalPreviewMode } from '../lib/runtimeMode';

function getAppDriveButton() {
  return [...document.querySelectorAll<HTMLButtonElement>('.cloud-controls > button')]
    .find((button) => button.getAttribute('aria-label') !== 'Login or re-login to Google Drive') ?? null;
}

function getAppStatus() {
  return document.querySelector<HTMLElement>('.save-indicator');
}

export function MobileDriveTools() {
  const previewMode = isLocalPreviewMode();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [working, setWorking] = useState(false);
  const [connected, setConnected] = useState(() => !previewMode && Boolean(getDriveAccessToken()));
  const [detail, setDetail] = useState(previewMode ? 'Drive actions are available on production.' : 'Log in to save this brew to Drive.');

  useEffect(() => {
    const refresh = () => {
      setTarget(document.querySelector<HTMLElement>('.mobile-writing-tools'));
      setConnected(!previewMode && Boolean(getDriveAccessToken()) && Boolean(getAppDriveButton()?.textContent?.includes('sync')));
      const appStatus = getAppStatus()?.textContent?.trim();
      if (!appStatus) return;
      setWorking(/connecting|saving|syncing/i.test(appStatus));
      if (!/saving locally/i.test(appStatus)) setDetail(appStatus);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [previewMode]);

  useEffect(() => {
    const handleExpired = () => {
      setConnected(false);
      setWorking(false);
      setDetail('The Drive login expired. Log in again.');
    };
    window.addEventListener(DRIVE_AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(DRIVE_AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const login = async () => {
    if (working || previewMode) return;
    setWorking(true);
    setDetail('Opening Google login…');
    try {
      await requestDriveAccess({ force: true });
      setConnected(true);
      setDetail('Drive login accepted. Connecting the workspace…');
      const appButton = getAppDriveButton();
      if (appButton && !appButton.textContent?.includes('sync')) appButton.click();
    } catch (error) {
      setConnected(false);
      setWorking(false);
      setDetail(error instanceof Error ? error.message : 'Google Drive login failed.');
    }
  };

  const saveToDrive = () => {
    if (working || previewMode) return;
    const appButton = getAppDriveButton();
    if (!getDriveAccessToken() || !appButton?.textContent?.includes('sync')) {
      setConnected(false);
      setDetail('Log in to Drive before saving.');
      return;
    }
    setWorking(true);
    setDetail('Saving changes to Google Drive…');
    appButton.click();
  };

  if (!target) return null;

  return createPortal(
    <div className="mobile-writing-tool-group mobile-drive-tools" aria-label="Google Drive">
      <button
        disabled={working || previewMode || !isGoogleConfigured()}
        onClick={() => void login()}
        type="button"
      >
        {connected ? 'Re-login Drive' : 'Login Drive'}
      </button>
      <button
        className="mobile-drive-save"
        disabled={working || previewMode || !connected}
        onClick={saveToDrive}
        type="button"
      >
        {working ? 'Saving…' : 'Save to Drive'}
      </button>
      <span className="mobile-drive-detail" aria-live="polite">{detail}</span>
    </div>,
    target
  );
}
