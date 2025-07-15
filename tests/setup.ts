// Test setup file
import '@testing-library/jest-dom/vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-api-key';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock crypto.randomUUID
Object.defineProperty(global.crypto, 'randomUUID', {
  value: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
});

// Mock fetch globally
global.fetch = vi.fn();

// Helper to reset all mocks
beforeEach(() => {
  vi.clearAllMocks();
});

// Suppress console errors in tests (optional)
if (process.env.SUPPRESS_TEST_CONSOLE) {
  global.console = {
    ...console,
    error: vi.fn(),
    warn: vi.fn(),
  };
}