import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Uncomment to add API proxy during development:
  // server: {
  //   proxy: {
  //     '/api': {
  //       target: 'https://your-api-server.com',
  //       changeOrigin: true,
  //     }
  //   }
  // }
})
