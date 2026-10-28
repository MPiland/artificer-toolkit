import { describe, expect, it } from 'vitest'

import { dnd5eCharacterActionTarget } from '../systems/dnd5e/modifierApplicability.js'
import { dnd5eAttackCriticalRules } from '../systems/dnd5e/characterCriticalRules.js'
import { evaluateSrdCharacter, itemAction, srdFeature } from '../testing/dnd5eSrdCharacter.js'

type AttackKind = 'MELEE' | 'RANGED'

/** The critical rules a Character's accepted grants give its Longsword or Shortbow attack. */
function criticalRules(
  input: Parameters<typeof evaluateSrdCharacter>[0],
  item: string,
  attackKind: AttackKind
) {
  const character = evaluateSrdCharacter({ ...input, items: [{ label: item, equipped: true }] })
  const { candidate } = itemAction(character, item, {
    attackKind,
    ...(item === 'Longsword' ? { grip: 'ONE_HANDED' as const } : {})
  })
  return dnd5eAttackCriticalRules(
    character.output,
    attackKind,
    dnd5eCharacterActionTarget(candidate)
  )
}

/** A Champion who has taken every subclass feature up to `level`. */
const champion = (level: number) => ({
  abilities: { STRENGTH: 16, DEXTERITY: 16 },
  classes: [{ label: 'Fighter', level, subclass: 'Champion' }],
  features: [
    srdFeature({
      owner: 'SUBCLASS',
      classLabel: 'Fighter',
      subclassLabel: 'Champion',
      featureLabel: 'Improved Critical',
      level: 3
    }),
    ...(level >= 15
      ? [
          srdFeature({
            owner: 'SUBCLASS',
            classLabel: 'Fighter',
            subclassLabel: 'Champion',
            featureLabel: 'Superior Critical',
            level: 15
          })
        ]
      : [])
  ]
})

const brutalCritical = () =>
  srdFeature({ owner: 'CLASS', classLabel: 'Barbarian', featureLabel: 'Brutal Critical', level: 9 })

describe('Character critical rules from authored grants (D158)', () => {
  it('has the default threshold and no extra dice without a source', () => {
    expect(
      criticalRules({ classes: [{ label: 'Fighter', level: 3 }] }, 'Longsword', 'MELEE')
    ).toEqual({ threshold: 20, extraDice: 0 })
  })

  it('gives a Champion a threshold of 19 from level 3, for melee and ranged weapons', () => {
    expect(criticalRules(champion(3), 'Longsword', 'MELEE').threshold).toBe(19)
    expect(criticalRules(champion(3), 'Shortbow', 'RANGED').threshold).toBe(19)
  })

  it('lowers a Champion to 18 at level 15, the lowest source winning over Improved Critical', () => {
    expect(criticalRules(champion(15), 'Longsword', 'MELEE').threshold).toBe(18)
  })

  it.each([
    { level: 8, extraDice: 0 },
    { level: 9, extraDice: 1 },
    { level: 13, extraDice: 2 },
    { level: 17, extraDice: 3 }
  ])('gives a level $level Barbarian $extraDice extra melee dice', ({ level, extraDice }) => {
    const barbarian = {
      abilities: { STRENGTH: 16 },
      classes: [{ label: 'Barbarian', level }],
      features: level >= 9 ? [brutalCritical()] : []
    }
    expect(criticalRules(barbarian, 'Greataxe', 'MELEE').extraDice).toBe(extraDice)
  })

  it('gives a Barbarian no extra dice on a ranged attack', () => {
    const barbarian = {
      abilities: { DEXTERITY: 16 },
      classes: [{ label: 'Barbarian', level: 17 }],
      features: [brutalCritical()]
    }
    expect(criticalRules(barbarian, 'Shortbow', 'RANGED').extraDice).toBe(0)
  })

  it('gives a Half-Orc one extra melee die from Savage Attacks and none at range (SPELLS-32.T5)', () => {
    const halfOrc = {
      abilities: { STRENGTH: 16, DEXTERITY: 16 },
      race: 'Half-Orc',
      classes: [{ label: 'Fighter', level: 1 }]
    }
    expect(criticalRules(halfOrc, 'Greataxe', 'MELEE').extraDice).toBe(1)
    expect(criticalRules(halfOrc, 'Shortbow', 'RANGED').extraDice).toBe(0)
  })

  it('adds Savage Attacks to Brutal Critical for a Half-Orc Barbarian', () => {
    const halfOrcBarbarian = {
      abilities: { STRENGTH: 16 },
      race: 'Half-Orc',
      classes: [{ label: 'Barbarian', level: 9 }],
      features: [brutalCritical()]
    }
    expect(criticalRules(halfOrcBarbarian, 'Greataxe', 'MELEE').extraDice).toBe(2)
  })
})
