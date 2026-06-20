import viteReact from '@vitejs/plugin-react'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
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
    fileParallelism: false,
    include: ['src/**/*.browser.test.tsx'],
    maxWorkers: 1,
    browser: {
      enabled: true,
      fileParallelism: false,
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
