import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-notice" role="status">
      <span>A new version of Homebrewry is ready.</span>
      <button onClick={() => { void updateServiceWorker(true); }} type="button">Update now</button>
      <button aria-label="Dismiss update notice" className="pwa-update-dismiss" onClick={() => setNeedRefresh(false)} type="button">×</button>
    </div>
  );
}
