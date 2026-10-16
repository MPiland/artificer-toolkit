import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { changedSnapshotFiles, failedSnapshotFiles } from './snapshotDrift.mjs'

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

const file = (name, assertionMessages, message = undefined) => ({
  name,
  status: assertionMessages.length || message ? 'failed' : 'passed',
  message,
  assertionResults: assertionMessages.map((failureMessages) => ({
    status: 'failed',
    failureMessages
  }))
})

describe('failedSnapshotFiles', () => {
  const root = join(tmpdir(), 'repo')
  const at = (path) => join(root, path)

  it('lists only the files that failed on a snapshot mismatch, root-relative and sorted', () => {
    const reports = [
      {
        testResults: [
          file(at('b/__tests__/two.test.ts'), [['Error: Snapshot `two 1` mismatched\n- a\n+ b']]),
          file(at('a/one.test.ts'), [['AssertionError: expected 1 to be 2']]),
          file(at('a/three.test.ts'), [[], ['Error: Snapshot `three 2` mismatched']]),
          file(at('a/four.test.ts'), [])
        ]
      },
      {
        testResults: [
          file(at('b/__tests__/two.test.ts'), [['Error: Snapshot `two 3` mismatched']]),
          file(at('a/five.test.ts'), [], 'Error: Snapshot `five 1` mismatched')
        ]
      }
    ]
    expect(failedSnapshotFiles(reports, root)).toEqual([
      'a/five.test.ts',
      'a/three.test.ts',
      'b/__tests__/two.test.ts'
    ])
  })

  it('is empty when no failure is a snapshot mismatch', () => {
    const reports = [{ testResults: [file(at('a/one.test.ts'), [['Error: boom']])] }]
    expect(failedSnapshotFiles(reports, root)).toEqual([])
  })
})

describe('changedSnapshotFiles', () => {
  let root

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'snapshot-drift-'))
    git(root, 'init', '--quiet')
    mkdirSync(join(root, 'pkg', '__snapshots__'), { recursive: true })
    writeFileSync(join(root, 'pkg', '__snapshots__', 'a.test.ts.snap'), 'one\n')
    writeFileSync(join(root, 'pkg', 'a.test.ts'), 'inline(1)\n')
    writeFileSync(join(root, 'pkg', 'source.ts'), 'export {}\n')
    git(root, 'add', '.')
    git(root, 'commit', '--quiet', '-m', 'snapshots')
  })

  afterEach(() => rmSync(root, { force: true, recursive: true }))

  it('is empty while the snapshots match the commit', () => {
    expect(changedSnapshotFiles(root)).toEqual([])
  })

  it('reports an updated snapshot, an inline-updated test and a new snapshot file', () => {
    writeFileSync(join(root, 'pkg', '__snapshots__', 'a.test.ts.snap'), 'two\n')
    writeFileSync(join(root, 'pkg', 'a.test.ts'), 'inline(2)\n')
    writeFileSync(join(root, 'pkg', '__snapshots__', 'b.test.ts.snap'), 'new\n')
    expect(changedSnapshotFiles(root).sort()).toEqual([
      'pkg/__snapshots__/a.test.ts.snap',
      'pkg/__snapshots__/b.test.ts.snap',
      'pkg/a.test.ts'
    ])
  })

  it('ignores changes that are not snapshots', () => {
    writeFileSync(join(root, 'pkg', 'source.ts'), 'export const changed = 1\n')
    writeFileSync(join(root, 'report.json'), '{}\n')
    expect(changedSnapshotFiles(root)).toEqual([])
  })
})
