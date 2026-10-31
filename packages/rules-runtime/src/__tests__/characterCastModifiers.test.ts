import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { gmRulingEffect } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'
import { sorceryPointsCharge } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { castModifierTargetCap, sparedCreatureCap } from '../character/characterCastModifiers.js'
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
