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

// Worker SSR cannot load the Node Sentry SDK (ADR 0037) or a parser requiring browser DOM APIs.
const nodeOnlySentryModule = /[\\/]node_modules[\\/]@sentry[\\/]node(-core)?[\\/]/
const browserOnlyHtmlParserModule =
  /[\\/]node_modules[\\/]html-dom-parser[\\/](?:esm|lib)[\\/]client[\\/]/

type ImporterInfo = { importers: readonly string[]; dynamicImporters: readonly string[] } | null

// Shortest importer path from an offending module back to app source, so a failure names its cause.
function importChain(moduleId: string, getModuleInfo: (id: string) => ImporterInfo): string[] {
  const previous = new Map<string, string | undefined>([[moduleId, undefined]])
  const queue = [moduleId]
  for (const id of queue) {
    if (!id.includes('node_modules')) {
      const chain: string[] = []
      for (let step: string | undefined = id; step; step = previous.get(step)) chain.push(step)
      return chain.reverse()
    }
    const info = getModuleInfo(id)
    for (const importer of [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])]) {
      if (!previous.has(importer)) {
        previous.set(importer, id)
        queue.push(importer)
      }
    }
  }
  return [moduleId]
}

function workerBundleGuard(): Plugin {
  return {
    name: 'artificer:worker-bundle-guard',
    applyToEnvironment: (environment) => environment.name === 'ssr',
    generateBundle(_options, bundle) {
      const offenders = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk'
          ? output.moduleIds
              .filter((id) => nodeOnlySentryModule.test(id) || browserOnlyHtmlParserModule.test(id))
              .map((id) => `${output.fileName}: ${id}`)
          : []
      )
      if (offenders.length > 0) {
        const firstOffender = offenders[0].slice(offenders[0].indexOf(': ') + 2)
        this.error(
          `The Worker bundle includes a Node SDK or browser DOM parser:\n${offenders.join('\n')}\n` +
            `Import chain: ${importChain(firstOffender, (id) => this.getModuleInfo(id)).join(' <- ')}`
        )
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  // `proof` builds the production bundle for local browser proofs from the process environment
  // alone, which the proof lifecycle checks is local; `.env` files may carry deployed values.
  const localProof = mode === 'proof'
  const webEnv: Record<string, string> = localProof ? {} : loadServerOnlyEnv(mode)
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
    envDir: localProof ? false : repoRoot,
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
      tsconfigPaths: true,
      // Worker SSR has no DOM. Use the installed pure-JS parser on both sides for matching markup.
      alias: [
        {
          find: /^html-dom-parser$/,
          replacement: fileURLToPath(import.meta.resolve('html-dom-parser/lib/server/html-to-dom'))
        }
      ]
    },
    ssr: {
      optimizeDeps: {
        include: ['html-react-parser']
      }
    },
    server: {
      port: 3000,
      strictPort: true
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
