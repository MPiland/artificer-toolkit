import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyInput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterGrantFoldInput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type {
  CompiledClass,
  CompiledEquipment,
  CompiledProficiencyGrant
} from '@artificer-toolkit/shared/compilers'
import type { FacetAuthored } from '@artificer-toolkit/shared/authored'

import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { compileCharacterEligibilityRuleFacts } from '../../../../character/characterEligibilityRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from '../../../../character/characterGrantFoldRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

type CharacterCondition = NonNullable<
  NonNullable<
    FacetAuthored<'CHARACTER'>['groups'][number]['contexts'][number]['conditions']
  >[number]
>
type PredicateCondition = Extract<CharacterCondition, { kind: 'PREDICATE' }>
type CharacterGroup = FacetAuthored<'CHARACTER'>['groups'][number]

const baseCondition = {
  id: 'condition-1',
  order: 1,
  kind: 'PREDICATE' as const,
  constraint: 'INCLUDE' as const
}

function facet(condition: CharacterCondition): FacetAuthored<'CHARACTER'> {
  return {
    id: 'eligibility-parity',
    groups: [
      {
        id: 'eligibility-group',
        order: 1,
        contexts: [
          {
            id: 'eligibility-context',
            order: 1,
            subject: 'CHARACTER',
            conditions: [condition]
          }
        ]
      }
    ]
  }
}

const classRecord = {
  id: 'wizard',
  category: 'BASE',
  spellcasting: {
    spellLimits: [],
    maxSpellLevel: 0,
    ability: 'INTELLIGENCE'
  },
  startingGold: { multiplier: 1, currencyId: 'gp', dieConfig: '1d4' },
  startingEquipment: { id: 'wizard-equipment', sets: [] },
  hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d6' },
  multiclass: {
    id: 'wizard-multiclass',
    requirementGroups: { id: 'wizard-requirements', groups: [] }
  }
} satisfies CompiledClass

const equipmentRecord = {
  id: 'chain-mail',
  category: 'ARMOR',
  properties: ['HEAVY'],
  rarityId: 'common',
  armorClass: 16
} satisfies CompiledEquipment

const chainMailProficiency = {
  id: 'chain-mail-proficiency',
  order: 1,
  grantKind: 'PROFICIENCY_GRANT',
  selectionKind: 'GRANTED',
  authoringModeKind: 'SELECTED',
  proficiencyKind: 'EQUIPMENT',
  equipmentIds: ['chain-mail'],
  level: 'FULL'
} satisfies CompiledProficiencyGrant<'EQUIPMENT'>

const heavyProficiency = {
  id: 'heavy-proficiency',
  order: 2,
  grantKind: 'PROFICIENCY_GRANT',
  selectionKind: 'GRANTED',
  authoringModeKind: 'SELECTED',
  proficiencyKind: 'EQUIPMENT_PROPERTY',
  properties: ['HEAVY'],
  category: 'ARMOR',
  level: 'FULL'
} satisfies CompiledProficiencyGrant<'EQUIPMENT_PROPERTY'>

const strengthSaveProficiency = {
  id: 'strength-save-proficiency',
  order: 3,
  grantKind: 'PROFICIENCY_GRANT',
  selectionKind: 'GRANTED',
  authoringModeKind: 'SELECTED',
  proficiencyKind: 'SAVE_ABILITY',
  abilities: ['STRENGTH'],
  level: 'FULL'
} satisfies CompiledProficiencyGrant<'SAVE_ABILITY'>

const commonProficiency = {
  id: 'common-proficiency',
  order: 4,
  grantKind: 'PROFICIENCY_GRANT',
  selectionKind: 'GRANTED',
  authoringModeKind: 'SELECTED',
  proficiencyKind: 'LANGUAGE',
  languageIds: ['common'],
  level: 'FULL'
} satisfies CompiledProficiencyGrant<'LANGUAGE'>

const arcanaProficiency = {
  id: 'arcana-proficiency',
  order: 5,
  grantKind: 'PROFICIENCY_GRANT',
  selectionKind: 'GRANTED',
  authoringModeKind: 'SELECTED',
  proficiencyKind: 'SKILL',
  skillIds: ['skill-arcana'],
  level: 'FULL'
} satisfies CompiledProficiencyGrant<'SKILL'>

