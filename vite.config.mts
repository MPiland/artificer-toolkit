import { defineConfig, splitVendorChunkPlugin } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('lodash')) {
              return 'lodash'
            }
          },
        },
      },
    },
    plugins: [react(), splitVendorChunkPlugin(), vanillaExtractPlugin()],
    server: {
      port: 3000,
      open: true,
    },
    preview: {
      port: 3000,
    },
  }
})
