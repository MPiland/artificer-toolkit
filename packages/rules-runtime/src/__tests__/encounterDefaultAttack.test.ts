import { describe, expect, it } from 'vitest'

import { ACTIVATION_CODE, TRIGGER } from '@artificer-toolkit/shared/core'

import {
  encounterDefaultAttackActionId,
  type DefaultAttackChoice
} from '../encounterDefaultAttack.js'

const choice = (overrides: Partial<DefaultAttackChoice> & { id: string }): DefaultAttackChoice => ({
  available: true,
  continuesAttack: false,
  itemId: null,
  activationCode: ACTIVATION_CODE.ACTION,
  triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
  ...overrides
})

const longsword = choice({ id: 'longsword:attack', itemId: 'longsword' })
const dagger = choice({ id: 'dagger:attack', itemId: 'dagger' })
const daggerThrow = choice({
  id: 'dagger:throw',
  itemId: 'dagger',
  triggerCode: TRIGGER.RANGED_WEAPON_ATTACK
})
const daggerOffHand = choice({
  id: 'dagger:off-hand',
  itemId: 'dagger',
  activationCode: ACTIVATION_CODE.BONUS_ACTION
})
const hands = { mainHandId: 'longsword', offHandId: 'dagger' }

describe('encounterDefaultAttackActionId (D107)', () => {
  it('starts on the main-hand weapon attack of the Action', () => {
    expect(
      encounterDefaultAttackActionId({
        choices: [dagger, daggerOffHand, longsword],
        hands,
        lastAttackActionId: null
      })
    ).toBe(longsword.id)
  })

  it('continues with the last weapon of the open Attack action while it has an attack left', () => {
    const daggerSlotted = { ...dagger, continuesAttack: true }
    expect(
      encounterDefaultAttackActionId({
        choices: [{ ...longsword, continuesAttack: true }, daggerSlotted],
        hands,
        lastAttackActionId: dagger.id
      })
    ).toBe(dagger.id)
  })

  it('moves to the off-hand bonus attack once the Attack action has no attack left', () => {
    const spent = { available: false, continuesAttack: false }
    expect(
      encounterDefaultAttackActionId({
        choices: [{ ...longsword, ...spent }, { ...dagger, ...spent }, daggerOffHand],
        hands,
        lastAttackActionId: longsword.id
      })
    ).toBe(daggerOffHand.id)
  })

  it('skips an attack whose activation is spent and the off-hand weapon used as a main-hand attack', () => {
    expect(
      encounterDefaultAttackActionId({
        choices: [{ ...longsword, available: false }, dagger],
        hands,
        lastAttackActionId: null
      })
    ).toBeNull()
  })

  it('takes a ranged weapon attack through the held weapon', () => {
    expect(
      encounterDefaultAttackActionId({
        choices: [daggerThrow],
        hands: { mainHandId: 'dagger', offHandId: null },
        lastAttackActionId: null
      })
    ).toBe(daggerThrow.id)
  })

  it('ignores an item action that is not a weapon attack', () => {
    expect(
      encounterDefaultAttackActionId({
        choices: [
          { ...longsword, triggerCode: TRIGGER.MELEE_SPELL_ATTACK },
          choice({ id: 'cantrip' })
        ],
        hands,
        lastAttackActionId: null
      })
    ).toBeNull()
  })

  it('picks nothing when nothing is held', () => {
    expect(
      encounterDefaultAttackActionId({
        choices: [longsword, daggerOffHand],
        hands: { mainHandId: null, offHandId: null },
        lastAttackActionId: null
      })
    ).toBeNull()
  })
})
