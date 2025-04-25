import { defineConfig, AliasOptions } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const tailwindPlugins = tailwindcss().map((plugin) => {
  if (plugin.name === '@tailwindcss/vite:generate:serve') {
    const originalTransform = plugin.transform
    return {
      ...plugin,
      transform(code: string, id: string, options: { ssr?: boolean }) {
        // or your file names you want to skip
        if (id.includes('vanilla.css')) {
          return
        }
        // @ts-expect-error
        return originalTransform?.call(this, code, id, options)
      },
    }
  }
  return plugin
})

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
      react(),
      vanillaExtractPlugin(),
      eslint(),
      tailwindPlugins as any,
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      } as AliasOptions,
    },
    server: {
      port: 3000,
      open: true,
    },
    preview: {
      port: 3000,
    },
  }
})
