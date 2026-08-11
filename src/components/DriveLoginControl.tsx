import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DRIVE_AUTH_EXPIRED_EVENT,
  getDriveAccessToken,
  isGoogleConfigured,
  requestDriveAccess
} from '../lib/googleIdentity';

type LoginState = 'idle' | 'working' | 'success' | 'error' | 'expired';

export function DriveLoginControl() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<LoginState>(() => getDriveAccessToken() ? 'idle' : 'expired');
  const [detail, setDetail] = useState('Login and refresh/sync are separate actions.');

  useEffect(() => {
    const findTarget = () => setTarget(document.querySelector<HTMLElement>('.cloud-login-target'));
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      setState('expired');
      setDetail('The Google Drive session expired. Log in again, then press Refresh & sync.');
    };
    window.addEventListener(DRIVE_AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(DRIVE_AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const login = async () => {
    if (state === 'working') return;
    setState('working');
    setDetail('Opening Google login…');
    try {
      await requestDriveAccess({ force: true });
      setState('success');
      setDetail('Google Drive login refreshed. Press Refresh & sync when ready.');
    } catch (error) {
      setState('error');
      setDetail(error instanceof Error ? error.message : 'Google Drive login failed.');
    }
  };

  if (!target) return null;

  const label = state === 'working'
    ? 'Logging in…'
    : state === 'success'
      ? 'Drive login refreshed'
      : state === 'expired' || state === 'error'
        ? 'Login to Drive'
        : 'Re-login Drive';

  return createPortal(
    <button
      aria-label="Login or re-login to Google Drive"
      disabled={state === 'working' || !isGoogleConfigured()}
      onClick={() => void login()}
      title={detail}
      type="button"
    >
      {label}
    </button>,
    target
  );
}
