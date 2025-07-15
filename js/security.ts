// Security utilities for safe HTML rendering

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create safe HTML element with text content
 */
export function createSafeTextElement(
    tag: keyof HTMLElementTagNameMap, 
    text: string, 
    className?: string
): HTMLElement {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) {
        element.className = className;
    }
    return element;
}

/**
 * Sanitize HTML content (for markdown rendering)
 */
export function sanitizeHtml(html: string): string {
    // Basic sanitization without DOMPurify (for browser compatibility)
    // Remove script tags and event handlers
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/on\w+\s*=\s*'[^']*'/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/data:text\/html/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^>]*>/gi, '')
        .replace(/<link\b[^>]*>/gi, '');
}

/**
 * Create safe error message element
 */
export function createSafeErrorMessage(message: string): HTMLDivElement {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-red-500 text-sm mt-2';
    errorDiv.textContent = message;
    return errorDiv;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

/**
 * Create safe image element
 */
export function createSafeImage(src: string, alt: string = ''): HTMLImageElement {
    const img = document.createElement('img');
    const sanitizedSrc = sanitizeUrl(src);
    if (sanitizedSrc) {
        img.src = sanitizedSrc;
        img.alt = escapeHtml(alt);
        img.loading = 'lazy';
        // Add CSP-compliant event handlers
        img.onerror = function() {
            this.style.display = 'none';
        };
    }
    return img;
}

/**
 * Safe innerHTML setter with basic sanitization
 */
export function setSafeHtml(element: HTMLElement, html: string): HTMLElement {
    const sanitized = sanitizeHtml(html);
    element.innerHTML = sanitized;
    return element;
}

/**
 * Check if content contains potentially malicious patterns
 */
export function containsMaliciousContent(content: string): boolean {
    const maliciousPatterns = [
        /<script[^>]*>/i,
        /<iframe[^>]*>/i,
        /javascript:/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /data:text\/html/i,
        /<object[^>]*>/i,
        /<embed[^>]*>/i,
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(content));
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
    return fileName
        .replace(/[^a-zA-Z0-9\-_.]/g, '_')
        .replace(/_{2,}/g, '_')
        .slice(0, 255);
}