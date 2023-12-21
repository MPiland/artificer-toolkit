import { defineConfig, type PluginOption, splitVendorChunkPlugin } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            if (id.includes('bootstrap')) {
              return 'bootstrap'
            }
            if(id.includes('lodash')) {
              return 'lodash'
            }
          },
        },
      },
    },
    plugins: [
      react(),
      eslint(),
      splitVendorChunkPlugin(),
      visualizer() as PluginOption],
    server: {
      port: 3000,
      open: true,
    },
    preview: {
      port: 3000,
    },
  }
})
