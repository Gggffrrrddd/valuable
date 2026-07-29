import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Disable PWA caching during the prototype so deployments always load fresh assets.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.filter((key) => key.startsWith('valuable-')).forEach((key) => caches.delete(key));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
