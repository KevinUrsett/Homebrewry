import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { MobileSection, ViewMode } from '../types';

type WorkspacePreviewProps = {
  viewMode: ViewMode;
  mobileSection: MobileSection;
  children: (printing: boolean) => ReactNode;
};

/** CSS hiding still lets Markdown parse and render. Mount only when visible. */
export function WorkspacePreview({ viewMode, mobileSection, children }: WorkspacePreviewProps) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 820px)').matches);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)');
    const resize = () => setMobile(media.matches);
    // Native Ctrl+P also needs the latest preview ready before print layout.
    const beforePrint = () => flushSync(() => setPrinting(true));
    const afterPrint = () => setPrinting(false);
    media.addEventListener('change', resize);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      media.removeEventListener('change', resize);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  return printing || (mobile ? mobileSection === 'preview' : viewMode !== 'editor') ? children(printing) : null;
}
