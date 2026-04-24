import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {

      '/api': {
        target: 'https://lms-1ntb.onrender.com',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'https://lms-1ntb.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
