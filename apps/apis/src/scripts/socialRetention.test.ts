import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  socialRetentionApplyInputSchema,
  socialRetentionPreviewInputSchema
} from '@artificer-toolkit/schema/api/socialRetention'

const execute = vi.hoisted(() =>
  vi.fn<(file: string, args: string[], options: ExecOptions) => Promise<{ stdout: string }>>()
)
vi.mock('node:child_process', async () => {
  const { promisify } = await import('node:util')
  return { execFile: Object.assign(vi.fn(), { [promisify.custom]: execute }) }
})

import { runSocialRetention } from './socialRetention.js'

const environment = {
  CONVEX_URL: 'https://forge.convex.cloud',
  CONVEX_DEPLOY_KEY: '',
  CONFIRM_SOCIAL_RETENTION_PURGE: 'purge-expired-social-data'
}
const asOf = '2026-01-01T00:00:00.000Z'
type ExecOptions = { env?: NodeJS.ProcessEnv }

function page(overrides: Record<string, unknown> = {}) {
  return {
    scanned: 0,
    eligible: 0,
    continueCursor: 'next',
    isDone: true,
    ...overrides
  }
}

describe('runSocialRetention', () => {
  beforeEach(() => {
    execute.mockReset()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it.each([
    ['missing deployment', ['--as-of', asOf]],
    ['missing cutoff', ['--deployment-name', 'forge']],
    ['invalid deployment', ['--deployment-name', 'Forge', '--as-of', asOf]],
    ['invalid cutoff', ['--deployment-name', 'forge', '--as-of', '2026-01-01T00:00:00Z']],
    ['malformed cutoff', ['--deployment-name', 'forge', '--as-of', 'invalid']],
    ['negative cutoff', ['--deployment-name', 'forge', '--as-of', '1969-12-31T23:59:59.999Z']],
    ['future cutoff', ['--deployment-name', 'forge', '--as-of', '2999-01-01T00:00:00.000Z']],
    ['positionals', ['--deployment-name', 'forge', '--as-of', asOf, 'extra']],
    ['unknown option', ['--deployment-name', 'forge', '--as-of', asOf, '--purge']]
  ] as const)('rejects %s without invoking Convex', async (_name, argv) => {
    await expect(runSocialRetention([...argv], environment)).rejects.toThrow()
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([
    ['wrong confirmation', { ...environment, CONFIRM_SOCIAL_RETENTION_PURGE: 'wrong' }],
    ['missing confirmation', { ...environment, CONFIRM_SOCIAL_RETENTION_PURGE: undefined }],
    ['URL mismatch', { ...environment, CONVEX_URL: 'https://other.convex.cloud' }],
    ['deploy key', { ...environment, CONVEX_DEPLOY_KEY: 'secret' }]
  ] as const)('rejects apply with %s without invoking Convex', async (_name, env) => {
    await expect(
      runSocialRetention(['--deployment-name', 'forge', '--as-of', asOf, '--apply'], env)
    ).rejects.toThrow()
    expect(execute).not.toHaveBeenCalled()
  })

  it('pages empty continuing results and runs all phases in order', async () => {
    execute.mockImplementation(async (_file: string, _args: string[], options: ExecOptions) => {
      const input = socialRetentionPreviewInputSchema.parse(
        JSON.parse(options.env?.SOCIAL_RETENTION_ARGS ?? '{}')
      )
      if (input.phase === 'INVITATIONS' && input.paginationOpts.cursor === null)
        return { stdout: JSON.stringify(page({ isDone: false, continueCursor: 'one' })) }
      return { stdout: JSON.stringify(page()) }
    })

    await runSocialRetention(['--deployment-name', 'forge', '--as-of', asOf], environment)

    expect(execute).toHaveBeenCalledTimes(4)
    const calls = execute.mock.calls.map((call) => {
      const options = call[2]
      return socialRetentionPreviewInputSchema.parse(
        JSON.parse(options.env?.SOCIAL_RETENTION_ARGS ?? '{}')
      )
    })
    expect(calls.map((input) => input.phase)).toEqual([
      'INVITATIONS',
      'INVITATIONS',
      'REPORTS',
      'APPLICATIONS'
    ])
    expect(calls.every((input) => input.asOf === asOf && input.paginationOpts.numItems === 8)).toBe(
      true
    )
    expect(
      execute.mock.calls.every(
        (call) => call[2].env?.SOCIAL_RETENTION_FUNCTION === 'social/retention:preview'
      )
    ).toBe(true)
    expect(calls[1]?.paginationOpts.cursor).toBe('one')
    expect(console.log).toHaveBeenCalledWith({ mode: 'dry-run', deployment: 'forge', asOf })
  })

  it('finishes report pages before applying applications', async () => {
    execute.mockImplementation(async (_file: string, _args: string[], options: ExecOptions) => {
      const input = socialRetentionApplyInputSchema.parse(
        JSON.parse(options.env?.SOCIAL_RETENTION_ARGS ?? '{}')
      )
      const continuation = input.phase === 'REPORTS' && input.paginationOpts.cursor === null
      return {
        stdout: JSON.stringify(
          page(
            continuation
              ? {
                  scanned: 1,
                  eligible: 1,
                  isDone: false,
                  continueCursor: 'report-next',
                  deleted: 1
                }
              : { scanned: 1, eligible: 1, deleted: 1 }
          )
        )
      }
    })

    await runSocialRetention(
      ['--deployment-name', 'forge', '--as-of', asOf, '--apply'],
      environment
    )

    const calls = execute.mock.calls.map((call) => {
      const options = call[2]
      return socialRetentionApplyInputSchema.parse(
        JSON.parse(options.env?.SOCIAL_RETENTION_ARGS ?? '{}')
      )
    })
    const phases = calls.map((input) => input.phase)
    expect(phases.indexOf('APPLICATIONS')).toBeGreaterThan(phases.lastIndexOf('REPORTS'))
    expect(
      calls.every(
        (input) =>
          input.confirm === 'purge-expired-social-data' &&
          input.asOf === asOf &&
          input.paginationOpts.numItems === 8
      )
    ).toBe(true)
    expect(
      execute.mock.calls.every(
        (call) => call[2].env?.SOCIAL_RETENTION_FUNCTION === 'social/retention:apply'
      )
    ).toBe(true)
    expect(console.log).toHaveBeenCalledWith({
      phase: 'REPORTS',
      scanned: 2,
      eligible: 2,
      deleted: 2
    })
  })

  it('sanitizes child failures and aborts later phases', async () => {
    execute.mockRejectedValue(new Error('secret stdout stderr'))
    await expect(
      runSocialRetention(['--deployment-name', 'forge', '--as-of', asOf], environment)
    ).rejects.toThrow('arguments/output withheld')
    expect(execute).toHaveBeenCalledTimes(1)
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('secret'))
  })

  it.each([
    ['malformed response', { scanned: 1 }, 1],
    ['nonadvancing cursor', page({ isDone: false, continueCursor: 'same' }), 2]
  ] as const)('rejects %s and stops', async (_name, result, calls) => {
    execute.mockResolvedValue({ stdout: JSON.stringify(result) })
    await expect(
      runSocialRetention(['--deployment-name', 'forge', '--as-of', asOf], environment)
    ).rejects.toThrow()
    expect(execute).toHaveBeenCalledTimes(calls)
  })
})
