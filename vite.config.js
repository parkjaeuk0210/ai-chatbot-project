import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

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
        main: resolve(__dirname, 'index.html'),
        secure: resolve(__dirname, 'index-secure.html')
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
    })
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
      '@': resolve(__dirname, './js'),
      '@api': resolve(__dirname, './api'),
      '@types': resolve(__dirname, './types')
    },
    extensions: ['.ts', '.js', '.json']
  },
  
  esbuild: {
    target: 'es2020'
  }
});