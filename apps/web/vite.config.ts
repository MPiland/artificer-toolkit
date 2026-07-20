import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import viteReact from '@vitejs/plugin-react'

const configDir = dirname(fileURLToPath(import.meta.url))
const serverOnlyEnvKeys = [
  'DATABASE_CONNECTION_STRING',
  'DATABASE_URL',
  'PUBLIC_SIGN_UP_ENABLED'
] as const
type ServerOnlyEnvKey = (typeof serverOnlyEnvKeys)[number]

function setServerOnlyEnv(
  key: ServerOnlyEnvKey,
  value: string | undefined,
  options: { overrideExisting?: boolean } = {}
) {
  if ((options.overrideExisting || !process.env[key]) && value) {
    process.env[key] = value
  }
}

function loadPackageDbEnv(mode: string, options: { ignoreProcessDatabaseEnv?: boolean } = {}) {
  if (!options.ignoreProcessDatabaseEnv) {
    return loadEnv(mode, resolve(configDir, '../../packages/db'), '')
  }

  const previousValues = new Map<ServerOnlyEnvKey, string | undefined>()
  for (const key of serverOnlyEnvKeys) {
    previousValues.set(key, process.env[key])
    delete process.env[key]
  }

  try {
    return loadEnv(mode, resolve(configDir, '../../packages/db'), '')
  } finally {
    for (const key of serverOnlyEnvKeys) {
      const value = previousValues.get(key)
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

function loadServerOnlyEnv(mode: string) {
  const webEnv = loadEnv(mode, configDir, '')
  setServerOnlyEnv('PUBLIC_SIGN_UP_ENABLED', webEnv.PUBLIC_SIGN_UP_ENABLED)

  const preferPackageDbEnv = mode === 'development' || mode === 'test'
  const dbEnv = loadPackageDbEnv(mode, {
    ignoreProcessDatabaseEnv: preferPackageDbEnv
  })
  const databaseConnectionString = preferPackageDbEnv
    ? (dbEnv.DATABASE_URL ?? dbEnv.DATABASE_CONNECTION_STRING)
    : (dbEnv.DATABASE_CONNECTION_STRING ?? dbEnv.DATABASE_URL)

  setServerOnlyEnv('DATABASE_CONNECTION_STRING', databaseConnectionString, {
    overrideExisting: preferPackageDbEnv
  })
  setServerOnlyEnv('DATABASE_URL', dbEnv.DATABASE_URL, {
    overrideExisting: preferPackageDbEnv
  })
}

export default defineConfig(({ mode }) => {
  loadServerOnlyEnv(mode)

  return {
    resolve: {
      tsconfigPaths: true
    },
    ssr: {
      noExternal: [
        'domhandler',
        'html-dom-parser',
        'html-react-parser',
        'inline-style-parser',
        'react-property',
        'style-to-js',
        'style-to-object'
      ]
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
      netlify(),
      viteReact()
    ]
  }
})
