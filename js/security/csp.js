/**
 * Content Security Policy (CSP) Management
 */

export class CSPManager {
    constructor() {
        this.nonce = this.generateNonce();
        this.trustedTypes = null;
        this.init();
    }

    generateNonce() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array));
    }

    init() {
        // Initialize Trusted Types if available
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
            try {
                this.trustedTypes = window.trustedTypes.createPolicy('feraApp', {
                    createHTML: (input) => this.sanitizeHTML(input),
                    createScript: (input) => input, // Scripts should be carefully controlled
                    createScriptURL: (input) => {
                        // Whitelist allowed script sources
                        const allowedHosts = [
                            'https://cdnjs.cloudflare.com',
                            'https://cdn.tailwindcss.com',
                            'https://fonts.googleapis.com'
                        ];
                        
                        const url = new URL(input, window.location.href);
                        if (allowedHosts.some(host => input.startsWith(host))) {
                            return input;
                        }
                        throw new Error(`Untrusted script URL: ${input}`);
                    }
                });
            } catch (e) {
                console.warn('Trusted Types policy creation failed:', e);
            }
        }

        // Set CSP meta tag dynamically
        this.setCSPMetaTag();
    }

    setCSPMetaTag() {
        const cspContent = this.generateCSPContent();
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = cspContent;
        document.head.appendChild(meta);
    }

    generateCSPContent() {
        return [
            `default-src 'self'`,
            `script-src 'self' 'nonce-${this.nonce}' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com`,
            `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com`,
            `font-src 'self' https://fonts.gstatic.com`,
            `img-src 'self' data: blob: https:`,
            `connect-src 'self' https://fera-ai.vercel.app https://api.anthropic.com wss:`,
            `worker-src 'self' blob:`,
            `frame-src 'none'`,
            `object-src 'none'`,
            `base-uri 'self'`,
            `form-action 'self'`,
            `upgrade-insecure-requests`
        ].join('; ');
    }

    sanitizeHTML(input) {
        // Use DOMPurify if available, otherwise basic sanitization
        if (window.DOMPurify) {
            return window.DOMPurify.sanitize(input, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'div', 'span', 'pre', 'code', 'ul', 'ol', 'li'],
                ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'data-*'],
                ALLOW_DATA_ATTR: true
            });
        }

        // Fallback basic sanitization
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    createTrustedHTML(html) {
        if (this.trustedTypes) {
            return this.trustedTypes.createHTML(html);
        }
        return this.sanitizeHTML(html);
    }

    addInlineScript(scriptContent) {
        const script = document.createElement('script');
        script.setAttribute('nonce', this.nonce);
        script.textContent = scriptContent;
        document.head.appendChild(script);
    }

    getNonce() {
        return this.nonce;
    }
}

// Create singleton instance
export const cspManager = new CSPManager();