import { describe, expect, it } from 'vitest'

import {
  createPlatformRulesRuntime,
  deriveRulesRuntimeContinuationIntegrityKey,
  requireInstalledGameSystemPolicyModule
} from './platformRulesRuntime.js'

describe('platform rules runtime', () => {
  it('derives the same continuation key for every transport from one secret', () => {
    expect(Array.from(deriveRulesRuntimeContinuationIntegrityKey('shared-secret'))).toEqual(
      Array.from(deriveRulesRuntimeContinuationIntegrityKey('shared-secret'))
    )
    expect(Array.from(deriveRulesRuntimeContinuationIntegrityKey('shared-secret'))).not.toEqual(
      Array.from(deriveRulesRuntimeContinuationIntegrityKey('different-secret'))
    )
  })

  it('admits only exact installed System policy modules', () => {
    expect(() =>
      requireInstalledGameSystemPolicyModule({
        gameSystemId: '00000000-0000-0000-0000-000000000001',
        policyModule: { key: 'scene.grid.square.alternating-diagonals', contractVersion: 1 }
      })
    ).not.toThrow()
    expect(() =>
      requireInstalledGameSystemPolicyModule({
        gameSystemId: '00000000-0000-0000-0000-000000000001',
        policyModule: { key: 'scene.grid.square.alternating-diagonals', contractVersion: 2 }
      })
    ).toThrow('No policy module')
  })

  it('constructs the installed System registry without a transport selector', () => {
    const runtime = createPlatformRulesRuntime({
      continuationIntegrityKey: deriveRulesRuntimeContinuationIntegrityKey('shared-secret'),
      definitions: { requireCurrent: async () => ({}) }
    })

    expect(runtime).toMatchObject({
      execute: expect.any(Function),
      resume: expect.any(Function)
    })
  })
})
