import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FENCE_ALLOWLIST,
  SIZE_BUDGET,
  SIZE_LIMIT,
  codeLines,
  ratchetProblems,
  systemsImports
} from './sourceRatchets.mjs'

const git = (root, ...args) =>
  execFileSync(
    'git',
    [
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      ...args
    ],
    { cwd: root, stdio: 'pipe' }
  )

const commitAll = (root, message) => {
  git(root, 'add', '-A')
  git(root, 'commit', '--quiet', '-m', message)
}

const module = (lines) =>
  Array.from({ length: lines }, (_, index) => `export const value${index} = ${index}`).join('\n') +
  '\n'

const BIG = 'packages/shared/src/big.ts'
const LEGACY = 'packages/rules-runtime/src/legacyEncounter.ts'
const NEUTRAL = 'packages/rules-runtime/src/neutralEncounter.ts'
const SYSTEM_IMPORT = "import { policy } from './systems/dnd5e/policy'\n"
const ROOT = 'packages/rules-runtime/src/platformProbePolicy.ts'
const NEW_ROOT = 'packages/rules-runtime/src/platformProbeVocabulary.ts'
const CONSUMER = 'apps/session-worker/src/nativeProbe.ts'
const PACKAGE_SYSTEM_IMPORT =
  "import { policy } from '@artificer-toolkit/rules-runtime/systems/dnd5e/policy'\n"
const allowlist = (importers, compositionRoots = { [ROOT]: 'Installs the probe adapters.' }) => ({
  compositionRoots,
  importers
})

describe('codeLines', () => {
  it('counts non-blank lines outside comments', () => {
    const source = [
      '// a line comment',
      '/**',
      ' * a block comment',
      ' */',
      '',
      'const a = 1 // trailing comment',
      "const b = '// not a comment'",
      '/* inline */ const c = 3',
      '   '
    ].join('\n')
    expect(codeLines('probe.ts', source)).toBe(3)
  })
})

describe('systemsImports', () => {
  it('finds imports, re-exports and dynamic imports that resolve into systems/', () => {
    const source = [
      "import { a } from './systems/dnd5e/a'",
      "import type { B } from './systems/dnd5e/b'",
      "export { c } from './systems'",
      "export * from './systems/dnd5e/d'",
      "const e = await import('./systems/dnd5e/e')",
      "import { f } from './systemsNeutral'",
      "import { g } from '@artificer-toolkit/shared/core'",
      "import { h } from '@artificer-toolkit/rules-runtime/systems/dnd5e/h'",
      "import { i } from '@artificer-toolkit/rules-runtime/systemsNeutral'"
    ].join('\n')
    expect(systemsImports('packages/rules-runtime/src/probe.ts', source)).toEqual([
      './systems/dnd5e/a',
      './systems/dnd5e/b',
      './systems',
      './systems/dnd5e/d',
      './systems/dnd5e/e',
      '@artificer-toolkit/rules-runtime/systems/dnd5e/h'
    ])
  })
})

