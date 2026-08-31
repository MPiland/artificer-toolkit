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

const damageTypeIds = {
  acid: '00000000-0000-4000-8000-000000000101',
  cold: '00000000-0000-4000-8000-000000000102',
  fire: '00000000-0000-4000-8000-000000000103',
  lightning: '00000000-0000-4000-8000-000000000104'
}

function defenseModifier(
  id: string,
  valueDomainCode:
    | 'DAMAGE_RESISTANCE'
    | 'DAMAGE_IMMUNITY'
    | 'DAMAGE_VULNERABILITY'
    | 'CONDITION_IMMUNITY',
  modifierKind: 'ADD_OPTION' | 'REMOVE_OPTION',
  identity?: string
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
    payload:
      identity === undefined
        ? {}
        : valueDomainCode === 'CONDITION_IMMUNITY'
          ? { conditionTypeId: identity }
          : { damageTypeId: identity }
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
  return characterRulePolicyOutputSchema.parse(result.result)
}

describe('D&D 5e 2014 Character defense policy', () => {
  it('deduplicates and canonically orders UUID-backed defenses after removal and manual replacement', async () => {
    const modifiers = [
      defenseModifier('add-fire-a', 'DAMAGE_RESISTANCE', 'ADD_OPTION', damageTypeIds.fire),
      defenseModifier('add-fire-b', 'DAMAGE_RESISTANCE', 'ADD_OPTION', damageTypeIds.fire),
      defenseModifier('remove-cold', 'DAMAGE_RESISTANCE', 'REMOVE_OPTION', damageTypeIds.cold),
      defenseModifier('add-cold', 'DAMAGE_RESISTANCE', 'ADD_OPTION', damageTypeIds.cold),
      defenseModifier('add-acid', 'DAMAGE_RESISTANCE', 'ADD_OPTION', damageTypeIds.acid),
      defenseModifier('remove-acid', 'DAMAGE_RESISTANCE', 'REMOVE_OPTION', damageTypeIds.acid),
      defenseModifier('add-fire-immunity', 'DAMAGE_IMMUNITY', 'ADD_OPTION', damageTypeIds.fire),
      defenseModifier('malformed', 'DAMAGE_VULNERABILITY', 'ADD_OPTION'),
      defenseModifier('empty-damage-type', 'DAMAGE_VULNERABILITY', 'ADD_OPTION', '')
    ]
    const snapshot = character(modifiers, [
      {
        id: 'manual-fire',
        family: 'DEFENSE',
        defenseKind: 'RESISTANCE',
        damageTypeId: damageTypeIds.fire,
        field: 'ADDITION',
        value: true
      },
      {
        id: 'manual-lightning',
        family: 'DEFENSE',
        defenseKind: 'VULNERABILITY',
        damageTypeId: damageTypeIds.lightning,
        field: 'ADDITION',
        value: true
      }
    ])
    const records = registry(modifiers)

    await expect(evaluate(snapshot, records)).resolves.toMatchObject({
      defenses: [
        expect.objectContaining({ kind: 'RESISTANCE', damageTypeId: damageTypeIds.cold }),
        expect.objectContaining({ kind: 'IMMUNITY', damageTypeId: damageTypeIds.fire }),
        {
          kind: 'RESISTANCE',
          damageTypeId: damageTypeIds.fire,
          source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-fire' }
        },
        {
          kind: 'VULNERABILITY',
          damageTypeId: damageTypeIds.lightning,
          source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-lightning' }
        }
      ]
    })
  })

  it('rejects non-UUID authored damage identities at the automatic policy boundary', async () => {
    const modifiers = [
      defenseModifier('non-uuid-damage-type', 'DAMAGE_VULNERABILITY', 'ADD_OPTION', 'fire')
    ]
    const snapshot = character(modifiers)

    await expect(evaluate(snapshot, registry(modifiers))).rejects.toThrow()
  })

  it('resolves UUID-backed condition immunities with set semantics', async () => {
    const poisoned = '00000000-0000-4000-8000-000000000101'
    const charmed = '00000000-0000-4000-8000-000000000102'
    const modifiers = [
      defenseModifier('immune-poisoned-a', 'CONDITION_IMMUNITY', 'ADD_OPTION', poisoned),
      defenseModifier('immune-poisoned-b', 'CONDITION_IMMUNITY', 'ADD_OPTION', poisoned),
      defenseModifier('remove-charmed', 'CONDITION_IMMUNITY', 'REMOVE_OPTION', charmed),
      defenseModifier('immune-charmed', 'CONDITION_IMMUNITY', 'ADD_OPTION', charmed),
      defenseModifier('remove-poisoned', 'CONDITION_IMMUNITY', 'REMOVE_OPTION', poisoned)
    ]

    await expect(evaluate(character(modifiers), registry(modifiers))).resolves.toMatchObject({
      conditionImmunityIds: [charmed]
    })
  })
})
