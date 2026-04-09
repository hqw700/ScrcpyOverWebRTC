import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/connect_client': {
        target: 'http://localhost:8443',
        ws: true
      },
      '/devices': {
        target: 'http://localhost:8443'
      },
      '/register_agent': {
        target: 'http://localhost:8443',
        ws: true
      },
      '/agent': {
        target: 'http://localhost:8443'
      }
    }
  },
  build: {
    outDir: '../assets',
    emptyOutDir: false
  }
})
