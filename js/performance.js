/**
 * Performance utilities for DOM batching and optimization
 */

export class DOMBatcher {
    constructor() {
        this.pendingUpdates = [];
        this.rafId = null;
    }

    addUpdate(updateFn) {
        this.pendingUpdates.push(updateFn);
        
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.flush();
            });
        }
    }

    flush() {
        const fragment = document.createDocumentFragment();
        const updates = [...this.pendingUpdates];
        this.pendingUpdates = [];
        this.rafId = null;

        updates.forEach(update => {
            try {
                update(fragment);
            } catch (error) {
                console.error('DOM batch update error:', error);
            }
        });
    }

    cancel() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.pendingUpdates = [];
    }
}

export class PerformanceMonitor {
    constructor() {
        this.measurements = new Map();
    }

    measureRender(name, fn) {
        const startTime = performance.now();
        
        try {
            const result = fn();
            
            // Handle both sync and async functions
            if (result instanceof Promise) {
                return result.finally(() => {
                    this.recordMeasurement(name, startTime);
                });
            }
            
            this.recordMeasurement(name, startTime);
            return result;
        } catch (error) {
            this.recordMeasurement(name, startTime);
            throw error;
        }
    }

    recordMeasurement(name, startTime) {
        const duration = performance.now() - startTime;
        
        if (!this.measurements.has(name)) {
            this.measurements.set(name, []);
        }
        
        const measurements = this.measurements.get(name);
        measurements.push(duration);
        
        // Keep only last 100 measurements
        if (measurements.length > 100) {
            measurements.shift();
        }
        
        // Log slow operations in development
        if (duration > 50 && import.meta.env.DEV) {
            console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
        }
    }

    getStats(name) {
        const measurements = this.measurements.get(name);
        if (!measurements || measurements.length === 0) {
            return null;
        }

        const sorted = [...measurements].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);

        return {
            count: sorted.length,
            mean: sum / sorted.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            min: sorted[0],
            max: sorted[sorted.length - 1]
        };
    }

    getAllStats() {
        const stats = {};
        for (const [name, _] of this.measurements) {
            stats[name] = this.getStats(name);
        }
        return stats;
    }

    clear() {
        this.measurements.clear();
    }
}

// Create singleton instances
export const domBatcher = new DOMBatcher();
export const performanceMonitor = new PerformanceMonitor();

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
    domBatcher.cancel();
});