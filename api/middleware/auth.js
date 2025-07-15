// Authentication middleware
import crypto from 'crypto';

// Generate API key
export function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

// Verify API key
export async function verifyApiKey(request) {
    const authHeader = request.headers.authorization || request.headers.Authorization;
    
    if (!authHeader) {
        return { valid: false, error: 'Missing authorization header' };
    }
    
    // Expected format: "Bearer API_KEY"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return { valid: false, error: 'Invalid authorization format' };
    }
    
    const apiKey = parts[1];
    
    // In production, validate against database or environment variable
    // For now, we'll check against an environment variable
    const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];
    
    // Allow requests without API key in development
    if (process.env.NODE_ENV !== 'production' && validApiKeys.length === 0) {
        return { valid: true, apiKey: 'dev-mode' };
    }
    
    if (!validApiKeys.includes(apiKey)) {
        return { valid: false, error: 'Invalid API key' };
    }
    
    return { valid: true, apiKey };
}

// Rate limiting per API key
const apiKeyRateLimits = new Map();

export function checkApiKeyRateLimit(apiKey, limit = 100, window = 60000) {
    const now = Date.now();
    const key = `ratelimit:${apiKey}`;
    
    const requests = apiKeyRateLimits.get(key) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < window);
    
    if (validRequests.length >= limit) {
        return { 
            allowed: false, 
            remaining: 0,
            resetAt: Math.min(...validRequests) + window
        };
    }
    
    validRequests.push(now);
    apiKeyRateLimits.set(key, validRequests);
    
    // Cleanup old entries
    if (apiKeyRateLimits.size > 1000) {
        for (const [k, v] of apiKeyRateLimits.entries()) {
            if (v.length === 0 || now - v[v.length - 1] > window) {
                apiKeyRateLimits.delete(k);
            }
        }
    }
    
    return { 
        allowed: true, 
        remaining: limit - validRequests.length,
        resetAt: now + window
    };
}

// Middleware function
export async function authenticate(request, response) {
    const authResult = await verifyApiKey(request);
    
    if (!authResult.valid) {
        response.status(401).json({ 
            message: 'Authentication required',
            error: authResult.error
        });
        return false;
    }
    
    // Check rate limit for this API key
    const rateLimitResult = checkApiKeyRateLimit(authResult.apiKey);
    
    if (!rateLimitResult.allowed) {
        response.status(429).json({ 
            message: 'API key rate limit exceeded',
            retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
        });
        return false;
    }
    
    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', '100');
    response.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.setHeader('X-RateLimit-Reset', new Date(rateLimitResult.resetAt).toISOString());
    
    // Attach API key to request for logging
    request.apiKey = authResult.apiKey;
    
    return true;
}