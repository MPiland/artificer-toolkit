import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import viteReact from '@vitejs/plugin-react'

const configDir = dirname(fileURLToPath(import.meta.url))

function setServerOnlyEnv(key: 'DATABASE_CONNECTION_STRING' | 'DATABASE_URL', value: string | undefined) {
  if (!process.env[key] && value) {
    process.env[key] = value
  }
}

function loadServerOnlyEnv(mode: string) {
  const dbEnv = loadEnv(mode, resolve(configDir, '../../packages/db'), '')
  const databaseConnectionString = dbEnv.DATABASE_CONNECTION_STRING ?? dbEnv.DATABASE_URL

  setServerOnlyEnv('DATABASE_CONNECTION_STRING', databaseConnectionString)
  setServerOnlyEnv('DATABASE_URL', dbEnv.DATABASE_URL)
}

export default defineConfig(({ mode }) => {
  loadServerOnlyEnv(mode)

  return {
    resolve: {
      tsconfigPaths: true
    },
    server: {
      port: 3000,
      strictPort: true,
      open: true
    },
    plugins: [
      vanillaExtractPlugin(),
      tanstackStart({
        router: {
          routesDirectory: 'routes',
          generatedRouteTree: 'routeTree.gen.ts'
        }
      }),
      viteReact()
    ]
  }
})
