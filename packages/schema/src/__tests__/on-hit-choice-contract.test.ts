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
  option: {
    kind: 'SPELL_SLOT' as const,
    riderId: RIDER_ID,
    riderLabel: 'Divine Smite',
    slotLevel: 2,
    useOptionId
  }
})

const poolAudit = (useOptionId: string, cost = 1) => ({
  selection: 'USE' as const,
  testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
  option: {
    kind: 'RESOURCE_POOL' as const,
    riderId: RIDER_ID,
    riderLabel: 'Divine Smite',
    poolId: 'pool:ki',
    cost,
    useOptionId
  }
})

describe('on-hit use option identity', () => {
  it('accepts the identity derived from the hit, rider and slot level offered', () => {
    const useOptionId = encounterOnHitUseOptionId({
      testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
      cost: { kind: 'SPELL_SLOT', riderId: RIDER_ID, riderLabel: 'Divine Smite', slotLevel: 2 }
    })

    expect(encounterOnHitAuditDtoSchema.safeParse(audit(useOptionId)).success).toBe(true)
  })

  it('rejects an identity derived for another slot level', () => {
    const useOptionId = encounterOnHitUseOptionId({
      testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
      cost: { kind: 'SPELL_SLOT', riderId: RIDER_ID, riderLabel: 'Divine Smite', slotLevel: 3 }
    })

    expect(encounterOnHitAuditDtoSchema.safeParse(audit(useOptionId)).success).toBe(false)
  })

  it('accepts the identity derived from the pool and cost offered', () => {
    const useOptionId = encounterOnHitUseOptionId({
      testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
      cost: {
        kind: 'RESOURCE_POOL',
        riderId: RIDER_ID,
        riderLabel: 'Divine Smite',
        poolId: 'pool:ki',
        cost: 2
      }
    })

    expect(encounterOnHitAuditDtoSchema.safeParse(poolAudit(useOptionId, 2)).success).toBe(true)
  })

  it('rejects an identity derived for another cost, or for a slot of the same rider', () => {
    const forOneCharge = encounterOnHitUseOptionId({
      testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
      cost: {
        kind: 'RESOURCE_POOL',
        riderId: RIDER_ID,
        riderLabel: 'Divine Smite',
        poolId: 'pool:ki',
        cost: 1
      }
    })
    const forSlot = encounterOnHitUseOptionId({
      testExecutionChecksum: TEST_EXECUTION_CHECKSUM,
      cost: { kind: 'SPELL_SLOT', riderId: RIDER_ID, riderLabel: 'Divine Smite', slotLevel: 1 }
    })

    expect(encounterOnHitAuditDtoSchema.safeParse(poolAudit(forOneCharge, 2)).success).toBe(false)
    expect(encounterOnHitAuditDtoSchema.safeParse(poolAudit(forSlot, 1)).success).toBe(false)
  })
})
