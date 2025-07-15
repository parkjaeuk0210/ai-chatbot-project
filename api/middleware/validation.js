// Enhanced input validation middleware
import { createValidationError } from './errorHandler.js';
export function validateChatInput(data) {
    const errors = [];
    
    // Check required fields
    if (!data.chatHistory) {
        errors.push({ field: 'chatHistory', message: 'chatHistory is required' });
    } else if (!Array.isArray(data.chatHistory)) {
        errors.push({ field: 'chatHistory', message: 'chatHistory must be an array' });
    } else {
        // Validate chatHistory structure
        if (data.chatHistory.length === 0) {
            errors.push({ field: 'chatHistory', message: 'chatHistory cannot be empty' });
        } else if (data.chatHistory.length > 100) {
            errors.push({ field: 'chatHistory', message: 'chatHistory too long (max 100 messages)' });
        }
        
        for (let i = 0; i < data.chatHistory.length; i++) {
            const msg = data.chatHistory[i];
            if (!msg.role || !['user', 'model', 'assistant'].includes(msg.role)) {
                errors.push({ field: `chatHistory[${i}].role`, message: 'Invalid role. Must be "user", "model", or "assistant"' });
            }
            if (!msg.parts || !Array.isArray(msg.parts)) {
                errors.push({ field: `chatHistory[${i}].parts`, message: 'Message parts must be an array' });
            } else if (msg.parts.length === 0) {
                errors.push({ field: `chatHistory[${i}].parts`, message: 'Message parts cannot be empty' });
            } else {
                // Check each part
                for (let j = 0; j < msg.parts.length; j++) {
                    const part = msg.parts[j];
                    if (!part.text && !part.inlineData) {
                        errors.push({ field: `chatHistory[${i}].parts[${j}]`, message: 'Part must have either text or inlineData' });
                    }
                    if (part.text && typeof part.text !== 'string') {
                        errors.push({ field: `chatHistory[${i}].parts[${j}].text`, message: 'Text must be a string' });
                    }
                    // Limit text length
                    if (part.text && part.text.length > 50000) {
                        errors.push({ field: `chatHistory[${i}].parts[${j}].text`, message: 'Text too long (max 50000 chars)' });
                    }
                    // Validate inlineData if present
                    if (part.inlineData) {
                        if (!part.inlineData.mimeType || !part.inlineData.data) {
                            errors.push({ field: `chatHistory[${i}].parts[${j}].inlineData`, message: 'inlineData must have mimeType and data' });
                        }
                        if (part.inlineData.mimeType && !part.inlineData.mimeType.match(/^(image|application)\/.+$/)) {
                            errors.push({ field: `chatHistory[${i}].parts[${j}].inlineData.mimeType`, message: 'Invalid MIME type' });
                        }
                    }
                }
            }
        }
    }
    
    // Validate sessionId (optional)
    if (data.sessionId !== undefined) {
        if (typeof data.sessionId !== 'string') {
            errors.push({ field: 'sessionId', message: 'sessionId must be a string' });
        } else if (data.sessionId.length > 100) {
            errors.push({ field: 'sessionId', message: 'sessionId too long (max 100 chars)' });
        } else if (!/^[a-zA-Z0-9_-]+$/.test(data.sessionId)) {
            errors.push({ field: 'sessionId', message: 'sessionId contains invalid characters' });
        }
    }
    
    // Validate model (optional)
    if (data.model !== undefined) {
        if (!['gemini', 'imagen'].includes(data.model)) {
            errors.push({ field: 'model', message: 'Invalid model. Must be "gemini" or "imagen"' });
        }
    }
    
    // Validate persona (optional)
    if (data.persona !== undefined) {
        if (typeof data.persona !== 'string') {
            errors.push({ field: 'persona', message: 'persona must be a string' });
        } else if (data.persona.length > 1000) {
            errors.push({ field: 'persona', message: 'persona too long (max 1000 chars)' });
        }
    }
    
    // URL validation with SSRF protection (optional)
    if (data.url !== undefined) {
        if (typeof data.url !== 'string') {
            errors.push({ field: 'url', message: 'URL must be a string' });
        } else {
            try {
                const url = new URL(data.url);
                // Block internal URLs
                const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
                const blockedPatterns = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./];
                
                if (blockedHosts.includes(url.hostname)) {
                    errors.push({ field: 'url', message: 'URL points to blocked host' });
                }
                
                for (const pattern of blockedPatterns) {
                    if (pattern.test(url.hostname)) {
                        errors.push({ field: 'url', message: 'URL points to private network' });
                    }
                }
                
                // Only allow http/https
                if (!['http:', 'https:'].includes(url.protocol)) {
                    errors.push({ field: 'url', message: 'Invalid URL protocol (only http/https allowed)' });
                }
            } catch {
                errors.push({ field: 'url', message: 'Invalid URL format' });
            }
        }
    }
    
    return errors;
}

// Sanitize input to prevent injection
export function sanitizeInput(data) {
    const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone
    
    // Sanitize text content
    if (sanitized.chatHistory && Array.isArray(sanitized.chatHistory)) {
        sanitized.chatHistory.forEach(msg => {
            if (msg.parts && Array.isArray(msg.parts)) {
                msg.parts.forEach(part => {
                    if (part.text && typeof part.text === 'string') {
                        // Remove potential script tags and dangerous content
                        part.text = part.text
                            .replace(/<script[^>]*>.*?<\/script>/gi, '')
                            .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                            .replace(/<object[^>]*>.*?<\/object>/gi, '')
                            .replace(/<embed[^>]*>/gi, '')
                            .replace(/javascript:/gi, '')
                            .replace(/on\w+\s*=/gi, '')
                            .replace(/<img[^>]*onerror[^>]*>/gi, '')
                            .replace(/<img[^>]*onload[^>]*>/gi, '')
                            .replace(/vbscript:/gi, '')
                            .replace(/data:text\/html/gi, '')
                            .trim();
                    }
                });
            }
        });
    }
    
    if (sanitized.persona) {
        sanitized.persona = sanitized.persona
            .replace(/<[^>]+>/g, '') // Remove all HTML tags
            .replace(/[<>&'"]/g, '') // Remove special characters
            .trim()
            .slice(0, 1000); // Enforce length limit
    }
    
    // Sanitize sessionId
    if (sanitized.sessionId) {
        sanitized.sessionId = sanitized.sessionId
            .replace(/[^a-zA-Z0-9\-_]/g, '') // Remove invalid characters
            .slice(0, 100); // Enforce length limit
    }
    
    // Sanitize URL
    if (sanitized.url) {
        try {
            const parsedUrl = new URL(sanitized.url);
            // Only allow http and https protocols
            if (['http:', 'https:'].includes(parsedUrl.protocol)) {
                sanitized.url = parsedUrl.href;
            } else {
                delete sanitized.url;
            }
        } catch {
            delete sanitized.url;
        }
    }
    
    return sanitized;
}

// Check request size
export function checkRequestSize(request) {
    const contentLength = request.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 1048576) { // 1MB
        return false;
    }
    return true;
}