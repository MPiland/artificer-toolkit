import { describe, expect, it } from 'vitest'
import { findUnusedExports, unusedExportProblems } from './unusedExports.mjs'

const src = (name) => `apps/web/src/${name}`
const unused = (sources) =>
  findUnusedExports(sources).map(({ file, name }) => `${file.replace('apps/web/src/', '')}:${name}`)

describe('findUnusedExports', () => {
  it('accepts exports that production code imports, relatively or through an alias', () => {
    expect(
      unused({
        [src('lib/a.ts')]: 'export const a = 1\nexport const b = 2',
        [src('lib/b.ts')]: "import { a } from './a'\nexport const c = a",
        [src('lib/c.ts')]:
          "import { b } from '#app/lib/a'\nimport { c } from './b'\nconsole.log(b, c)"
      })
    ).toEqual([])
  })

  it('flags an export nothing imports, and one only a test imports that the module never uses', () => {
    expect(
      unused({
        [src('lib/dead.ts')]: 'export const dead = 1',
        [src('lib/testOnly.ts')]: 'export const helper = () => 1',
        [src('lib/testOnly.test.ts')]: "import { helper } from './testOnly'\nhelper()"
      })
    ).toEqual(['lib/dead.ts:dead', 'lib/testOnly.ts:helper'])
  })

  it('keeps product logic that the module uses itself and its unit test imports', () => {
    expect(
      unused({
        [src('lib/rule.ts')]: 'export const rule = () => 1\nexport const run = () => rule()',
        [src('lib/rule.test.ts')]: "import { rule } from './rule'\nrule()",
        [src('lib/app.ts')]: "import { run } from './rule'\nrun()"
      })
    ).toEqual([])
  })

  it('flags a locally used export that no test or production module imports', () => {
    expect(
      unused({
        [src('lib/local.ts')]: 'export type Local = string\nexport const use = (x: Local) => x',
        [src('lib/app.ts')]: "import { use } from './local'\nuse('x')"
      })
    ).toEqual(['lib/local.ts:Local'])
  })

  it('exempts framework entry files, default exports and modules imported as a whole', () => {
    expect(
      unused({
        [src('routes/page.tsx')]: 'export const Route = 1',
        [src('lib/default.ts')]: 'export default 1',
        [src('lib/all.ts')]: 'export const x = 1',
        [src('lib/app.ts')]:
          "import * as all from './all'\nimport d from './default'\nconsole.log(all, d)"
      })
    ).toEqual([])
  })

  it('follows re-exports and dynamic imports', () => {
    expect(
      unused({
        [src('lib/inner.ts')]: 'export const inner = 1\nexport const lazy = 2',
        [src('lib/barrel.ts')]: "export { inner } from './inner'",
        [src('lib/app.ts')]:
          "import { inner } from './barrel'\nconst l = import('./inner')\nconsole.log(inner, l)"
      })
    ).toEqual([])
  })

  it('does not treat stories as production importers', () => {
    expect(
      unused({
        [src('ui/Thing.tsx')]: 'export const Thing = () => null',
        [src('ui/Thing.stories.tsx')]: "import { Thing } from './Thing'\nexport const S = Thing"
      })
    ).toEqual(['ui/Thing.tsx:Thing'])
  })
})

describe('unusedExportProblems', () => {
  const finding = { file: 'apps/web/src/lib/dead.ts', name: 'dead' }

  it('reports a finding that is not allowlisted', () => {
    expect(unusedExportProblems([finding], {})).toHaveLength(1)
  })

  it('accepts an allowlisted finding and reports a stale allowlist entry', () => {
    expect(unusedExportProblems([finding], { [finding.file]: { dead: 'why' } })).toEqual([])
    expect(unusedExportProblems([], { [finding.file]: { dead: 'why' } })).toHaveLength(1)
  })
})
