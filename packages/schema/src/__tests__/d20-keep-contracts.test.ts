import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { serverRuleExecutionD20EvidenceDtoSchema } from '../shared/ruleExecutionEvidence.js'

const evidence = (overrides: Record<string, unknown>) => ({
  requestId: 'attack-request',
  rollMode: 'ADVANTAGE',
  keep: 'HIGHER',
  derivedRollMode: 'NORMAL',
  contributors: [],
  contributorChecksum: checksumRuleDocument([]),
  modifier: 4,
  defenseOrDc: 15,
  resultPath: 'ON_HIT',
  rawFaces: [3, 17],
  selectedNatural: 17,
  total: 21,
  ...overrides
})

describe('d20 evidence keep', () => {
  it('accepts faces and a kept face that follow the keep', () => {
    expect(serverRuleExecutionD20EvidenceDtoSchema.safeParse(evidence({})).success).toBe(true)
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.safeParse(
        evidence({ keep: 'LOWER', selectedNatural: 3, total: 7 })
      ).success
    ).toBe(true)
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.safeParse(
        evidence({
          rollMode: 'NORMAL',
          keep: 'FIRST',
          rawFaces: [9],
          selectedNatural: 9,
          total: 13
        })
      ).success
    ).toBe(true)
  })

  it('refuses a face count the keep does not roll', () => {
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.safeParse(evidence({ keep: 'FIRST' })).success
    ).toBe(false)
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.safeParse(evidence({ rawFaces: [3] })).success
    ).toBe(false)
  })

  it('refuses a kept face the keep does not select', () => {
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.safeParse(evidence({ selectedNatural: 3, total: 7 }))
        .success
    ).toBe(false)
  })

  it('requires a keep', () => {
    const { keep: _keep, ...withoutKeep } = evidence({})
    expect(serverRuleExecutionD20EvidenceDtoSchema.safeParse(withoutKeep).success).toBe(false)
  })
})
