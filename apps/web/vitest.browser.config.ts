import viteReact from '@vitejs/plugin-react'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { webAliases } from './vite.aliases.ts'

export default defineConfig({
  resolve: {
    alias: webAliases,
    tsconfigPaths: true
  },
  optimizeDeps: {
    include: [
      '@tabler/icons-react',
      '@tanstack/react-router'
    ]
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    }),
    viteReact()
  ],
  test: {
    include: ['src/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: {
          channel: 'chromium'
        }
      }),
      instances: [
        {
          browser: 'chromium'
        }
      ],
      viewport: {
        width: 1440,
        height: 900
      }
    }
  }
})
