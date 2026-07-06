import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    })
  ]
})
