import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { DriveLoginControl } from './components/DriveLoginControl';
import { MobileDriveTools } from './components/MobileDriveTools';
import { MobileEditorKeyboardGuard } from './components/MobileEditorKeyboardGuard';
import { MobileQuickMenuEnhancements } from './components/MobileQuickMenuEnhancements';
import { MobileWritingMode } from './components/MobileWritingMode';
import PreviewRootApp from './PreviewRootApp';
import RootApp from './RootApp';
import { isLocalPreviewMode } from './lib/runtimeMode';
import './fonts.css';
import './styles.css';
import './iphone-layout.css';
import './mobile-editor-viewport-fix.css';
import './mobile-editor-keyboard.css';
import './mobile-drive-tools.css';
import './mobile-writing-mode.css';

registerSW({ immediate: true });

const previewMode = isLocalPreviewMode();
const AppRoot = previewMode ? PreviewRootApp : RootApp;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
    <MobileEditorKeyboardGuard />
    <MobileQuickMenuEnhancements />
    <MobileDriveTools />
    <MobileWritingMode />
    {!previewMode && <DriveLoginControl />}
  </StrictMode>
);
