/**
 * Web Vitals Monitoring
 * Tracks Core Web Vitals and custom performance metrics
 */

export class WebVitalsMonitor {
    constructor() {
        this.metrics = {
            FCP: null,
            LCP: null,
            FID: null,
            CLS: null,
            TTFB: null,
            INP: null
        };
        
        this.observers = new Map();
        this.reportCallback = null;
        
        this.init();
    }

    async init() {
        try {
            // Dynamically import web-vitals library
            const webVitals = await import(/* @vite-ignore */ 'web-vitals').catch(() => null);
            
            if (!webVitals) {
                console.warn('web-vitals library not available, using fallback');
                this.setupManualTracking();
                return;
            }
            
            // Set up Core Web Vitals tracking
            webVitals.onFCP(metric => this.handleMetric('FCP', metric));
            webVitals.onLCP(metric => this.handleMetric('LCP', metric));
            webVitals.onFID(metric => this.handleMetric('FID', metric));
            webVitals.onCLS(metric => this.handleMetric('CLS', metric));
            webVitals.onTTFB(metric => this.handleMetric('TTFB', metric));
            webVitals.onINP(metric => this.handleMetric('INP', metric));
            
            // Custom metrics
            this.trackCustomMetrics();
            
            console.log('Web Vitals monitoring initialized');
        } catch (error) {
            console.warn('Failed to load web-vitals library:', error);
            // Fallback to manual tracking
            this.setupManualTracking();
        }
    }

    handleMetric(name, metric) {
        this.metrics[name] = {
            value: metric.value,
            rating: metric.rating || this.getRating(name, metric.value),
            entries: metric.entries,
            id: metric.id,
            navigationType: metric.navigationType,
            timestamp: Date.now()
        };
        
        // Log in development
        if (import.meta.env.DEV) {
            console.log(`[Web Vitals] ${name}:`, metric.value, metric.rating);
        }
        
        // Report to analytics if callback is set
        if (this.reportCallback) {
            this.reportCallback(name, metric);
        }
        
        // Send to monitoring services
        this.reportToAnalytics(name, metric);
    }

    getRating(name, value) {
        const thresholds = {
            FCP: { good: 1800, needsImprovement: 3000 },
            LCP: { good: 2500, needsImprovement: 4000 },
            FID: { good: 100, needsImprovement: 300 },
            CLS: { good: 0.1, needsImprovement: 0.25 },
            TTFB: { good: 800, needsImprovement: 1800 },
            INP: { good: 200, needsImprovement: 500 }
        };
        
        const threshold = thresholds[name];
        if (!threshold) return 'unknown';
        
        if (value <= threshold.good) return 'good';
        if (value <= threshold.needsImprovement) return 'needs-improvement';
        return 'poor';
    }

