const GOOGLE_IDENTITY_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const DRIVE_AUTH_PROMPT = 'select_account consent';
export const DRIVE_AUTH_EXPIRED_EVENT = 'homebrewry-drive-auth-expired';

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void;
};

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        prompt?: string;
        callback: (response: TokenResponse) => void;
      }) => TokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let scriptPromise: Promise<void> | null = null;
let sessionAccessToken: string | null = null;

function getClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
}

export function isGoogleConfigured() {
  return Boolean(getClientId());
}

export function getDriveAccessToken() {
  return sessionAccessToken;
}

export function invalidateDriveAccessToken() {
  sessionAccessToken = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DRIVE_AUTH_EXPIRED_EVENT));
}

function loadGoogleIdentity() {
  if (window.google) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services could not be loaded.'));
    document.head.append(script);
  });

  return scriptPromise;
}

export async function requestDriveAccess(options: { force?: boolean } = {}) {
  if (sessionAccessToken && !options.force) return sessionAccessToken;
  if (options.force) sessionAccessToken = null;

  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google Drive is not configured. Add VITE_GOOGLE_CLIENT_ID in the hosting environment.');
  }

  await loadGoogleIdentity();
  if (!window.google) throw new Error('Google Identity Services is unavailable.');

  return new Promise<string>((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      prompt: DRIVE_AUTH_PROMPT,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description ?? response.error ?? 'Google access was not granted.'));
          return;
        }
        sessionAccessToken = response.access_token;
        resolve(response.access_token);
      }
    });

    client?.requestAccessToken({ prompt: DRIVE_AUTH_PROMPT });
  });
}
