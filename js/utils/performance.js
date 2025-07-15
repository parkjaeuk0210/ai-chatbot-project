/**
 * Performance Monitoring and Optimization
 */

export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fcp: null,
            lcp: null,
            fid: null,
            cls: null,
            ttfb: null
        };
        
        this.init();
    }

    init() {
        // First Contentful Paint (FCP)
        this.observePaintTiming();
        
        // Largest Contentful Paint (LCP)
        this.observeLCP();
        
        // First Input Delay (FID)
        this.observeFID();
        
        // Cumulative Layout Shift (CLS)
        this.observeCLS();
        
        // Time to First Byte (TTFB)
        this.measureTTFB();
        
        // Memory usage monitoring
        this.monitorMemory();
    }

    observePaintTiming() {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name === 'first-contentful-paint') {
                        this.metrics.fcp = entry.startTime;
                        this.reportMetric('FCP', entry.startTime);
                    }
                }
            });
            observer.observe({ entryTypes: ['paint'] });
        } catch (e) {
            console.warn('Paint timing not supported');
        }
    }

    observeLCP() {
        try {
            let lcp;
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                lcp = entries[entries.length - 1];
            });
            
            observer.observe({ entryTypes: ['largest-contentful-paint'] });
            
            // Report final LCP when page is backgrounded
            document.addEventListener('visibilitychange', () => {
                if (lcp && document.visibilityState === 'hidden') {
                    this.metrics.lcp = lcp.startTime;
                    this.reportMetric('LCP', lcp.startTime);
                    observer.disconnect();
                }
            });
        } catch (e) {
            console.warn('LCP not supported');
        }
    }

    observeFID() {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name === 'first-input') {
                        this.metrics.fid = entry.processingStart - entry.startTime;
                        this.reportMetric('FID', this.metrics.fid);
                        observer.disconnect();
                    }
                }
            });
            observer.observe({ entryTypes: ['first-input'] });
        } catch (e) {
            console.warn('FID not supported');
        }
    }

    observeCLS() {
        try {
            let clsValue = 0;
            let clsEntries = [];
            let sessionValue = 0;
            let sessionEntries = [];
            
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        const firstSessionEntry = sessionEntries[0];
                        const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
                        
                        if (sessionValue && 
                            entry.startTime - lastSessionEntry.startTime < 1000 && 
                            entry.startTime - firstSessionEntry.startTime < 5000) {
                            sessionValue += entry.value;
                            sessionEntries.push(entry);
                        } else {
                            sessionValue = entry.value;
                            sessionEntries = [entry];
                        }
                        
                        if (sessionValue > clsValue) {
                            clsValue = sessionValue;
                            clsEntries = sessionEntries;
                            this.metrics.cls = clsValue;
                        }
                    }
                }
            });
            
            observer.observe({ entryTypes: ['layout-shift'] });
            
            // Report final CLS when page is backgrounded
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden' && this.metrics.cls !== null) {
                    this.reportMetric('CLS', this.metrics.cls);
                    observer.disconnect();
                }
            });
        } catch (e) {
            console.warn('CLS not supported');
        }
    }

    measureTTFB() {
        try {
            const navigationTiming = performance.getEntriesByType('navigation')[0];
            if (navigationTiming) {
                this.metrics.ttfb = navigationTiming.responseStart - navigationTiming.requestStart;
                this.reportMetric('TTFB', this.metrics.ttfb);
            }
        } catch (e) {
            console.warn('TTFB measurement not supported');
        }
    }

    monitorMemory() {
        if (performance.memory) {
            setInterval(() => {
                const memoryUsage = {
                    usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576),
                    totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576),
                    jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
                };
                
                // Warn if memory usage is high
                if (memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit > 0.9) {
                    console.warn('High memory usage detected:', memoryUsage);
                }
            }, 30000); // Check every 30 seconds
        }
    }

    reportMetric(name, value) {
        // Log to console in development
        if (import.meta.env.DEV) {
            console.log(`Performance metric - ${name}: ${value.toFixed(2)}ms`);
        }
        
        // Send to analytics if available
        if (window.gtag) {
            window.gtag('event', name, {
                value: Math.round(value),
                metric_value: value,
                metric_delta: value,
                event_category: 'Web Vitals'
            });
        }
    }

    getMetrics() {
        return this.metrics;
    }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Resource hints for better performance
export function addResourceHints() {
    const head = document.head;
    
    // Preconnect to CDNs
    const preconnects = [
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com'
    ];
    
    preconnects.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = url;
        link.crossOrigin = '';
        head.appendChild(link);
    });
    
    // DNS prefetch for external resources
    const dnsPrefetches = [
        'https://cdn.tailwindcss.com'
    ];
    
    dnsPrefetches.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = url;
        head.appendChild(link);
    });
}