const proficiencyFeature = {
  proficiencies: [
    chainMailProficiency,
    heavyProficiency,
    strengthSaveProficiency,
    commonProficiency,
    arcanaProficiency
  ]
} satisfies NonNullable<CharacterAssemblyRegistry['features'][string]>

const snapshot = {
  characterId: 'eligibility-character',
  systemId: 'dnd5e2014',
  totalLevel: 5,
  raceId: 'elf',
  classes: [{ classId: 'wizard', level: 5 }],
  abilities: {
    STR: 16,
    DEX: 14,
    CON: 12,
    INT: 16,
    WIS: 10,
    CHA: 8
  },
  hitpoints: [],
  features: [
    {
      featureId: 'eligibility-grants',
      acquisitionId: 'eligibility-acquisition',
      source: { kind: 'FEATURE', featureId: 'eligibility-grants' },
      timing: { kind: 'IMMEDIATE' },
      selections: [
        {
          selectionKey: 'options',
          values: [{ kind: 'ID' as const, id: 'option-defense' }]
        }
      ]
    },
    {
      featureId: 'feat-power',
      source: { kind: 'FEAT', featId: 'feat-power' },
      timing: { kind: 'IMMEDIATE' }
    }
  ],
  chosenGrantSelections: [
    {
      id: 'option-selection',
      grantId: 'option-selection',
      source: { kind: 'FEATURE', featureId: 'eligibility-grants' },
      timing: { kind: 'IMMEDIATE' },
      targetIds: ['option-defense']
    }
  ],
  equipmentItems: [
    {
      instanceId: 'chain-mail-instance',
      contentRef: {
        definitionId: 'chain-mail',
        binding: { kind: 'ACTIVE' },
        systemId: 'dnd5e2014'
      },
      equippedState: { slot: 'ARMOR' as const },
      attuned: false,
      compiledItem: equipmentRecord
    }
  ],
  spellSources: []
} satisfies CharacterBuildSnapshot

const registry = {
  classes: { wizard: classRecord },
  equipment: { 'chain-mail': equipmentRecord },
  features: { 'eligibility-grants': proficiencyFeature },
  feats: {},
  races: {
    elf: {
      id: 'elf',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [],
      heritageIds: ['heritage-elven']
    }
  },
  spells: {},
  system: { skills: [{ id: 'skill-arcana', code: 'arcana', label: 'Arcana' }] }
} satisfies CharacterAssemblyRegistry

type EligibilityIds = { featureIds: string[]; optionIds: string[] }

const defaultEligibilityIds: EligibilityIds = {
  featureIds: ['eligibility-grants', 'feat-power'],
  optionIds: ['option-defense']
}

function basePolicyFacts(
  grantFoldFacts: CharacterGrantFoldInput,
  eligibilityFacets: CharacterRulePolicyInput['eligibilityFacets'],
  derivedBaseFacts: CharacterRulePolicyInput['derivedBaseFacts']
): CharacterRulePolicyInput {
  return characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts,
    totalLevel: snapshot.totalLevel,
    derivedBaseFacts,
    spellAccessCandidates: [
      {
        sequence: 0,
        accessId: 'wizard:spell-magic-missile',
        sourceInstanceId: 'wizard:spell-source',
        spellId: 'spell-magic-missile',
        sourceFeatureId: 'wizard-spell-feature',
        grantId: 'wizard-spell-grant',
        sourceKind: 'CLASS',
        sourceId: 'wizard',
        owningClassId: 'wizard',
        activeSourceLevel: 5,
        featureAvailableAtLevel: 1,
        inheritedFeatureDuplicate: false,
        specializationId: null,
        specializationRestrictionIds: null,
        selectionKind: 'GRANTED',
        authoringMode: 'SELECTED',
        selectedByCharacter: true,
        scalingKind: 'NONE',
        scalingSource: null,
        progressionLevel: null,
        totalLevel: snapshot.totalLevel,
        classLevel: 5,
        attributes: ['KNOWN'],
        castAtLevel: null,
        castingAbility: 'INTELLIGENCE',
        charge: null
      }
    ],
    spellClasses: [{ classId: 'wizard' }],
    spellPreparationClasses: [],
    spellPreparationCatalog: [],
    spellPreparationRequest: null,
    spellCastCandidates: [],
    spellCastSlots: [],
    spellCastResources: [],
    spellcastingClasses: [],
    chargeCalculations: [],
    eligibilityFacets,
    rest: { totalHitDice: 0, currentExhaustion: 0, attunementSlotOverride: null }
  })
}

