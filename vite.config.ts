import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/challenges': {
        target: 'https://geronimo.askdavidstone.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/challenges/, '/webhook/challenges')
      }
    }
  }
})
