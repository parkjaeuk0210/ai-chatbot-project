import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { fileURLToPath, URL } from 'node:url';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Custom plugin to copy static files
const copyStaticFiles = () => ({
  name: 'copy-static-files',
  closeBundle() {
    try {
      // Copy manifest.json
      copyFileSync('./manifest.json', './dist/manifest.json');
      
      // Copy sw.js
      copyFileSync('./sw.js', './dist/sw.js');
      
      // Create directories if they don't exist
      mkdirSync('./dist/icons', { recursive: true });
      mkdirSync('./dist/css', { recursive: true });
      
      // Copy icon
      copyFileSync('./icons/icon.svg', './dist/icons/icon.svg');
      
      // Copy a11y.css
      copyFileSync('./css/a11y.css', './dist/css/a11y.css');
      
      // Copy styles.css
      try {
        copyFileSync('./css/styles.css', './dist/css/styles.css');
      } catch (e) {
        console.warn('styles.css not found');
      }
    } catch (err) {
      console.warn('Warning: Could not copy some static files:', err.message);
    }
  }
});

export default defineConfig({
  root: './',
  base: '/',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        secure: fileURLToPath(new URL('./index-secure.html', import.meta.url))
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks(id) {
          // Vendor dependencies
          if (id.includes('node_modules/@supabase')) {
            return 'vendor';
          }
          
          // External monitoring dependencies (loaded dynamically)
          if (id.includes('node_modules/@sentry') || 
              id.includes('node_modules/web-vitals') ||
              id.includes('node_modules/jspdf')) {
            return 'external';
          }
          
          // Internal chunks
          if (id.includes('/js/i18n/')) {
            return 'i18n';
          }
          if (id.includes('/js/utils/') || id.includes('/js/utils.js') || id.includes('/js/security.js')) {
            return 'utils';
          }
          if (id.includes('/js/components/')) {
            return 'components';
          }
          if (id.includes('/js/features/')) {
            return 'features';
          }
          if (id.includes('/js/monitoring/')) {
            return 'monitoring';
          }
          if (id.includes('/js/chat.js')) {
            return 'chat';
          }
        }
      }
    }
  },
  
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    }),
    copyStaticFiles()
  ],
  
  server: {
    port: 5500,
    open: true
  },
  
  optimizeDeps: {
    include: [
      '@supabase/supabase-js',
      '@sentry/browser',
      '@sentry/tracing',
      'web-vitals',
      'jspdf'
    ]
  },
  
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./js', import.meta.url)),
      '@api': fileURLToPath(new URL('./api', import.meta.url)),
      '@types': fileURLToPath(new URL('./types', import.meta.url))
    },
    extensions: ['.ts', '.js', '.json']
  },
  
  esbuild: {
    target: 'es2020'
  }
});