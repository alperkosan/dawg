import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    // Workers need ES modules to allow code-splitting (IIFE breaks Vite build on Vercel)
    format: 'es'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/layout': path.resolve(__dirname, './src/layout'),
      '@/assets': path.resolve(__dirname, './src/assets'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // ✅ CODE SPLITTING: Manual chunks for better optimization
        manualChunks: {
          // Vendor chunks - separate large dependencies
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'audio-vendor': [
            // Large audio libraries can be split if needed
          ],
          // Feature-based chunks
          'pages': [
            './src/pages/AdminPanel',
            './src/pages/ProjectsPage',
            './src/pages/RenderPage',
          ],
          'media': [
            './src/features/media_panel/MediaPanel',
          ],
        },
        // Chunk size warning limit (default: 500KB)
        chunkSizeWarningLimit: 1000, // Increase to 1MB for audio apps
      },
    },
    // Target modern browsers for better tree-shaking
    target: 'esnext',
    // Minify options
    minify: 'esbuild',
    // Source maps for production debugging (optional)
    sourcemap: false,
  },
})

