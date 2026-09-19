import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split the heaviest, least-often-used libraries into their own
        // cached chunks. Combined with the route-level lazy-loading in
        // App.jsx, this means someone who never opens the admin map or
        // analytics pages never downloads leaflet/recharts at all, and
        // returning visitors reuse these chunks from cache even after an
        // app update (they only change when the library itself is bumped).
        manualChunks: {
          maps: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
          markdown: ['react-markdown', 'remark-gfm'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})