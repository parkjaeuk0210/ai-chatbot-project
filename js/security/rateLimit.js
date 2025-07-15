/**
 * Client-side Rate Limiting
 */

export class RateLimiter {
    constructor(options = {}) {
        this.limits = {
            chat: { max: 50, window: 60000 }, // 50 messages per minute
            image: { max: 10, window: 300000 }, // 10 images per 5 minutes
            api: { max: 100, window: 60000 }, // 100 API calls per minute
            ...options
        };
        
        this.attempts = new Map();
        this.blocked = new Map();
        
        // Cleanup old entries periodically
        setInterval(() => this.cleanup(), 60000);
    }

    check(action, identifier = 'global') {
        const key = `${action}:${identifier}`;
        const limit = this.limits[action];
        
        if (!limit) {
            console.warn(`No rate limit defined for action: ${action}`);
            return { allowed: true };
        }

        // Check if temporarily blocked
        if (this.blocked.has(key)) {
            const blockedUntil = this.blocked.get(key);
            if (Date.now() < blockedUntil) {
                return {
                    allowed: false,
                    retryAfter: Math.ceil((blockedUntil - Date.now()) / 1000),
                    reason: 'rate_limit_exceeded'
                };
            } else {
                this.blocked.delete(key);
            }
        }

        const now = Date.now();
        const attempts = this.attempts.get(key) || [];
        
        // Remove old attempts outside the window
        const validAttempts = attempts.filter(timestamp => 
            now - timestamp < limit.window
        );

        if (validAttempts.length >= limit.max) {
            // Block for the window duration
            const blockDuration = limit.window;
            this.blocked.set(key, now + blockDuration);
            
            return {
                allowed: false,
                retryAfter: Math.ceil(blockDuration / 1000),
                reason: 'rate_limit_exceeded',
                limit: limit.max,
                window: limit.window
            };
        }

        // Record the attempt
        validAttempts.push(now);
        this.attempts.set(key, validAttempts);

        return {
            allowed: true,
            remaining: limit.max - validAttempts.length,
            resetAt: Math.min(...validAttempts) + limit.window
        };
    }

    cleanup() {
        const now = Date.now();

        // Clean up old attempts
        for (const [key, attempts] of this.attempts) {
            const action = key.split(':')[0];
            const limit = this.limits[action];
            
            if (limit) {
                const validAttempts = attempts.filter(timestamp => 
                    now - timestamp < limit.window
                );
                
                if (validAttempts.length === 0) {
                    this.attempts.delete(key);
                } else {
                    this.attempts.set(key, validAttempts);
                }
            }
        }

        // Clean up expired blocks
        for (const [key, blockedUntil] of this.blocked) {
            if (now >= blockedUntil) {
                this.blocked.delete(key);
            }
        }
    }

    reset(action, identifier = 'global') {
        const key = `${action}:${identifier}`;
        this.attempts.delete(key);
        this.blocked.delete(key);
    }

    getStatus(action, identifier = 'global') {
        const key = `${action}:${identifier}`;
        const limit = this.limits[action];
        
        if (!limit) {
            return null;
        }

        const attempts = this.attempts.get(key) || [];
        const now = Date.now();
        const validAttempts = attempts.filter(timestamp => 
            now - timestamp < limit.window
        );

        return {
            used: validAttempts.length,
            limit: limit.max,
            remaining: Math.max(0, limit.max - validAttempts.length),
            resetAt: validAttempts.length > 0 
                ? Math.min(...validAttempts) + limit.window 
                : null
        };
    }
}

// Create singleton instance
export const rateLimiter = new RateLimiter();

// Helper function for API calls with rate limiting
export async function rateLimitedFetch(url, options = {}, action = 'api') {
    const check = rateLimiter.check(action);
    
    if (!check.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${check.retryAfter} seconds.`);
    }

    try {
        const response = await fetch(url, options);
        
        // Update rate limit headers if present
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = response.headers.get('X-RateLimit-Reset');
        
        if (remaining !== null || reset !== null) {
            // Server-side rate limits take precedence
            console.log('Server rate limits:', { remaining, reset });
        }
        
        return response;
    } catch (error) {
        // Don't count failed requests against rate limit
        rateLimiter.reset(action);
        throw error;
    }
}