import type { CharacterGrantFoldModifier } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  SRD_DARKVISION_SENSE_ID,
  SRD_SPEEDS
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { withActiveGrantSpeeds, withCharacterActiveGrants } from '../encounterActiveGrants.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { darkvisionEffect, longstriderEffect } from './antitoxinEffectFixture.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'

const HOLDER_ID = '00000000-0000-4000-8000-00000000c301'
const EFFECT_ID = '00000000-0000-4000-8000-00000000c302'
const OTHER_EFFECT_ID = '00000000-0000-4000-8000-00000000c303'
const speedId = (code: string) => {
  const id = SRD_SPEEDS.find((speed) => speed.code === code)?.id
  if (!id) throw new Error(`No SRD ${code} speed.`)
  return id
}
const WALK = speedId('WALK')
const FLY = speedId('FLY')

type LengthPayload = NonNullable<CharacterGrantFoldModifier['payload']>
type LengthModifier = {
  valueDomainCode: 'SPEED' | 'SENSE_RANGE'
  modifierKind: 'BONUS' | 'PENALTY' | 'SET_VALUE'
  domain: CharacterGrantFoldModifier['domain']
  payload: LengthPayload
}
const speedModifier = (
  modifierKind: LengthModifier['modifierKind'],
  payload: LengthPayload,
  id = WALK
): LengthModifier => ({ valueDomainCode: 'SPEED', modifierKind, domain: { speedId: id }, payload })
const senseBonus = (payload: LengthPayload): LengthModifier => ({
  valueDomainCode: 'SENSE_RANGE',
  modifierKind: 'BONUS',
  domain: { senseDefinitionId: SRD_DARKVISION_SENSE_ID },
  payload
})

/** The real compiler's Longstrider plan with its modifiers replaced by the given authored ones. */
function lengthEffect(
  modifiers: readonly LengthModifier[],
  id = EFFECT_ID
): ActiveRuleEffectRecord {
  const effect = longstriderEffect({ id, holderActorId: HOLDER_ID })
  const { definition } = effect
  const [contribution] = definition.stateContributions
  const template = contribution?.kind === 'MODIFIER_GRANT' ? contribution.modifiers[0] : undefined
  if (contribution?.kind !== 'MODIFIER_GRANT' || !template)
    throw new Error('Longstrider plans no modifier to template from.')
  return {
    ...effect,
    definition: {
      ...definition,
      stateContributions: [
        {
          ...contribution,
          modifiers: modifiers.map((modifier) => ({ ...template, ...modifier }))
        }
      ]
    }
  }
}