async function evaluateRawEligibility(
  facetValue: FacetAuthored<'CHARACTER'>,
  ids: EligibilityIds = defaultEligibilityIds
) {
  const compiledGrantFoldFacts = compileCharacterGrantFoldRuleFacts({ snapshot, registry })
  const grantFoldFacts: CharacterGrantFoldInput = {
    ...compiledGrantFoldFacts,
    base: {
      ...compiledGrantFoldFacts.base,
      featureIds: [...ids.featureIds],
      optionIds: [...ids.optionIds]
    }
  }
  const normalized = compileCharacterEligibilityRuleFacts({
    evaluationId: facetValue.id,
    facet: facetValue,
    sourceState: { carried: true, equipped: true, attuned: false }
  })
  const facts = basePolicyFacts(
    grantFoldFacts,
    [normalized],
    buildCharacterDerivedRuleFacts(snapshot, registry)
  )
  const result = await evaluateZenRuleModel({
    document: dnd5e2014CharacterPolicyDocument,
    modelKey: 'character-policy',
    context: facts
  })
  return characterRulePolicyOutputSchema.parse(result.result).eligibilityFacets[0]
}

function predicate(
  predicateCode: PredicateCondition['predicateCode'],
  values: Record<string, unknown> = {},
  constraint: PredicateCondition['constraint'] = 'INCLUDE'
): CharacterCondition {
  return {
    ...baseCondition,
    constraint,
    predicateCode,
    ...values
  } as CharacterCondition
}

