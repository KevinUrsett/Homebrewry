const PRODUCTION_HOST = 'homebrewry.vercel.app';

export function isLocalPreviewMode(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname.toLocaleLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  return hostname.endsWith('.vercel.app') && hostname !== PRODUCTION_HOST;
}
