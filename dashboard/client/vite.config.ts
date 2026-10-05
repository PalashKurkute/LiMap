import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    // Two pages: the home screen at / and the dashboard at /dashboard/ (each is a plain HTML file, so any static host serves them).
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        dashboard: fileURLToPath(new URL('./dashboard/index.html', import.meta.url)),
      },
    },
    // The 3D view's chunk is mostly three.js (~590 kB minified) and cannot be split further. The limit sits just above it
    // so the warning returns if that chunk, or any other, grows.
    chunkSizeWarningLimit: 650,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            // Suppress terminal ECONNREFUSED error spam when FastAPI backend is in standby
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'standby', error: 'FastAPI backend in standby mode' }));
            }
          });
        },
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Suppress WebSocket offline noise in dev terminal
          });
        },
      },
    },
  },
})
