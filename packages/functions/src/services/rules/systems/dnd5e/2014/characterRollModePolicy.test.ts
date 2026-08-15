import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from '../../../../character/characterGrantFoldRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

function modifier(
  id: string,
  valueDomainCode: string,
  modifierKind: 'ADVANTAGE' | 'DISADVANTAGE',
  domain: Record<string, string> = {},
  restrictions?: Record<string, unknown>
) {
  return {
    id,
    grantKind: 'MODIFIER_GRANT',
    order: 1,
    selectionKind: 'GRANTED',
    valueDomainCode,
    domain,
    modifierKind,
    scope: 'GLOBAL',
    payload: { valueKind: 'FIXED', amount: 1 },
    ...(restrictions ? { restrictions } : {})
  }
}

const sourceEquippedRestriction = {
  id: 'source-equipped',
  groups: [
    {
      id: 'source-equipped-group',
      order: 1,
      contexts: [
        {
          id: 'source-equipped-context',
          order: 1,
          subject: 'CHARACTER',
          conditions: [
            {
              id: 'source-equipped-condition',
              order: 1,
              kind: 'PREDICATE',
              constraint: 'INCLUDE',
              predicateCode: 'WHILE_SOURCE_EQUIPPED'
            }
          ]
        }
      ]
    }
  ]
}

function snapshot(
  equipmentItems: CharacterBuildSnapshot['equipmentItems'] = []
): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 1,
    classes: [],
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    hitpoints: [],
    features: [
      {
        featureId: 'roll-feature',
        source: { kind: 'FEATURE', featureId: 'roll-feature' },
        timing: { kind: 'IMMEDIATE' }
      }
    ],
    equipmentItems
  }
}

const records = {
  classes: {},
  equipment: {},
  feats: {},
  races: {},
  spells: {},
  system: { skills: [{ id: 'skill-perception', code: 'perception', label: 'Perception' }] },
  features: {
    'roll-feature': {
      id: 'roll-feature',
      modifiers: [
        modifier('initiative-advantage', 'INITIATIVE', 'ADVANTAGE'),
        modifier('initiative-disadvantage', 'INITIATIVE', 'DISADVANTAGE'),
        modifier('global-check-advantage', 'ABILITY_CHECK', 'ADVANTAGE'),
        modifier('dexterity-check-disadvantage', 'ABILITY_CHECK', 'DISADVANTAGE', {
          ability: 'DEX'
        }),
        modifier('perception-advantage', 'SKILL_MODIFIER', 'ADVANTAGE', {
          skillId: 'skill-perception'
        }),
        modifier('wisdom-save-advantage', 'SAVING_THROW_MODIFIER', 'ADVANTAGE', {
          ability: 'WISDOM'
        }),
        modifier('conditional-wisdom-save-disadvantage', 'SAVING_THROW_MODIFIER', 'DISADVANTAGE', {
          ability: 'WISDOM',
          conditionTypeId: 'frightened'
        }),
        modifier('melee-advantage', 'ATTACK_ROLL', 'ADVANTAGE', { attackDomain: 'MELEE' }),
        modifier('ranged-disadvantage', 'ATTACK_ROLL', 'DISADVANTAGE', {
          attackDomain: 'RANGED'
        }),
        modifier('spell-advantage', 'ATTACK_ROLL', 'ADVANTAGE', { attackDomain: 'SPELL' })
      ]
    }
  }
} as unknown as CharacterAssemblyRegistry

async function evaluatePolicy(snapshotValue: CharacterBuildSnapshot) {
  const input = characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: compileCharacterGrantFoldRuleFacts({
      snapshot: snapshotValue,
      registry: records
    }),
    totalLevel: snapshotValue.totalLevel,
    derivedBaseFacts: buildCharacterDerivedRuleFacts(snapshotValue, records),
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

async function evaluate(snapshotValue: CharacterBuildSnapshot) {
  return (await evaluatePolicy(snapshotValue)).rollModes
}

describe('D&D 5e 2014 Character roll-mode policy', () => {
  it('resolves cancellation, aliases, conditional saves, and attacks', async () => {
    const character = snapshot()
    await expect(evaluate(character)).resolves.toMatchObject({
      initiative: 'NORMAL',
      abilityChecks: {
        STRENGTH: 'ADVANTAGE',
        DEXTERITY: 'NORMAL',
        CONSTITUTION: 'ADVANTAGE',
        INTELLIGENCE: 'ADVANTAGE',
        WISDOM: 'ADVANTAGE',
        CHARISMA: 'ADVANTAGE'
      },
      savingThrows: { WISDOM: 'ADVANTAGE' },
      skillChecks: { perception: 'ADVANTAGE' },
      attacks: {
        MELEE: 'ADVANTAGE',
        RANGED: 'DISADVANTAGE',
        SPELL: 'ADVANTAGE',
        UNARMED: 'NORMAL'
      }
    })
  })

  it('includes only active, attuned equipment root modifiers', async () => {
    const item = {
      instanceId: 'lucky-item',
      contentRef: { definitionId: 'lucky-item' },
      compiledItem: {
        id: 'lucky-item',
        requiresAttunement: true,
        modifiers: [
          modifier(
            'item-initiative-advantage',
            'INITIATIVE',
            'ADVANTAGE',
            {},
            sourceEquippedRestriction
          )
        ]
      },
      equippedState: true,
      attuned: true
    } as unknown as CharacterBuildSnapshot['equipmentItems'][number]
    const active = { ...snapshot([item]), features: [] }
    await expect(evaluate(active)).resolves.toMatchObject({ initiative: 'ADVANTAGE' })

    const inactive = { ...snapshot([{ ...item, attuned: false }]), features: [] }
    await expect(evaluate(inactive)).resolves.toMatchObject({ initiative: 'NORMAL' })

    const { equippedState: _equippedState, ...unequippedItem } = item
    const unequipped = { ...snapshot([unequippedItem]), features: [] }
    await expect(evaluate(unequipped)).resolves.toMatchObject({ initiative: 'NORMAL' })
  })

  it('applies equipment features before root modifiers for last-wins provenance', async () => {
    const lastWinsModifier = (id: string, amount: number) => ({
      id,
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'INITIATIVE',
      domain: {},
      modifierKind: 'SET_VALUE',
      scope: 'GLOBAL',
      payload: { valueKind: 'FIXED', amount }
    })
    const character = {
      ...snapshot([
        {
          instanceId: 'ordered-item',
          contentRef: { definitionId: 'ordered-item' },
          equippedState: { slot: 'GENERIC' as const },
          attuned: true,
          compiledItem: {
            id: 'ordered-item',
            modifiers: [lastWinsModifier('root-set', 7)]
          }
        } as unknown as CharacterBuildSnapshot['equipmentItems'][number],
        {
          instanceId: 'feature-item',
          contentRef: { definitionId: 'feature-item' },
          equippedState: { slot: 'GENERIC' as const },
          attuned: true,
          compiledItem: {
            id: 'feature-item',
            features: [{ id: 'item-feature', modifiers: [lastWinsModifier('feature-set', 3)] }]
          }
        } as unknown as CharacterBuildSnapshot['equipmentItems'][number]
      ]),
      features: []
    }

    const result = await evaluatePolicy(character)
    expect(result.modifierGroups).toMatchObject([
      {
        domainKey: 'INITIATIVE:SET_VALUE',
        effective: 7,
        contributions: [
          { grantId: 'feature-set', state: 'SUPPRESSED' },
          { grantId: 'root-set', state: 'APPLIED' }
        ]
      }
    ])
  })
})
