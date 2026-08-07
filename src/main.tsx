import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { DriveLoginControl } from './components/DriveLoginControl';
import { MobileCaptureDismiss } from './components/MobileCaptureDismiss';
import { MobileEditorTextScale } from './components/MobileEditorTextScale';
import { MobileVisualViewportInset } from './components/MobileVisualViewportInset';
import { PreviewPositionSync } from './components/PreviewPositionSync';
import PreviewRootApp from './PreviewRootApp';
import RootApp from './RootApp';
import { isLocalPreviewMode } from './lib/runtimeMode';
import './fonts.css';
import './styles.css';
import './iphone-layout.css';
import './mobile-editor-text-size.css';

registerSW({ immediate: true });

const previewMode = isLocalPreviewMode();
const AppRoot = previewMode ? PreviewRootApp : RootApp;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
    <MobileCaptureDismiss />
    <MobileEditorTextScale />
    <MobileVisualViewportInset />
    <PreviewPositionSync />
    {!previewMode && <DriveLoginControl />}
  </StrictMode>
);
