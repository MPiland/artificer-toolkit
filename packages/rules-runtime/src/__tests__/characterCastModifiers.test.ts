import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { gmRulingEffect } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'
import { sorceryPointsCharge } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  aimsAtOneCreature,
  castModifierActivation,
  castModifierCostAtLevel,
  castModifierRange,
  castModifierTargetCap,
  sparedCreatureCap
} from '../character/characterCastModifiers.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { SRD, evaluateSrdCharacter, srdByLabel, srdFeature } from '../testing/dnd5eSrdCharacter.js'

const SORCERER = srdByLabel(SRD.classes, 'Sorcerer')
const METAMAGIC = srdByLabel(SORCERER.features ?? [], 'Metamagic')
const SUBTLE = srdByLabel(METAMAGIC.options ?? [], 'Subtle Spell')

const sorcerer = (optionLabels: readonly string[]) =>
  evaluateSrdCharacter({
    classes: [{ label: 'Sorcerer', level: 3 }],
    features: [
      srdFeature({
        owner: 'CLASS',
        classLabel: 'Sorcerer',
        featureLabel: 'Metamagic',
        level: 3,
        optionLabels
      })
    ]
  })

describe('the costs a Character may pay on casting a spell (SPELLS-31.T5g)', () => {
  it('projects the cast modifier of a Metamagic option the Character chose', () => {
    expect(sorcerer(['Subtle Spell']).castModifiers).toEqual([
      {
        modifierId: SUBTLE.effects?.[0]?.id,
        label: 'Subtle Spell',
        cost: { chargeId: sorceryPointsCharge.id, cost: 1 }
      }
    ])
  })

  it('projects Twinned Spell as one further target for the spell level in sorcery points', () => {
    const [twinned] = sorcerer(['Twinned Spell']).castModifiers
    expect(twinned?.cost).toEqual({
      chargeId: sorceryPointsCharge.id,
      cost: 1,
      perSpellLevel: true,
      targets: { outcome: 'EXTRA_TARGET', base: 1 }
    })
    expect(castModifierCostAtLevel(twinned!.cost, 3)).toBe(3)
    expect(castModifierCostAtLevel(twinned!.cost, 0)).toBe(1)
    expect(castModifierCostAtLevel({ chargeId: 'c', cost: 2 }, 5)).toBe(2)
  })

  it('projects none for an option the Character did not choose', () => {
    expect(sorcerer(['Quickened Spell']).castModifiers).toEqual([])
  })

  /** The authoring-parity proof: a Builder author writes the same option from core options alone. */
  it('projects the same cost from a homebrew feature authored with the core option', () => {
    const chargeId = testUuid(0xc01)
    const homebrew: FeatureAuthored = {
      id: testUuid(0xc02),
      label: 'Quiet Casting',
      description: 'Pay one use to cast without components.',
      availableAtLevel: 1,
      order: 1,
      effects: [
        gmRulingEffect({
          ids: {
            effect: testUuid(0xc03),
            range: testUuid(0xc04),
            path: testUuid(0xc05),
            result: testUuid(0xc06),
            outcome: testUuid(0xc07)
          },
          label: 'Quiet Casting',
          instructions: 'The spell is cast without components.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          castModifier: { chargeId, cost: 1 }
        })
      ]
    }
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:quiet-casting',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: srdByLabel(SRD.classes, 'Fighter').id, classLevel: 1 },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    expect(character.castModifiers).toEqual([
      { modifierId: testUuid(0xc03), label: 'Quiet Casting', cost: { chargeId, cost: 1 } }
    ])
  })
})

describe('the spells that can take a further target (SPELLS-31.T5g3)', () => {
  const range = (rangeKind: string) => ({ id: 'range', rangeKind })
  const invocation = (overrides: Record<string, unknown>) =>
    ({ range: range('DISTANCE'), ...overrides }) as Parameters<typeof aimsAtOneCreature>[0]

  it('accepts one creature at range, with or without an authored single target', () => {
    expect(aimsAtOneCreature(invocation({}))).toBe(true)
    expect(aimsAtOneCreature(invocation({ targeting: { selectionKind: 'SINGLE_TARGET' } }))).toBe(
      true
    )
  })

  it('refuses a list of creatures, an area, a Self range and Self targeting', () => {
    expect(
      aimsAtOneCreature(invocation({ targeting: { selectionKind: 'CHOSEN_CREATURES' } }))
    ).toBe(false)
    expect(aimsAtOneCreature(invocation({ shape: { shapeKind: 'SPHERE' } }))).toBe(false)
    expect(aimsAtOneCreature(invocation({ range: range('SELF') }))).toBe(false)
    expect(aimsAtOneCreature(invocation({ targeting: { selectionKind: 'SELF' } }))).toBe(false)
  })

  /** The authoring-parity proof: a Builder author writes the same option from core options alone. */
  it('projects the same further target from a homebrew feature authored with the core option', () => {
    const chargeId = testUuid(0xc31)
    const cost = {
      chargeId,
      cost: 1,
      perSpellLevel: true,
      targets: { outcome: 'EXTRA_TARGET' as const, base: 2 }
    }
    const homebrew: FeatureAuthored = {
      id: testUuid(0xc32),
      label: 'Echoing Cast',
      description: 'Pay per spell level to reach further creatures.',
      availableAtLevel: 1,
      order: 1,
      effects: [
        gmRulingEffect({
          ids: {
            effect: testUuid(0xc33),
            range: testUuid(0xc34),
            path: testUuid(0xc35),
            result: testUuid(0xc36),
            outcome: testUuid(0xc37)
          },
          label: 'Echoing Cast',
          instructions: 'The spell also targets the named creatures.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          castModifier: cost
        })
      ]
    }
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:echoing-cast',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: srdByLabel(SRD.classes, 'Fighter').id, classLevel: 1 },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    expect(character.castModifiers).toEqual([
      { modifierId: testUuid(0xc33), label: 'Echoing Cast', cost }
    ])
  })
})

