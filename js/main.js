// Main entry point for Vite
import './app.js';

// Import styles
import '../css/styles.css';
import '../css/a11y.css';

// Import i18n
import './i18n/i18n.js';

// Import service worker registration
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('Service Worker registration failed:', err);
    });
  });
}