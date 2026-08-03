import { useEffect, useState } from 'react';
import App from './App';
import { createBrew, saveBrew, seedBrews } from './lib/brewStore';
import './preview-mode.css';

let previewSetupPromise: Promise<void> | null = null;

function preparePreviewWorkspace() {
  if (previewSetupPromise) return previewSetupPromise;
  previewSetupPromise = seedBrews().then(async (brews) => {
    if (brews.length) return;
    const brew = createBrew('Preview Brew');
    await saveBrew(brew);
  });
  return previewSetupPromise;
}

export default function PreviewRootApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('preview-local-mode');
    let cancelled = false;

    void preparePreviewWorkspace()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Preview storage could not be opened.');
      });

    return () => {
      cancelled = true;
      document.documentElement.classList.remove('preview-local-mode');
    };
  }, []);

  if (error) return <main className="loading-screen">{error}</main>;
  if (!ready) return <main className="loading-screen">Opening local preview workspace…</main>;
  return <App />;
}
