// Performance optimization utilities

// Request debouncing for API calls
export class RequestManager {
    constructor() {
        this.pendingRequests = new Map();
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    async makeRequest(key, requestFn, options = {}) {
        // Check if request is already pending
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }
        
        // Check cache
        if (options.useCache && this.cache.has(key)) {
            const cached = this.cache.get(key);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return Promise.resolve(cached.data);
            }
        }
        
        // Create new request
        const promise = requestFn().then(data => {
            this.pendingRequests.delete(key);
            
            // Cache successful responses
            if (options.useCache) {
                this.cache.set(key, {
                    data,
                    timestamp: Date.now()
                });
            }
            
            return data;
        }).catch(error => {
            this.pendingRequests.delete(key);
            throw error;
        });
        
        this.pendingRequests.set(key, promise);
        return promise;
    }
    
    clearCache() {
        this.cache.clear();
    }
}

// DOM batch updates
export class DOMBatcher {
    constructor() {
        this.updates = [];
        this.scheduled = false;
    }
    
    addUpdate(updateFn) {
        this.updates.push(updateFn);
        
        if (!this.scheduled) {
            this.scheduled = true;
            requestAnimationFrame(() => {
                this.flush();
            });
        }
    }
    
    flush() {
        const fragment = document.createDocumentFragment();
        
        this.updates.forEach(update => {
            update(fragment);
        });
        
        this.updates = [];
        this.scheduled = false;
        
        return fragment;
    }
}

// Image lazy loading with IntersectionObserver
export class ImageLoader {
    constructor() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                }
            });
        }, {
            rootMargin: '50px'
        });
    }
    
    observe(img) {
        if (img.dataset.src) {
            this.observer.observe(img);
        }
    }
    
    loadImage(img) {
        const src = img.dataset.src;
        if (!src) return;
        
        // Create a new image to preload
        const newImg = new Image();
        newImg.onload = () => {
            img.src = src;
            img.classList.add('loaded');
            delete img.dataset.src;
            this.observer.unobserve(img);
        };
        newImg.src = src;
    }
    
    disconnect() {
        this.observer.disconnect();
    }
}

// Memory management
export class MemoryManager {
    constructor() {
        this.listeners = new Map();
        this.intervals = new Set();
        this.timeouts = new Set();
    }
    
    addEventListener(element, event, handler, options) {
        const key = `${element.id || 'anonymous'}_${event}`;
        
        // Remove existing listener if any
        if (this.listeners.has(key)) {
            const { element: el, event: ev, handler: h } = this.listeners.get(key);
            el.removeEventListener(ev, h);
        }
        
        element.addEventListener(event, handler, options);
        this.listeners.set(key, { element, event, handler });
    }
    
    setInterval(callback, delay) {
        const id = setInterval(callback, delay);
        this.intervals.add(id);
        return id;
    }
    
    clearInterval(id) {
        clearInterval(id);
        this.intervals.delete(id);
    }
    
    setTimeout(callback, delay) {
        const id = setTimeout(() => {
            callback();
            this.timeouts.delete(id);
        }, delay);
        this.timeouts.add(id);
        return id;
    }
    
    clearTimeout(id) {
        clearTimeout(id);
        this.timeouts.delete(id);
    }
    
    cleanup() {
        // Remove all event listeners
        this.listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.listeners.clear();
        
        // Clear all intervals
        this.intervals.forEach(id => clearInterval(id));
        this.intervals.clear();
        
        // Clear all timeouts
        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts.clear();
    }
}

// Performance monitoring
export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            renderTime: [],
            apiCallTime: [],
            memoryUsage: []
        };
        this.maxMetrics = 100;
    }
    
    measureRender(operation, callback) {
        const start = performance.now();
        const result = callback();
        const duration = performance.now() - start;
        
        this.addMetric('renderTime', {
            operation,
            duration,
            timestamp: Date.now()
        });
        
        if (duration > 16.67) { // More than one frame (60fps)
            console.warn(`Slow render operation: ${operation} took ${duration.toFixed(2)}ms`);
        }
        
        return result;
    }
    
    async measureAPI(endpoint, callback) {
        const start = performance.now();
        try {
            const result = await callback();
            const duration = performance.now() - start;
            
            this.addMetric('apiCallTime', {
                endpoint,
                duration,
                status: 'success',
                timestamp: Date.now()
            });
            
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            
            this.addMetric('apiCallTime', {
                endpoint,
                duration,
                status: 'error',
                timestamp: Date.now()
            });
            
            throw error;
        }
    }
    
    measureMemory() {
        if (performance.memory) {
            this.addMetric('memoryUsage', {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            });
        }
    }
    
    addMetric(type, data) {
        this.metrics[type].push(data);
        
        // Keep only recent metrics
        if (this.metrics[type].length > this.maxMetrics) {
            this.metrics[type] = this.metrics[type].slice(-this.maxMetrics);
        }
    }
    
    getMetrics() {
        return this.metrics;
    }
    
    getAverages() {
        const averages = {};
        
        Object.keys(this.metrics).forEach(type => {
            const data = this.metrics[type];
            if (data.length === 0) {
                averages[type] = 0;
                return;
            }
            
            if (type === 'memoryUsage') {
                const latest = data[data.length - 1];
                averages[type] = latest ? latest.usedJSHeapSize : 0;
            } else {
                const sum = data.reduce((acc, item) => acc + item.duration, 0);
                averages[type] = sum / data.length;
            }
        });
        
        return averages;
    }
}

// Singleton instances
export const requestManager = new RequestManager();
export const domBatcher = new DOMBatcher();
export const imageLoader = new ImageLoader();
export const memoryManager = new MemoryManager();
export const performanceMonitor = new PerformanceMonitor();

// Auto cleanup on page unload
window.addEventListener('beforeunload', () => {
    memoryManager.cleanup();
    imageLoader.disconnect();
});