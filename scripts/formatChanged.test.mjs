import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { changedFiles, formatChanged } from './formatChanged.mjs'

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

const unformatted = 'export const value   =   {a:1}\n'

describe('formatChanged', () => {
  let root

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'format-changed-'))
    git(root, 'init', '--quiet', '--initial-branch=phase')
    writeFileSync(join(root, 'untouched.ts'), unformatted)
    writeFileSync(join(root, 'edited.ts'), 'export const value = 1\n')
    writeFileSync(join(root, 'deleted.ts'), 'export const value = 1\n')
    git(root, 'add', '.')
    git(root, 'commit', '--quiet', '-m', 'phase')
    git(root, 'switch', '--quiet', '-c', 'slice')
    writeFileSync(join(root, 'edited.ts'), unformatted)
    unlinkSync(join(root, 'deleted.ts'))
    git(root, 'add', '-A')
    git(root, 'commit', '--quiet', '-m', 'slice')
    writeFileSync(join(root, 'added.ts'), unformatted)
  })

  afterEach(() => rmSync(root, { force: true, recursive: true }))

  it('lists committed, uncommitted and untracked changes since the merge base, not deletions', () => {
    expect(changedFiles(root, 'phase')).toEqual(['added.ts', 'edited.ts'])
  })

  it('fails the check on a changed file and leaves the files alone', () => {
    expect(formatChanged(root, 'phase', { check: true })).not.toBe(0)
    expect(readFileSync(join(root, 'edited.ts'), 'utf8')).toBe(unformatted)
  })

  it('formats only the changed files', () => {
    expect(formatChanged(root, 'phase')).toBe(0)
    expect(readFileSync(join(root, 'edited.ts'), 'utf8')).not.toBe(unformatted)
    expect(readFileSync(join(root, 'added.ts'), 'utf8')).not.toBe(unformatted)
    expect(readFileSync(join(root, 'untouched.ts'), 'utf8')).toBe(unformatted)
    expect(formatChanged(root, 'phase', { check: true })).toBe(0)
  })

  it('runs no formatter when nothing changed', () => {
    git(root, 'switch', '--quiet', 'phase')
    rmSync(join(root, 'added.ts'))
    expect(formatChanged(root, 'phase', { check: true })).toBe(0)
  })
})
