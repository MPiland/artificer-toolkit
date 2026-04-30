import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { webAliases } from '../vite.aliases.ts'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: webAliases
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    })
  ]
})
