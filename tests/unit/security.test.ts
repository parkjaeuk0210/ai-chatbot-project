import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeInput,
  validateURL,
  isValidImageUrl,
  containsScriptTag,
  containsSQLInjection,
  containsMaliciousContent,
  sanitizeFileName,
  validateFileType,
  validateFileSize,
  setSafeHtml,
  createSafeTextElement,
} from '../../js/security';

describe('Security Utils', () => {
  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
      expect(escapeHtml("Hello & 'World'")).toBe("Hello &amp; &#39;World&#39;");
      expect(escapeHtml('Test "quotes" and <tags>')).toBe(
        'Test &quot;quotes&quot; and &lt;tags&gt;'
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize dangerous input', () => {
      expect(sanitizeInput('<script>alert(1)</script>Hello')).toBe('Hello');
      expect(sanitizeInput('Normal text')).toBe('Normal text');
      expect(sanitizeInput('javascript:void(0)')).toBe('');
      expect(sanitizeInput('Test\x00null\x00byte')).toBe('Testnullbyte');
    });
  });

  describe('validateURL', () => {
    it('should validate URLs correctly', () => {
      expect(validateURL('https://example.com')).toBe(true);
      expect(validateURL('http://localhost:3000')).toBe(true);
      expect(validateURL('javascript:alert(1)')).toBe(false);
      expect(validateURL('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(validateURL('not a url')).toBe(false);
    });
  });

  describe('isValidImageUrl', () => {
    it('should validate image URLs', () => {
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.png')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.gif')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.webp')).toBe(true);
      expect(isValidImageUrl('https://example.com/file.pdf')).toBe(false);
      expect(isValidImageUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('containsScriptTag', () => {
    it('should detect script tags', () => {
      expect(containsScriptTag('<script>alert(1)</script>')).toBe(true);
      expect(containsScriptTag('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
      expect(containsScriptTag('< script >alert(1)</ script >')).toBe(true);
      expect(containsScriptTag('Normal text')).toBe(false);
    });
  });

  describe('containsSQLInjection', () => {
    it('should detect SQL injection patterns', () => {
      expect(containsSQLInjection("1' OR '1'='1")).toBe(true);
      expect(containsSQLInjection('DROP TABLE users')).toBe(true);
      expect(containsSQLInjection('UNION SELECT * FROM')).toBe(true);
      expect(containsSQLInjection('Normal query')).toBe(false);
    });
  });

  describe('sanitizeFileName', () => {
    it('should sanitize file names', () => {
      expect(sanitizeFileName('normal-file.txt')).toBe('normal-file.txt');
      expect(sanitizeFileName('../../../etc/passwd')).toBe('etcpasswd');
      expect(sanitizeFileName('file<>:"|?*name.txt')).toBe('filename.txt');
      expect(sanitizeFileName('my file.txt')).toBe('my_file.txt');
    });
  });

  describe('validateFileType', () => {
    it('should validate file types', () => {
      const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      const exeFile = new File([''], 'test.exe', { type: 'application/exe' });
      
      expect(validateFileType(imageFile)).toBe(true);
      expect(validateFileType(pdfFile)).toBe(true);
      expect(validateFileType(exeFile)).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should validate file sizes', () => {
      const smallFile = new File(['a'.repeat(1024 * 1024)], 'small.txt');
      const largeFile = new File(['a'.repeat(6 * 1024 * 1024)], 'large.txt');
      
      expect(validateFileSize(smallFile)).toBe(true);
      expect(validateFileSize(largeFile)).toBe(false);
      expect(validateFileSize(smallFile, 2)).toBe(true);
      expect(validateFileSize(largeFile, 10)).toBe(true);
    });
  });

  describe('setSafeHtml', () => {
    it('should safely set HTML content', () => {
      const element = document.createElement('div');
      setSafeHtml(element, '<p>Safe content</p><script>alert(1)</script>');
      
      expect(element.innerHTML).toContain('<p>Safe content</p>');
      expect(element.innerHTML).not.toContain('<script>');
    });
  });

  describe('createSafeTextElement', () => {
    it('should create safe text elements', () => {
      const element = createSafeTextElement(
        'div',
        '<script>alert(1)</script>Text',
        'test-class'
      );
      
      expect(element.tagName).toBe('DIV');
      expect(element.textContent).toBe('<script>alert(1)</script>Text');
      expect(element.innerHTML).not.toContain('<script>');
      expect(element.className).toBe('test-class');
    });
  });
});