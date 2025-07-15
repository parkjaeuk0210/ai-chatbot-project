import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    // Test environment
    environment: 'happy-dom',
    
    // Global test APIs
    globals: true,
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'tests/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    
    // Test timeout
    testTimeout: 20000,
    
    // Retry failed tests
    retry: process.env.CI ? 2 : 0,
    
    // Reporter
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    
    // Output file for junit reporter
    outputFile: {
      junit: './test-results/junit.xml',
    },
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './js'),
      '@components': resolve(__dirname, './js/components'),
      '@services': resolve(__dirname, './js/services'),
      '@types': resolve(__dirname, './types'),
      '@utils': resolve(__dirname, './js/utils'),
    },
  },
});