import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En dev: SPA en :5173, BFF en :8000.
// Proxy de /api → BFF preserva la cookie de sesión y evita CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
