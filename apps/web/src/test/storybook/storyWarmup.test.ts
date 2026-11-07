// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { http, passthrough } from 'msw'
import { createServer, type ViteDevServer } from 'vite'
import { server as mswServer } from '#test/msw/server'
import { STORY_WARMUP_PATH, storyWarmup, transformModuleGraph } from './storyWarmup'

let root: string
let vite: ViteDevServer | undefined
let listener: Server | undefined

function writeProject(files: Record<string, string>) {
  root = mkdtempSync(join(tmpdir(), 'story-warmup-'))
  for (const [name, code] of Object.entries(files)) writeFileSync(join(root, name), code)
}

async function startVite(entries: string[]) {
  vite = await createServer({
    configFile: false,
    root,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [storyWarmup(entries)]
  })
  return vite
}

const transformed = (server: ViteDevServer, url: string) =>
  Boolean(server.environments.client.moduleGraph.urlToModuleMap.get(url)?.transformResult)

afterEach(async () => {
  listener?.close()
  await vite?.close()
  listener = undefined
  vite = undefined
  rmSync(root, { force: true, recursive: true })
})

const graph = {
  'entry.ts':
    "import { a } from './a.ts'\nexport const load = () => import('./story.ts')\nexport { a }\n",
  'a.ts': 'export const a = 1\n',
  'story.ts': "import { c } from './c.ts'\nexport const story = c\n",
  'c.ts': 'export const c = 2\n'
}

it('transforms the static and dynamic imports of the entries before resolving', async () => {
  writeProject(graph)
  const server = await startVite([])

  const result = await transformModuleGraph(server, ['/entry.ts'])

  expect(result).toEqual({ modules: 4, failures: [] })
  for (const url of ['/entry.ts', '/a.ts', '/story.ts', '/c.ts'])
    expect(transformed(server, url)).toBe(true)
})

it('follows a virtual entry given in its browser URL form, as builder-vite serves the iframe entry', async () => {
  writeProject(graph)
  vite = await createServer({
    configFile: false,
    root,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      {
        name: 'virtual-entry',
        resolveId: (id) => (id === 'virtual:entry' ? '\0virtual:entry' : undefined),
        load: (id) => (id === '\0virtual:entry' ? "import '/entry.ts'\n" : undefined)
      }
    ]
  })

  const result = await transformModuleGraph(vite, ['/@id/__x00__virtual:entry'])

  expect(result).toEqual({ modules: 5, failures: [] })
  expect(transformed(vite, '/c.ts')).toBe(true)
})

it('reports a module that fails to transform and still transforms the rest', async () => {
  writeProject({ ...graph, 'c.ts': 'export const c = \n' })
  const server = await startVite([])

  const { modules, failures } = await transformModuleGraph(server, ['/entry.ts'])

  expect(modules).toBe(4)
  expect(failures).toEqual([expect.stringMatching(/^\/c\.ts: /)])
  expect(transformed(server, '/story.ts')).toBe(true)
})

it('answers the readiness path only once the entries graph is transformed', async () => {
  writeProject(graph)
  const server = await startVite(['/entry.ts'])
  listener = createHttpServer(server.middlewares).listen(0, '127.0.0.1')
  await new Promise((resolve) => listener?.once('listening', resolve))
  const url = `http://127.0.0.1:${(listener.address() as AddressInfo).port}${STORY_WARMUP_PATH}`
  mswServer.use(http.get(url, () => passthrough()))

  const first = await fetch(url)
  expect(first.status).toBe(503)

  await vi.waitFor(async () => expect((await fetch(url)).status).toBe(200), {
    timeout: 20_000,
    interval: 50
  })
  expect(transformed(server, '/c.ts')).toBe(true)
})
