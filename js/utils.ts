// Utility functions

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const random2 = Math.random().toString(36).substring(2, 15);
    return `session-${timestamp}-${random}${random2}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    return function(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };
        
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
    return function(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(date: Date | string | number): string {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
        return 'just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
        return past.toLocaleDateString();
    }
}

/**
 * Get timestamp string
 */
export function getTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as T;
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item)) as T;
    }
    
    if (obj instanceof Object) {
        const clonedObj = {} as T;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
    
    return obj;
}

/**
 * Sleep function for async/await
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxAttempts - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                await sleep(delay);
            }
        }
    }
    
    throw lastError;
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Get query parameter from URL
 */
export function getQueryParam(name: string, url?: string): string | null {
    const urlToSearch = url || window.location.href;
    const urlObj = new URL(urlToSearch);
    return urlObj.searchParams.get(name);
}

/**
 * Format error message for display
 */
export function formatErrorMessage(error: unknown): { message: string; code?: string; isRetryable: boolean } {
    if (error instanceof Error) {
        const message = error.message;
        let code: string | undefined;
        let isRetryable = false;
        
        // Network errors
        if (message.includes('fetch') || message.includes('network')) {
            code = 'NETWORK_ERROR';
            isRetryable = true;
        }
        // Timeout errors
        else if (message.includes('timeout')) {
            code = 'TIMEOUT';
            isRetryable = true;
        }
        // Rate limit errors
        else if (message.includes('429') || message.includes('rate limit')) {
            code = 'RATE_LIMIT';
            isRetryable = true;
        }
        // Server errors (5xx)
        else if (message.includes('500') || message.includes('502') || message.includes('503')) {
            code = 'SERVER_ERROR';
            isRetryable = true;
        }
        
        return { message, code, isRetryable };
    }
    
    return { 
        message: typeof error === 'string' ? error : 'An unknown error occurred',
        isRetryable: false
    };
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
    fn: T,
    getKey: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args)
): T {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>) => {
        const key = getKey(...args);
        
        if (cache.has(key)) {
            return cache.get(key)!;
        }
        
        const result = fn(...args);
        cache.set(key, result);
        
        return result;
    }) as T;
}