const cases: Array<{ label: string; condition: CharacterCondition }> = [
  {
    label: 'ability score selected',
    condition: predicate('ABILITY_SCORE', {
      authoringModeKind: 'SELECTED',
      abilities: 'STR',
      min: 15
    })
  },
  {
    label: 'ability score selected long authored alias',
    condition: predicate('ABILITY_SCORE', {
      authoringModeKind: 'SELECTED',
      abilities: 'STRENGTH',
      min: 15
    })
  },
  {
    label: 'ability score all is unsupported',
    condition: predicate('ABILITY_SCORE', { authoringModeKind: 'ALL' })
  },
  {
    label: 'heritage selected',
    condition: predicate('HERITAGE', {
      authoringModeKind: 'SELECTED',
      heritageIds: ['heritage-elven']
    })
  },
  {
    label: 'heritage all',
    condition: predicate('HERITAGE', { authoringModeKind: 'ALL' })
  },
  {
    label: 'character level',
    condition: predicate('CHARACTER_LEVEL', { min: 5 })
  },
  {
    label: 'class level',
    condition: predicate('CLASS_LEVEL', { classIds: ['wizard'], min: 5 })
  },
  {
    label: 'feat obtained',
    condition: predicate('FEAT_OBTAINED', { featIds: ['feat-power'] })
  },
  {
    label: 'feature obtained',
    condition: predicate('FEATURE_OBTAINED', { featureIds: ['eligibility-grants'] })
  },
  {
    label: 'option obtained',
    condition: predicate('OPTION_OBTAINED', {
      featureIds: ['eligibility-grants'],
      optionIds: ['option-defense']
    })
  },
  {
    label: 'spell obtained',
    condition: predicate('SPELL_OBTAINED', { spellIds: ['spell-magic-missile'] })
  },
  {
    label: 'can cast spell',
    condition: predicate('CAN_CAST_SPELL', {})
  },
  {
    label: 'equipment proficiency selected',
    condition: predicate('EQUIPMENT_PROFICIENCY', {
      authoringModeKind: 'SELECTED',
      equipmentIds: ['chain-mail'],
      level: 'FULL'
    })
  },
  {
    label: 'equipment proficiency all',
    condition: predicate('EQUIPMENT_PROFICIENCY', { authoringModeKind: 'ALL' })
  },
  {
    label: 'equipment property proficiency selected category',
    condition: predicate('EQUIPMENT_PROPERTY_PROFICIENCY', {
      authoringModeKind: 'SELECTED',
      category: 'ARMOR',
      properties: ['HEAVY']
    })
  },
  {
    label: 'equipment property proficiency all',
    condition: predicate('EQUIPMENT_PROPERTY_PROFICIENCY', { authoringModeKind: 'ALL' })
  },
  {
    label: 'save proficiency selected',
    condition: predicate('SAVE_ABILITY_PROFICIENCY', {
      authoringModeKind: 'SELECTED',
      abilities: 'STRENGTH',
      level: 'FULL'
    })
  },
  {
    label: 'save proficiency all',
    condition: predicate('SAVE_ABILITY_PROFICIENCY', { authoringModeKind: 'ALL' })
  },
  {
    label: 'language proficiency selected',
    condition: predicate('LANGUAGE_PROFICIENCY', {
      authoringModeKind: 'SELECTED',
      languageIds: ['common'],
      level: 'FULL'
    })
  },
  {
    label: 'language proficiency all',
    condition: predicate('LANGUAGE_PROFICIENCY', { authoringModeKind: 'ALL' })
  },
  {
    label: 'skill proficiency selected',
    condition: predicate('SKILL_PROFICIENCY', {
      authoringModeKind: 'SELECTED',
      skillIds: ['skill-arcana'],
      level: 'FULL'
    })
  },
  {
    label: 'skill proficiency all',
    condition: predicate('SKILL_PROFICIENCY', { authoringModeKind: 'ALL' })
  },
  {
    label: 'equipped selected id/category/property',
    condition: predicate('EQUIPMENT_EQUIPPED', {
      authoringModeKind: 'SELECTED',
      equipmentIds: ['chain-mail'],
      category: 'ARMOR',
      properties: ['HEAVY']
    })
  },
  {
    label: 'equipped all category/property',
    condition: predicate('EQUIPMENT_EQUIPPED', {
      authoringModeKind: 'ALL',
      category: 'ARMOR',
      properties: ['HEAVY']
    })
  },
  {
    label: 'skill score selected',
    condition: predicate('SKILL_SCORE', {
      authoringModeKind: 'SELECTED',
      skillIds: ['arcana']
    })
  },
  {
    label: 'skill score all',
    condition: predicate('SKILL_SCORE', { authoringModeKind: 'ALL' })
  },
  {
    label: 'save bonus selected alias',
    condition: predicate('SAVING_THROW_ABILITY_BONUS', {
      authoringModeKind: 'SELECTED',
      abilities: 'STRENGTH',
      min: 0
    })
  },
  {
    label: 'save bonus selected short authored alias',
    condition: predicate('SAVING_THROW_ABILITY_BONUS', {
      authoringModeKind: 'SELECTED',
      abilities: 'STR',
      min: 0
    })
  },
  {
    label: 'save bonus all',
    condition: predicate('SAVING_THROW_ABILITY_BONUS', { authoringModeKind: 'ALL' })
  },
  {
    label: 'source carried',
    condition: predicate('WHILE_SOURCE_CARRIED', {})
  },
  {
    label: 'source equipped',
    condition: predicate('WHILE_SOURCE_EQUIPPED', {})
  },
  {
    label: 'source attuned',
    condition: predicate('WHILE_SOURCE_ATTUNED', {})
  },
  {
    label: 'unknown unsupported exclude',
    condition: {
      id: 'condition-1',
      order: 1,
      kind: 'EXISTS',
      constraint: 'EXCLUDE',
      relationCode: 'CREATURE',
      authoringModeKind: 'ALL'
    }
  }
]

const failingCaseLabels = new Set([
  'ability score all is unsupported',
  'source attuned',
  'unknown unsupported exclude'
])

