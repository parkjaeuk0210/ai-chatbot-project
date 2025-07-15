// Lazy loading utilities for performance optimization

// Lazy load images with IntersectionObserver
export class ImageLazyLoader {
    constructor(options = {}) {
        this.options = {
            root: null,
            rootMargin: '50px 0px',
            threshold: 0.01,
            ...options
        };
        
        this.imageObserver = null;
        this.loadedImages = new Set();
        this.init();
    }
    
    init() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                    }
                });
            }, this.options);
        }
    }
    
    loadImage(img) {
        const src = img.dataset.src;
        if (!src || this.loadedImages.has(src)) return;
        
        // Create a new image to load
        const tempImg = new Image();
        
        tempImg.onload = () => {
            img.src = src;
            img.classList.add('loaded');
            this.loadedImages.add(src);
            
            // Stop observing this image
            if (this.imageObserver) {
                this.imageObserver.unobserve(img);
            }
        };
        
        tempImg.onerror = () => {
            img.classList.add('error');
            // Still unobserve to prevent repeated attempts
            if (this.imageObserver) {
                this.imageObserver.unobserve(img);
            }
        };
        
        tempImg.src = src;
    }
    
    observe(img) {
        if (this.imageObserver && img.dataset.src) {
            this.imageObserver.observe(img);
        } else if (!this.imageObserver) {
            // Fallback for browsers without IntersectionObserver
            this.loadImage(img);
        }
    }
    
    observeAll(container = document) {
        const images = container.querySelectorAll('img[data-src]');
        images.forEach(img => this.observe(img));
    }
    
    disconnect() {
        if (this.imageObserver) {
            this.imageObserver.disconnect();
        }
    }
}

// Lazy load scripts
export function lazyLoadScript(src, attributes = {}) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        
        // Add any additional attributes
        Object.entries(attributes).forEach(([key, value]) => {
            script.setAttribute(key, value);
        });
        
        script.onload = resolve;
        script.onerror = reject;
        
        document.head.appendChild(script);
    });
}

// Lazy load PDF.js
let pdfJsPromise = null;
export function lazyLoadPdfJs() {
    if (pdfJsPromise) return pdfJsPromise;
    
    pdfJsPromise = lazyLoadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
        .then(() => {
            // Set worker source
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            return window.pdfjsLib;
        })
        .catch(error => {
            pdfJsPromise = null; // Reset on error to allow retry
            throw error;
        });
    
    return pdfJsPromise;
}

// Preload critical resources
export function preloadResource(url, as) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = as;
    link.href = url;
    document.head.appendChild(link);
}

// Resource hints for better performance
export function addResourceHints() {
    // DNS prefetch for external domains
    const domains = [
        'https://cdnjs.cloudflare.com',
        'https://generativelanguage.googleapis.com'
    ];
    
    domains.forEach(domain => {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = domain;
        document.head.appendChild(link);
    });
    
    // Preconnect to API domain
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = 'https://generativelanguage.googleapis.com';
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);
}

// Progressive enhancement for images
export function enhanceImages(container = document) {
    const images = container.querySelectorAll('img');
    
    images.forEach(img => {
        // Add loading attribute for native lazy loading
        if (!img.loading) {
            img.loading = 'lazy';
        }
        
        // Add decoding attribute for better performance
        if (!img.decoding) {
            img.decoding = 'async';
        }
    });
}

// Create a global instance
export const imageLazyLoader = new ImageLazyLoader();