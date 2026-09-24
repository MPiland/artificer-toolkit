import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import viteReact from '@vitejs/plugin-react'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const serverOnlyEnvKeys = ['CONVEX_SITE_URL', 'AUTH_PROXY_SECRET'] as const
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
  for (const key of serverOnlyEnvKeys) setServerOnlyEnv(key, rootEnv[key])

  return rootEnv
}

export default defineConfig(({ mode }) => {
  const webEnv = loadServerOnlyEnv(mode)
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN ?? webEnv.SENTRY_AUTH_TOKEN
  const sentryOrg = process.env.SENTRY_ORG ?? webEnv.SENTRY_ORG
  const sentryProject = process.env.SENTRY_PROJECT ?? webEnv.SENTRY_PROJECT
  const sentryPlugin =
    mode === 'production' && sentryAuthToken && sentryOrg && sentryProject
      ? sentryTanstackStart({
          authToken: sentryAuthToken,
          autoInstrumentMiddleware: false,
          org: sentryOrg,
          project: sentryProject
        })
      : []

  return {
    cacheDir: 'node_modules/.vite/app',
    envDir: repoRoot,
    optimizeDeps: {
      include: [
        'better-auth/react',
        'better-auth/client/plugins',
        'better-auth/cookies',
        '@tanstack/history',
        '@tanstack/router-core',
        '@tanstack/router-core/ssr/client',
        '@tanstack/router-core/ssr/server',
        'h3-v2',
        'seroval'
      ]
    },
    resolve: {
      tsconfigPaths: true
    },
    ssr: {
      noExternal: [
        '@convex-dev/better-auth',
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
          generatedRouteTree: 'routeTree.gen.ts',
          codeSplittingOptions: {
            defaultBehavior: [
              ['loader'],
              ['component'],
              ['pendingComponent'],
              ['errorComponent'],
              ['notFoundComponent']
            ]
          }
        }
      }),
      netlify(),
      viteReact(),
      ...sentryPlugin
    ]
  }
})
