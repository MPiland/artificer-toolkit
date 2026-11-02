import { describe, expect, it } from 'vitest'

import { consumeEncounterActionEconomy } from '../encounterActionEconomyConsumption.js'
import { encounterSpellCastingState } from '../encounterActorState.js'
import {
  applyEncounterSpellCastingTransition,
  evaluateEncounterSpellCasting,
  revertEncounterSpellCastingTransition
} from '../encounterSpellCasting.js'
import { characterActor, srdEncounterState, testUuid } from '../testing/dnd5eSrdEncounter.js'

const ACTOR = characterActor({ id: testUuid(0xd01), characterId: testUuid(0xd02) })
const state = (turnSequence: number) =>
  srdEncounterState({ actors: [ACTOR], currentActorId: ACTOR.id, turnSequence })

const ACTION = { code: 'ACTION', amount: 1 }
const BONUS_ACTION = { code: 'BONUS_ACTION', amount: 1 }
const REACTION = { code: 'REACTION', amount: 1 }

/** Casts in order within one turn, each settling the record the cast before it left. */
function castInOrder(
  casts: readonly { activation: { code: string; amount: number }; cantrip: boolean }[],
  turnSequence = 1
) {
  let actor = ACTOR
  const outcomes = casts.map((cast) => {
    const evaluated = evaluateEncounterSpellCasting({
      actor,
      state: state(turnSequence),
      ...cast
    })
    if (evaluated.transition)
      actor = applyEncounterSpellCastingTransition(actor, evaluated.transition)
    return evaluated.refusal
  })
  return { actor, outcomes }
}

describe('the limit on spells cast in one turn (SPELLS-31.T5h-3)', () => {
  it('refuses a leveled spell after a bonus action spell, and allows an action cantrip', () => {
    const { outcomes } = castInOrder([
      { activation: BONUS_ACTION, cantrip: false },
      { activation: ACTION, cantrip: false },
      { activation: ACTION, cantrip: true }
    ])
    expect(outcomes[0]).toBeNull()
    expect(outcomes[1]).toMatch(/only a cantrip/)
    expect(outcomes[2]).toBeNull()
  })

  it('refuses a bonus action spell after an action spell that is not a cantrip', () => {
    const { outcomes } = castInOrder([
      { activation: ACTION, cantrip: false },
      { activation: BONUS_ACTION, cantrip: false }
    ])
    expect(outcomes[0]).toBeNull()
    expect(outcomes[1]).toMatch(/bonus action spell can’t follow/)
  })

  it('allows a bonus action spell after an action cantrip', () => {
    const { outcomes } = castInOrder([
      { activation: ACTION, cantrip: true },
      { activation: BONUS_ACTION, cantrip: false }
    ])
    expect(outcomes).toEqual([null, null])
  })

  it('refuses a second bonus action spell', () => {
    const { outcomes } = castInOrder([
      { activation: BONUS_ACTION, cantrip: false },
      { activation: BONUS_ACTION, cantrip: true }
    ])
    expect(outcomes[1]).toMatch(/bonus action spell can’t follow/)
  })

  it('never limits a reaction spell, nor records it', () => {
    const { actor, outcomes } = castInOrder([
      { activation: BONUS_ACTION, cantrip: false },
      { activation: REACTION, cantrip: false },
      { activation: ACTION, cantrip: true }
    ])
    expect(outcomes).toEqual([null, null, null])
    expect(encounterSpellCastingState(actor)).toEqual({
      turnSequence: 1,
      bonusActionSpell: true,
      actionSpell: false
    })
  })

  it('ignores the record of an earlier turn', () => {
    const first = castInOrder([{ activation: ACTION, cantrip: false }], 1)
    const next = evaluateEncounterSpellCasting({
      actor: first.actor,
      state: state(2),
      activation: BONUS_ACTION,
      cantrip: false
    })
    expect(next.refusal).toBeNull()
    expect(next.transition?.after).toEqual({
      turnSequence: 2,
      bonusActionSpell: true,
      actionSpell: false
    })
  })
})

describe('a cast that overrides the limit (SPELLS-31.T5h-3)', () => {
  it('still records the cast, so the next cast is judged against it', () => {
    // An action spell, then a bonus action spell the GM allows, then a second action spell.
    const { actor, outcomes } = castInOrder([
      { activation: ACTION, cantrip: false },
      { activation: BONUS_ACTION, cantrip: false },
      { activation: ACTION, cantrip: false }
    ])
    expect(outcomes[1]).toMatch(/bonus action spell can’t follow/)
    expect(outcomes[2]).toMatch(/only a cantrip/)
    expect(encounterSpellCastingState(actor)).toEqual({
      turnSequence: 1,
      bonusActionSpell: true,
      actionSpell: true
    })
  })

  it('restores the earlier record on undo', () => {
    const first = castInOrder([{ activation: ACTION, cantrip: false }])
    const overridden = evaluateEncounterSpellCasting({
      actor: first.actor,
      state: state(1),
      activation: BONUS_ACTION,
      cantrip: false
    })
    expect(overridden.refusal).not.toBeNull()
    const spent = applyEncounterSpellCastingTransition(first.actor, overridden.transition!)
    const restored = revertEncounterSpellCastingTransition(spent, overridden.transition!)
    expect(restored && encounterSpellCastingState(restored)).toEqual(
      encounterSpellCastingState(first.actor)
    )
  })
})

describe('the spell-casting record an allowance spend carries (SPELLS-31.T5h-3)', () => {
  const consumption = {
    definitionId: testUuid(0xd10),
    definitionVersion: 1,
    definitionChecksum: 'a'.repeat(64),
    maximum: 1,
    beforeUsed: 0,
    afterUsed: 1
  }

  it('settles the record with the allowance and restores both on undo', () => {
    const { transition } = evaluateEncounterSpellCasting({
      actor: ACTOR,
      state: state(1),
      activation: BONUS_ACTION,
      cantrip: false
    })
    const spent = consumeEncounterActionEconomy({
      actor: ACTOR,
      consumption: { ...consumption, spellCasting: transition! },
      overridden: false
    })
    expect(encounterSpellCastingState(spent)?.bonusActionSpell).toBe(true)
    const restored = revertEncounterSpellCastingTransition(spent, transition!)
    expect(restored && encounterSpellCastingState(restored)).toBeNull()
  })

  it('refuses to undo once a later spell changed the record', () => {
    const { transition } = evaluateEncounterSpellCasting({
      actor: ACTOR,
      state: state(1),
      activation: BONUS_ACTION,
      cantrip: false
    })
    const spent = applyEncounterSpellCastingTransition(ACTOR, transition!)
    const later = evaluateEncounterSpellCasting({
      actor: spent,
      state: state(1),
      activation: ACTION,
      cantrip: false
    })
    expect(later.refusal).not.toBeNull()
    const changed = applyEncounterSpellCastingTransition(spent, {
      before: transition!.after,
      after: { ...transition!.after, actionSpell: true }
    })
    expect(revertEncounterSpellCastingTransition(changed, transition!)).toBeNull()
  })

  it('refuses to settle when the record changed since the cast was planned', () => {
    const { transition } = evaluateEncounterSpellCasting({
      actor: ACTOR,
      state: state(1),
      activation: BONUS_ACTION,
      cantrip: false
    })
    const spent = applyEncounterSpellCastingTransition(ACTOR, transition!)
    expect(() => applyEncounterSpellCastingTransition(spent, transition!)).toThrow(
      /spell-casting record changed/
    )
  })
})
