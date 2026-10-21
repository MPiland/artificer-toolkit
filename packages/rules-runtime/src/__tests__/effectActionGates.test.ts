import { describe, expect, it } from 'vitest'

import {
  damageTypeIdsText,
  gateEvidenceIsValid,
  gateNodeInputs,
  gatesAdmit,
  isGated
} from '../systems/dnd5e/effectActionGates.js'

const FIRE = '00000000-0000-4000-8000-0000000000f1'
const RADIANT = '00000000-0000-4000-8000-0000000000f2'

function operationInputs(hitPoints: number, taken: string[], suppressed: string[]) {
  return {
    targetCurrentHitPoints: hitPoints,
    hitPointsAbove: 0,
    hitPointsAtMost: Number.MAX_SAFE_INTEGER,
    targetDamageTypesTaken: damageTypeIdsText(taken),
    suppressedDamageTypeIds: damageTypeIdsText(suppressed)
  }
}

describe('the dnd5e gate table (SPELLS-33.T4i1b2)', () => {
  it('admits a target only while every gate kind admits it', () => {
    expect(gatesAdmit(operationInputs(10, [FIRE], [RADIANT]))).toBe(true)
    expect(gatesAdmit(operationInputs(10, [RADIANT], [RADIANT]))).toBe(false)
    expect(gatesAdmit(operationInputs(0, [], [RADIANT]))).toBe(false)
  })

  it('refuses inputs that do not bind a gate', () => {
    expect(gatesAdmit({ ...operationInputs(10, [], []), suppressedDamageTypeIds: 'x' })).toBeNull()
    expect(gatesAdmit({ targetCurrentHitPoints: 10 })).toBeNull()
  })

  it('compiles an unauthored gate wide open and treats a suppression alone as gated', () => {
    expect(isGated({})).toBe(false)
    expect(isGated({ suppressedByDamageTypeIds: [RADIANT] })).toBe(true)
    expect(gateNodeInputs({ suppressedByDamageTypeIds: [RADIANT] })).toMatchObject({
      hitPointsAbove: { kind: 'LITERAL', value: -1 },
      suppressedDamageTypeIds: { kind: 'LITERAL', value: damageTypeIdsText([RADIANT]) }
    })
  })

  describe('evidence', () => {
    const inputs = gateNodeInputs({ suppressedByDamageTypeIds: [RADIANT] })
    const node = { inputs }
    const check = (taken: string[], hitPoints: number, authorized: boolean) =>
      gateEvidenceIsValid(
        {
          currentHitPoints: hitPoints,
          execution: {
            evidence: {
              facts: {
                'dnd5e.target-current-hit-points': hitPoints,
                'dnd5e.target-damage-types-taken': damageTypeIdsText(taken)
              }
            }
          }
        },
        node,
        { operation: { contractVersion: 2 }, outputs: { authorized } }
      )

    it('accepts the verdict the facts imply', () => {
      expect(check([FIRE], 10, true)).toBe(true)
      expect(check([RADIANT], 10, false)).toBe(true)
    })

    it('rejects an authorization the facts do not imply', () => {
      expect(check([RADIANT], 10, true)).toBe(false)
      expect(check([FIRE], 10, false)).toBe(false)
    })
  })
})
