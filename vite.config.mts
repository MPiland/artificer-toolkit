import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react(), vanillaExtractPlugin()],
    server: {
      port: 3000,
      open: true,
    },
    preview: {
      port: 3000,
    },
  }
})