    setupManualTracking() {
        // First Contentful Paint
        if ('PerformanceObserver' in window) {
            try {
                const paintObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name === 'first-contentful-paint') {
                            this.handleMetric('FCP', {
                                value: entry.startTime,
                                entries: [entry]
                            });
                        }
                    }
                });
                paintObserver.observe({ entryTypes: ['paint'] });
                this.observers.set('paint', paintObserver);
            } catch (e) {
                console.warn('Paint observer not supported');
            }
        }
        
        // Largest Contentful Paint
        if ('PerformanceObserver' in window) {
            try {
                let lcpValue = 0;
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    lcpValue = lastEntry.startTime;
                });
                
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                this.observers.set('lcp', lcpObserver);
                
                // Report final LCP when page is hidden
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden' && lcpValue) {
                        this.handleMetric('LCP', {
                            value: lcpValue,
                            entries: []
                        });
                        lcpObserver.disconnect();
                    }
                });
            } catch (e) {
                console.warn('LCP observer not supported');
            }
        }
        
        // Time to First Byte
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const ttfb = timing.responseStart - timing.requestStart;
            if (ttfb > 0) {
                this.handleMetric('TTFB', {
                    value: ttfb,
                    entries: []
                });
            }
        }
    }

    trackCustomMetrics() {
        // Time to Interactive
        this.measureTimeToInteractive();
        
        // First Input Delay (custom implementation)
        this.measureFirstInputDelay();
        
        // Memory usage
        this.trackMemoryUsage();
        
        // Network information
        this.trackNetworkInfo();
    }

    measureTimeToInteractive() {
        if (!window.performance || !window.performance.timing) return;
        
        // Simple TTI calculation
        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = window.performance.timing;
                const tti = Date.now() - timing.navigationStart;
                
                this.handleMetric('TTI', {
                    value: tti,
                    entries: []
                });
            }, 0);
        });
    }

    measureFirstInputDelay() {
        let firstInputDelay = null;
        let firstInputTimeStamp = null;
        
        const eventTypes = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchstart'];
        
        const handleInput = (event) => {
            if (firstInputDelay !== null) return;
            
            const delay = event.timeStamp - performance.now();
            firstInputDelay = Math.max(0, delay);
            firstInputTimeStamp = event.timeStamp;
            
            this.handleMetric('FID', {
                value: firstInputDelay,
                entries: []
            });
            
            // Remove listeners
            eventTypes.forEach(type => {
                window.removeEventListener(type, handleInput);
            });
        };
        
        // Add listeners
        eventTypes.forEach(type => {
            window.addEventListener(type, handleInput, { passive: true });
        });
    }

    trackMemoryUsage() {
        if (!performance.memory) return;
        
        setInterval(() => {
            const memory = {
                usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576),
                totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576),
                jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
            };
            
            const usage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
            
            if (usage > 90) {
                console.warn('High memory usage detected:', memory);
                this.reportToAnalytics('memory_warning', { usage, ...memory });
            }
        }, 30000); // Check every 30 seconds
    }

    trackNetworkInfo() {
        if (!navigator.connection) return;
        
        const connection = navigator.connection;
        
        const networkInfo = {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData
        };
        
        this.reportToAnalytics('network_info', networkInfo);
        
        // Listen for changes
        connection.addEventListener('change', () => {
            const updatedInfo = {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
            
            this.reportToAnalytics('network_change', updatedInfo);
        });
    }

    reportToAnalytics(metricName, metricData) {
        // Report to Google Analytics
        if (window.gtag) {
            window.gtag('event', metricName, {
                value: metricData.value,
                metric_rating: metricData.rating,
                metric_id: metricData.id,
                metric_entries: metricData.entries?.length || 0,
                event_category: 'Web Vitals'
            });
        }
        
        // Report to Sentry
        if (window.sentryMonitor) {
            window.sentryMonitor.capturePerformance('web_vitals', {
                [metricName]: metricData.value
            });
        }
    }

    getMetrics() {
        return this.metrics;
    }

    onReport(callback) {
        this.reportCallback = callback;
    }

    // Get recommendations based on metrics
    getRecommendations() {
        const recommendations = [];
        
        if (this.metrics.LCP?.rating === 'poor') {
            recommendations.push({
                metric: 'LCP',
                issue: 'Largest Contentful Paint is too slow',
                suggestions: [
                    'Optimize server response times',
                    'Use image CDN and optimize images',
                    'Preload critical resources',
                    'Remove render-blocking resources'
                ]
            });
        }
        
        if (this.metrics.CLS?.rating === 'poor') {
            recommendations.push({
                metric: 'CLS',
                issue: 'Cumulative Layout Shift is too high',
                suggestions: [
                    'Include size attributes on images and videos',
                    'Avoid inserting content above existing content',
                    'Use transform animations instead of position changes'
                ]
            });
        }
        
        if (this.metrics.FID?.rating === 'poor') {
            recommendations.push({
                metric: 'FID',
                issue: 'First Input Delay is too high',
                suggestions: [
                    'Break up long JavaScript tasks',
                    'Use web workers for heavy computations',
                    'Reduce JavaScript execution time',
                    'Optimize third-party scripts'
                ]
            });
        }
        
        return recommendations;
    }

    // Clean up
    disconnect() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }
}

// Create singleton instance
export const webVitalsMonitor = new WebVitalsMonitor();

// Export metrics for other modules
export function getWebVitals() {
    return webVitalsMonitor.getMetrics();
}