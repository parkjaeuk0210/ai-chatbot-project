/**
 * Lazy Loading Utility
 * Provides intersection observer based lazy loading for images and components
 */

export class LazyLoader {
    constructor(options = {}) {
        this.options = {
            root: null,
            rootMargin: '50px',
            threshold: 0.01,
            ...options
        };
        
        this.observer = null;
        this.loadedElements = new WeakSet();
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                this.handleIntersection.bind(this),
                this.options
            );
        }
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !this.loadedElements.has(entry.target)) {
                this.loadElement(entry.target);
                this.loadedElements.add(entry.target);
                this.observer.unobserve(entry.target);
            }
        });
    }

    loadElement(element) {
        // Load images
        if (element.tagName === 'IMG' && element.dataset.src) {
            this.loadImage(element);
        }
        
        // Load iframes
        if (element.tagName === 'IFRAME' && element.dataset.src) {
            element.src = element.dataset.src;
            element.removeAttribute('data-src');
        }
        
        // Load components
        if (element.dataset.component) {
            this.loadComponent(element);
        }
    }

    loadImage(img) {
        const tempImg = new Image();
        
        tempImg.onload = () => {
            img.src = tempImg.src;
            img.classList.add('lazy-loaded');
            
            // Remove blur effect after load
            if (img.dataset.placeholder) {
                setTimeout(() => {
                    img.style.filter = 'none';
                    img.classList.remove('lazy-loading');
                }, 50);
            }
        };
        
        tempImg.onerror = () => {
            if (img.dataset.fallback) {
                img.src = img.dataset.fallback;
            }
            img.classList.add('lazy-error');
        };
        
        // Set actual src
        tempImg.src = img.dataset.src;
        img.removeAttribute('data-src');
    }

    async loadComponent(element) {
        const componentName = element.dataset.component;
        
        try {
            // Dynamic import for code splitting
            const module = await import(`../components/${componentName}.js`);
            const Component = module.default || module[componentName];
            
            if (Component) {
                const instance = new Component(element);
                element.classList.add('component-loaded');
            }
        } catch (error) {
            console.error(`Failed to load component: ${componentName}`, error);
            element.classList.add('component-error');
        }
    }

    observe(element) {
        if (this.observer && element) {
            this.observer.observe(element);
        } else if (!this.observer) {
            // Fallback for browsers without IntersectionObserver
            this.loadElement(element);
        }
    }

    observeAll(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => this.observe(element));
    }

    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// Create singleton instance
export const lazyLoader = new LazyLoader();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        lazyLoader.observeAll('[data-src], [data-component]');
    });
} else {
    lazyLoader.observeAll('[data-src], [data-component]');
}