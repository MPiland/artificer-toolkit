import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import { buildCharacterDefenseRuleFacts } from '../../../../character/characterDefenseRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from '../../../../character/characterGrantFoldRuleFacts.js'
import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

function defenseModifier(
  id: string,
  valueDomainCode: 'DAMAGE_RESISTANCE' | 'DAMAGE_IMMUNITY' | 'DAMAGE_VULNERABILITY',
  modifierKind: 'ADD_OPTION' | 'REMOVE_OPTION',
  damageTypeId?: string
) {
  return {
    id,
    grantKind: 'MODIFIER_GRANT',
    order: 1,
    selectionKind: 'GRANTED',
    valueDomainCode,
    domain: {},
    modifierKind,
    scope: 'GLOBAL',
    payload: damageTypeId === undefined ? {} : { damageTypeId }
  }
}

function character(
  modifiers: ReturnType<typeof defenseModifier>[],
  adjustments: CharacterBuildSnapshot['adjustments'] = []
): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 1,
    classes: [],
    abilities: { DEXTERITY: 10 },
    hitpoints: [],
    features: [
      {
        featureId: 'defense-feature',
        source: { kind: 'FEATURE', featureId: 'defense-feature' },
        timing: { kind: 'IMMEDIATE' }
      }
    ],
    equipmentItems: [],
    adjustments
  }
}

function registry(modifiers: ReturnType<typeof defenseModifier>[]): CharacterAssemblyRegistry {
  return {
    classes: {},
    equipment: {},
    feats: {},
    races: {},
    spells: {},
    features: { 'defense-feature': { id: 'defense-feature', modifiers } }
  } as unknown as CharacterAssemblyRegistry
}

async function evaluate(snapshot: CharacterBuildSnapshot, records: CharacterAssemblyRegistry) {
  const input = characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: compileCharacterGrantFoldRuleFacts({
      snapshot,
      registry: records
    }),
    totalLevel: snapshot.totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(snapshot, records),
    ...buildCharacterDefenseRuleFacts(snapshot),
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
  const result = await evaluateZenRuleModel({
    document: dnd5e2014CharacterPolicyDocument,
    modelKey: 'character-policy',
    context: input
  })
  return characterRulePolicyOutputSchema.parse(result.result).defenses
}

describe('D&D 5e 2014 Character defense policy', () => {
  it('preserves authored ordering, removal, and manual replacement', async () => {
    const modifiers = [
      defenseModifier('add-fire-a', 'DAMAGE_RESISTANCE', 'ADD_OPTION', 'fire'),
      defenseModifier('add-fire-b', 'DAMAGE_RESISTANCE', 'ADD_OPTION', 'fire'),
      defenseModifier('remove-cold', 'DAMAGE_RESISTANCE', 'REMOVE_OPTION', 'cold'),
      defenseModifier('add-cold', 'DAMAGE_RESISTANCE', 'ADD_OPTION', 'cold'),
      defenseModifier('add-acid', 'DAMAGE_RESISTANCE', 'ADD_OPTION', 'acid'),
      defenseModifier('remove-acid', 'DAMAGE_RESISTANCE', 'REMOVE_OPTION', 'acid'),
      defenseModifier('add-fire-immunity', 'DAMAGE_IMMUNITY', 'ADD_OPTION', 'fire'),
      defenseModifier('malformed', 'DAMAGE_VULNERABILITY', 'ADD_OPTION'),
      defenseModifier('empty-damage-type', 'DAMAGE_VULNERABILITY', 'ADD_OPTION', '')
    ]
    const snapshot = character(modifiers, [
      {
        id: 'manual-fire',
        family: 'DEFENSE',
        defenseKind: 'RESISTANCE',
        damageTypeId: 'fire',
        field: 'ADDITION',
        value: true
      },
      {
        id: 'manual-lightning',
        family: 'DEFENSE',
        defenseKind: 'VULNERABILITY',
        damageTypeId: 'lightning',
        field: 'ADDITION',
        value: true
      }
    ])
    const records = registry(modifiers)

    await expect(evaluate(snapshot, records)).resolves.toEqual([
      {
        kind: 'RESISTANCE',
        damageTypeId: 'fire',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-fire' }
      },
      expect.objectContaining({ kind: 'RESISTANCE', damageTypeId: 'cold' }),
      expect.objectContaining({ kind: 'IMMUNITY', damageTypeId: 'fire' }),
      {
        kind: 'VULNERABILITY',
        damageTypeId: 'lightning',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-lightning' }
      }
    ])
  })

  it('ignores whitespace-only authored damage types before the typed output boundary', async () => {
    const modifiers = [
      defenseModifier('whitespace-damage-type', 'DAMAGE_VULNERABILITY', 'ADD_OPTION', '   ')
    ]
    const snapshot = character(modifiers)

    await expect(evaluate(snapshot, registry(modifiers))).resolves.toEqual([])
  })
})
