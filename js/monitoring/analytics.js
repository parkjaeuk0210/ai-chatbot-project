/**
 * Analytics and Monitoring Module
 * Integrates Google Analytics 4 and custom event tracking
 */

export class Analytics {
    constructor() {
        this.GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
        this.initialized = false;
        this.queue = [];
        this.sessionId = this.generateSessionId();
        this.userId = this.getUserId();
        
        this.init();
    }

    init() {
        if (!this.GA_MEASUREMENT_ID) {
            console.warn('Google Analytics ID not configured');
            return;
        }

        // Load Google Analytics
        this.loadGoogleAnalytics();
        
        // Initialize custom tracking
        this.initializeCustomTracking();
    }

    loadGoogleAnalytics() {
        // Create gtag script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.GA_MEASUREMENT_ID}`;
        
        script.onload = () => {
            window.dataLayer = window.dataLayer || [];
            window.gtag = function() {
                window.dataLayer.push(arguments);
            };
            
            window.gtag('js', new Date());
            window.gtag('config', this.GA_MEASUREMENT_ID, {
                send_page_view: true,
                user_id: this.userId,
                custom_map: {
                    dimension1: 'user_type',
                    dimension2: 'session_id',
                    dimension3: 'language'
                }
            });
            
            this.initialized = true;
            this.processQueue();
        };
        
        document.head.appendChild(script);
    }

    initializeCustomTracking() {
        // Track page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.track('page_visibility', {
                    action: 'hidden',
                    time_on_page: this.getTimeOnPage()
                });
            }
        });
        
        // Track errors
        window.addEventListener('error', (event) => {
            this.trackError('javascript_error', {
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno
            });
        });
        
        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError('unhandled_promise_rejection', {
                reason: event.reason
            });
        });
    }

    track(eventName, parameters = {}) {
        if (!this.initialized) {
            this.queue.push({ eventName, parameters });
            return;
        }

        // Add common parameters
        const enrichedParams = {
            ...parameters,
            session_id: this.sessionId,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            screen_resolution: `${screen.width}x${screen.height}`,
            language: navigator.language || 'unknown'
        };

        // Send to Google Analytics
        if (window.gtag) {
            window.gtag('event', eventName, enrichedParams);
        }

        // Log in development
        if (import.meta.env.DEV) {
            console.log(`[Analytics] ${eventName}:`, enrichedParams);
        }
    }

    trackError(errorType, details) {
        this.track('error', {
            error_type: errorType,
            ...details
        });
    }

    trackPerformance(metric, value) {
        this.track('performance', {
            metric_name: metric,
            metric_value: value,
            metric_unit: 'milliseconds'
        });
    }

    trackUserAction(action, category, label = null, value = null) {
        const params = {
            action,
            category
        };
        
        if (label) params.label = label;
        if (value !== null) params.value = value;
        
        this.track('user_action', params);
    }

    trackChatMessage(messageType, messageLength, hasAttachment = false) {
        this.track('chat_message', {
            message_type: messageType,
            message_length: messageLength,
            has_attachment: hasAttachment,
            session_messages_count: this.getSessionMessageCount()
        });
    }

    trackFeatureUsage(feature, details = {}) {
        this.track('feature_usage', {
            feature_name: feature,
            ...details
        });
    }

    trackConversion(conversionType, value = null) {
        const params = {
            conversion_type: conversionType
        };
        
        if (value !== null) {
            params.value = value;
            params.currency = 'USD';
        }
        
        this.track('conversion', params);
    }

    setUserProperties(properties) {
        if (window.gtag) {
            window.gtag('set', 'user_properties', properties);
        }
    }

    processQueue() {
        while (this.queue.length > 0) {
            const { eventName, parameters } = this.queue.shift();
            this.track(eventName, parameters);
        }
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getUserId() {
        let userId = localStorage.getItem('analytics_user_id');
        if (!userId) {
            userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('analytics_user_id', userId);
        }
        return userId;
    }

    getTimeOnPage() {
        return Date.now() - (window.analyticsPageLoadTime || Date.now());
    }

    getSessionMessageCount() {
        return parseInt(sessionStorage.getItem('message_count') || '0');
    }

    // Privacy-compliant methods
    async requestConsent() {
        // Implement consent dialog
        return new Promise((resolve) => {
            const consent = localStorage.getItem('analytics_consent');
            if (consent === 'granted') {
                resolve(true);
            } else if (consent === 'denied') {
                resolve(false);
            } else {
                // Show consent dialog
                // This is a placeholder - implement actual UI
                const userConsent = confirm('이 웹사이트는 사용자 경험을 개선하기 위해 분석 도구를 사용합니다. 동의하시겠습니까?');
                localStorage.setItem('analytics_consent', userConsent ? 'granted' : 'denied');
                resolve(userConsent);
            }
        });
    }

    disableTracking() {
        window['ga-disable-' + this.GA_MEASUREMENT_ID] = true;
        localStorage.setItem('analytics_consent', 'denied');
    }

    enableTracking() {
        window['ga-disable-' + this.GA_MEASUREMENT_ID] = false;
        localStorage.setItem('analytics_consent', 'granted');
    }
}

// Create singleton instance
export const analytics = new Analytics();

// Set page load time for session tracking
window.analyticsPageLoadTime = Date.now();