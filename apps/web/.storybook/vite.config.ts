import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    }),
    viteReact()
  ]
})