describe('casting an action spell as a bonus action (SPELLS-31.T5h-3)', () => {
  const action = { code: 'ACTION', amount: 1 }
  const bonusAction = [{ parameter: 'ACTIVATION' as const, activation: 'BONUS_ACTION' as const }]

  it('projects Quickened Spell as 2 sorcery points that cast with a bonus action', () => {
    const [quickened] = sorcerer(['Quickened Spell']).castModifiers
    expect(quickened?.cost).toEqual({
      chargeId: sorceryPointsCharge.id,
      cost: 2,
      parameters: bonusAction
    })
  })

  it('changes the activation of a one-action cast only', () => {
    expect(castModifierActivation(bonusAction, action)).toEqual({
      code: 'BONUS_ACTION',
      amount: 1
    })
    expect(castModifierActivation(bonusAction, { code: 'BONUS_ACTION', amount: 1 })).toBeNull()
    expect(castModifierActivation(bonusAction, { code: 'ACTION', amount: 2 })).toBeNull()
    expect(castModifierActivation(bonusAction, { code: 'MINUTE', amount: 1 })).toBeNull()
    expect(castModifierActivation(bonusAction, null)).toBeNull()
    expect(castModifierActivation([], { code: 'MINUTE', amount: 1 })).toEqual({
      code: 'MINUTE',
      amount: 1
    })
  })

  it('leaves the range of a cast alone', () => {
    const range = { id: 'range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' } as const
    expect(castModifierRange(bonusAction, range)).toEqual(range)
  })

  /** The authoring-parity proof: a Builder author writes the same option from core options alone. */
  it('projects the same cost from a homebrew feature authored with the core option', () => {
    const chargeId = testUuid(0xc41)
    const cost = { chargeId, cost: 2, parameters: bonusAction }
    const homebrew: FeatureAuthored = {
      id: testUuid(0xc42),
      label: 'Hasty Casting',
      description: 'Pay two uses to cast an action spell as a bonus action.',
      availableAtLevel: 1,
      order: 1,
      effects: [
        gmRulingEffect({
          ids: {
            effect: testUuid(0xc43),
            range: testUuid(0xc44),
            path: testUuid(0xc45),
            result: testUuid(0xc46),
            outcome: testUuid(0xc47)
          },
          label: 'Hasty Casting',
          instructions: 'The spell is cast with a bonus action.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          castModifier: cost
        })
      ]
    }
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:hasty-casting',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: srdByLabel(SRD.classes, 'Fighter').id, classLevel: 1 },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    expect(character.castModifiers).toEqual([
      { modifierId: testUuid(0xc43), label: 'Hasty Casting', cost }
    ])
  })
})

describe('the creatures a Character may spare from an area spell (SPELLS-16)', () => {
  const evoker = evaluateSrdCharacter({
    classes: [{ label: 'Wizard', level: 2 }],
    features: [
      srdFeature({
        owner: 'SUBCLASS',
        classLabel: 'Wizard',
        subclassLabel: 'School of Evocation',
        featureLabel: 'Sculpt Spells',
        level: 2
      })
    ]
  })

  it("projects Sculpt Spells as 1 plus the spell's level, for evocation spells only", () => {
    expect(evoker.sparesCreatures).toEqual([
      { base: 1, plusSpellLevel: true, magicSchoolIds: [expect.any(String)] }
    ])
    const [evocationId] = evoker.sparesCreatures[0]?.magicSchoolIds ?? []
    expect(
      sparedCreatureCap(evoker.sparesCreatures, { level: 3, magicSchoolId: evocationId! })
    ).toBe(4)
    expect(
      sparedCreatureCap(evoker.sparesCreatures, { level: 0, magicSchoolId: evocationId! })
    ).toBe(1)
    expect(sparedCreatureCap(evoker.sparesCreatures, { level: 3, magicSchoolId: 'other' })).toBe(0)
  })

  /** The authoring-parity proof: a Builder author writes the same option from core options alone. */
  it('projects the same allowance from a homebrew feature authored with the core option', () => {
    const homebrew: FeatureAuthored = {
      id: testUuid(0xc11),
      label: 'Safe Pockets',
      description: 'Spare creatures from your area spells.',
      availableAtLevel: 1,
      order: 1,
      effects: [
        gmRulingEffect({
          ids: {
            effect: testUuid(0xc12),
            range: testUuid(0xc13),
            path: testUuid(0xc14),
            result: testUuid(0xc15),
            outcome: testUuid(0xc16)
          },
          label: 'Safe Pockets',
          instructions: 'The caster must see each creature spared.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          sparesCreatures: { base: 2 }
        })
      ]
    }
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:safe-pockets',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: srdByLabel(SRD.classes, 'Fighter').id, classLevel: 1 },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    expect(character.sparesCreatures).toEqual([{ base: 2 }])
    expect(sparedCreatureCap(character.sparesCreatures, { level: 5, magicSchoolId: 'any' })).toBe(2)
  })
})

