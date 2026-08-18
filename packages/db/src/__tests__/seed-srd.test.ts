import { describe, expect, it } from 'vitest'

import { assertDatabaseTarget, parseSeedInvocation } from '../scripts/seedSrd.js'

describe('SRD seed invocation', () => {
  it('requires exactly one explicit target', () => {
    expect(() => parseSeedInvocation([])).toThrow('Pass exactly one')
    expect(() => parseSeedInvocation(['--staging', '--production', '--dry-run'])).toThrow(
      'Pass exactly one'
    )
  })

  it('accepts a rollback-only staging dry run without the commit confirmation', () => {
    expect(parseSeedInvocation(['--staging', '--dry-run'])).toEqual({
      dryRun: true,
      target: 'staging'
    })
  })

  it('requires explicit confirmation before a hosted commit', () => {
    expect(() => parseSeedInvocation(['--production'])).toThrow('--confirm-seed-srd')
    expect(parseSeedInvocation(['--production', '--confirm-seed-srd'])).toEqual({
      dryRun: false,
      target: 'production'
    })
  })

  it('keeps local seeding direct and rejects a meaningless local dry run', () => {
    expect(parseSeedInvocation(['--local'])).toEqual({ dryRun: false, target: 'local' })
    expect(() => parseSeedInvocation(['--local', '--dry-run'])).toThrow(
      '--local and --dry-run cannot be used together'
    )
  })

  it('rejects crossing local and hosted database boundaries', () => {
    expect(() =>
      assertDatabaseTarget('staging', 'postgresql://postgres@127.0.0.1:54322/postgres')
    ).toThrow('staging SRD seed command requires a hosted database')
    expect(() =>
      assertDatabaseTarget('local', 'postgresql://postgres@db.example.test:5432/postgres')
    ).toThrow('local SRD seed command requires a local database')
  })
})