/** The effect with every sense it grants given the distance. */
function withSenseRange(
  effect: ActiveRuleEffectRecord,
  distance: { amount: number; unit: 'FEET' | 'YARDS' }
): ActiveRuleEffectRecord {
  const { definition } = effect
  return {
    ...effect,
    definition: {
      ...definition,
      stateContributions: definition.stateContributions.map((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? {
              ...contribution,
              senses: contribution.senses.map((sense) => ({
                ...sense,
                range: { ...sense.range, rangeKind: 'DISTANCE' as const, ...distance }
              }))
            }
          : contribution
      ) as typeof definition.stateContributions
    }
  }
}

describe('a Creature holder reads authored speed grants as lengths', () => {
  it('adds a feet bonus to a speed held in another unit', () => {
    expect(
      withActiveGrantSpeeds(
        [{ speedId: WALK, amount: 18, unit: 'YARDS' }],
        [lengthEffect([speedModifier('BONUS', { amount: 30, unit: 'FEET' })])]
      )
    ).toEqual([{ speedId: WALK, amount: 28, unit: 'YARDS' }])
  })

  it('subtracts a feet penalty from a speed held in another unit', () => {
    expect(
      withActiveGrantSpeeds(
        [{ speedId: WALK, amount: 18, unit: 'YARDS' }],
        [lengthEffect([speedModifier('PENALTY', { amount: 15, unit: 'FEET' })])]
      )
    ).toEqual([{ speedId: WALK, amount: 13, unit: 'YARDS' }])
  })

  it('replaces a speed with a set value authored in another unit, in the speed own unit', () => {
    expect(
      withActiveGrantSpeeds(
        [{ speedId: WALK, amount: 30, unit: 'FEET' }],
        [lengthEffect([speedModifier('SET_VALUE', { amount: 20, unit: 'YARDS' })])]
      )
    ).toEqual([{ speedId: WALK, amount: 60, unit: 'FEET' }])
  })

  it('gives a speed the holder lacked the unit and amount of the modifier that set it', () => {
    expect(
      withActiveGrantSpeeds(
        [],
        [lengthEffect([speedModifier('SET_VALUE', { amount: 40, unit: 'YARDS' }, FLY)])]
      )
    ).toEqual([{ speedId: FLY, amount: 40, unit: 'YARDS' }])
    expect(
      withActiveGrantSpeeds(
        [],
        [
          lengthEffect([
            speedModifier('SET_VALUE', { amount: 40, unit: 'YARDS' }, FLY),
            speedModifier('BONUS', { amount: 15, unit: 'FEET' }, FLY)
          ])
        ]
      )
    ).toEqual([{ speedId: FLY, amount: 45, unit: 'YARDS' }])
  })

  it('never lets a penalty take a speed below zero', () => {
    expect(
      withActiveGrantSpeeds(
        [{ speedId: WALK, amount: 5, unit: 'YARDS' }],
        [lengthEffect([speedModifier('PENALTY', { amount: 30, unit: 'FEET' })])]
      )
    ).toEqual([{ speedId: WALK, amount: 0, unit: 'YARDS' }])
  })

  it('fails the read on a speed grant that is not a length', () => {
    const speeds = [{ speedId: WALK, amount: 30, unit: 'FEET' }]
    expect(() =>
      withActiveGrantSpeeds(speeds, [
        lengthEffect([speedModifier('BONUS', { valueKind: 'FIXED', amount: 10 })])
      ])
    ).toThrow(/unit/)
    expect(() =>
      withActiveGrantSpeeds(speeds, [
        // A payload the contract rejects: the read still fails closed if one reaches it.
        // @ts-expect-error FURLONGS is not a length unit.
        lengthEffect([speedModifier('SET_VALUE', { amount: 60, unit: 'FURLONGS' })])
      ])
    ).toThrow(/unit/)
  })

  it('fails the read on a malformed base speed', () => {
    expect(() =>
      withActiveGrantSpeeds([{ speedId: WALK, amount: 'fast', unit: 'FEET' }], [])
    ).toThrow(/amount/)
    expect(() =>
      withActiveGrantSpeeds([{ speedId: WALK, amount: 30, unit: 'FURLONGS' }], [])
    ).toThrow(/unit/)
  })
})

describe('a Character holder reads authored speed and sense grants as lengths', () => {
  const fighter = evaluateSrdCharacter({
    race: 'Human',
    abilities: { CONSTITUTION: 14 },
    classes: [{ label: 'Fighter', level: 1 }]
  })
  const policyWith = (effects: ActiveRuleEffectRecord[]) =>
    evaluateDnd5e2014CharacterPolicy(withCharacterActiveGrants(fighter.facts, effects))
  const walk = (effects: ActiveRuleEffectRecord[]) =>
    policyWith(effects).movement.speeds.find((speed) => speed.speedId === WALK)
  const baseWalk = walk([])?.amount ?? 0

  it('adds a bonus authored in another unit through the shared conversion', () => {
    expect(
      walk([lengthEffect([speedModifier('BONUS', { amount: 5, unit: 'YARDS' })])])
    ).toMatchObject({
      amount: baseWalk + 15,
      unit: 'FEET'
    })
  })

  it('subtracts a penalty authored in another unit through the shared conversion', () => {
    expect(
      walk([lengthEffect([speedModifier('PENALTY', { amount: 5, unit: 'YARDS' })])])
    ).toMatchObject({
      amount: baseWalk - 15,
      unit: 'FEET'
    })
  })

  it('replaces the speed with a set value authored in another unit, in the speed own unit', () => {
    expect(
      walk([lengthEffect([speedModifier('SET_VALUE', { amount: 20, unit: 'YARDS' })])])
    ).toMatchObject({
      amount: 60,
      unit: 'FEET'
    })
  })

  it('gives a speed it lacked the unit and amount of the modifier that set it', () => {
    const flySpeed = policyWith([
      lengthEffect([speedModifier('SET_VALUE', { amount: 40, unit: 'YARDS' }, FLY)])
    ]).movement.speeds.find((speed) => speed.speedId === FLY)
    expect(flySpeed).toMatchObject({ amount: 40, unit: 'YARDS' })
  })

  it('never lets a penalty take a speed below zero', () => {
    expect(
      walk([lengthEffect([speedModifier('PENALTY', { amount: baseWalk + 10, unit: 'FEET' })])])
    ).toMatchObject({ amount: 0, unit: 'FEET' })
  })

  it('fails the policy on a speed grant that is not a length', () => {
    expect(() =>
      policyWith([lengthEffect([speedModifier('BONUS', { valueKind: 'FIXED', amount: 10 })])])
    ).toThrow(/unit/)
  })

  const darkvisionRanges = (darkvision: ActiveRuleEffectRecord, bonus: LengthPayload) =>
    policyWith([darkvision, lengthEffect([senseBonus(bonus)], OTHER_EFFECT_ID)])
      .senses.filter((sense) => sense.senseDefinitionId === SRD_DARKVISION_SENSE_ID)
      .map((sense) => sense.range)

  it('adds a sense range bonus authored in another unit to the granted range', () => {
    expect(
      darkvisionRanges(darkvisionEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID }), {
        amount: 10,
        unit: 'YARDS'
      })
    ).toMatchObject([{ amount: 90, unit: 'FEET' }])
  })

  it('adds a feet bonus to a sense granted in another unit, in the granted unit', () => {
    expect(
      darkvisionRanges(
        withSenseRange(darkvisionEffect({ id: EFFECT_ID, holderActorId: HOLDER_ID }), {
          amount: 18,
          unit: 'YARDS'
        }),
        { amount: 30, unit: 'FEET' }
      )
    ).toMatchObject([{ amount: 28, unit: 'YARDS' }])
  })
})