describe('the creatures a paid cast modifier names (SPELLS-31.T5g2)', () => {
  it('projects Careful Spell as an auto-succeeded save for up to the Charisma modifier, at least one', () => {
    const [careful] = sorcerer(['Careful Spell']).castModifiers
    expect(careful?.cost).toEqual({
      chargeId: sorceryPointsCharge.id,
      cost: 1,
      targets: {
        outcome: 'SAVE_AUTO_SUCCESS',
        base: 0,
        abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CHARISMA,
        minimum: 1
      }
    })
  })

  it('projects Heightened Spell as disadvantage on one target for three sorcery points', () => {
    const [heightened] = sorcerer(['Heightened Spell']).castModifiers
    expect(heightened?.cost).toEqual({
      chargeId: sorceryPointsCharge.id,
      cost: 3,
      targets: { outcome: 'SAVE_DISADVANTAGE', base: 1, minimum: 1 }
    })
  })

  it('caps the creatures at the base plus the ability modifier, never below the minimum', () => {
    const careful = {
      outcome: 'SAVE_AUTO_SUCCESS' as const,
      base: 0,
      abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CHARISMA,
      minimum: 1
    }
    const modifier = (value: number) => (abilityId: string) =>
      abilityId === SRD_ABILITY_DEFINITION_IDS.CHARISMA ? value : 0
    expect(castModifierTargetCap(careful, modifier(4))).toBe(4)
    expect(castModifierTargetCap(careful, modifier(-1))).toBe(1)
    expect(castModifierTargetCap({ outcome: 'SAVE_DISADVANTAGE', base: 1 }, modifier(5))).toBe(1)
  })

  /** The authoring-parity proof: a Builder author writes the same options from core options alone. */
  it('projects the same targets from a homebrew feature authored with the core option', () => {
    const chargeId = testUuid(0xc21)
    const targets = {
      outcome: 'SAVE_AUTO_SUCCESS' as const,
      base: 2,
      abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CHARISMA
    }
    const homebrew: FeatureAuthored = {
      id: testUuid(0xc22),
      label: 'Gentle Casting',
      description: 'Pay one use to shield creatures from your spell.',
      availableAtLevel: 1,
      order: 1,
      effects: [
        gmRulingEffect({
          ids: {
            effect: testUuid(0xc23),
            range: testUuid(0xc24),
            path: testUuid(0xc25),
            result: testUuid(0xc26),
            outcome: testUuid(0xc27)
          },
          label: 'Gentle Casting',
          instructions: 'The named creatures pass their saves.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          castModifier: { chargeId, cost: 1, targets }
        })
      ]
    }
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:gentle-casting',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: srdByLabel(SRD.classes, 'Fighter').id, classLevel: 1 },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    expect(character.castModifiers).toEqual([
      {
        modifierId: testUuid(0xc23),
        label: 'Gentle Casting',
        cost: { chargeId, cost: 1, targets }
      }
    ])
    expect(castModifierTargetCap(targets, () => 3)).toBe(5)
  })
})

describe('the range a paid cast modifier gives a cast (SPELLS-31.T5h)', () => {
  const double = [
    {
      parameter: 'RANGE' as const,
      multiplier: 2,
      touchDistance: { amount: 30, unit: 'FEET' as const }
    }
  ]

  it('multiplies a distance, its long range too', () => {
    expect(
      castModifierRange(double, {
        id: 'r',
        rangeKind: 'DISTANCE',
        amount: 80,
        longAmount: 320,
        unit: 'FEET'
      })
    ).toEqual({ id: 'r', rangeKind: 'DISTANCE', amount: 160, longAmount: 640, unit: 'FEET' })
  })

  it('turns Touch into the authored distance', () => {
    expect(castModifierRange(double, { id: 'r', rangeKind: 'TOUCH' })).toEqual({
      id: 'r',
      rangeKind: 'DISTANCE',
      amount: 30,
      unit: 'FEET'
    })
  })

  it.each(['SELF', 'SIGHT', 'SPECIAL', 'UNLIMITED'] as const)(
    'does not fit a %s range',
    (rangeKind) => {
      expect(castModifierRange(double, { id: 'r', rangeKind })).toBeNull()
    }
  )
})
