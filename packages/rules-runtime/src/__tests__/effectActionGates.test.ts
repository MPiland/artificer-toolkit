import { describe, expect, it } from 'vitest'

import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import {
  damageTypeIdsText,
  gateEvidenceIsValid,
  gateNodeInputs,
  gatesAdmit,
  isGated,
  reducedToZeroGateHolds
} from '../systems/dnd5e/effectActionGates.js'

const FIRE = '00000000-0000-4000-8000-0000000000f1'
const RADIANT = '00000000-0000-4000-8000-0000000000f2'

function operationInputs(hitPoints: number, taken: string[], suppressed: string[]) {
  return {
    targetCurrentHitPoints: hitPoints,
    hitPointsAbove: 0,
    hitPointsAtMost: Number.MAX_SAFE_INTEGER,
    targetDamageTypesTaken: damageTypeIdsText(taken),
    suppressedDamageTypeIds: damageTypeIdsText(suppressed),
    reducedToZeroByNodeId: ''
  }
}

const DAMAGE_NODE = 'outcome1-proposal-on_hit'

function damageApplication(before: number, after: number, sourceNodeId = DAMAGE_NODE) {
  return {
    kind: 'DAMAGE',
    sourceNodeId,
    beforeCurrentHitPoints: before,
    afterCurrentHitPoints: after
  } as CharacterRuleActionApplication
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

  describe('the reduced-to-0 gate (SPELLS-33.T4i3a)', () => {
    const gated = gateNodeInputs({ reducedToZeroByNodeId: DAMAGE_NODE })

    it('is gated, binds its damage node as a literal, and leaves the rest open', () => {
      expect(isGated({ reducedToZeroByNodeId: DAMAGE_NODE })).toBe(true)
      expect(gated).toMatchObject({
        reducedToZeroByNodeId: { kind: 'LITERAL', value: DAMAGE_NODE },
        hitPointsAbove: { kind: 'LITERAL', value: -1 }
      })
      expect(gateNodeInputs({}).reducedToZeroByNodeId).toEqual({ kind: 'LITERAL', value: '' })
    })

    it('admits in the graph, which cannot see damage defenses', () => {
      expect(
        gatesAdmit({ ...operationInputs(10, [], []), reducedToZeroByNodeId: DAMAGE_NODE })
      ).toBe(true)
    })

    it('holds only while the named damage took the target from above 0 to 0', () => {
      expect(reducedToZeroGateHolds(gated, [damageApplication(7, 0)])).toBe(true)
      expect(reducedToZeroGateHolds(gated, [damageApplication(7, 2)])).toBe(false)
      expect(reducedToZeroGateHolds(gated, [damageApplication(0, 0)])).toBe(false)
      expect(reducedToZeroGateHolds(gated, [damageApplication(7, 0, 'other-damage')])).toBe(false)
      expect(reducedToZeroGateHolds(gated, [])).toBe(false)
    })

    it('does not constrain a proposal that names no damage', () => {
      expect(reducedToZeroGateHolds(gateNodeInputs({}), [])).toBe(true)
      expect(reducedToZeroGateHolds({}, [])).toBe(true)
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
