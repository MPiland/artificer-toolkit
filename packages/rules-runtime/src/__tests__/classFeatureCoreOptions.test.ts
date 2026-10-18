import { describe, expect, it } from 'vitest'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCharacterChargeRuleFact } from '../character/characterChargeRuleFacts.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { SRD, evaluateSrdCharacter, srdByLabel, srdFeature } from '../testing/dnd5eSrdCharacter.js'

/**
 * SPELLS-31.T3b (D156): Divine Sense, Empty Body and Gaze of Two Minds resolve from the core
 * options a Builder author has on a class feature, with no closed rule.
 */

const condition = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id

function featureAction(input: {
  classLabel: string
  level: number
  featureLabel: string
  actionLabel: string
  optionLabels?: string[]
  abilities?: { CHARISMA: number }
}) {
  const character = evaluateSrdCharacter({
    ...(input.abilities ? { abilities: input.abilities } : {}),
    classes: [{ label: input.classLabel, level: input.level }],
    features: [
      srdFeature({
        owner: 'CLASS',
        classLabel: input.classLabel,
        featureLabel: input.featureLabel,
        level: input.level,
        ...(input.optionLabels ? { optionLabels: input.optionLabels } : {})
      })
    ]
  })
  const candidates = character.facts.actionCandidates.filter(
    ({ label }) => label === input.actionLabel
  )
  expect(candidates).toHaveLength(1)
  return { character, candidate: candidates[0]! }
}

describe('Paladin Divine Sense (SPELLS-31.T3b)', () => {
  it('has 1 + Charisma modifier uses per long rest', () => {
    const divineSense = srdByLabel(SRD.classes, 'Paladin').features?.find(
      ({ label }) => label === 'Divine Sense'
    )
    if (!divineSense?.charges) throw new Error('Divine Sense must author its charges.')
    expect(divineSense.charges.resetKind).toBe('LONG_REST')
    const maximum = (charisma: number) => {
      const { facts } = evaluateSrdCharacter({
        abilities: { CHARISMA: charisma },
        classes: [{ label: 'Paladin', level: 1 }]
      })
      const output = evaluateDnd5e2014CharacterPolicy({
        ...facts,
        chargeCalculations: [buildCharacterChargeRuleFact(divineSense.charges!, 'divine-sense')]
      })
      return output.chargeMaximums.find(({ calculationId }) => calculationId === 'divine-sense')
        ?.maximum
    }
    expect(maximum(16)).toBe(4)
    expect(maximum(10)).toBe(1)
  })

  it('spends one use as an action and leaves the detection to the table', () => {
    const { candidate } = featureAction({
      classLabel: 'Paladin',
      level: 1,
      featureLabel: 'Divine Sense',
      actionLabel: 'Divine Sense',
      abilities: { CHARISMA: 16 }
    })
    expect(candidate.resourceUse).toEqual(expect.objectContaining({ cost: 1 }))
    expect(candidate.mechanicFacts.invocation.activation?.code).toBe('ACTION')
    expect(candidate.mechanicFacts.outcomes).toEqual([
      expect.objectContaining({ kind: 'EFFECT', effectKind: 'MANUAL_ADJUDICATION' })
    ])
  })
})

describe('Monk Empty Body (SPELLS-31.T3b)', () => {
  it('spends 4 ki to become invisible and resistant to all but force damage for 1 minute', () => {
    const { candidate } = featureAction({
      classLabel: 'Monk',
      level: 18,
      featureLabel: 'Empty Body',
      actionLabel: 'Empty Body'
    })
    expect(candidate.resourceUse).toEqual(expect.objectContaining({ cost: 4 }))
    expect(candidate.mechanicFacts.outcomes).toEqual([
      expect.objectContaining({ kind: 'CONDITION', conditionId: condition('INVISIBLE') }),
      expect.objectContaining({ kind: 'EFFECT', effectKind: 'APPLY_GRANT' })
    ])
  })
})

describe('Warlock Gaze of Two Minds (SPELLS-31.T3b)', () => {
  it('leaves the warlock blinded and deafened until the end of their next turn', () => {
    const { candidate } = featureAction({
      classLabel: 'Warlock',
      level: 15,
      featureLabel: 'Eldritch Invocations',
      actionLabel: 'Gaze of Two Minds',
      optionLabels: ['Gaze of Two Minds']
    })
    expect(candidate.mechanicFacts.invocation.activation?.code).toBe('ACTION')
    expect(candidate.mechanicFacts.outcomes).toEqual([
      expect.objectContaining({ kind: 'CONDITION', conditionId: condition('BLINDED') }),
      expect.objectContaining({ kind: 'CONDITION', conditionId: condition('DEAFENED') })
    ])
  })
})
