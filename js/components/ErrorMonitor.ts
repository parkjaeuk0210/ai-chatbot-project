// Error Monitor Component - Real-time error monitoring dashboard
import { errorService, ErrorLog } from '../services/error.service.js';
import { apiCircuitBreaker } from '../services/circuit-breaker.js';

export class ErrorMonitor {
  private container: HTMLElement | null = null;
  private isVisible: boolean = false;
  private updateInterval: number | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    // Only enable in development
    if (process.env.NODE_ENV === 'production') return;
    
    this.createMonitor();
    this.setupKeyboardShortcut();
  }

  /**
   * Create monitor UI
   */
  private createMonitor(): void {
    this.container = document.createElement('div');
    this.container.className = 'error-monitor fixed bottom-0 right-0 w-96 h-96 bg-gray-900 text-white p-4 transform translate-y-full transition-transform duration-300 z-50 overflow-hidden flex flex-col';
    this.container.style.display = 'none';
    
    // Header
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4';
    header.innerHTML = `
      <h3 class="text-lg font-semibold">Error Monitor</h3>
      <button class="hover:text-gray-300" aria-label="Close error monitor">✕</button>
    `;
    
    header.querySelector('button')?.addEventListener('click', () => this.hide());
    
    // Stats
    const stats = document.createElement('div');
    stats.className = 'error-monitor-stats grid grid-cols-2 gap-2 mb-4 text-sm';
    
    // Logs container
    const logsContainer = document.createElement('div');
    logsContainer.className = 'error-monitor-logs flex-1 overflow-y-auto space-y-2';
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'mt-4 flex gap-2';
    actions.innerHTML = `
      <button class="btn-clear px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-700">Clear Logs</button>
      <button class="btn-download px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700">Download Report</button>
    `;
    
    actions.querySelector('.btn-clear')?.addEventListener('click', () => {
      errorService.clearLogs();
      this.updateDisplay();
    });
    
    actions.querySelector('.btn-download')?.addEventListener('click', () => {
      errorService.downloadErrorReport();
    });
    
    this.container.appendChild(header);
    this.container.appendChild(stats);
    this.container.appendChild(logsContainer);
    this.container.appendChild(actions);
    
    document.body.appendChild(this.container);
  }

  /**
   * Setup keyboard shortcut
   */
  private setupKeyboardShortcut(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + E
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Show monitor
   */
  show(): void {
    if (!this.container) return;
    
    this.isVisible = true;
    this.container.style.display = 'flex';
    
    requestAnimationFrame(() => {
      this.container!.style.transform = 'translateY(0)';
    });
    
    this.startUpdating();
  }

  /**
   * Hide monitor
   */
  hide(): void {
    if (!this.container) return;
    
    this.isVisible = false;
    this.container.style.transform = 'translateY(100%)';
    
    setTimeout(() => {
      this.container!.style.display = 'none';
    }, 300);
    
    this.stopUpdating();
  }

  /**
   * Toggle monitor
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Start updating display
   */
  private startUpdating(): void {
    this.updateDisplay();
    
    // Update every second
    this.updateInterval = window.setInterval(() => {
      this.updateDisplay();
    }, 1000);
    
    // Subscribe to new errors
    this.unsubscribe = errorService.subscribe(() => {
      this.updateDisplay();
    });
  }

  /**
   * Stop updating display
   */
  private stopUpdating(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Update display
   */
  private updateDisplay(): void {
    if (!this.container) return;
    
    const logs = errorService.getErrorLogs();
    const stats = this.container.querySelector('.error-monitor-stats');
    const logsContainer = this.container.querySelector('.error-monitor-logs');
    
    if (!stats || !logsContainer) return;
    
    // Update stats
    const errorCount = logs.filter(l => l.level === 'error').length;
    const warnCount = logs.filter(l => l.level === 'warn').length;
    const circuitState = apiCircuitBreaker.getState();
    const circuitStats = apiCircuitBreaker.getStats();
    
    stats.innerHTML = `
      <div class="bg-red-800 p-2 rounded">
        <div class="text-xs text-gray-300">Errors</div>
        <div class="text-xl font-bold">${errorCount}</div>
      </div>
      <div class="bg-yellow-800 p-2 rounded">
        <div class="text-xs text-gray-300">Warnings</div>
        <div class="text-xl font-bold">${warnCount}</div>
      </div>
      <div class="bg-blue-800 p-2 rounded">
        <div class="text-xs text-gray-300">Circuit Breaker</div>
        <div class="text-sm font-bold">${circuitState}</div>
      </div>
      <div class="bg-gray-800 p-2 rounded">
        <div class="text-xs text-gray-300">Failures</div>
        <div class="text-xl font-bold">${circuitStats.failureCount}</div>
      </div>
    `;
    
    // Update logs
    const recentLogs = logs.slice(-20).reverse();
    logsContainer.innerHTML = recentLogs.map(log => this.renderLog(log)).join('');
  }

  /**
   * Render single log entry
   */
  private renderLog(log: ErrorLog): string {
    const levelColors = {
      error: 'bg-red-900',
      warn: 'bg-yellow-900',
      info: 'bg-blue-900',
      debug: 'bg-gray-800',
    };
    
    const time = new Date(log.timestamp).toLocaleTimeString();
    
    return `
      <div class="text-xs ${levelColors[log.level]} p-2 rounded">
        <div class="flex justify-between items-start">
          <span class="font-semibold">[${log.level.toUpperCase()}]</span>
          <span class="text-gray-400">${time}</span>
        </div>
        <div class="mt-1">${this.escapeHtml(log.message)}</div>
        ${log.error ? `<div class="text-gray-400 mt-1">${this.escapeHtml(log.error.message)}</div>` : ''}
      </div>
    `;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create monitor instance
let errorMonitor: ErrorMonitor | null = null;

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  errorMonitor = new ErrorMonitor();
}

export { errorMonitor };