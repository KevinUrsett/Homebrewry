import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DriveLoginControl } from './components/DriveLoginControl';
import { MobileCaptureDismiss } from './components/MobileCaptureDismiss';
import { MobileContextTools } from './components/MobileContextTools';
import { MobileEditorResume } from './components/MobileEditorResume';
import { MobileEditorTextScale } from './components/MobileEditorTextScale';
import { MobileFocusWriting } from './components/MobileFocusWriting';
import { MobileOutlineScrubber } from './components/MobileOutlineScrubber';
import { MobileRevisionHistory } from './components/MobileRevisionHistory';
import { MobileVisualViewportInset } from './components/MobileVisualViewportInset';
import { PreviewPositionSync } from './components/PreviewPositionSync';
import { PwaUpdateNotice } from './components/PwaUpdateNotice';
import PreviewRootApp from './PreviewRootApp';
import RootApp from './RootApp';
import { isLocalPreviewMode } from './lib/runtimeMode';
import './fonts.css';
import './styles.css';
import './iphone-layout.css';
import './mobile-editor-text-size.css';
import './mobile-qol.css';
import './mobile-outline-scrubber.css';

const previewMode = isLocalPreviewMode();
const AppRoot = previewMode ? PreviewRootApp : RootApp;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
    <MobileCaptureDismiss />
    <MobileContextTools />
    <MobileEditorResume />
    <MobileEditorTextScale />
    <MobileFocusWriting />
    <MobileOutlineScrubber />
    <MobileRevisionHistory />
    <MobileVisualViewportInset />
    <PreviewPositionSync />
    <PwaUpdateNotice />
    {!previewMode && <DriveLoginControl />}
  </StrictMode>
);
