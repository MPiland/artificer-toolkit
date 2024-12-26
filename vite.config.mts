import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react(), vanillaExtractPlugin(), eslint()],
    server: {
      port: 3000,
      open: true,
    },
    preview: {
      port: 3000,
    },
  }
})
