// Accessibility (a11y) Helper Module

export interface A11yConfig {
  announceDelay?: number;
  focusTrapEnabled?: boolean;
  keyboardNavEnabled?: boolean;
  highContrastMode?: boolean;
  reducedMotion?: boolean;
}

export class AccessibilityManager {
  private config: A11yConfig;
  private liveRegion: HTMLElement | null = null;
  private focusTrapStack: HTMLElement[] = [];
  private originalTabIndices: WeakMap<HTMLElement, string | null> = new WeakMap();

  constructor(config: A11yConfig = {}) {
    this.config = {
      announceDelay: 100,
      focusTrapEnabled: true,
      keyboardNavEnabled: true,
      highContrastMode: false,
      reducedMotion: false,
      ...config,
    };
    
    this.init();
  }

  /**
   * Initialize accessibility features
   */
  private init(): void {
    this.createLiveRegion();
    this.setupKeyboardNavigation();
    this.detectUserPreferences();
    this.setupFocusIndicators();
  }

  /**
   * Create ARIA live region for announcements
   */
  private createLiveRegion(): void {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.className = 'sr-only';
    document.body.appendChild(this.liveRegion);
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.liveRegion) return;
    
    this.liveRegion.setAttribute('aria-live', priority);
    
    // Clear previous message
    this.liveRegion.textContent = '';
    