describe('Character eligibility parity', () => {
  it.each(cases)(
    'matches the explicit eligibility golden for $label',
    async ({ label, condition }) => {
      const authored = facet(condition)
      const raw = await evaluateRawEligibility(authored)

      expect(raw.passed, `${JSON.stringify(raw)} for ${condition.kind}`).toBe(
        !failingCaseLabels.has(label)
      )
    }
  )

  it.each([
    {
      label: 'both present include',
      featureIds: ['eligibility-grants'],
      optionIds: ['option-defense'],
      constraint: 'INCLUDE',
      passed: true
    },
    {
      label: 'feature present option absent include',
      featureIds: ['eligibility-grants'],
      optionIds: [],
      constraint: 'INCLUDE',
      passed: false
    },
    {
      label: 'feature absent option present include',
      featureIds: [],
      optionIds: ['option-defense'],
      constraint: 'INCLUDE',
      passed: false
    },
    {
      label: 'both absent include',
      featureIds: [],
      optionIds: [],
      constraint: 'INCLUDE',
      passed: false
    },
    {
      label: 'both present exclude',
      featureIds: ['eligibility-grants'],
      optionIds: ['option-defense'],
      constraint: 'EXCLUDE',
      passed: false
    },
    {
      label: 'feature present option absent exclude',
      featureIds: ['eligibility-grants'],
      optionIds: [],
      constraint: 'EXCLUDE',
      passed: true
    },
    {
      label: 'feature absent option present exclude',
      featureIds: [],
      optionIds: ['option-defense'],
      constraint: 'EXCLUDE',
      passed: true
    },
    {
      label: 'both absent exclude',
      featureIds: [],
      optionIds: [],
      constraint: 'EXCLUDE',
      passed: true
    }
  ] as const)('matches OPTION_OBTAINED compound semantics for $label', async (row) => {
    const ids: EligibilityIds = {
      featureIds: [...row.featureIds],
      optionIds: [...row.optionIds]
    }
    const authored = facet(
      predicate(
        'OPTION_OBTAINED',
        { featureIds: ['eligibility-grants'], optionIds: ['option-defense'] },
        row.constraint
      )
    )
    const raw = await evaluateRawEligibility(authored, ids)

    expect(raw.passed).toBe(row.passed)
  })

  it('preserves INCLUDE/EXCLUDE, OR groups, and first minimum failure reason', async () => {
    const authored: FacetAuthored<'CHARACTER'> = {
      id: 'eligibility-groups',
      groups: [
        {
          id: 'first-failing-group',
          order: 1,
          contexts: [
            {
              id: 'first-context',
              order: 1,
              subject: 'CHARACTER',
              conditions: [
                predicate('ABILITY_SCORE', {
                  authoringModeKind: 'SELECTED',
                  abilities: 'STRENGTH',
                  min: 30
                }),
                predicate('WHILE_SOURCE_CARRIED', {}, 'EXCLUDE')
              ]
            }
          ]
        },
        {
          id: 'second-passing-group',
          order: 2,
          contexts: [
            {
              id: 'second-context',
              order: 1,
              subject: 'CHARACTER',
              conditions: [
                predicate('HERITAGE', {
                  authoringModeKind: 'SELECTED',
                  heritageIds: ['heritage-elven']
                })
              ]
            }
          ]
        }
      ]
    }
    const passing = await evaluateRawEligibility(authored)
    expect(passing).toEqual({ evaluationId: 'eligibility-groups', passed: true, failures: [] })

    const failing = await evaluateRawEligibility({
      ...authored,
      groups: authored.groups.map((group: CharacterGroup) =>
        group.id === 'second-passing-group'
          ? {
              ...group,
              contexts: [
                {
                  ...group.contexts[0],
                  conditions: [
                    predicate('HERITAGE', {
                      authoringModeKind: 'SELECTED',
                      heritageIds: ['heritage-dwarf']
                    })
                  ]
                }
              ]
            }
          : group
      )
    })
    expect(failing).toEqual({
      evaluationId: 'eligibility-groups',
      passed: false,
      failures: [{ conditionId: 'condition-1', reasonCode: 'REQUIRED_CONDITION_FAILED' }]
    })
  })
})
