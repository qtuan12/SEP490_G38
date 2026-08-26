import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// A production PWA worker previously installed on this localhost origin can
// keep serving an obsolete bundle while Vite is running. Development must
// always use current source and live API data.
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
  }

  if ('caches' in window) {
    void caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.includes('workbox') || key.includes('precache'))
          .map(key => caches.delete(key)),
      ))
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
