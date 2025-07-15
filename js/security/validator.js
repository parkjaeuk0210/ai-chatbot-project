/**
 * Input validation and sanitization utilities
 */

export class InputValidator {
    constructor() {
        this.patterns = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
            alphanumeric: /^[a-zA-Z0-9]+$/,
            safeText: /^[a-zA-Z0-9\s\-\_\.\,\!\?\@\#\$\%\&\*\(\)\[\]\{\}\:\;\'\"\u3131-\u314e\u314f-\u3163\uac00-\ud7a3\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+$/,
            noScript: /<script|<\/script|javascript:|on\w+\s*=/i,
            sqlInjection: /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)|(--)|(;)|(\/\*)|(\*\/)/i
        };
        
        this.limits = {
            message: 5000,
            url: 2048,
            filename: 255,
            persona: 1000
        };
    }

    validate(input, type) {
        if (typeof input !== 'string') {
            return { valid: false, error: 'Input must be a string' };
        }

        // Check length limits
        const limit = this.limits[type];
        if (limit && input.length > limit) {
            return { 
                valid: false, 
                error: `Input exceeds maximum length of ${limit} characters` 
            };
        }

        // Check for malicious patterns
        if (this.patterns.noScript.test(input)) {
            return { 
                valid: false, 
                error: 'Input contains potentially malicious script content' 
            };
        }

        if (this.patterns.sqlInjection.test(input)) {
            return { 
                valid: false, 
                error: 'Input contains potentially malicious SQL patterns' 
            };
        }

        // Type-specific validation
        switch (type) {
            case 'email':
                if (!this.patterns.email.test(input)) {
                    return { valid: false, error: 'Invalid email format' };
                }
                break;
                
            case 'url':
                if (!this.patterns.url.test(input)) {
                    return { valid: false, error: 'Invalid URL format' };
                }
                break;
                
            case 'message':
            case 'persona':
                // Allow most characters for messages, but still check for scripts
                if (input.trim().length === 0) {
                    return { valid: false, error: 'Input cannot be empty' };
                }
                break;
                
            case 'filename':
                // Check for path traversal attempts
                if (input.includes('..') || input.includes('/') || input.includes('\\')) {
                    return { valid: false, error: 'Invalid filename' };
                }
                break;
        }

        return { valid: true };
    }

    sanitize(input, type) {
        if (typeof input !== 'string') {
            return '';
        }

        let sanitized = input;

        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');

        // Type-specific sanitization
        switch (type) {
            case 'html':
                // Basic HTML sanitization
                sanitized = sanitized
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/\//g, '&#x2F;');
                break;
                
            case 'url':
                // URL encode special characters
                try {
                    const url = new URL(sanitized);
                    sanitized = url.href;
                } catch (e) {
                    sanitized = encodeURI(sanitized);
                }
                break;
                
            case 'filename':
                // Remove special characters from filenames
                sanitized = sanitized.replace(/[^a-zA-Z0-9\-\_\.]/g, '_');
                break;
                
            case 'message':
                // Preserve formatting but remove scripts
                sanitized = sanitized
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '');
                break;
        }

        // Trim to length limit
        const limit = this.limits[type];
        if (limit && sanitized.length > limit) {
            sanitized = sanitized.substring(0, limit);
        }

        return sanitized;
    }

    validateFile(file, options = {}) {
        const {
            maxSize = 10 * 1024 * 1024, // 10MB default
            allowedTypes = [],
            allowedExtensions = []
        } = options;

        if (!file || typeof file !== 'object') {
            return { valid: false, error: 'Invalid file object' };
        }

        // Check file size
        if (file.size > maxSize) {
            return { 
                valid: false, 
                error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB` 
            };
        }

        // Check MIME type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
            return { 
                valid: false, 
                error: `File type ${file.type} is not allowed` 
            };
        }

        // Check file extension
        if (allowedExtensions.length > 0 && file.name) {
            const extension = file.name.split('.').pop().toLowerCase();
            if (!allowedExtensions.includes(extension)) {
                return { 
                    valid: false, 
                    error: `File extension .${extension} is not allowed` 
                };
            }
        }

        // Check for double extensions (potential attack vector)
        if (file.name && file.name.split('.').length > 2) {
            const parts = file.name.split('.');
            const suspiciousExtensions = ['exe', 'scr', 'bat', 'cmd', 'com'];
            for (let i = 0; i < parts.length - 1; i++) {
                if (suspiciousExtensions.includes(parts[i].toLowerCase())) {
                    return { 
                        valid: false, 
                        error: 'Suspicious file name detected' 
                    };
                }
            }
        }

        return { valid: true };
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Create singleton instance
export const validator = new InputValidator();