    // Announce new message after delay
    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = message;
      }
    }, this.config.announceDelay);
  }

  /**
   * Set up keyboard navigation helpers
   */
  private setupKeyboardNavigation(): void {
    if (!this.config.keyboardNavEnabled) return;
    
    document.addEventListener('keydown', (e) => {
      // Skip navigation with Tab
      if (e.key === 'Tab' && e.shiftKey && e.altKey) {
        e.preventDefault();
        this.skipToMainContent();
      }
      
      // Escape key handling for modals/dialogs
      if (e.key === 'Escape' && this.focusTrapStack.length > 0) {
        const topElement = this.focusTrapStack[this.focusTrapStack.length - 1];
        const closeButton = topElement.querySelector('[data-a11y-close], .close, [aria-label*="close"]');
        if (closeButton instanceof HTMLElement) {
          closeButton.click();
        }
      }
    });
  }

  /**
   * Skip to main content
   */
  private skipToMainContent(): void {
    const main = document.querySelector('main, [role="main"], #main-content');
    if (main instanceof HTMLElement) {
      main.focus();
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.announce('Skipped to main content');
    }
  }

  /**
   * Detect user preferences
   */
  private detectUserPreferences(): void {
    // Detect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.config.reducedMotion = prefersReducedMotion.matches;
    
    prefersReducedMotion.addEventListener('change', (e) => {
      this.config.reducedMotion = e.matches;
      this.updateReducedMotion();
    });
    
    // Detect high contrast preference
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
    this.config.highContrastMode = prefersHighContrast.matches;
    
    prefersHighContrast.addEventListener('change', (e) => {
      this.config.highContrastMode = e.matches;
      this.updateHighContrast();
    });
    
    // Apply initial preferences
    this.updateReducedMotion();
    this.updateHighContrast();
  }

  /**
   * Update reduced motion styles
   */
  private updateReducedMotion(): void {
    if (this.config.reducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }

  /**
   * Update high contrast styles
   */
  private updateHighContrast(): void {
    if (this.config.highContrastMode) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }

  /**
   * Set up visible focus indicators
   */
  private setupFocusIndicators(): void {
    // Add focus-visible polyfill behavior
    let hadKeyboardEvent = true;
    const keyboardEvents = ['keydown', 'keyup'];
    const pointerEvents = ['mousedown', 'mouseup', 'touchstart', 'touchend'];
    
    keyboardEvents.forEach(event => {
      document.addEventListener(event, () => {
        hadKeyboardEvent = true;
      });
    });
    
    pointerEvents.forEach(event => {
      document.addEventListener(event, () => {
        hadKeyboardEvent = false;
      });
    });
    
    document.addEventListener('focus', (e) => {
      if (hadKeyboardEvent && e.target instanceof HTMLElement) {
        e.target.classList.add('focus-visible');
      }
    }, true);
    
    document.addEventListener('blur', (e) => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.remove('focus-visible');
      }
    }, true);
  }

  /**
   * Create focus trap for modals/dialogs
   */
  createFocusTrap(element: HTMLElement): () => void {
    if (!this.config.focusTrapEnabled) return () => {};
    
    this.focusTrapStack.push(element);
    
    // Get all focusable elements
    const focusableElements = this.getFocusableElements(element);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    // Focus first element
    if (firstFocusable) {
      firstFocusable.focus();
    }
    
    // Trap focus handler
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };
    
    element.addEventListener('keydown', trapFocus);
    
    // Make elements outside trap unfocusable
    this.makeUnfocusable(element);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', trapFocus);
      this.restoreFocusable();
      
      const index = this.focusTrapStack.indexOf(element);
      if (index > -1) {
        this.focusTrapStack.splice(index, 1);
      }
    };
  }

  /**
   * Get all focusable elements within container
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    
    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  /**
   * Make elements outside focus trap unfocusable
   */
  private makeUnfocusable(exceptElement: HTMLElement): void {
    const allFocusable = this.getFocusableElements(document.body);
    
    allFocusable.forEach((el) => {
      if (!exceptElement.contains(el)) {
        const currentTabIndex = el.getAttribute('tabindex');
        this.originalTabIndices.set(el, currentTabIndex);
        el.setAttribute('tabindex', '-1');
      }
    });
  }

  /**
   * Restore original tabindex values
   */
  private restoreFocusable(): void {
    this.originalTabIndices.forEach((originalValue, element) => {
      if (originalValue === null) {
        element.removeAttribute('tabindex');
      } else {
        element.setAttribute('tabindex', originalValue);
      }
    });
    
    this.originalTabIndices.clear();
  }

  /**
   * Add ARIA labels to interactive elements
   */
  addAriaLabels(container: HTMLElement = document.body): void {
    // Add labels to buttons without text
    container.querySelectorAll('button').forEach((button) => {
      if (!button.textContent?.trim() && !button.getAttribute('aria-label')) {
        const icon = button.querySelector('svg, i, .icon');
        if (icon) {
          // Try to infer label from icon class
          const className = icon.className;
          if (typeof className === 'string') {
            const label = this.inferLabelFromClass(className);
            if (label) {
              button.setAttribute('aria-label', label);
            }
          }
        }
      }
    });
    
    // Add labels to inputs without labels
    container.querySelectorAll('input, textarea, select').forEach((input) => {
      if (!input.getAttribute('aria-label') && !input.id) {
        const placeholder = input.getAttribute('placeholder');
        if (placeholder) {
          input.setAttribute('aria-label', placeholder);
        }
      }
    });
    
    // Add role attributes
    this.addRoleAttributes(container);
  }

  /**
   * Infer label from class name
   */
  private inferLabelFromClass(className: string): string | null {
    const labelMap: Record<string, string> = {
      'close': 'Close',
      'menu': 'Menu',
      'search': 'Search',
      'settings': 'Settings',
      'send': 'Send',
      'submit': 'Submit',
      'download': 'Download',
      'upload': 'Upload',
      'delete': 'Delete',
      'edit': 'Edit',
      'save': 'Save',
      'cancel': 'Cancel',
      'back': 'Go back',
      'forward': 'Go forward',
      'home': 'Home',
      'profile': 'Profile',
      'logout': 'Log out',
      'login': 'Log in',
    };
    
    const lowerClass = className.toLowerCase();
    
    for (const [key, label] of Object.entries(labelMap)) {
      if (lowerClass.includes(key)) {
        return label;
      }
    }
    
    return null;
  }

  /**
   * Add appropriate role attributes
   */
  private addRoleAttributes(container: HTMLElement): void {
    // Add navigation role
    container.querySelectorAll('nav, .nav, .navigation').forEach((nav) => {
      if (!nav.getAttribute('role')) {
        nav.setAttribute('role', 'navigation');
      }
    });
    
    // Add main role
    container.querySelectorAll('main, .main, #main').forEach((main) => {
      if (!main.getAttribute('role')) {
        main.setAttribute('role', 'main');
      }
    });
    
    // Add complementary role to sidebars
    container.querySelectorAll('aside, .sidebar').forEach((aside) => {
      if (!aside.getAttribute('role')) {
        aside.setAttribute('role', 'complementary');
      }
    });
    
    // Add search role
    container.querySelectorAll('.search, [type="search"]').forEach((search) => {
      const container = search.closest('form, div');
      if (container && !container.getAttribute('role')) {
        container.setAttribute('role', 'search');
      }
    });
  }

  /**
   * Make table accessible
   */
  makeTableAccessible(table: HTMLTableElement): void {
    // Add caption if missing
    if (!table.caption && table.querySelector('thead')) {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent).join(', ');
      const caption = document.createElement('caption');
      caption.className = 'sr-only';
      caption.textContent = `Table with columns: ${headers}`;
      table.appendChild(caption);
    }
    
    // Add scope to headers
    table.querySelectorAll('th').forEach((th) => {
      if (!th.getAttribute('scope')) {
        const isRowHeader = th.parentElement?.parentElement?.tagName === 'TBODY';
        th.setAttribute('scope', isRowHeader ? 'row' : 'col');
      }
    });
  }

  /**
   * Create skip links
   */
  createSkipLinks(): void {
    const skipLinksContainer = document.createElement('div');
    skipLinksContainer.className = 'skip-links';
    skipLinksContainer.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
      <a href="#search" class="skip-link">Skip to search</a>
    `;
    
    document.body.insertBefore(skipLinksContainer, document.body.firstChild);
    
    // Add CSS for skip links
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -40px;
        left: 0;
        width: 100%;
        z-index: 9999;
      }
      
      .skip-link {
        position: absolute;
        left: -9999px;
        background: #000;
        color: #fff;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 4px;
      }
      
      .skip-link:focus {
        left: 50%;
        transform: translateX(-50%);
        top: 10px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add loading state announcement
   */
  announceLoading(isLoading: boolean, context: string = 'Content'): void {
    if (isLoading) {
      this.announce(`${context} is loading, please wait`, 'polite');
    } else {
      this.announce(`${context} has finished loading`, 'polite');
    }
  }

  /**
   * Handle form validation announcements
   */
  announceFormError(fieldName: string, errorMessage: string): void {
    this.announce(`Error in ${fieldName}: ${errorMessage}`, 'assertive');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.liveRegion) {
      this.liveRegion.remove();
      this.liveRegion = null;
    }
    
    this.focusTrapStack = [];
    this.originalTabIndices.clear();
  }
}

// Create and export singleton instance
export const a11y = new AccessibilityManager();

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      a11y.createSkipLinks();
      a11y.addAriaLabels();
    });
  } else {
    a11y.createSkipLinks();
    a11y.addAriaLabels();
  }
}

// Make a11y available globally
declare global {
  interface Window {
    a11y: AccessibilityManager;
  }
}

if (typeof window !== 'undefined') {
  window.a11y = a11y;
}