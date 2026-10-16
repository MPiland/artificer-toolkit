import { describe, expect, it } from 'vitest'

import {
  encounterOnHitAuditDtoSchema,
  encounterOnHitUseOptionId
} from '../shared/ruleExecutionOnHitChoice.js'

const TEST_EXECUTION_CHECKSUM = 'a'.repeat(64)
const RIDER_ID = '00000000-0000-4000-8000-000000000201'

const audit = (useOptionId: string) => ({
  selection: 'USE' as const,
  testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
  option: { riderId: RIDER_ID, slotLevel: 2, useOptionId }
})

describe('on-hit use option identity', () => {
  it('accepts the identity derived from the hit, rider and slot level offered', () => {
    const useOptionId = encounterOnHitUseOptionId({
      testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
      riderId: RIDER_ID,
      slotLevel: 2
    })

    expect(encounterOnHitAuditDtoSchema.safeParse(audit(useOptionId)).success).toBe(true)
  })

  it('rejects an identity derived for another slot level', () => {
    const useOptionId = encounterOnHitUseOptionId({
      testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
      riderId: RIDER_ID,
      slotLevel: 3
    })

    expect(encounterOnHitAuditDtoSchema.safeParse(audit(useOptionId)).success).toBe(false)
  })
})
