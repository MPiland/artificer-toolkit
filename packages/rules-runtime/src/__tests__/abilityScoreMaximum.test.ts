import { describe, expect, it } from 'vitest'
import type { EquipmentAuthored, FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import {
  equipId,
  magicArmorModifiers
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { signetRing } from '@artificer-toolkit/source-data/srd/equipment/signet-ring.js'

import { SRD, evaluateSrdCharacter, srdByLabel, srdFeature } from '../testing/dnd5eSrdCharacter.js'

/**
 * SPELLS-31.T5q-A: the ability score maximum is a generic modifier domain. The System default is 20;
 * Primal Champion and any authored feature raise it with the same SET_VALUE grant.
 */

/** The effective score and modifier of one ability, as the policy derives them for the Sheet. */
function abilityOf(code: string, input: Parameters<typeof evaluateSrdCharacter>[0]) {
  const entry = evaluateSrdCharacter(input).output.derivedStats.abilities.find(
    (ability) => ability.abilityId === code
  )
  if (!entry) throw new Error(`The policy derives ${code}.`)
  return { score: entry.score.effective, modifier: entry.modifier.effective }
}

const improvement = (label: string) =>
  srdFeature({
    owner: 'CLASS',
    classLabel: 'Fighter',
    featureLabel: 'Ability Score Improvement',
    level: 4,
    optionLabels: [label]
  })

const primalChampion = srdFeature({
  owner: 'CLASS',
  classLabel: 'Barbarian',
  featureLabel: 'Primal Champion',
  level: 20
})

/** A worn item whose authored modifier sets an ability score, as a belt does. */
const strengthBelt: EquipmentAuthored = {
  ...signetRing,
  id: equipId(930),
  label: 'Test Strength Belt',
  modifiers: magicArmorModifiers(equipId(930), 0).map((modifier) => ({
    ...modifier,
    valueDomainCode: 'ABILITY_SCORE' as const,
    modifierKind: 'SET_VALUE' as const,
    domain: { ability: 'STRENGTH' },
    payload: { amount: 21 }
  }))
}

/** An authored Feature raising every ability's maximum, using no ability so it covers them all. */
const everyAbilityTo22: FeatureAuthored = {
  id: '7e57a000-0000-4000-8000-0000000005e1',
  label: 'Test Ceiling',
  description: 'Raises every ability score maximum to 22.',
  availableAtLevel: 1,
  order: 0,
  grants: {
    modifiers: [
      {
        id: '7e57a000-0000-4000-8000-0000000005e2',
        grantKind: 'MODIFIER_GRANT',
        valueDomainCode: 'ABILITY_SCORE_MAXIMUM',
        domain: {},
        modifierKind: 'SET_VALUE',
        scope: 'GLOBAL',
        selectionKind: 'GRANTED',
        payload: { amount: 22 },
        order: 0
      }
    ]
  }
}

describe('the default ability score maximum', () => {
  it('stops an Ability Score Improvement at 20', () => {
    expect(
      abilityOf('STRENGTH', {
        abilities: { STRENGTH: 19 },
        classes: [{ label: 'Fighter', level: 4 }],
        features: [improvement('Strength +2')]
      })
    ).toEqual({ score: 20, modifier: 5 })
  })

  it('leaves a score below the maximum as increased', () => {
    expect(
      abilityOf('STRENGTH', {
        abilities: { STRENGTH: 15 },
        classes: [{ label: 'Fighter', level: 4 }],
        features: [improvement('Strength +2')]
      }).score
    ).toBe(17)
  })

  it('lets a SET_VALUE score such as a belt exceed it', () => {
    expect(
      abilityOf('STRENGTH', {
        abilities: { STRENGTH: 10 },
        classes: [{ label: 'Fighter', level: 4 }],
        items: [{ label: strengthBelt.label, equipped: true }],
        extraEquipment: [strengthBelt]
      })
    ).toEqual({ score: 21, modifier: 5 })
  })
})

describe('Primal Champion is authorable from core options', () => {
  const championFeature = barbarian.features?.find((entry) => entry.label === 'Primal Champion')

  it('authors the ceiling with the generic modifier and no closed rule', () => {
    expect(JSON.stringify(championFeature?.effects ?? [])).not.toContain('CLOSED_RULE')
    expect(
      championFeature?.grants?.modifiers?.filter(
        (grant) => grant.valueDomainCode === 'ABILITY_SCORE_MAXIMUM'
      )
    ).toMatchObject([
      { modifierKind: 'SET_VALUE', domain: { ability: 'STRENGTH' }, payload: { amount: 24 } },
      { modifierKind: 'SET_VALUE', domain: { ability: 'CONSTITUTION' }, payload: { amount: 24 } }
    ])
  })

  it('takes Strength and Constitution from 20 to 24, and no other ability past 20', () => {
    const input = {
      abilities: { STRENGTH: 20, CONSTITUTION: 20, DEXTERITY: 20 },
      classes: [{ label: 'Barbarian', level: 20 }],
      features: [primalChampion]
    }
    expect(abilityOf('STRENGTH', input)).toEqual({ score: 24, modifier: 7 })
    expect(abilityOf('CONSTITUTION', input)).toEqual({ score: 24, modifier: 7 })
    expect(abilityOf('DEXTERITY', input)).toEqual({ score: 20, modifier: 5 })
  })

  it('caps an increase that would pass the raised ceiling', () => {
    expect(
      abilityOf('STRENGTH', {
        abilities: { STRENGTH: 22 },
        classes: [{ label: 'Barbarian', level: 20 }],
        features: [primalChampion]
      }).score
    ).toBe(24)
  })

  it('raises the ceiling for a Feature authored with the same domain and kind', () => {
    expect(
      abilityOf('WISDOM', {
        abilities: { WISDOM: 21 },
        classes: [{ label: 'Fighter', level: 1 }],
        features: [
          {
            acquisitionId: `acquired:${everyAbilityTo22.id}`,
            featureId: everyAbilityTo22.id,
            source: {
              kind: 'CLASS',
              classId: srdByLabel(SRD.classes, 'Fighter').id,
              classLevel: 1
            },
            timing: { kind: 'IMMEDIATE' }
          }
        ],
        extraFeatures: [everyAbilityTo22]
      }).score
    ).toBe(21)
  })
})
