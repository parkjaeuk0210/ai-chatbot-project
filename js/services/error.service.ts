// Error Service - Centralized error handling and logging

export interface ErrorLog {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  error?: Error;
  context?: Record<string, any>;
  stack?: string;
  userAgent?: string;
  url?: string;
}

export class ErrorService {
  private errorLogs: ErrorLog[] = [];
  private maxLogs: number = 100;
  private listeners: ((error: ErrorLog) => void)[] = [];
  private isProduction: boolean = process.env.NODE_ENV === 'production';

  constructor() {
    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.logError('Uncaught error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
      event.preventDefault();
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled promise rejection', new Error(String(event.reason)), {
        promise: event.promise,
      });
      event.preventDefault();
    });
  }

  /**
   * Log an error
   */
  logError(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      error: error instanceof Error ? error : new Error(String(error)),
      context,
      stack: error instanceof Error ? error.stack : undefined,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.addLog(errorLog);
    this.notifyListeners(errorLog);

    // Console log in development
    if (!this.isProduction) {
      console.error(`[ERROR] ${message}`, error, context);
    }

    // Send to monitoring service in production
    if (this.isProduction) {
      this.sendToMonitoring(errorLog);
    }
  }

  /**
   * Log a warning
   */
  logWarn(message: string, context?: Record<string, any>): void {
    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.addLog(log);

    if (!this.isProduction) {
      console.warn(`[WARN] ${message}`, context);
    }
  }

  /**
   * Log info
   */
  logInfo(message: string, context?: Record<string, any>): void {
    if (this.isProduction) return; // Don't log info in production

    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    };

    this.addLog(log);
    console.info(`[INFO] ${message}`, context);
  }

  /**
   * Log debug
   */
  logDebug(message: string, context?: Record<string, any>): void {
    if (this.isProduction) return; // Don't log debug in production

    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
    };

    this.addLog(log);
    console.debug(`[DEBUG] ${message}`, context);
  }

  /**
   * Add log entry
   */
  private addLog(log: ErrorLog): void {
    this.errorLogs.push(log);
    
    // Keep only recent logs
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogs);
    }
  }

  /**
   * Get error logs
   */
  getErrorLogs(level?: ErrorLog['level']): ErrorLog[] {
    if (level) {
      return this.errorLogs.filter(log => log.level === level);
    }
    return [...this.errorLogs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.errorLogs = [];
  }

  /**
   * Subscribe to error events
   */
  subscribe(listener: (error: ErrorLog) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify listeners
   */
  private notifyListeners(error: ErrorLog): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  /**
   * Send error to monitoring service
   */
  private async sendToMonitoring(error: ErrorLog): Promise<void> {
    try {
      // In production, you would send to Sentry, LogRocket, etc.
      // For now, we'll just store in localStorage
      const errors = JSON.parse(localStorage.getItem('error_logs') || '[]');
      errors.push(error);
      
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }
      
      localStorage.setItem('error_logs', JSON.stringify(errors));
    } catch (err) {
      // Fail silently
    }
  }

  /**
   * Generate error report
   */
  generateErrorReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errors: this.errorLogs,
      errorCount: {
        error: this.errorLogs.filter(l => l.level === 'error').length,
        warn: this.errorLogs.filter(l => l.level === 'warn').length,
        info: this.errorLogs.filter(l => l.level === 'info').length,
        debug: this.errorLogs.filter(l => l.level === 'debug').length,
      },
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Download error report
   */
  downloadErrorReport(): void {
    const report = this.generateErrorReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Singleton instance
export const errorService = new ErrorService();