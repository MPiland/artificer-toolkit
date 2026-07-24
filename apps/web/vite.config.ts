import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import viteReact from '@vitejs/plugin-react'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const serverOnlyEnvKeys = [
  'DATABASE_CONNECTION_STRING',
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

function loadServerOnlyEnv(mode: string) {
  const rootEnv = loadEnv(mode, repoRoot, '')
  setServerOnlyEnv('PUBLIC_SIGN_UP_ENABLED', rootEnv.PUBLIC_SIGN_UP_ENABLED)
  setServerOnlyEnv('DATABASE_CONNECTION_STRING', rootEnv.DATABASE_CONNECTION_STRING)

  return rootEnv
}

export default defineConfig(({ mode }) => {
  const webEnv = loadServerOnlyEnv(mode)
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN ?? webEnv.SENTRY_AUTH_TOKEN
  const sentryOrg = process.env.SENTRY_ORG ?? webEnv.SENTRY_ORG
  const sentryProject = process.env.SENTRY_PROJECT ?? webEnv.SENTRY_PROJECT
  const sentryPlugin = mode === 'production' && sentryAuthToken && sentryOrg && sentryProject
    ? sentryTanstackStart({
        authToken: sentryAuthToken,
        autoInstrumentMiddleware: false,
        org: sentryOrg,
        project: sentryProject
      })
    : []

  return {
    envDir: repoRoot,
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
      ],
      optimizeDeps: {
        include: ['html-react-parser']
      }
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
      viteReact(),
      ...sentryPlugin
    ]
  }
})
