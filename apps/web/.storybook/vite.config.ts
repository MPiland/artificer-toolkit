import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { defineConfig } from 'vite'
import { storyWarmup } from '../src/test/storybook/storyWarmup.ts'

export default defineConfig({
  cacheDir: 'node_modules/.vite/storybook',
  resolve: {
    tsconfigPaths: true
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    }),
    // The dev iframe's entry (builder-vite rewrites iframe.html to it); it imports every story lazily.
    storyWarmup(['/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js'])
  ]
})
