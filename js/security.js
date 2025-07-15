// Security utilities for safe HTML rendering

import { cspManager } from './security/csp.js';
import { rateLimiter } from './security/rateLimit.js';

// Safe text encoder to prevent XSS
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create safe HTML element with text content
export function createSafeTextElement(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) {
        element.className = className;
    }
    return element;
}

// Sanitize HTML content (for markdown rendering)
export function sanitizeHtml(html) {
    // Basic sanitization without DOMPurify (for browser compatibility)
    // Remove script tags and event handlers
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/on\w+\s*=\s*'[^']*'/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^>]*>/gi, '')
        .replace(/<link\b[^>]*>/gi, '');
}

// Safe error message display
export function createSafeErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-red-500 text-sm mt-2';
    errorDiv.textContent = message;
    return errorDiv;
}

// Validate and sanitize URL
export function sanitizeUrl(url) {
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

// Create safe image element
export function createSafeImage(src, alt = '') {
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

// Safe innerHTML setter with basic sanitization
export function setSafeHtml(element, html) {
    // Use CSP manager for trusted HTML if available
    if (cspManager && cspManager.createTrustedHTML) {
        try {
            const trustedHTML = cspManager.createTrustedHTML(html);
            element.innerHTML = trustedHTML;
            return element;
        } catch (e) {
            // Fallback to basic sanitization
        }
    }
    
    const sanitized = sanitizeHtml(html);
    element.innerHTML = sanitized;
    return element;
}

// Export security managers
export { cspManager, rateLimiter };