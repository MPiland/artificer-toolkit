import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import { buildCharacterCompanionMechanicsRuleFacts } from '../../../../character/characterCompanionMechanicsRuleFacts.js'
import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { dnd5e2014CharacterGrantFoldEmptyInput } from './characterGrantFoldSource.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const registry: CharacterAssemblyRegistry = {
  classes: {},
  equipment: {},
  feats: {},
  features: {},
  races: {},
  spells: {}
}

function snapshot(): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 1,
    classes: [],
    abilities: {},
    hitpoints: [],
    features: [],
    equipmentItems: [],
    companions: [
      {
        companionInstanceId: 'owl-1',
        creatureId: 'owl',
        abilityScores: { DEX: 16 },
        armorClass: 11,
        maxHitPoints: 1,
        size: 'TINY',
        alignmentId: 'unaligned',
        creatureTypeId: 'beast'
      },
      {
        companionInstanceId: 'owl-2',
        creatureId: 'owl',
        abilityScores: { DEX: 14 },
        armorClass: 12,
        maxHitPoints: 2
      },
      {
        companionInstanceId: 'construct-1',
        creatureId: 'construct',
        abilityScores: { STR: 10 },
        armorClass: 13,
        maxHitPoints: 8
      }
    ],
    adjustments: [
      {
        id: 'owl-1-ac',
        family: 'COMPANION',
        companionInstanceId: 'owl-1',
        field: 'ARMOR_CLASS_OVERRIDE',
        value: 15
      },
      {
        id: 'owl-1-ac-second',
        family: 'COMPANION',
        companionInstanceId: 'owl-1',
        field: 'ARMOR_CLASS_OVERRIDE',
        value: 99
      },
      {
        id: 'owl-1-hp',
        family: 'COMPANION',
        companionInstanceId: 'owl-1',
        field: 'MAXIMUM_HIT_POINTS_OVERRIDE',
        value: 4
      },
      {
        id: 'owl-1-size',
        family: 'COMPANION',
        companionInstanceId: 'owl-1',
        field: 'SIZE_OVERRIDE',
        value: 'SMALL'
      },
      {
        id: 'owl-1-alignment',
        family: 'COMPANION',
        companionInstanceId: 'owl-1',
        field: 'ALIGNMENT_OVERRIDE',
        value: 'neutral'
      },
      {
        id: 'owl-1-type',
        family: 'COMPANION',
        companionInstanceId: 'owl-1',
        field: 'CREATURE_TYPE_OVERRIDE',
        value: 'fey'
      },
      {
        id: 'construct-size',
        family: 'COMPANION',
        companionInstanceId: 'construct-1',
        field: 'SIZE_OVERRIDE',
        value: 'MEDIUM'
      },
      {
        id: 'construct-alignment',
        family: 'COMPANION',
        companionInstanceId: 'construct-1',
        field: 'ALIGNMENT_OVERRIDE',
        value: 'lawful'
      },
      {
        id: 'construct-type',
        family: 'COMPANION',
        companionInstanceId: 'construct-1',
        field: 'CREATURE_TYPE_OVERRIDE',
        value: 'construct'
      },
      {
        id: 'missing',
        family: 'COMPANION',
        companionInstanceId: 'missing',
        field: 'ARMOR_CLASS_OVERRIDE',
        value: 99
      }
    ]
  }
}

function input(character: CharacterBuildSnapshot) {
  return characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
    totalLevel: character.totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(character, registry),
    ...buildCharacterCompanionMechanicsRuleFacts(character),
    spellAccessCandidates: [],
    spellClasses: [],
    spellPreparationClasses: [],
    spellPreparationCatalog: [],
    spellPreparationRequest: null,
    spellCastCandidates: [],
    spellCastSlots: [],
    spellCastResources: [],
    spellcastingClasses: [],
    chargeCalculations: [],
    eligibilityFacets: [],
    rest: { totalHitDice: 0, currentExhaustion: 0, attunementSlotOverride: null }
  })
}

describe('D&D 5e 2014 Character companion mechanics policy', () => {
  it('preserves per-instance mechanics and applies only the first override', async () => {
    const character = snapshot()
    const actual = characterRulePolicyOutputSchema.parse(
      (
        await evaluateZenRuleModel({
          document: dnd5e2014CharacterPolicyDocument,
          modelKey: 'character-policy',
          context: input(character)
        })
      ).result
    ).companions

    expect(actual).toHaveLength(3)
    expect(actual.map((companion) => companion.companionInstanceId)).toEqual([
      'owl-1',
      'owl-2',
      'construct-1'
    ])
    expect(actual[2]).toMatchObject({
      size: 'MEDIUM',
      alignmentId: 'lawful',
      creatureTypeId: 'construct',
      calculations: {
        size: { base: 'MEDIUM', effective: 'MEDIUM' },
        alignmentId: { base: 'lawful', effective: 'lawful' },
        creatureTypeId: { base: 'construct', effective: 'construct' }
      }
    })
    expect(actual[0]?.calculations.armorClass).toMatchObject({
      effective: 15,
      override: {
        sourceId: 'owl-1-ac',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'owl-1-ac' }
      }
    })
    expect(actual[0]).toMatchObject({
      armorClass: 15,
      maxHitPoints: 4,
      size: 'SMALL',
      alignmentId: 'neutral',
      creatureTypeId: 'fey'
    })
    expect(actual[1]).toMatchObject({
      companionInstanceId: 'owl-2',
      armorClass: 12,
      maxHitPoints: 2
    })
  })
})
