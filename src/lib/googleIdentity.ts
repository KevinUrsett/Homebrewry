const GOOGLE_IDENTITY_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

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

function getClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
}

export function isGoogleConfigured() {
  return Boolean(getClientId());
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

export async function requestDriveAccess() {
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
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description ?? response.error ?? 'Google access was not granted.'));
          return;
        }
        resolve(response.access_token);
      }
    });

    client?.requestAccessToken({ prompt: '' });
  });
}
