import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  cacheDir: 'node_modules/.vite/storybook',
  resolve: {
    tsconfigPaths: true
  },
  server: {
    hmr: {
      port: 24679
    }
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    })
  ]
})
