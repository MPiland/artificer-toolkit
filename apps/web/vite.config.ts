import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import viteReact from '@vitejs/plugin-react'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
// The Worker's declared secrets (wrangler.jsonc) are read from this process environment in dev and
// preview, so the root env file stays the single local source.
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

// vanilla-extract externalizes its runtime for Node SSR, but a Worker bundle cannot have externals
// (vanilla-extract-css/vanilla-extract#1603). Bundling it is safe: `.css.ts` modules compile to
// static class names. Vite has already folded `ssr.external` into this environment, so mutate it.
function bundleVanillaExtractRuntime(): Plugin {
  return {
    name: 'artificer:bundle-vanilla-extract-runtime',
    configEnvironment(name, config) {
      if (name === 'ssr' && config.resolve) delete config.resolve.external
    }
  }
}

// The Node Sentry SDK does not run on workerd (ADR 0037); fail the Worker build if any path pulls it in.
const nodeOnlySentryModule = /[\\/]node_modules[\\/]@sentry[\\/]node(-core)?[\\/]/

function workerBundleGuard(): Plugin {
  return {
    name: 'artificer:worker-bundle-guard',
    applyToEnvironment: (environment) => environment.name === 'ssr',
    generateBundle(_options, bundle) {
      const offenders = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk'
          ? output.moduleIds
              .filter((id) => nodeOnlySentryModule.test(id))
              .map((id) => `${output.fileName}: ${id}`)
          : []
      )
      if (offenders.length > 0) {
        this.error(`The Worker bundle includes the Node Sentry SDK:\n${offenders.join('\n')}`)
      }
    }
  }
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
      bundleVanillaExtractRuntime(),
      cloudflare({ viteEnvironment: { name: 'ssr' } }),
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
      viteReact(),
      workerBundleGuard(),
      ...sentryPlugin
    ]
  }
})
