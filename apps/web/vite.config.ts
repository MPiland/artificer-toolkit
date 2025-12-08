import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  plugins: [
    viteTsConfigPaths({
      projects: [
        './tsconfig.json'
      ]
    }),
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    }),
    tanstackStart(),
    viteReact()
  ]
})
