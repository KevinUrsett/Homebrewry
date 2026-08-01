import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { DriveLoginControl } from './components/DriveLoginControl';
import RootApp from './RootApp';
import './fonts.css';
import './styles.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
    <DriveLoginControl />
  </StrictMode>
);
