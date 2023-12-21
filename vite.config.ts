import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if(id.includes('locash')) {
              return 'lodash'
            }
            if(id.includes('bootstrap')) {
              return 'bootstrap'
            }
            if(id.includes('@fortawesome')) {
              return 'fortawesome'
            }
          }
        }
      }
    },
    plugins: [react(), eslint()],
    server: {
        port: 3000,
        open: true
    },
    preview: {
      port: 3000
    }
  }
})
