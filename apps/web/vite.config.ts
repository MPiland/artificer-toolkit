import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import { webAliases } from './vite.aliases.ts'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: webAliases
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
        routesDirectory: 'routes',
        generatedRouteTree: 'routeTree.gen.ts'
      }
    }),
    viteReact()
  ]
})
