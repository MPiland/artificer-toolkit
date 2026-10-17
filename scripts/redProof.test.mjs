import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classify, isTestPath, packagesToRebuild, summary } from './redProof.mjs'

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
        'apps/web/src/routes/-routeTreeSource.testUtils.ts',
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
    expect(
      classify(
        ['a/import.test.ts', 'a/missing.test.ts', 'a/pass.test.ts', 'a/red.test.ts'],
        reports,
        root
      )
    ).toEqual([
      {
        file: 'a/import.test.ts',
        outcome: 'RED-IMPORT',
        detail: 'Error: Failed to load url ../newModule'
      },
      {
        file: 'a/missing.test.ts',
        outcome: 'NOT-RUN',
        detail: 'No Vitest report holds this file.'
      },
      { file: 'a/pass.test.ts', outcome: 'ALREADY-PASSING', detail: '' },
      {
        file: 'a/red.test.ts',
        outcome: 'RED',
        detail: '1 of 2 failing: "test 1". First: AssertionError: expected 1 to be 2'
      }
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
