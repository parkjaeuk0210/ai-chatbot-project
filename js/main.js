// Main entry point for Vite
import { FeraApp } from './app.js';
import './i18n/i18n.js';
import { performanceMonitor, addResourceHints } from './utils/performance.js';
// Conditionally import monitoring modules
let analytics, sentryMonitor, webVitalsMonitor;

// These modules will be lazy-loaded only if needed
if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true' || import.meta.env.VITE_ENABLE_SENTRY === 'true') {
    // Import monitoring modules dynamically to avoid build errors
    Promise.all([
        import('./monitoring/analytics.js').then(m => analytics = m.analytics).catch(() => {}),
        import('./monitoring/sentry.js').then(m => sentryMonitor = m.sentryMonitor).catch(() => {}),
        import('./monitoring/webVitals.js').then(m => webVitalsMonitor = m.webVitalsMonitor).catch(() => {})
    ]);
}

// Add resource hints for better performance
addResourceHints();

// Initialize monitoring if enabled
setTimeout(() => {
    if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true' && analytics) {
        analytics.track('app_start', {
            version: import.meta.env.VITE_APP_VERSION || 'unknown'
        });
    }

    if (import.meta.env.VITE_ENABLE_SENTRY === 'true' && sentryMonitor) {
        sentryMonitor.addBreadcrumb({
            category: 'app',
            message: 'App initialization started',
            level: 'info'
        });
    }
}, 1000);

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
                if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true' && analytics) {
                    analytics.track('app_initialized', {
                        initialization_time: Date.now() - window.analyticsPageLoadTime
                    });
                }
            }, 5000);
        }
        
        // Set up Web Vitals reporting
        if (webVitalsMonitor) {
            webVitalsMonitor.onReport((name, metric) => {
                if (analytics) {
                    analytics.trackPerformance(name, metric.value);
                }
            });
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