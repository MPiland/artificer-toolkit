import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev',
    }),
    viteReact(),
    viteTsConfigPaths(),
  ],
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 3000,
  },
})
