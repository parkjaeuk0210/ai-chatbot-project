/**
 * Sentry Error Tracking Integration
 * Provides comprehensive error monitoring and performance tracking
 */

export class SentryMonitor {
    constructor() {
        this.DSN = import.meta.env.VITE_SENTRY_DSN || '';
        this.environment = import.meta.env.MODE || 'development';
        this.initialized = false;
        this.Sentry = null;
        
        this.init();
    }

    async init() {
        if (!this.DSN) {
            console.warn('Sentry DSN not configured');
            return;
        }

        try {
            // Dynamically import Sentry to reduce initial bundle size
            // These will only be loaded if Sentry is configured
            const SentryModule = await import(/* @vite-ignore */ '@sentry/browser').catch(() => null);
            const TracingModule = await import(/* @vite-ignore */ '@sentry/tracing').catch(() => null);
            
            if (!SentryModule || !TracingModule) {
                console.warn('Sentry modules not available');
                return;
            }
            
            const { BrowserTracing } = TracingModule;
            
            this.Sentry = SentryModule;
            
            this.Sentry.init({
                dsn: this.DSN,
                environment: this.environment,
                integrations: [
                    new BrowserTracing({
                        // Set sampling rate for performance monitoring
                        tracingOrigins: ['localhost', /^\//],
                        // Track interactions
                        routingInstrumentation: this.Sentry.browserTracingIntegration({
                            enableLongAnimationFrame: true,
                            enableInp: true
                        })
                    }),
                    new this.Sentry.Replay({
                        // Capture 10% of all sessions
                        sessionSampleRate: 0.1,
                        // Capture 100% of sessions with an error
                        errorSampleRate: 1.0,
                        // Mask sensitive content
                        maskAllText: false,
                        maskAllInputs: true,
                        blockAllMedia: false
                    })
                ],
                // Performance Monitoring
                tracesSampleRate: this.environment === 'production' ? 0.1 : 1.0,
                // Release tracking
                release: import.meta.env.VITE_APP_VERSION || 'unknown',
                // Session tracking
                autoSessionTracking: true,
                // Breadcrumbs
                beforeBreadcrumb(breadcrumb, hint) {
                    // Filter out sensitive breadcrumbs
                    if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
                        return null;
                    }
                    return breadcrumb;
                },
                // Before send hook
                beforeSend(event, hint) {
                    // Filter out known issues or sensitive data
                    if (event.exception) {
                        const error = hint.originalException;
                        
                        // Don't report network errors in development
                        if (this.environment === 'development' && 
                            error && error.message && 
                            error.message.includes('NetworkError')) {
                            return null;
                        }
                    }
                    
                    // Sanitize user data
                    if (event.user) {
                        delete event.user.email;
                        delete event.user.ip_address;
                    }
                    
                    return event;
                }
            });
            
            this.initialized = true;
            console.log('Sentry initialized successfully');
            
            // Set initial user context
            this.setUserContext();
            
            // Add custom tags
            this.Sentry.setTags({
                app_version: import.meta.env.VITE_APP_VERSION || 'unknown',
                browser: this.getBrowserInfo(),
                platform: navigator.platform
            });
            
        } catch (error) {
            console.error('Failed to initialize Sentry:', error);
        }
    }

    captureException(error, context = {}) {
        if (!this.initialized || !this.Sentry) return;
        
        this.Sentry.withScope((scope) => {
            // Add context
            Object.keys(context).forEach(key => {
                scope.setContext(key, context[key]);
            });
            
            // Capture the exception
            this.Sentry.captureException(error);
        });
    }

    captureMessage(message, level = 'info', context = {}) {
        if (!this.initialized || !this.Sentry) return;
        
        this.Sentry.withScope((scope) => {
            // Add context
            Object.keys(context).forEach(key => {
                scope.setContext(key, context[key]);
            });
            
            // Capture the message
            this.Sentry.captureMessage(message, level);
        });
    }

    capturePerformance(transaction, measurements) {
        if (!this.initialized || !this.Sentry) return;
        
        const sentryTransaction = this.Sentry.startTransaction({
            name: transaction,
            op: 'custom'
        });
        
        // Add measurements
        Object.keys(measurements).forEach(key => {
            sentryTransaction.setMeasurement(key, measurements[key], 'millisecond');
        });
        
        sentryTransaction.finish();
    }

    addBreadcrumb(breadcrumb) {
        if (!this.initialized || !this.Sentry) return;
        
        this.Sentry.addBreadcrumb({
            timestamp: Date.now() / 1000,
            ...breadcrumb
        });
    }

    setUserContext(user = {}) {
        if (!this.initialized || !this.Sentry) return;
        
        // Get or generate user ID
        const userId = user.id || localStorage.getItem('sentry_user_id') || this.generateUserId();
        
        this.Sentry.setUser({
            id: userId,
            ...user
        });
        
        // Store user ID
        if (!user.id) {
            localStorage.setItem('sentry_user_id', userId);
        }
    }

    setTag(key, value) {
        if (!this.initialized || !this.Sentry) return;
        this.Sentry.setTag(key, value);
    }

    setContext(key, context) {
        if (!this.initialized || !this.Sentry) return;
        this.Sentry.setContext(key, context);
    }

    startTransaction(name, op = 'navigation') {
        if (!this.initialized || !this.Sentry) return null;
        
        return this.Sentry.startTransaction({
            name,
            op
        });
    }

    // Specific error tracking methods
    trackAPIError(endpoint, error, requestData = {}) {
        this.captureException(error, {
            api: {
                endpoint,
                method: requestData.method || 'GET',
                status: error.status || 'unknown',
                request_data: requestData
            }
        });
    }

    trackUserAction(action, details = {}) {
        this.addBreadcrumb({
            category: 'user',
            message: action,
            level: 'info',
            data: details
        });
    }

    trackStateChange(stateName, oldValue, newValue) {
        this.addBreadcrumb({
            category: 'state',
            message: `${stateName} changed`,
            level: 'info',
            data: {
                old_value: oldValue,
                new_value: newValue
            }
        });
    }

    // Utility methods
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Other';
    }

    // Performance monitoring helpers
    measurePageLoad() {
        if (!this.initialized || !this.Sentry || !window.performance) return;
        
        const navigation = performance.getEntriesByType('navigation')[0];
        if (!navigation) return;
        
        this.capturePerformance('page_load', {
            dns: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcp: navigation.connectEnd - navigation.connectStart,
            request: navigation.responseStart - navigation.requestStart,
            response: navigation.responseEnd - navigation.responseStart,
            dom_processing: navigation.domComplete - navigation.domLoading,
            total: navigation.loadEventEnd - navigation.fetchStart
        });
    }

    // Clean up method
    close() {
        if (this.initialized && this.Sentry) {
            this.Sentry.close();
        }
    }
}

// Create singleton instance
export const sentryMonitor = new SentryMonitor();

// Automatically measure page load when ready
if (document.readyState === 'complete') {
    sentryMonitor.measurePageLoad();
} else {
    window.addEventListener('load', () => {
        sentryMonitor.measurePageLoad();
    });
}