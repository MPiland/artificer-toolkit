import viteReact from '@vitejs/plugin-react'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { defineConfig } from 'vitest/config'
import { webAliases } from './vite.aliases.ts'

export default defineConfig({
  resolve: {
    alias: webAliases,
    tsconfigPaths: true
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    }),
    viteReact()
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    },
    exclude: [
      '**/node_modules/**',
      '**/tests/e2e/**',
      '**/*.browser.test.tsx'
    ]
  }
})
