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
        manualChunks: {
          'vendor': ['@supabase/supabase-js'],
          'i18n': [
            './js/i18n/i18n.js',
            './js/i18n/ko.js',
            './js/i18n/en.js',
            './js/i18n/zh.js',
            './js/i18n/ja.js',
            './js/i18n/id.js'
          ]
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
    include: ['@supabase/supabase-js']
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