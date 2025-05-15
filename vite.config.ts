import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react'
import eslintPlugin from 'vite-plugin-eslint'
import tsconfigPaths from 'vite-tsconfig-paths'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
      react(),
      vanillaExtractPlugin(),
      eslintPlugin(),
      tsconfigPaths(),
    ],
    server: {
      port: 3000,
      open: true,
    },
    preview: {
      port: 3000,
    },
  }
})
