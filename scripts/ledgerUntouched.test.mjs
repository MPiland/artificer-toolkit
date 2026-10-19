import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LEDGER, ledgerChanges } from './ledgerUntouched.mjs'

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

const writeLedger = (root, status) =>
  writeFileSync(join(root, LEDGER), `{ "status": "${status}" }\n`)

describe('ledgerChanges (PLATFORM-13.T14)', () => {
  let root

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ledger-untouched-'))
    git(root, 'init', '--quiet', '--initial-branch=phase')
    mkdirSync(join(root, 'docs/roadmap'), { recursive: true })
    writeLedger(root, 'IN_PROGRESS')
    writeFileSync(join(root, 'workflow.yml'), 'jobs: {}\n')
    commitAll(root, 'phase')
    git(root, 'switch', '--quiet', '-c', 'slice')
    writeFileSync(join(root, 'workflow.yml'), 'jobs: { lint: {} }\n')
    commitAll(root, 'slice work')
  })

  afterEach(() => rmSync(root, { force: true, recursive: true }))

  it('passes a slice that left the ledger alone', () => {
    expect(ledgerChanges(root, 'phase')).toEqual([])
  })

  it('names the slice commit that rewrote the ledger', () => {
    writeLedger(root, 'TODO')
    commitAll(root, 'rewrite the ledger')
    expect(ledgerChanges(root, 'phase')).toEqual([
      expect.stringMatching(/^[0-9a-f]+ rewrite the ledger$/)
    ])
  })

  it('counts an uncommitted ledger edit', () => {
    writeLedger(root, 'TODO')
    expect(ledgerChanges(root, 'phase')).toEqual(['working tree'])
  })

  it('does not count ledger edits a merge of the phase branch brought in', () => {
    git(root, 'switch', '--quiet', 'phase')
    writeLedger(root, 'DONE')
    commitAll(root, 'orchestrator ledger edit')
    git(root, 'switch', '--quiet', 'slice')
    git(root, 'merge', '--quiet', '--no-edit', 'phase')
    expect(ledgerChanges(root, 'phase')).toEqual([])
  })
})
