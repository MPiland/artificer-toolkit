import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generatedStatus } from './generatedDrift.mjs'

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

describe('generatedStatus', () => {
  let root
  const generated = ['_generated', 'manifest.generated.ts']

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'generated-drift-'))
    git(root, 'init', '--quiet')
    mkdirSync(join(root, '_generated'))
    writeFileSync(join(root, '_generated', 'api.js'), 'export {}\n')
    writeFileSync(join(root, 'manifest.generated.ts'), 'export const manifest = 1\n')
    git(root, 'add', '.')
    git(root, 'commit', '--quiet', '-m', 'generated')
  })

  afterEach(() => rmSync(root, { force: true, recursive: true }))

  it('is empty while the generated files match the commit', () => {
    expect(generatedStatus(root, generated)).toBe('')
  })

  it('reports a modified generated file', () => {
    writeFileSync(join(root, 'manifest.generated.ts'), 'export const manifest = 2\n')
    expect(generatedStatus(root, generated)).toBe(' M manifest.generated.ts')
  })

  it('reports an untracked file that codegen added to a generated folder', () => {
    writeFileSync(join(root, '_generated', 'added.d.ts'), 'export {}\n')
    expect(generatedStatus(root, generated)).toBe('?? _generated/added.d.ts')
  })

  it('ignores changes outside the generated paths', () => {
    writeFileSync(join(root, 'other.ts'), 'export {}\n')
    expect(generatedStatus(root, generated)).toBe('')
  })
})
