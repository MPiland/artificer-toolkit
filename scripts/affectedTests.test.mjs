import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertEveryTestRuns,
  buildImportGraph,
  fullRunReason,
  selectTests
} from './affectedTests.mjs'

let root

const write = (files) => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, dirname(path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return Object.keys(files)
}

// A two-package workspace: `app` imports `lib` through its package exports, which point at `dist`.
const workspace = {
  'packages/lib/package.json': JSON.stringify({
    name: '@scope/lib',
    exports: {
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      './feature/*': { types: './dist/feature/*.d.ts', default: './dist/feature/*.js' }
    },
    imports: { '#core': { types: './dist/core.d.ts', default: './dist/core.js' } }
  }),
  'packages/lib/src/index.ts': "export * from './feature/one.js'\n",
  'packages/lib/src/core.ts': 'export const core = 1\n',
  'packages/lib/src/feature/one.ts': "import { core } from '#core'\nexport const one = core\n",
  'packages/lib/src/feature/two.ts': 'export const two = 2\n',
  'packages/lib/src/feature/one.test.ts': "import { one } from './one.js'\n",
  'packages/lib/src/feature/__snapshots__/one.test.ts.snap': '',
  'apps/app/package.json': JSON.stringify({ name: '@scope/app' }),
  'apps/app/tsconfig.json':
    '// paths\n{ "compilerOptions": { "paths": { "#app/*": ["./src/*"] } } }\n',
  'apps/app/src/view.ts': "import { two } from '@scope/lib/feature/two'\nexport const view = two\n",
  'apps/app/src/view.test.ts': "import { view } from '#app/view'\n",
  'apps/app/src/root.test.ts': "import { one } from '@scope/lib'\n",
  'apps/app/src/corpus.txt': 'text',
  'apps/app/src/corpus.test.ts': "const url = new URL('./corpus.txt', import.meta.url)\n",
  'apps/app/src/scan.test.ts': "import { readdirSync } from 'node:fs'\n",
  'apps/app/src/modules/a.ts': 'export const a = 1\n',
  'apps/app/src/modules/a.test.ts': 'export const t = 1\n',
  'apps/app/src/glob.test.ts': "const modules = import.meta.glob('./modules/**/*.ts')\n",
  'apps/app/src/stale.test.ts': "import { gone } from './gone.js'\n",
  'docs/notes.md': 'notes'
}

const tests = (paths) => paths.filter((path) => /\.test\.ts$/.test(path))
const suite = (tracked) => [{ name: 'all', tests: tests(tracked), setupFiles: [] }]
const select = (tracked, changed) =>
  selectTests(buildImportGraph(root, tracked), suite(tracked), changed).all.sort()

describe('affected test selection', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'affected-tests-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('follows workspace exports and package imports from dist to the source they build from', () => {
    const tracked = write(workspace)
    expect(select(tracked, ['packages/lib/src/core.ts'])).toEqual([
      'apps/app/src/root.test.ts',
      'apps/app/src/scan.test.ts',
      'packages/lib/src/feature/one.test.ts'
    ])
    expect(select(tracked, ['packages/lib/src/feature/two.ts'])).toEqual([
      'apps/app/src/scan.test.ts',
      'apps/app/src/view.test.ts'
    ])
  })

  it('follows tsconfig paths, file URLs, globs, snapshots and deleted files', () => {
    const tracked = write(workspace)
    expect(select(tracked, ['apps/app/src/view.ts'])).toEqual([
      'apps/app/src/scan.test.ts',
      'apps/app/src/view.test.ts'
    ])
    expect(select(tracked, ['apps/app/src/corpus.txt'])).toEqual([
      'apps/app/src/corpus.test.ts',
      'apps/app/src/scan.test.ts'
    ])
    // A glob over modules does not make a test depend on the test files it also matches.
    expect(select(tracked, ['apps/app/src/modules/a.ts'])).toEqual([
      'apps/app/src/glob.test.ts',
      'apps/app/src/scan.test.ts'
    ])
    expect(select(tracked, ['apps/app/src/modules/a.test.ts'])).toEqual([
      'apps/app/src/modules/a.test.ts',
      'apps/app/src/scan.test.ts'
    ])
    expect(select(tracked, ['packages/lib/src/feature/__snapshots__/one.test.ts.snap'])).toEqual([
      'apps/app/src/scan.test.ts',
      'packages/lib/src/feature/one.test.ts'
    ])
    expect(select(tracked, ['apps/app/src/gone.ts'])).toEqual([
      'apps/app/src/scan.test.ts',
      'apps/app/src/stale.test.ts'
    ])
  })

  it('selects nothing for a change outside the source roots', () => {
    const tracked = write(workspace)
    expect(select(tracked, ['docs/notes.md'])).toEqual([])
  })

  it('runs a whole suite when its setup files are affected', () => {
    const tracked = write({
      ...workspace,
      'apps/app/test/setup.ts': "import { two } from '@scope/lib/feature/two'\n"
    })
    const suites = [{ name: 'all', tests: tests(tracked), setupFiles: ['apps/app/test/setup.ts'] }]
    const selected = selectTests(buildImportGraph(root, tracked), suites, [
      'packages/lib/src/feature/two.ts'
    ])
    expect(selected.all).toEqual(tests(tracked))
  })
})

describe('full runs and the suite guard', () => {
  const suites = [{ name: 'all', tests: ['a/x.test.ts'], setupFiles: ['a/setup.ts'] }]

  it('runs everything when dependencies, configuration or setup files change', () => {
    for (const path of [
      'yarn.lock',
      'packages/lib/package.json',
      'apps/web/tsconfig.typecheck.tests.json',
      'apps/web/vitest.config.ts',
      'apps/session-worker/wrangler.jsonc',
      '.github/workflows/tests.yml',
      '.github/actions/setup/action.yml',
      'scripts/affectedTests.mjs',
      'a/setup.ts'
    ])
      expect(fullRunReason(['docs/notes.md', path], suites)).toBe(`${path} changed`)
    expect(fullRunReason(['a/x.ts', '.github/workflows/live-backend.yml'], suites)).toBeNull()
  })

  it('rejects a test file that no suite runs', () => {
    expect(() =>
      assertEveryTestRuns(['a/x.test.ts', 'apps/web/tests/e2e/app/flow.spec.ts'], suites)
    ).not.toThrow()
    expect(() => assertEveryTestRuns(['a/x.test.ts', 'b/y.test.ts'], suites)).toThrow(
      'Test files outside every CI suite:\nb/y.test.ts'
    )
  })
})
