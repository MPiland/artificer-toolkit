import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { changedTestFiles, classify, isTestPath, packagesToRebuild, runnerFor, summary } from './redProof.mjs'

const git = (root, ...args) =>
  execFileSync(
    'git',
    ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, stdio: 'pipe', encoding: 'utf8' }
  )

describe('isTestPath', () => {
  it('takes test files and anything under a test directory', () => {
    expect(
      [
        'packages/shared/src/__tests__/a.test.ts',
        'apps/web/src/forms/Form.test.tsx',
        'scripts/snapshotDrift.test.mjs',
        'apps/session-worker/test/liveRoomFixture.ts',
        'apps/apis/tests/convexTest.ts',
        'apps/web/src/test/setup.ts',
        'packages/authoring/src/fixtures/zone.ts',
        'apps/web/src/domains/characters/characterList.fixtures.ts',
        'apps/apis/convex/__snapshots__/a.test.ts.snap'
      ].every(isTestPath)
    ).toBe(true)
  })

  it('leaves production code, including names that only mention tests', () => {
    expect(
      [
        'apps/session-worker/src/nativeLiveSessionRoom.ts',
        'packages/shared/src/testable.ts',
        'apps/web/src/latest/index.ts',
        '.github/workflows/tests.yml'
      ].some(isTestPath)
    ).toBe(false)
  })
})

describe('runnerFor', () => {
  it('sends each test file to the suite whose config includes it', () => {
    expect(
      [
        'apps/apis/convex/live/session.test.ts',
        'apps/session-worker/test/nativeLiveSessionRoom.test.ts',
        'apps/web/src/forms/Form.test.tsx',
        'packages/shared/src/__tests__/a.test.ts',
        'apps/apis/src/http.test.ts',
        'apps/session-worker/src/room.test.ts',
        'scripts/snapshotDrift.test.mjs'
      ].map((path) => runnerFor(path)?.name)
    ).toEqual(['convex', 'worker', 'web', 'root', 'root', 'root', 'root'])
  })

  it('runs no suite for browser-only and unincluded tests', () => {
    expect(runnerFor('apps/web/src/vtt/Board.browser.test.tsx')).toBeUndefined()
    expect(runnerFor('apps/session-worker/test/other.test.ts')).toBeUndefined()
    expect(runnerFor('packages/shared/src/foo/foo.test.ts')).toBeUndefined()
  })
})

describe('classify', () => {
  const root = join(tmpdir(), 'repo')
  const result = (name, status, assertions, message = undefined) => ({
    name: join(root, name),
    status,
    message,
    assertionResults: assertions.map(([assertionStatus, failureMessages], index) => ({
      fullName: `test ${index}`,
      status: assertionStatus,
      failureMessages
    }))
  })

  it('labels each file by how it fails against the phase branch', () => {
    const reports = [
      {
        testResults: [
          result('a/red.test.ts', 'failed', [
            ['passed', []],
            ['failed', ['AssertionError: expected 1 to be 2\n  at a/red.test.ts:3']]
          ]),
          result('a/import.test.ts', 'failed', [], 'Error: Failed to load url ../newModule\nstack'),
          result('a/pass.test.ts', 'passed', [['passed', []]])
        ]
      }
    ]
    expect(classify(['a/import.test.ts', 'a/missing.test.ts', 'a/pass.test.ts', 'a/red.test.ts'], reports, root)).toEqual([
      { file: 'a/import.test.ts', outcome: 'RED-IMPORT', detail: 'Error: Failed to load url ../newModule' },
      { file: 'a/missing.test.ts', outcome: 'NOT-RUN', detail: 'No Vitest report holds this file.' },
      { file: 'a/pass.test.ts', outcome: 'ALREADY-PASSING', detail: '' },
      { file: 'a/red.test.ts', outcome: 'RED', detail: '1 of 2 failing: "test 1". First: AssertionError: expected 1 to be 2' }
    ])
  })
})

describe('packagesToRebuild', () => {
  it('rebuilds the packages whose build output carries a changed helper', () => {
    expect(
      packagesToRebuild([
        'packages/rules-runtime/src/testing/fixture.ts',
        'packages/rules-runtime/src/testing/other.ts',
        'packages/shared/src/__tests__/helper.ts',
        'packages/schema/src/a.test.ts',
        'apps/session-worker/test/liveRoomFixture.ts'
      ])
    ).toEqual(['rules-runtime'])
  })
})

describe('summary', () => {
  it('lists each file with its outcome and escapes table pipes', () => {
    const text = summary([{ file: 'a/red.test.ts', outcome: 'RED', detail: 'expected a | b' }])
    expect(text).toContain('| `a/red.test.ts` | RED | expected a \\| b |')
  })
})

describe('changedTestFiles', () => {
  let root
  let base
  const write = (path, text) => {
    mkdirSync(join(root, dirname(path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'red-proof-'))
    git(root, 'init', '--quiet')
    write('pkg/src/a.ts', 'export const a = 1\n')
    write('pkg/src/a.test.ts', 'a\n')
    write('pkg/src/old.test.ts', 'old\n')
    write('pkg/test/fixture.ts', 'fixture\n')
    git(root, 'add', '.')
    git(root, 'commit', '--quiet', '-m', 'base')
    base = git(root, 'rev-parse', 'HEAD').trim()
  })

  afterEach(() => rmSync(root, { force: true, recursive: true }))

  it('lists added and modified test files and helpers, not production code or deletions', () => {
    write('pkg/src/a.ts', 'export const a = 2\n')
    write('pkg/src/a.test.ts', 'a changed\n')
    write('pkg/src/b.test.ts', 'b\n')
    write('pkg/test/fixture.ts', 'fixture changed\n')
    rmSync(join(root, 'pkg/src/old.test.ts'))
    git(root, 'add', '-A')
    git(root, 'commit', '--quiet', '-m', 'slice')
    expect(changedTestFiles(root, base)).toEqual(['pkg/src/a.test.ts', 'pkg/src/b.test.ts', 'pkg/test/fixture.ts'])
  })

  it('is empty for a production-only change', () => {
    write('pkg/src/a.ts', 'export const a = 3\n')
    git(root, 'commit', '--quiet', '-am', 'fix')
    expect(changedTestFiles(root, base)).toEqual([])
  })
})
