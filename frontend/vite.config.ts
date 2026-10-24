import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Long-lived vendor chunks: app deploys do not bust the React / supabase-js cache.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            'lucide-react',
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/pdf': {
        target: 'http://127.0.0.1:3847',
        changeOrigin: true,
        rewrite: (p) => (p === '/api/pdf' ? '/pdf' : p.replace(/^\/api/, '')),
      },
    },
  },
})
