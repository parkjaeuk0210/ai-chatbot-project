import { describe, it, expect, vi } from 'vitest';
import {
  generateSessionId,
  debounce,
  throttle,
  formatBytes,
  formatRelativeTime,
  getTimestamp,
  deepClone,
  sleep,
  retry,
  memoize,
  escapeRegExp,
  formatErrorMessage,
} from '../../js/utils';

describe('Utils', () => {
  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      
      expect(id1).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(fn).not.toHaveBeenCalled();
      
      await sleep(150);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', async () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);
      
      throttledFn();
      throttledFn();
      throttledFn();
      
      expect(fn).toHaveBeenCalledTimes(1);
      
      await sleep(150);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time correctly', () => {
      const now = new Date();
      
      expect(formatRelativeTime(now)).toBe('just now');
      expect(formatRelativeTime(new Date(now.getTime() - 30000))).toBe('just now');
      expect(formatRelativeTime(new Date(now.getTime() - 120000))).toBe('2 minutes ago');
      expect(formatRelativeTime(new Date(now.getTime() - 3600000))).toBe('1 hour ago');
      expect(formatRelativeTime(new Date(now.getTime() - 86400000))).toBe('1 day ago');
    });
  });

  describe('getTimestamp', () => {
    it('should return ISO timestamp string', () => {
      const timestamp = getTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('deepClone', () => {
    it('should deep clone objects', () => {
      const original = {
        a: 1,
        b: { c: 2, d: [3, 4, 5] },
        e: new Date(),
      };
      
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
      expect(cloned.e).not.toBe(original.e);
    });
  });

  describe('retry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
        return 'success';
      });
      
      const result = await retry(fn, 3, 10);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(retry(fn, 3, 10)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('memoize', () => {
    it('should memoize function results', () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoizedFn = memoize(fn);
      
      expect(memoizedFn(5)).toBe(10);
      expect(memoizedFn(5)).toBe(10);
      expect(memoizedFn(10)).toBe(20);
      
      expect(fn).toHaveBeenCalledTimes(2); // Only called twice, not three times
    });
  });

  describe('formatErrorMessage', () => {
    it('should format error messages correctly', () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'NETWORK_ERROR';
      
      const formatted = formatErrorMessage(networkError);
      expect(formatted.type).toBe('network');
      expect(formatted.isRetryable).toBe(true);
    });
  });
});