describe('ratchetProblems (RULES-2.T1)', () => {
  let root

  const write = (file, content) => {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  const writeJson = (file, value) => write(file, `${JSON.stringify(value, null, 2)}\n`)

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'source-ratchets-'))
    git(root, 'init', '--quiet', '--initial-branch=phase')
    write(BIG, module(SIZE_LIMIT + 100))
    write('packages/rules-runtime/src/systems/dnd5e/policy.ts', module(1))
    write(LEGACY, SYSTEM_IMPORT)
    write(NEUTRAL, module(1))
    write(ROOT, SYSTEM_IMPORT)
    write(CONSUMER, module(1))
    writeJson(SIZE_BUDGET, { [BIG]: SIZE_LIMIT + 100 })
    writeJson(FENCE_ALLOWLIST, allowlist([LEGACY]))
    commitAll(root, 'phase')
    git(root, 'switch', '--quiet', '-c', 'slice')
  })

  afterEach(() => rmSync(root, { force: true, recursive: true }))

  it('passes a budgeted file at its cap and an allowlisted systems import', () => {
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([])
  })

  it('fails an oversize file the budget does not list', () => {
    write('packages/shared/src/grown.ts', module(SIZE_LIMIT + 1))
    commitAll(root, 'oversize module')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `packages/shared/src/grown.ts: ${SIZE_LIMIT + 1} code lines, over ${SIZE_LIMIT}; split the module.`
    ])
  })

  it('does not size test files, test helpers or generated modules', () => {
    write('packages/shared/src/big.test.ts', module(SIZE_LIMIT + 1))
    write('packages/shared/src/testing/fixture.ts', module(SIZE_LIMIT + 1))
    write('apps/apis/convex/_generated/api.ts', module(SIZE_LIMIT + 1))
    write('apps/web/src/routeTree.gen.ts', module(SIZE_LIMIT + 1))
    commitAll(root, 'exempt modules')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([])
  })

  it('fails a budgeted file that grows past its cap', () => {
    write(BIG, module(SIZE_LIMIT + 101))
    commitAll(root, 'grow')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${BIG}: ${SIZE_LIMIT + 101} code lines, over its budget of ${SIZE_LIMIT + 100}; split the module.`
    ])
  })

  it('passes a file that shrinks with its cap lowered, and asks for the lower cap until then', () => {
    write(BIG, module(SIZE_LIMIT + 50))
    commitAll(root, 'shrink')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${SIZE_BUDGET}: ${BIG} shrank to ${SIZE_LIMIT + 50} code lines; lower its cap from ${SIZE_LIMIT + 100}.`
    ])
    writeJson(SIZE_BUDGET, { [BIG]: SIZE_LIMIT + 50 })
    commitAll(root, 'lower the cap')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([])
  })

  it('asks to remove the entry once the file is within the limit', () => {
    write(BIG, module(SIZE_LIMIT))
    commitAll(root, 'split')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${SIZE_BUDGET}: ${BIG} is ${SIZE_LIMIT} code lines, within ${SIZE_LIMIT}; remove it.`
    ])
    writeJson(SIZE_BUDGET, {})
    commitAll(root, 'remove the entry')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([])
  })

  it('fails a cap raised or an entry added since the merge base', () => {
    write(BIG, module(SIZE_LIMIT + 120))
    write('packages/shared/src/grown.ts', module(SIZE_LIMIT + 1))
    writeJson(SIZE_BUDGET, {
      [BIG]: SIZE_LIMIT + 120,
      'packages/shared/src/grown.ts': SIZE_LIMIT + 1
    })
    commitAll(root, 'buy room')
    expect(ratchetProblems(root)).toEqual([])
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${SIZE_BUDGET}: ${BIG} cap raised from ${SIZE_LIMIT + 100} to ${SIZE_LIMIT + 120}; a budget only shrinks.`,
      `${SIZE_BUDGET}: packages/shared/src/grown.ts is new; a budget only shrinks, so split the module.`
    ])
  })

  it('fails a new systems import from a neutral rules-runtime module', () => {
    write(NEUTRAL, SYSTEM_IMPORT)
    commitAll(root, 'new fenced import')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${NEUTRAL}: imports systems/ directly; reach it through a capability registry.`
    ])
  })

  it('fails an allowlist entry added since the merge base', () => {
    write(NEUTRAL, SYSTEM_IMPORT)
    writeJson(FENCE_ALLOWLIST, allowlist([LEGACY, NEUTRAL]))
    commitAll(root, 'allowlist the new import')
    expect(ratchetProblems(root)).toEqual([])
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${FENCE_ALLOWLIST}: ${NEUTRAL} is new; the allowlist only shrinks.`
    ])
  })

  it('asks to remove an allowlist entry once the module stops importing systems/', () => {
    write(LEGACY, module(1))
    commitAll(root, 'use the registry')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${FENCE_ALLOWLIST}: ${LEGACY} no longer imports systems/; remove it.`
    ])
  })

  it('leaves systems/, character/ and test modules outside the fence', () => {
    write(
      'packages/rules-runtime/src/systems/dnd5e/compiler.ts',
      "import { policy } from './policy'\n"
    )
    write(
      'packages/rules-runtime/src/character/sheet.ts',
      "import { policy } from '../systems/dnd5e/policy'\n"
    )
    write(
      'packages/rules-runtime/src/__tests__/encounter.test.ts',
      "import { policy } from '../systems/dnd5e/policy'\n"
    )
    write(
      'packages/rules-runtime/src/testing/fixture.ts',
      "import { policy } from '../systems/dnd5e/policy'\n"
    )
    commitAll(root, 'unfenced modules')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([])
  })

  it('fails a systems package import from a rules-runtime consumer, but not from its tests', () => {
    write(CONSUMER, PACKAGE_SYSTEM_IMPORT)
    write('apps/session-worker/test/nativeProbe.test.ts', PACKAGE_SYSTEM_IMPORT)
    write('apps/web/src/domains/probe/probe.test.ts', PACKAGE_SYSTEM_IMPORT)
    commitAll(root, 'consumer imports systems/')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${CONSUMER}: imports systems/ directly; reach it through a capability registry.`
    ])
  })

  it('passes a named composition root and asks to remove it once it installs no System adapter', () => {
    write(ROOT, module(1))
    commitAll(root, 'root installs nothing')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${FENCE_ALLOWLIST}: ${ROOT} no longer imports systems/; remove it.`
    ])
  })

  it('fails a composition root added since the merge base', () => {
    write(NEUTRAL, SYSTEM_IMPORT)
    writeJson(
      FENCE_ALLOWLIST,
      allowlist([LEGACY], { [ROOT]: 'Installs the probe adapters.', [NEUTRAL]: 'A new root.' })
    )
    commitAll(root, 'name a new root')
    expect(ratchetProblems(root)).toEqual([])
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${FENCE_ALLOWLIST}: ${NEUTRAL} is new; the allowlist only shrinks.`
    ])
  })

  it('passes a new platform composition root that states its reason (RULES-2.T9b)', () => {
    write(NEW_ROOT, SYSTEM_IMPORT)
    writeJson(
      FENCE_ALLOWLIST,
      allowlist([LEGACY], {
        [ROOT]: 'Installs the probe adapters.',
        [NEW_ROOT]: 'Installs a list.'
      })
    )
    commitAll(root, 'name a new platform root')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([])
  })

  it('fails a new platform composition root without a reason (RULES-2.T9b)', () => {
    write(NEW_ROOT, SYSTEM_IMPORT)
    writeJson(
      FENCE_ALLOWLIST,
      allowlist([LEGACY], { [ROOT]: 'Installs the probe adapters.', [NEW_ROOT]: ' ' })
    )
    commitAll(root, 'name a new platform root without a reason')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${FENCE_ALLOWLIST}: ${NEW_ROOT} is new; the allowlist only shrinks.`
    ])
  })

  it('fails a new importer even when it is a platform module (RULES-2.T9b)', () => {
    write(NEW_ROOT, SYSTEM_IMPORT)
    writeJson(FENCE_ALLOWLIST, allowlist([LEGACY, NEW_ROOT]))
    commitAll(root, 'list a platform module as an importer')
    expect(ratchetProblems(root, { base: 'phase' })).toEqual([
      `${FENCE_ALLOWLIST}: ${NEW_ROOT} is new; the allowlist only shrinks.`
    ])
  })
})
