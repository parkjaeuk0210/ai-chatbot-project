// Main entry point for Vite
import { FeraApp } from './app.js';
import './i18n/i18n.js';
import { performanceMonitor, addResourceHints } from './utils/performance.js';
import { analytics } from './monitoring/analytics.js';
import { sentryMonitor } from './monitoring/sentry.js';
import { webVitalsMonitor } from './monitoring/webVitals.js';

// Add resource hints for better performance
addResourceHints();

// Initialize monitoring if enabled
if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
    analytics.track('app_start', {
        version: import.meta.env.VITE_APP_VERSION || 'unknown'
    });
}

if (import.meta.env.VITE_ENABLE_SENTRY === 'true') {
    sentryMonitor.addBreadcrumb({
        category: 'app',
        message: 'App initialization started',
        level: 'info'
    });
}

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
                
                // Track app initialization complete
                if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
                    analytics.track('app_initialized', {
                        initialization_time: Date.now() - window.analyticsPageLoadTime
                    });
                }
            }, 5000);
        }
        
        // Set up Web Vitals reporting
        webVitalsMonitor.onReport((name, metric) => {
            analytics.trackPerformance(name, metric.value);
        });
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