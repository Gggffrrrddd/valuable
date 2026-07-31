import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Force-cleanup any stale service worker + cache from prior deployments.
// Earlier builds registered a hand-written /sw.js (valuable-shell-v*) and a
// possible vite-plugin-pwa worker; their `clients.claim()` + `skipWaiting()`
// can keep stale workers controlling the origin until all tabs are closed.
// Unregister ALL workers and clear EVERY cache unconditionally so a fresh
// load is guaranteed to be served by the network.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().catch(() => undefined);
    });
  });
}

if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      caches.delete(key).catch(() => undefined);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
