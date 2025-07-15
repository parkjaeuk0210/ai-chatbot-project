// Main entry point for Vite
import { FeraApp } from './app.js';
import './i18n/i18n.js';
import { performanceMonitor, addResourceHints } from './utils/performance.js';

// Add resource hints for better performance
addResourceHints();

// Initialize app when DOM is ready
function initializeApp() {
    console.log('Initializing FeraApp from main.js...');
    
    // Check if app already exists
    if (window.feraApp) {
        console.log('FeraApp already initialized');
        return;
    }
    
    try {
        window.feraApp = new FeraApp();
        console.log('FeraApp initialized successfully');
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('feraAppInitialized', { 
            detail: { app: window.feraApp } 
        }));
        
        // Report performance metrics
        if (import.meta.env.PROD) {
            setTimeout(() => {
                const metrics = performanceMonitor.getMetrics();
                console.log('Web Vitals:', metrics);
            }, 5000);
        }
    } catch (error) {
        console.error('Failed to initialize FeraApp:', error);
    }
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded
    initializeApp();
}

// Import service worker registration
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('Service Worker registration failed:', err);
    });
  });
}