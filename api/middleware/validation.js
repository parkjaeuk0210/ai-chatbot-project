// Input validation middleware
export function validateChatInput(data) {
    const errors = [];
    
    // Check required fields
    if (!data.chatHistory || !Array.isArray(data.chatHistory)) {
        errors.push('chatHistory must be an array');
    } else {
        // Validate chatHistory structure
        if (data.chatHistory.length > 100) {
            errors.push('chatHistory too long (max 100 messages)');
        }
        
        for (let i = 0; i < data.chatHistory.length; i++) {
            const msg = data.chatHistory[i];
            if (!msg.role || !['user', 'model'].includes(msg.role)) {
                errors.push(`Invalid role at index ${i}`);
            }
            if (!msg.parts || !Array.isArray(msg.parts)) {
                errors.push(`Invalid parts at index ${i}`);
            } else {
                // Check each part
                for (let j = 0; j < msg.parts.length; j++) {
                    const part = msg.parts[j];
                    if (!part.text || typeof part.text !== 'string') {
                        errors.push(`Invalid text in part ${j} of message ${i}`);
                    }
                    // Limit text length
                    if (part.text && part.text.length > 10000) {
                        errors.push(`Text too long in part ${j} of message ${i} (max 10000 chars)`);
                    }
                }
            }
        }
    }
    
    // Validate sessionId
    if (!data.sessionId || typeof data.sessionId !== 'string') {
        errors.push('sessionId is required and must be a string');
    } else if (data.sessionId.length > 100) {
        errors.push('sessionId too long (max 100 chars)');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(data.sessionId)) {
        errors.push('sessionId contains invalid characters');
    }
    
    // Validate model
    if (data.model) {
        const validModels = ['gemini-2.5-flash-lite-preview-06-17', 'imagen'];
        if (!validModels.includes(data.model)) {
            errors.push('Invalid model specified');
        }
    }
    
    // Validate persona
    if (data.persona) {
        if (typeof data.persona !== 'string') {
            errors.push('persona must be a string');
        } else if (data.persona.length > 1000) {
            errors.push('persona too long (max 1000 chars)');
        }
    }
    
    // URL validation with SSRF protection
    if (data.url) {
        try {
            const url = new URL(data.url);
            // Block internal URLs
            const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
            const blockedPatterns = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./];
            
            if (blockedHosts.includes(url.hostname)) {
                errors.push('URL points to blocked host');
            }
            
            for (const pattern of blockedPatterns) {
                if (pattern.test(url.hostname)) {
                    errors.push('URL points to private network');
                }
            }
            
            // Only allow http/https
            if (!['http:', 'https:'].includes(url.protocol)) {
                errors.push('Invalid URL protocol (only http/https allowed)');
            }
        } catch {
            errors.push('Invalid URL format');
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
                            .replace(/<img[^>]*onload[^>]*>/gi, '');
                    }
                });
            }
        });
    }
    
    if (sanitized.persona) {
        sanitized.persona = sanitized.persona
            .replace(/<[^>]+>/g, '') // Remove all HTML tags
            .slice(0, 1000); // Enforce length limit
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