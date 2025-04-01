import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
      react(),
      vanillaExtractPlugin(),
      eslint({
        exclude: ['**/node_modules/**'],
        include: ['./src/**/*.ts', './src/**/*.tsx'],
        emitWarning: process.env.NODE_ENV !== 'production',
        emitError: process.env.NODE_ENV !== 'production',
      }),
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
