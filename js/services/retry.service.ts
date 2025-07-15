// Retry Service - Implements retry logic with exponential backoff
import { errorService } from './error.service.js';

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export class RetryService {
  private defaultOptions: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: (error) => {
      // Retry on network errors and 5xx status codes
      if (error.name === 'NetworkError' || error.message.includes('fetch')) {
        return true;
      }
      if (error.status >= 500 && error.status < 600) {
        return true;
      }
      if (error.status === 429) { // Too Many Requests
        return true;
      }
      return false;
    },
  };

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: any;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          errorService.logInfo(`Retry successful after ${attempt} attempts`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!opts.retryableErrors?.(error)) {
          errorService.logDebug('Error is not retryable', { error });
          throw error;
        }
        
        // Don't retry if we've exhausted attempts
        if (attempt === opts.maxRetries) {
          errorService.logError(`Max retries (${opts.maxRetries}) exceeded`, error);
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
          opts.maxDelay
        );
        
        errorService.logWarn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`, {
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Call retry callback if provided
        opts.onRetry?.(attempt + 1, error);
        
        // Wait before retrying
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });
    
    return Promise.race([fn(), timeoutPromise]);
  }

  /**
   * Execute function with retry and timeout
   */
  async executeWithRetryAndTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    retryOptions?: Partial<RetryOptions>
  ): Promise<T> {
    return this.executeWithRetry(
      () => this.executeWithTimeout(fn, timeout),
      retryOptions
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retryable function
   */
  createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options?: Partial<RetryOptions>
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.executeWithRetry(() => fn(...args), options);
    }) as T;
  }
}

// Singleton instance
export const retryService = new RetryService();