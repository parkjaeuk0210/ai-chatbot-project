// Toast Component - User-friendly notification system

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
  dismissible?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
  icon?: string;
}

export class ToastManager {
  private container: HTMLElement | null = null;
  private toasts: Map<string, HTMLElement> = new Map();
  private position: ToastPosition = 'top-right';

  constructor() {
    this.createContainer();
  }

  /**
   * Create toast container
   */
  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.className = 'toast-container fixed z-50 pointer-events-none';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-label', 'Notifications');
    this.updateContainerPosition();
    document.body.appendChild(this.container);
  }

  /**
   * Update container position
   */
  private updateContainerPosition(): void {
    if (!this.container) return;

    const positionClasses = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
      'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
    };

    // Remove all position classes
    Object.values(positionClasses).forEach(cls => {
      cls.split(' ').forEach(c => this.container?.classList.remove(c));
    });

    // Add new position classes
    const classes = positionClasses[this.position];
    classes.split(' ').forEach(c => this.container?.classList.add(c));
  }

  /**
   * Show toast notification
   */
  show(options: ToastOptions): string {
    const toast = this.createToast(options);
    const id = this.generateId();
    
    this.toasts.set(id, toast);
    this.container?.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto dismiss
    if (options.duration !== 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, options.duration || 5000);
    }

    return id;
  }

  /**
   * Create toast element
   */
  private createToast(options: ToastOptions): HTMLElement {
    const toast = document.createElement('div');
    toast.className = `toast pointer-events-auto flex items-start gap-3 p-4 mb-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-0 opacity-0`;
    
    // Add type-specific classes
    const typeClasses = {
      success: 'bg-green-600 text-white',
      error: 'bg-red-600 text-white',
      warning: 'bg-yellow-500 text-white',
      info: 'bg-blue-600 text-white',
    };
    
    toast.classList.add(...(typeClasses[options.type || 'info'].split(' ')));

    // Icon
    const icon = this.getIcon(options.type || 'info', options.icon);
    if (icon) {
      const iconElement = document.createElement('div');
      iconElement.className = 'flex-shrink-0';
      iconElement.innerHTML = icon;
      toast.appendChild(iconElement);
    }

    // Content
    const content = document.createElement('div');
    content.className = 'flex-1';
    
    // Message
    const message = document.createElement('div');
    message.className = 'text-sm font-medium';
    message.textContent = options.message;
    content.appendChild(message);

    // Action button
    if (options.action) {
      const action = document.createElement('button');
      action.className = 'text-sm underline hover:no-underline mt-1';
      action.textContent = options.action.label;
      action.onclick = () => {
        options.action!.handler();
        this.dismissByElement(toast);
      };
      content.appendChild(action);
    }

    toast.appendChild(content);

    // Dismiss button
    if (options.dismissible !== false) {
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'flex-shrink-0 ml-2 hover:opacity-70';
      dismissBtn.setAttribute('aria-label', 'Dismiss notification');
      dismissBtn.innerHTML = `
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      `;
      dismissBtn.onclick = () => this.dismissByElement(toast);
      toast.appendChild(dismissBtn);
    }

    return toast;
  }

  /**
   * Get icon for toast type
   */
  private getIcon(type: ToastType, customIcon?: string): string {
    if (customIcon) return customIcon;

    const icons = {
      success: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>`,
      error: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>`,
      warning: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>`,
      info: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>`,
    };

    return icons[type];
  }

  /**
   * Dismiss toast
   */
  dismiss(id: string): void {
    const toast = this.toasts.get(id);
    if (!toast) return;

    this.dismissByElement(toast);
    this.toasts.delete(id);
  }

  /**
   * Dismiss by element
   */
  private dismissByElement(toast: HTMLElement): void {
    toast.classList.remove('show');
    toast.classList.add('hide');
    
    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.toasts.forEach((_, id) => {
      this.dismiss(id);
    });
  }

  /**
   * Set default position
   */
  setPosition(position: ToastPosition): void {
    this.position = position;
    this.updateContainerPosition();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Convenience methods
  success(message: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, message, type: 'success' });
  }

  error(message: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, message, type: 'error' });
  }

  warning(message: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, message, type: 'warning' });
  }

  info(message: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, message, type: 'info' });
  }
}

// Singleton instance
export const toastManager = new ToastManager();

// Add CSS for toast animations
const style = document.createElement('style');
style.textContent = `
  .toast {
    max-width: 400px;
  }
  
  .toast.show {
    opacity: 1;
    transform: translateX(0);
  }
  
  .toast.hide {
    opacity: 0;
    transform: translateX(100%);
  }
  
  .toast-container.top-left .toast.hide,
  .toast-container.bottom-left .toast.hide {
    transform: translateX(-100%);
  }
`;
document.head.appendChild(style);