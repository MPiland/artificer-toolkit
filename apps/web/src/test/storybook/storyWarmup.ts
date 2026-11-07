import type { Plugin, ViteDevServer } from 'vite'

/** Answers 503 until the story graph is transformed, then 200; Playwright's webServer waits on it. */
export const STORY_WARMUP_PATH = '/__story-warmup'

/**
 * Transforms every module reachable from `entries`, static and dynamic imports alike, and resolves when
 * the whole graph is in Vite's transform cache. Vite's own `server.warmup` only starts transforms and
 * cannot be awaited, so a first story would still compile inside its first test. A module that fails
 * to transform is reported, not retried: the story that imports it fails with the real error.
 */
export async function transformModuleGraph(server: ViteDevServer, entries: readonly string[]) {
  const environment = server.environments.client
  const seen = new Set<string>()
  const failures: string[] = []
  let frontier = [...entries]
  while (frontier.length > 0) {
    const fresh = [...new Set(frontier)].filter((url) => !seen.has(url))
    for (const url of fresh) seen.add(url)
    const next = await Promise.all(
      fresh.map(async (url) => {
        try {
          const result = await environment.transformRequest(url)
          return [...(result?.deps ?? []), ...(result?.dynamicDeps ?? [])]
        } catch (error) {
          failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`)
          return []
        }
      })
    )
    frontier = next.flat()
  }
  return { modules: seen.size, failures }
}

/**
 * Serves STORY_WARMUP_PATH. Its first request starts transforming the graph of `entries`, so a plain
 * `storybook dev` and the Vitest Storybook project pay nothing; only a caller that waits on readiness
 * (the Playwright Storybook web server) starts it.
 */
export function storyWarmup(entries: readonly string[]): Plugin {
  return {
    name: 'artificer:story-warmup',
    apply: 'serve',
    configureServer(server) {
      let warmup: Promise<void> | undefined
      let ready = false
      server.middlewares.use(STORY_WARMUP_PATH, (_request, response) => {
        warmup ??= (async () => {
          const started = performance.now()
          const { modules, failures } = await transformModuleGraph(server, entries)
          const seconds = ((performance.now() - started) / 1000).toFixed(1)
          server.config.logger.info(
            `[story-warmup] ${modules} modules transformed in ${seconds} s, ${failures.length} failed.`
          )
          for (const failure of failures) server.config.logger.warn(`[story-warmup] ${failure}`)
          ready = true
        })()
        response.statusCode = ready ? 200 : 503
        response.end(ready ? 'warm' : 'warming')
      })
    }
  }
}
