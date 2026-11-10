import { describe, expect, it } from 'vitest'

import { imposeRollModeOnTriggeringRollDtoSchema } from '../effects/imposeRollModeOnTriggeringRoll.js'
import { reactionTriggerBindingDtoSchema } from '../shared/reaction.js'
import { sizeRangeDtoSchema } from '../shared/sizeRange.js'

describe('the size range contract (D217)', () => {
  it.each([
    [{ minimumSizeCode: 'LARGE' }],
    [{ maximumSizeCode: 'MEDIUM' }],
    [{ minimumSizeCode: 'SMALL', maximumSizeCode: 'LARGE' }]
  ])('accepts %o', (range) => {
    expect(sizeRangeDtoSchema.safeParse(range).success).toBe(true)
  })

  it.each([[{}], [{ minimumSizeCode: '' }], [{ minimumSizeCode: 'LARGE', sizeCode: 'LARGE' }]])(
    'refuses %o',
    (range) => {
      expect(sizeRangeDtoSchema.safeParse(range).success).toBe(false)
    }
  )
})

describe('the attack reaction trigger contracts (D217)', () => {
  it('accepts a reaction to an attack on another creature near the reactor', () => {
    expect(
      reactionTriggerBindingDtoSchema.safeParse({
        kind: 'ATTACK_ON_OTHER',
        requiresSight: true,
        targetWithinFeet: 5,
        holderEquippedCategory: 'SHIELD',
        attackerSize: { maximumSizeCode: 'LARGE' }
      }).success
    ).toBe(true)
  })

  it('needs a reach for an attack on another creature', () => {
    expect(reactionTriggerBindingDtoSchema.safeParse({ kind: 'ATTACK_ON_OTHER' }).success).toBe(
      false
    )
  })

  it.each(['HIT', 'MISS', 'ANY'])(
    'accepts a reaction to an attack on the reactor that %s',
    (outcome) => {
      expect(
        reactionTriggerBindingDtoSchema.safeParse({
          kind: 'ATTACK_RESOLVED_ON_SELF',
          outcome,
          attackerWithinFeet: 5,
          attackerSize: { minimumSizeCode: 'LARGE' }
        }).success
      ).toBe(true)
    }
  )

  it('refuses a resolved attack with no outcome, an unknown outcome, or an empty size range', () => {
    const parse = (fields: Record<string, unknown>) =>
      reactionTriggerBindingDtoSchema.safeParse({ kind: 'ATTACK_RESOLVED_ON_SELF', ...fields })
        .success
    expect(parse({})).toBe(false)
    expect(parse({ outcome: 'CRITICAL' })).toBe(false)
    expect(parse({ outcome: 'ANY', attackerSize: {} })).toBe(false)
  })
})

describe('the impose-roll-mode outcome contract (D217)', () => {
  it('names the roll mode the triggering roll takes', () => {
    expect(
      imposeRollModeOnTriggeringRollDtoSchema.safeParse({
        id: 'outcome-1',
        effectKind: 'IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL',
        rollMode: 'DISADVANTAGE'
      }).success
    ).toBe(true)
    expect(
      imposeRollModeOnTriggeringRollDtoSchema.safeParse({
        id: 'outcome-1',
        effectKind: 'IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL'
      }).success
    ).toBe(false)
  })
})
