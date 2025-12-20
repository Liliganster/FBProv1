import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_HASH__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || ''),
  },
  build: {
    outDir: 'dist',
    sourcemap: 'hidden',
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
          'charts': ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  preview: {
    port: 5173,
    strictPort: false,
  },
})
