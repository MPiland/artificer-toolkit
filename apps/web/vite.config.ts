import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  server: {
    port: 3000,
    strictPort: true,
    open: false
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    }),
    tanstackStart({
      router: {
        routesDirectory: 'app/routes',
        generatedRouteTree: 'app/routeTree.gen.ts'
      }
    }),
    viteReact()
  ]
})
