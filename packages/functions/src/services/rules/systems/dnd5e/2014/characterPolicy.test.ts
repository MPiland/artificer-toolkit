import { describe, expect, it } from 'vitest'

import { characterRulePolicyOutputSchema } from '@artificer-toolkit/schema/api/characterRules'
import {
  characterGrantFoldInputSchema,
  type CharacterGrantFoldInput
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'
import { compileCharge } from '@artificer-toolkit/shared/compilers'
import { resolveAbilityAlias } from '@artificer-toolkit/shared/character'
import {
  CHARGE_BONUS_KIND,
  CHARGE_RESET_KIND,
  CLASS_CATEGORY,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type { CompiledClass } from '@artificer-toolkit/shared/subjects/compilers'

import { buildCharacterChargeRuleFact } from '../../../../character/characterChargeRuleFacts.js'
import { buildCharacterDerivedRuleFacts } from '../../../../character/characterDerivedRuleFacts.js'
import { buildCharacterSpellSlotRuleFacts } from '../../../../character/characterSpellSlotRuleFacts.js'
import type { CharacterRuleProficiency } from '../../../../character/characterSheetRuleProjection.js'
import { assertRulePackConformance } from '../../../ruleConformance.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { dnd5e2014CharacterGrantFoldEmptyInput } from './characterGrantFoldSource.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

type SpellLimits = NonNullable<CompiledClass['spellcasting']>['spellLimits']

const ACTION_EFFECT_IDS = {
  action: '00000000-0000-4000-8000-0000000000d1',
  available: '00000000-0000-4000-8000-0000000000d2',
  missing: '00000000-0000-4000-8000-0000000000d3',
  unequipped: '00000000-0000-4000-8000-0000000000d4',
  unattuned: '00000000-0000-4000-8000-0000000000d5',
  inactive: '00000000-0000-4000-8000-0000000000d6'
} as const

function spellcastingClass(
  id: string,
  resetKind: typeof CHARGE_RESET_KIND.LONG_REST | typeof CHARGE_RESET_KIND.SHORT_REST,
  spellLimits: SpellLimits
): CompiledClass {
  return {
    id,
    category: CLASS_CATEGORY.BASE,
    spellcasting: {
      spellLimits,
      maxSpellLevel: 9,
      charges: {
        id: `${id}:slots`,
        resetKind,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    },
    startingGold: { multiplier: 1, currencyId: 'gp', dieConfig: '1d4' },
    startingEquipment: { id: `${id}:equipment`, sets: [] },
    hitpoint: { ability: 'CONSTITUTION', dieConfig: '1d8' },
    multiclass: {
      id: `${id}:multiclass`,
      requirementGroups: { id: `${id}:requirements`, groups: [] }
    }
  }
}

function spellcastingFixture(classes: CharacterBuildSnapshot['classes'], records: CompiledClass[]) {
  const snapshot: CharacterBuildSnapshot = {
    characterId: 'character-1',
    systemId: 'system-1',
    totalLevel: classes.reduce((sum, entry) => sum + entry.level, 0),
    classes,
    abilities: {},
    hitpoints: [],
    features: [],
    equipmentItems: []
  }
  const registry: CharacterAssemblyRegistry = {
    classes: Object.fromEntries(records.map((record) => [record.id, record])),
    features: {},
    feats: {},
    races: {},
    equipment: {},
    spells: {}
  }
  return { snapshot, registry }
}

function policyFacts(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 4 as const,
    grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
    totalLevel: 1,
    derivedBaseFacts: {
      abilities: [],
      savingThrows: [],
      skills: [],
      initiative: { abilityId: 'DEXTERITY', abilityIndex: null, bonuses: [] },
      spellcasting: null
    },
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
    resourcePoolCandidates: [],
    actionCandidates: [],
    eligibilityFacets: [],
    rest: {
      totalHitDice: 0,
      currentExhaustion: 0,
      attunementSlotOverride: null
    },
    ...overrides
  }
}

function emptyActionMechanicFacts() {
  return {
    invocation: {
      triggerCode: 'ACTIVATED' as const,
      activation: { code: 'ACTION', amount: 1 },
      range: { rangeKind: 'SELF', amount: null, unit: null },
      savingThrow: null,
      reactionMovementTrigger: null
    },
    outcomes: []
  }
}

function grantFoldFactsFromLegacyGroups({
  totalLevel,
  modifiers = [],
  proficiencies = [],
  abilities = {}
}: {
  totalLevel: number
  modifiers?: Array<{
    domainKey: string
    modifierKind: string
    contributions: Array<{
      sourceId: string
      value: number
      valueKind?: string
      multiplier?: number
      ability?: string
      classId?: string
    }>
  }>
  proficiencies?: Array<{
    kind: string
    subjectId: string
    matchId?: string
    scaling: 'HALF' | 'FULL' | 'DOUBLE'
    grantId: string
  }>
  abilities?: Record<string, number>
}): CharacterGrantFoldInput {
  const parseDomain = (domainKey: string): Record<string, string> => {
    const separator = domainKey.indexOf('|')
    if (separator < 0) return {}
    return Object.fromEntries(
      domainKey
        .slice(separator + 1)
        .split('&')
        .map((entry) => entry.split('='))
        .filter(([key, value]) => key && value)
    )
  }
  const features = [
    {
      sourceKind: 'FEATURE' as const,
      sourceClassLevel: null,
      timingLevel: null,
      definition: {
        sourceId: 'legacy-fixture',
        mechanicSource: { kind: 'SYSTEM' as const, systemId: 'dnd5e2014' },
        sourceState: null,
        restrictions: [],
        proficiencies: proficiencies.map((proficiency) => ({
          grantId: proficiency.grantId,
          proficiencyKind: proficiency.kind,
          targetIds: [proficiency.subjectId],
          matchIds: [
            proficiency.matchId ??
              (proficiency.kind === 'SAVE_ABILITY'
                ? (resolveAbilityAlias(proficiency.subjectId) ?? proficiency.subjectId)
                : proficiency.subjectId)
          ],
          category: null,
          scaling: proficiency.scaling
        })),
        senses: [],
        modifiers: modifiers.flatMap((group) =>
          group.contributions.map((contribution) => ({
            grantId: contribution.sourceId,
            valueDomainCode: group.domainKey.split(':')[0] ?? group.domainKey,
            modifierKind: group.modifierKind,
            domain: parseDomain(group.domainKey),
            grant: {
              payload: {
                valueKind: contribution.valueKind ?? 'FIXED',
                amount: contribution.value,
                ...(contribution.multiplier === undefined
                  ? {}
                  : { multiplier: contribution.multiplier }),
                ...(contribution.ability === undefined ? {} : { ability: contribution.ability }),
                ...(contribution.classId === undefined ? {} : { classId: contribution.classId })
              }
            },
            restrictions: [],
            scopeSpellIds: []
          }))
        ),
        feats: [],
        spells: []
      },
      selectedOptions: [],
      featDefinition: null
    }
  ]
  return characterGrantFoldInputSchema.parse({
    ...dnd5e2014CharacterGrantFoldEmptyInput,
    base: {
      ...dnd5e2014CharacterGrantFoldEmptyInput.base,
      totalLevel,
      abilities
    },
    features
  })
}

describe('D&D 5e 2014 Character policy', () => {
  it('evaluates a raw-resolved action pool without a second decision node', async () => {
    const sourceId = 'legacy-fixture'
    const poolId = 'AUTHORED_SOURCE:legacy-fixture:action-charge'
    const evaluate = (rawUsed: number) =>
      evaluateZenRuleModel({
        document: dnd5e2014CharacterPolicyDocument,
        modelKey: 'character-policy',
        context: policyFacts({
          grantFoldFacts: grantFoldFactsFromLegacyGroups({ totalLevel: 1 }),
          actionCandidates: [
            {
              sequence: 0,
              actionId: 'legacy-fixture:ACTION:effect',
              effectId: ACTION_EFFECT_IDS.action,
              sourceId,
              source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
              mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
              activationSourceKind: 'ACTIVE_SOURCE',
              equipment: null,
              resourceUse: { chargeId: 'action-charge', cost: 1, poolId },
              mechanicFacts: emptyActionMechanicFacts()
            }
          ],
          resourcePoolCandidates: [
            {
              sequence: 0,
              poolId,
              ownerKind: 'AUTHORED_SOURCE',
              resourceDefinitionId: 'action-charge',
              chargeId: 'action-charge',
              chargeCalculationId: poolId,
              baseResetKind: 'LONG_REST',
              sourceId,
              source: { kind: 'SYSTEM', systemId: 'dnd5e2014' }
            }
          ],
          chargeCalculations: [
            {
              calculationId: poolId,
              sourceId,
              base: { kind: 'FIXED_AMOUNT', amount: 1 },
              bonuses: []
            }
          ],
          resourceUsageFacts: [{ poolId, rawUsed }]
        })
      })

    expect(
      characterRulePolicyOutputSchema.parse((await evaluate(0)).result).actionDecisions
    ).toEqual([
      expect.objectContaining({ status: 'AVAILABLE', reasonCode: null, resourcePoolId: poolId })
    ])
    expect(
      characterRulePolicyOutputSchema.parse((await evaluate(1)).result).actionDecisions
    ).toEqual([
      expect.objectContaining({
        status: 'UNAVAILABLE',
        reasonCode: 'INSUFFICIENT_RESOURCE',
        resourcePoolId: poolId
      })
    ])
  })

  it('returns typed unavailable action reasons without hiding the action', async () => {
    const result = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        grantFoldFacts: grantFoldFactsFromLegacyGroups({ totalLevel: 1 }),
        actionCandidates: [
          {
            sequence: 0,
            actionId: 'available',
            effectId: ACTION_EFFECT_IDS.available,
            sourceId: 'legacy-fixture',
            source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
            mechanicsOwner: { kind: 'FEATURE', id: 'available' },
            activationSourceKind: 'ACTIVE_SOURCE',
            equipment: null,
            resourceUse: null,
            mechanicFacts: emptyActionMechanicFacts()
          },
          {
            sequence: 1,
            actionId: 'missing',
            effectId: ACTION_EFFECT_IDS.missing,
            sourceId: 'legacy-fixture',
            source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
            mechanicsOwner: { kind: 'FEATURE', id: 'missing' },
            activationSourceKind: 'ACTIVE_SOURCE',
            equipment: null,
            resourceUse: { chargeId: 'missing', cost: 1, poolId: null },
            mechanicFacts: emptyActionMechanicFacts()
          },
          {
            sequence: 2,
            actionId: 'unequipped',
            effectId: ACTION_EFFECT_IDS.unequipped,
            sourceId: 'item-1',
            source: { kind: 'EQUIPMENT_INSTANCE', equipmentId: 'wand', itemInstanceId: 'item-1' },
            mechanicsOwner: { kind: 'EQUIPMENT', id: 'wand' },
            activationSourceKind: 'ACTIVE_EQUIPMENT',
            equipment: {
              itemInstanceId: 'item-1',
              equipped: false,
              attuned: false,
              requiresAttunement: false,
              requiresEquipped: true,
              requiresAttuned: false
            },
            resourceUse: { chargeId: 'wand-charge', cost: 1, poolId: 'item-pool' },
            mechanicFacts: emptyActionMechanicFacts()
          },
          {
            sequence: 3,
            actionId: 'unattuned',
            effectId: ACTION_EFFECT_IDS.unattuned,
            sourceId: 'item-2',
            source: { kind: 'EQUIPMENT_INSTANCE', equipmentId: 'wand', itemInstanceId: 'item-2' },
            mechanicsOwner: { kind: 'EQUIPMENT', id: 'wand' },
            activationSourceKind: 'ACTIVE_EQUIPMENT',
            equipment: {
              itemInstanceId: 'item-2',
              equipped: true,
              attuned: false,
              requiresAttunement: true,
              requiresEquipped: false,
              requiresAttuned: false
            },
            resourceUse: null,
            mechanicFacts: emptyActionMechanicFacts()
          },
          {
            sequence: 4,
            actionId: 'inactive',
            effectId: ACTION_EFFECT_IDS.inactive,
            sourceId: 'inactive-source',
            source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
            mechanicsOwner: { kind: 'FEATURE', id: 'inactive' },
            activationSourceKind: 'ACTIVE_SOURCE',
            equipment: null,
            resourceUse: { chargeId: 'inactive-charge', cost: 1, poolId: 'inactive-pool' },
            mechanicFacts: emptyActionMechanicFacts()
          }
        ]
      })
    })

    expect(
      characterRulePolicyOutputSchema
        .parse(result.result)
        .actionDecisions.map(({ status, reasonCode, resourcePoolId, resourceCost }) => ({
          status,
          reasonCode,
          resourcePoolId,
          resourceCost
        }))
    ).toEqual([
      { status: 'AVAILABLE', reasonCode: null, resourcePoolId: null, resourceCost: null },
      {
        status: 'UNAVAILABLE',
        reasonCode: 'RESOURCE_MISSING',
        resourcePoolId: null,
        resourceCost: null
      },
      {
        status: 'UNAVAILABLE',
        reasonCode: 'SOURCE_NOT_EQUIPPED',
        resourcePoolId: null,
        resourceCost: null
      },
      {
        status: 'UNAVAILABLE',
        reasonCode: 'SOURCE_NOT_ATTUNED',
        resourcePoolId: null,
        resourceCost: null
      },
      {
        status: 'UNAVAILABLE',
        reasonCode: 'SOURCE_REQUIREMENTS_NOT_MET',
        resourcePoolId: null,
        resourceCost: null
      }
    ])
  })

  it('passes a named array between single-mode expression nodes', async () => {
    const document: RulePackDocumentDto = {
      schemaVersion: 1,
      models: {
        probe: {
          contentType: 'application/vnd.gorules.decision',
          nodes: [
            {
              id: 'input',
              type: 'inputNode',
              name: 'Input',
              position: { x: 0, y: 0 },
              content: { schema: '' }
            },
            {
              id: 'first',
              type: 'expressionNode',
              name: 'First',
              position: { x: 100, y: 0 },
              content: {
                passThrough: true,
                inputField: null,
                outputPath: null,
                executionMode: 'single',
                expressions: [{ id: 'values', key: 'probeValues', value: 'map(values, # * 2)' }]
              }
            },
            {
              id: 'second',
              type: 'expressionNode',
              name: 'Second',
              position: { x: 200, y: 0 },
              content: {
                passThrough: false,
                inputField: null,
                outputPath: null,
                executionMode: 'single',
                expressions: [{ id: 'result', key: 'result', value: 'sum(probeValues)' }]
              }
            },
            {
              id: 'output',
              type: 'outputNode',
              name: 'Output',
              position: { x: 300, y: 0 },
              content: { schema: '' }
            }
          ],
          edges: [
            { id: 'a', sourceId: 'input', targetId: 'first' },
            { id: 'b', sourceId: 'first', targetId: 'second' },
            { id: 'c', sourceId: 'second', targetId: 'output' }
          ]
        }
      },
      fixtures: []
    }
    const evaluated = await evaluateZenRuleModel({
      document,
      modelKey: 'probe',
      context: { values: [2, 3] }
    })
    expect(evaluated.result).toEqual({ result: 10 })
  })

  it('maps a non-empty folded ability group in a single-mode node', async () => {
    const grantFoldFacts = characterGrantFoldInputSchema.parse({
      contractVersion: 1,
      base: {
        systemId: 'dnd5e',
        totalLevel: 1,
        raceId: null,
        subraceId: null,
        abilities: { STR: 10 },
        heritageIds: [],
        featureIds: ['strength-feature'],
        optionIds: [],
        featIds: [],
        classes: [],
        equipment: []
      },
      upstreamSpellIds: [],
      classes: [],
      background: null,
      features: [
        {
          sourceKind: 'FEATURE',
          sourceClassLevel: null,
          timingLevel: null,
          definition: {
            sourceId: 'strength-feature',
            mechanicSource: { kind: 'SYSTEM', systemId: 'dnd5e' },
            sourceState: null,
            restrictions: [],
            proficiencies: [],
            senses: [],
            modifiers: [
              {
                grantId: 'strength-bonus',
                valueDomainCode: 'ABILITY_SCORE',
                modifierKind: 'BONUS',
                domain: { ability: 'STR' },
                grant: { payload: { valueKind: 'FIXED', amount: 2 } },
                restrictions: [],
                scopeSpellIds: []
              }
            ],
            feats: [],
            spells: []
          },
          selectedOptions: [],
          featDefinition: null
        }
      ],
      equipmentItems: []
    })
    const result = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        grantFoldFacts,
        derivedBaseFacts: {
          abilities: [{ abilityId: 'STR', baseScore: 10, bonuses: [], scoreOverride: null }],
          savingThrows: [],
          skills: [],
          initiative: { abilityId: 'STR', abilityIndex: 0, bonuses: [] },
          spellcasting: null
        }
      })
    })
    expect(characterRulePolicyOutputSchema.parse(result.result).modifierGroups[0]).toMatchObject({
      domainKey: 'ABILITY_SCORE:BONUS|ability=STR',
      effective: 2,
      contributions: [{ grantId: 'strength-bonus', value: 2, state: 'APPLIED' }]
    })
  })

  it('passes its activation fixture through the real Zen runtime', async () => {
    await expect(
      assertRulePackConformance(dnd5e2014CharacterPolicyDocument)
    ).resolves.toBeUndefined()
  })

  it('evaluates a fresh level-zero Builder draft', async () => {
    const result = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({ totalLevel: 0 })
    })

    const parsed = characterRulePolicyOutputSchema.parse(result.result)
    expect(parsed.proficiencyBonus).toBe(2)
    expect(parsed.derivedStats.proficiencyBonus).toMatchObject({ base: 2, effective: 2 })
    expect(parsed.abilityModifiers).toEqual([])
  })

  it('matches canonical skill and saving-throw subjects without discarding authored ids', async () => {
    const result = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        totalLevel: 5,
        grantFoldFacts: grantFoldFactsFromLegacyGroups({
          totalLevel: 5,
          abilities: { WISDOM: 16 },
          proficiencies: [
            {
              kind: 'SAVE_ABILITY',
              subjectId: 'WIS',
              matchId: 'WISDOM',
              scaling: 'FULL',
              grantId: 'wisdom-save'
            },
            {
              kind: 'SKILL',
              subjectId: 'skill-perception-record',
              matchId: 'perception',
              scaling: 'FULL',
              grantId: 'perception-skill'
            }
          ]
        }),
        derivedBaseFacts: {
          abilities: [{ abilityId: 'WISDOM', baseScore: 16, bonuses: [], scoreOverride: null }],
          savingThrows: [
            {
              abilityId: 'WISDOM',
              abilityIndex: 0,
              proficiencySubjectId: 'WISDOM',
              proficiencyOverride: null,
              bonuses: [{ kind: 'PROFICIENCY', sourceId: 'wisdom-save', operation: 'ADD' }],
              totalOverride: null
            }
          ],
          skills: [
            {
              skillId: 'perception',
              governingAbilityId: 'WISDOM',
              governingAbilityIndex: 0,
              governingAbilityOverride: null,
              proficiencySubjectIds: ['perception'],
              proficiencyOverride: null,
              bonuses: [{ kind: 'PROFICIENCY', sourceId: 'perception-skill', operation: 'ADD' }],
              totalOverride: null,
              passiveOverride: null
            }
          ],
          initiative: { abilityId: 'WISDOM', abilityIndex: 0, bonuses: [] },
          spellcasting: null
        }
      })
    })

    const parsed = characterRulePolicyOutputSchema.parse(result.result)
    expect(parsed.derivedStats.savingThrows[0]).toMatchObject({
      proficiency: {
        effective: 'FULL',
        contributions: [{ grantId: 'wisdom-save', state: 'APPLIED' }]
      },
      total: { effective: 6 }
    })
    expect(parsed.derivedStats.skills[0]).toMatchObject({
      proficiency: {
        effective: 'FULL',
        contributions: [{ grantId: 'perception-skill', state: 'APPLIED' }]
      },
      total: { effective: 6 }
    })
  })

  it('uses the same resolved dynamic modifiers for groups and derived calculations', async () => {
    const folded = grantFoldFactsFromLegacyGroups({
      totalLevel: 5,
      abilities: { DEXTERITY: 14 },
      modifiers: [
        {
          domainKey: 'ABILITY_SCORE:BONUS|ability=DEX',
          modifierKind: 'BONUS',
          contributions: [{ sourceId: 'dex-score', value: 2 }]
        },
        {
          domainKey: 'INITIATIVE:BONUS',
          modifierKind: 'BONUS',
          contributions: [
            {
              sourceId: 'initiative-proficiency',
              value: 0,
              valueKind: 'PROFICIENCY_BONUS'
            }
          ]
        },
        {
          domainKey: 'SAVING_THROW_MODIFIER:BONUS|ability=DEXTERITY',
          modifierKind: 'BONUS',
          contributions: [
            {
              sourceId: 'save-class-level',
              value: 0,
              valueKind: 'CLASS_LEVEL',
              classId: 'rogue'
            }
          ]
        },
        {
          domainKey: 'SKILL_MODIFIER:ABILITY_MODIFIER_BONUS|skillId=acrobatics',
          modifierKind: 'ABILITY_MODIFIER_BONUS',
          contributions: [{ sourceId: 'skill-dexterity', value: 0, ability: 'DEX', multiplier: 1 }]
        },
        {
          domainKey: 'SAVE_DC:BONUS',
          modifierKind: 'BONUS',
          contributions: [
            {
              sourceId: 'spell-save-proficiency',
              value: 0,
              valueKind: 'PROFICIENCY_BONUS'
            }
          ]
        },
        {
          domainKey: 'ATTACK_ROLL:BONUS|attackDomain=SPELL',
          modifierKind: 'BONUS',
          contributions: [
            {
              sourceId: 'spell-attack-class-level',
              value: 0,
              valueKind: 'CLASS_LEVEL',
              classId: 'rogue'
            }
          ]
        }
      ]
    })
    const grantFoldFacts = characterGrantFoldInputSchema.parse({
      ...folded,
      base: {
        ...folded.base,
        classes: [{ classId: 'rogue', level: 5, spellcasting: false }]
      }
    })
    const result = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        totalLevel: 5,
        grantFoldFacts,
        derivedBaseFacts: {
          abilities: [
            {
              abilityId: 'DEXTERITY',
              baseScore: 14,
              bonuses: [
                {
                  kind: 'MODIFIER_GROUP',
                  sourceId: 'dex-score',
                  domainKey: 'ABILITY_SCORE:BONUS|ability=DEX',
                  operation: 'ADD'
                }
              ],
              scoreOverride: null
            }
          ],
          savingThrows: [
            {
              abilityId: 'DEXTERITY',
              abilityIndex: 0,
              proficiencySubjectId: 'DEXTERITY',
              proficiencyOverride: null,
              bonuses: [
                {
                  kind: 'MODIFIER_GROUP',
                  sourceId: 'save-class-level',
                  domainKey: 'SAVING_THROW_MODIFIER:BONUS|ability=DEXTERITY',
                  operation: 'ADD'
                }
              ],
              totalOverride: null
            }
          ],
          skills: [
            {
              skillId: 'acrobatics',
              governingAbilityId: 'DEXTERITY',
              governingAbilityIndex: 0,
              governingAbilityOverride: null,
              proficiencySubjectIds: ['acrobatics'],
              proficiencyOverride: null,
              bonuses: [
                {
                  kind: 'MODIFIER_GROUP',
                  sourceId: 'skill-dexterity',
                  domainKey: 'SKILL_MODIFIER:ABILITY_MODIFIER_BONUS|skillId=acrobatics',
                  operation: 'ADD'
                }
              ],
              totalOverride: null,
              passiveOverride: null
            }
          ],
          initiative: {
            abilityId: 'DEXTERITY',
            abilityIndex: 0,
            bonuses: [
              {
                kind: 'MODIFIER_GROUP',
                sourceId: 'initiative-proficiency',
                domainKey: 'INITIATIVE:BONUS',
                operation: 'ADD'
              }
            ]
          },
          spellcasting: {
            abilityId: 'DEXTERITY',
            abilityIndex: 0,
            saveDcBonuses: [
              {
                kind: 'MODIFIER_GROUP',
                sourceId: 'spell-save-proficiency',
                domainKey: 'SAVE_DC:BONUS',
                operation: 'ADD'
              }
            ],
            attackBonuses: [
              {
                kind: 'MODIFIER_GROUP',
                sourceId: 'spell-attack-class-level',
                domainKey: 'ATTACK_ROLL:BONUS|attackDomain=SPELL',
                operation: 'ADD'
              }
            ]
          }
        }
      })
    })

    const parsed = characterRulePolicyOutputSchema.parse(result.result)
    expect(
      Object.fromEntries(parsed.modifierGroups.map((group) => [group.domainKey, group.effective]))
    ).toMatchObject({
      'ABILITY_SCORE:BONUS|ability=DEX': 2,
      'INITIATIVE:BONUS': 3,
      'SAVING_THROW_MODIFIER:BONUS|ability=DEXTERITY': 5,
      'SKILL_MODIFIER:ABILITY_MODIFIER_BONUS|skillId=acrobatics': 3,
      'SAVE_DC:BONUS': 3,
      'ATTACK_ROLL:BONUS|attackDomain=SPELL': 5
    })
    expect(parsed.derivedStats.abilities[0]?.score.effective).toBe(16)
    expect(parsed.derivedStats.initiative.effective).toBe(6)
    expect(parsed.derivedStats.savingThrows[0]?.total.effective).toBe(8)
    expect(parsed.derivedStats.skills[0]?.total.effective).toBe(6)
    expect(parsed.derivedStats.spellcasting?.saveDc.effective).toBe(17)
    expect(parsed.derivedStats.spellcasting?.attackBonus.effective).toBe(11)
  })

  it('returns typed calculations and source explanations in one evaluation', async () => {
    const result = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: {
        contractVersion: 4,
        grantFoldFacts: grantFoldFactsFromLegacyGroups({
          totalLevel: 9,
          modifiers: [
            {
              domainKey: 'INITIATIVE:BONUS',
              modifierKind: 'BONUS',
              contributions: [
                { sourceId: 'feature:alert', value: 5 },
                { sourceId: 'adjustment:blessing', value: 1 }
              ]
            }
          ],
          abilities: { STR: 8, DEX: 18 }
        }),
        totalLevel: 9,
        derivedBaseFacts: {
          abilities: [
            { abilityId: 'STR', baseScore: 8, bonuses: [], scoreOverride: null },
            { abilityId: 'DEX', baseScore: 18, bonuses: [], scoreOverride: null }
          ],
          savingThrows: [],
          skills: [
            {
              skillId: 'STEALTH',
              governingAbilityId: 'DEX',
              governingAbilityIndex: 1,
              governingAbilityOverride: null,
              proficiencySubjectIds: ['STEALTH'],
              proficiencyOverride: null,
              bonuses: [
                {
                  kind: 'FIXED',
                  sourceId: 'skill:stealth',
                  source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
                  value: 3,
                  operation: 'ADD'
                }
              ],
              totalOverride: null,
              passiveOverride: null
            }
          ],
          initiative: {
            abilityId: 'DEX',
            abilityIndex: 1,
            bonuses: [
              {
                kind: 'MODIFIER_GROUP',
                sourceId: 'INITIATIVE:BONUS',
                domainKey: 'INITIATIVE:BONUS',
                operation: 'ADD'
              }
            ]
          },
          spellcasting: null
        },
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
        resourcePoolCandidates: [],
        eligibilityFacets: [],
        rest: {
          totalHitDice: 9,
          currentExhaustion: 0,
          attunementSlotOverride: 4,
          companions: [{ companionInstanceId: 'companion-wolf', totalHitDice: 5 }]
        }
      }
    })

    const parsed = characterRulePolicyOutputSchema.parse(result.result)
    expect(parsed.grantFold).toMatchObject({
      modifiers: [
        { domainKey: 'INITIATIVE:BONUS', modifierKind: 'BONUS' },
        { domainKey: 'INITIATIVE:BONUS', modifierKind: 'BONUS' }
      ],
      modifierGroups: [
        {
          domainKey: 'INITIATIVE:BONUS',
          contributions: [
            { acceptedModifierIndex: 0, grantId: 'feature:alert' },
            { acceptedModifierIndex: 1, grantId: 'adjustment:blessing' }
          ]
        }
      ]
    })
    const {
      grantFold: _grantFold,
      rollModes,
      rollContributorEvidence: _rollContributorEvidence,
      ...policyResult
    } = parsed
    expect(rollModes.initiative).toBe('NORMAL')
    expect(policyResult).toEqual({
      proficiencies: [],
      proficiencyBonus: 4,
      defenses: [],
      hitPointProgression: [],
      movement: { speeds: [], primaryMovementSpeedId: null },
      senses: [],
      companions: [],
      conditionImmunityIds: [],
      actionDecisions: [],
      savingThrowDefinitions: [],
      abilityModifiers: [
        { ability: 'STR', value: -1 },
        { ability: 'DEX', value: 4 }
      ],
      passiveChecks: [{ checkId: 'STEALTH', value: 17 }],
      modifierGroups: [
        {
          domainKey: 'INITIATIVE:BONUS',
          effective: 6,
          contributions: [
            {
              acceptedModifierIndex: 0,
              sourceId: 'legacy-fixture',
              grantId: 'feature:alert',
              source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
              domainKey: 'INITIATIVE:BONUS',
              value: 5,
              state: 'APPLIED',
              reasonCode: 'STACKED'
            },
            {
              acceptedModifierIndex: 1,
              sourceId: 'legacy-fixture',
              grantId: 'adjustment:blessing',
              source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
              domainKey: 'INITIATIVE:BONUS',
              value: 1,
              state: 'APPLIED',
              reasonCode: 'STACKED'
            }
          ]
        }
      ],
      derivedStats: {
        proficiencyBonus: {
          base: 4,
          effective: 4,
          contributions: [],
          override: null
        },
        abilities: [
          {
            abilityId: 'STR',
            score: { base: 8, effective: 8, contributions: [], override: null },
            modifier: {
              base: -1,
              effective: -1,
              contributions: [],
              override: null
            }
          },
          {
            abilityId: 'DEX',
            score: { base: 18, effective: 18, contributions: [], override: null },
            modifier: {
              base: 4,
              effective: 4,
              contributions: [],
              override: null
            }
          }
        ],
        savingThrows: [],
        skills: [
          {
            skillId: 'STEALTH',
            governingAbility: { base: 'DEX', effective: 'DEX', override: null },
            proficiency: {
              base: 'NONE',
              effective: 'NONE',
              contributions: [],
              override: null
            },
            total: {
              base: 4,
              effective: 7,
              contributions: [
                {
                  sourceId: 'skill:stealth',
                  source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
                  value: 3,
                  state: 'APPLIED',
                  reasonCode: 'APPLIED'
                }
              ],
              override: null
            },
            passive: {
              base: 17,
              effective: 17,
              contributions: [],
              override: null
            }
          }
        ],
        initiative: {
          base: 4,
          effective: 10,
          contributions: [
            {
              acceptedModifierIndex: 0,
              sourceId: 'legacy-fixture',
              grantId: 'feature:alert',
              source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
              domainKey: 'INITIATIVE:BONUS',
              value: 5,
              state: 'APPLIED',
              reasonCode: 'STACKED'
            },
            {
              acceptedModifierIndex: 1,
              sourceId: 'legacy-fixture',
              grantId: 'adjustment:blessing',
              source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
              domainKey: 'INITIATIVE:BONUS',
              value: 1,
              state: 'APPLIED',
              reasonCode: 'STACKED'
            }
          ],
          override: null
        },
        armorClass: {
          base: 10,
          effective: 10,
          contributions: [],
          override: null
        },
        maxHitPoints: {
          base: 0,
          effective: 0,
          contributions: [],
          override: null
        },
        spellcasting: null
      },
      spellAccessDecisions: [],
      spellAccess: [],
      spellMechanics: [],
      itemMechanics: [],
      classSpellStates: [],
      spellPreparation: { sources: [], requestDecision: null },
      spellCastDecisions: [],
      spellCastMechanics: [],
      spellReferenceMechanics: [],
      spellSlots: {
        calculationId: 'spell-slots',
        sourceClassIds: [],
        maxByLevel: [],
        pactMagic: null,
        fusionStrategy: 'NONE'
      },
      chargeMaximums: [],
      resources: [],
      eligibilityFacets: [],
      rest: {
        hitDieConstitutionModifier: 0,
        hitDiceRecoveredAfterLongRest: 4,
        currentExhaustion: 0,
        minimumExhaustion: 0,
        maximumExhaustion: 6,
        exhaustionAfterLongRest: 0,
        attunementSlotLimit: 4,
        companionHitDiceRecoveredAfterLongRest: [
          { companionInstanceId: 'companion-wolf', recovered: 2 }
        ]
      }
    })
  })

  it('matches the migration oracle for scalar, rest, and stacking policies', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, async (_, index) => {
        const totalLevel = index + 1
        const score = index + 1
        const result = await evaluateZenRuleModel({
          document: dnd5e2014CharacterPolicyDocument,
          modelKey: 'character-policy',
          context: {
            contractVersion: 4,
            grantFoldFacts: grantFoldFactsFromLegacyGroups({
              totalLevel,
              abilities: { TEST: score, PASSIVE_BASE: 10 },
              modifiers: [
                {
                  domainKey: 'TEST:BONUS',
                  modifierKind: 'BONUS',
                  contributions: [
                    { sourceId: 'first', value: 1 },
                    { sourceId: 'second', value: 2 }
                  ]
                },
                {
                  domainKey: 'TEST:SET_VALUE',
                  modifierKind: 'SET_VALUE',
                  contributions: [
                    { sourceId: 'first', value: 1 },
                    { sourceId: 'second', value: 2 }
                  ]
                },
                {
                  domainKey: 'TEST:ADVANTAGE',
                  modifierKind: 'ADVANTAGE',
                  contributions: [
                    { sourceId: 'first', value: 0 },
                    { sourceId: 'second', value: 1 }
                  ]
                }
              ]
            }),
            totalLevel,
            derivedBaseFacts: {
              abilities: [
                {
                  abilityId: 'TEST',
                  baseScore: score,
                  bonuses: [],
                  scoreOverride: null
                },
                {
                  abilityId: 'PASSIVE_BASE',
                  baseScore: 10,
                  bonuses: [],
                  scoreOverride: null
                }
              ],
              savingThrows: [],
              skills: [
                {
                  skillId: 'TEST',
                  governingAbilityId: 'PASSIVE_BASE',
                  governingAbilityIndex: 1,
                  governingAbilityOverride: null,
                  proficiencySubjectIds: ['TEST'],
                  proficiencyOverride: null,
                  bonuses: [
                    {
                      kind: 'FIXED',
                      sourceId: 'passive-bonus',
                      source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
                      value: index - 5,
                      operation: 'ADD'
                    }
                  ],
                  totalOverride: null,
                  passiveOverride: null
                }
              ],
              initiative: { abilityId: 'TEST', abilityIndex: 0, bonuses: [] },
              spellcasting: null
            },
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
            resourcePoolCandidates: [],
            eligibilityFacets: [],
            rest: {
              totalHitDice: totalLevel,
              currentExhaustion: Math.min(index, 6),
              attunementSlotOverride: null
            }
          }
        })
        return characterRulePolicyOutputSchema.parse(result.result)
      })
    )

    for (const [index, result] of results.entries()) {
      const totalLevel = index + 1
      expect(result.proficiencyBonus).toBe(2 + Math.floor((totalLevel - 1) / 4))
      expect(result.abilityModifiers[0]?.value).toBe(Math.floor((totalLevel - 10) / 2))
      expect(result.passiveChecks[0]?.value).toBe(10 + index - 5)
      expect(result.rest.hitDiceRecoveredAfterLongRest).toBe(
        Math.max(1, Math.floor(totalLevel / 2))
      )
      expect(result.rest.exhaustionAfterLongRest).toBe(Math.max(0, Math.min(index, 6) - 1))
      expect(result.rest.attunementSlotLimit).toBe(3)
      expect(result.modifierGroups.map(({ effective }) => effective)).toEqual([3, 2, 1])
      expect(result.modifierGroups[1]?.contributions.map(({ state }) => state)).toEqual([
        'SUPPRESSED',
        'APPLIED'
      ])
    }
  })

  it('matches adjusted Character calculations while retaining override and rank evidence', async () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-derived',
      systemId: 'dnd5e2014',
      totalLevel: 5,
      classes: [{ classId: 'wizard', level: 5 }],
      abilities: { STRENGTH: 8, DEXTERITY: 14, WISDOM: 16 },
      hitpoints: [],
      features: [],
      equipmentItems: [],
      adjustments: [
        {
          id: 'strength-override',
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'SCORE_OVERRIDE',
          value: 12
        },
        {
          id: 'wisdom-save-override',
          family: 'SAVING_THROW',
          ability: 'WISDOM',
          field: 'TOTAL_OVERRIDE',
          value: 9
        },
        {
          id: 'athletics-ability',
          family: 'SKILL',
          skillId: 'athletics',
          field: 'GOVERNING_ABILITY_OVERRIDE',
          value: 'WISDOM'
        },
        {
          id: 'athletics-proficiency',
          family: 'SKILL',
          skillId: 'athletics',
          field: 'PROFICIENCY_OVERRIDE',
          value: 'DOUBLE'
        },
        {
          id: 'stealth-total',
          family: 'SKILL',
          skillId: 'stealth',
          field: 'TOTAL_OVERRIDE',
          value: 11
        },
        {
          id: 'perception-passive',
          family: 'PASSIVE',
          skillId: 'perception',
          field: 'TOTAL_OVERRIDE',
          value: 19
        }
      ]
    }
    const registry: CharacterAssemblyRegistry = {
      classes: {
        wizard: { spellcasting: { ability: 'WISDOM' } } as never
      },
      features: {},
      feats: {},
      races: {},
      equipment: {},
      spells: {}
    }
    const proficiencies: CharacterRuleProficiency[] = [
      {
        kind: 'SAVE_ABILITY',
        subjectId: 'WIS',
        scaling: 'HALF',
        grantId: 'wisdom-half',
        source: { kind: 'SYSTEM', systemId: 'dnd5e2014' }
      },
      {
        kind: 'SAVE_ABILITY',
        subjectId: 'WISDOM',
        scaling: 'FULL',
        grantId: 'wisdom-full',
        source: { kind: 'SYSTEM', systemId: 'dnd5e2014' }
      },
      {
        kind: 'SKILL',
        subjectId: 'perception',
        scaling: 'HALF',
        grantId: 'perception-half',
        source: { kind: 'SYSTEM', systemId: 'dnd5e2014' }
      },
      {
        kind: 'SKILL',
        subjectId: 'perception',
        scaling: 'FULL',
        grantId: 'perception-full',
        source: { kind: 'SYSTEM', systemId: 'dnd5e2014' }
      }
    ]
    const modifierGroups = [
      {
        domainKey: 'ABILITY_SCORE:BONUS|ability=STR',
        modifierKind: 'BONUS',
        contributions: [{ sourceId: 'feature:strength', value: 2 }]
      },
      {
        domainKey: 'ABILITY_SCORE:BONUS|ability=WISDOM',
        modifierKind: 'BONUS',
        contributions: [{ sourceId: 'feature:wisdom', value: 2 }]
      },
      {
        domainKey: 'SAVING_THROW_MODIFIER:BONUS|ability=WISDOM',
        modifierKind: 'BONUS',
        contributions: [{ sourceId: 'feature:wise-save', value: 1 }]
      },
      {
        domainKey: 'SKILL_MODIFIER:BONUS|skillId=perception',
        modifierKind: 'BONUS',
        contributions: [{ sourceId: 'feature:observant', value: 1 }]
      },
      {
        domainKey: 'INITIATIVE:BONUS',
        modifierKind: 'BONUS',
        contributions: [{ sourceId: 'feature:alert', value: 2 }]
      },
      {
        domainKey: 'SAVE_DC:BONUS',
        modifierKind: 'BONUS',
        contributions: [{ sourceId: 'feature:focus', value: 1 }]
      },
      {
        domainKey: 'ATTACK_ROLL:BONUS|attackDomain=SPELL',
        modifierKind: 'BONUS',
        contributions: [{ sourceId: 'feature:wand', value: 1 }]
      }
    ]
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        totalLevel: snapshot.totalLevel,
        grantFoldFacts: grantFoldFactsFromLegacyGroups({
          totalLevel: snapshot.totalLevel,
          modifiers: modifierGroups,
          proficiencies: proficiencies.map((proficiency) => ({
            kind: proficiency.kind,
            subjectId: proficiency.subjectId,
            scaling: proficiency.scaling,
            grantId: proficiency.grantId ?? proficiency.subjectId
          })),
          abilities: snapshot.abilities
        }),
        derivedBaseFacts: buildCharacterDerivedRuleFacts(snapshot, registry)
      })
    })
    const result = characterRulePolicyOutputSchema.parse(evaluated.result).derivedStats

    expect(
      Object.fromEntries(
        result.abilities.map(({ abilityId, score }) => [abilityId, score.effective])
      )
    ).toEqual({ STRENGTH: 12, DEXTERITY: 14, WISDOM: 18 })
    expect(
      Object.fromEntries(
        result.abilities.map(({ abilityId, modifier }) => [abilityId, modifier.effective])
      )
    ).toEqual({ STRENGTH: 1, DEXTERITY: 2, WISDOM: 4 })
    expect(
      Object.fromEntries(
        result.savingThrows.map(({ abilityId, total }) => [abilityId, total.effective])
      )
    ).toEqual({ STRENGTH: 1, DEXTERITY: 2, WISDOM: 9 })
    expect(result.skills.find(({ skillId }) => skillId === 'athletics')).toMatchObject({
      governingAbility: { effective: 'WISDOM' },
      total: { effective: 10 }
    })
    expect(result.skills.find(({ skillId }) => skillId === 'perception')).toMatchObject({
      total: { effective: 8 },
      passive: { effective: 19 }
    })
    expect(result.skills.find(({ skillId }) => skillId === 'stealth')).toMatchObject({
      total: { effective: 11 }
    })
    expect(result.initiative.effective).toBe(4)
    expect(result.spellcasting?.saveDc.effective).toBe(16)
    expect(result.spellcasting?.attackBonus.effective).toBe(8)
    expect(result.abilities[0]?.score).toMatchObject({
      effective: 12,
      contributions: [{ state: 'SUPPRESSED', reasonCode: 'SUPPRESSED_BY_OVERRIDE' }],
      override: { sourceId: 'strength-override', value: 12 }
    })
    expect(
      result.skills.find(({ skillId }) => skillId === 'perception')?.proficiency.contributions
    ).toMatchObject([
      { value: 'HALF', state: 'SUPPRESSED', reasonCode: 'SUPPRESSED_BY_HIGHER_RANK' },
      { value: 'FULL', state: 'APPLIED', reasonCode: 'SELECTED_HIGHEST_RANK' }
    ])
  })

  it('matches D&D edge levels, negative modifiers, and every proficiency rank', async () => {
    const cases = [
      { totalLevel: 1, score: 1, rank: 'HALF' as const },
      { totalLevel: 4, score: 8, rank: 'FULL' as const },
      { totalLevel: 5, score: 9, rank: 'DOUBLE' as const },
      { totalLevel: 8, score: 10, rank: 'HALF' as const },
      { totalLevel: 9, score: 19, rank: 'FULL' as const },
      { totalLevel: 20, score: 30, rank: 'DOUBLE' as const }
    ]

    for (const fixture of cases) {
      const evaluated = await evaluateZenRuleModel({
        document: dnd5e2014CharacterPolicyDocument,
        modelKey: 'character-policy',
        context: policyFacts({
          totalLevel: fixture.totalLevel,
          grantFoldFacts: grantFoldFactsFromLegacyGroups({
            totalLevel: fixture.totalLevel,
            abilities: { TEST: fixture.score },
            proficiencies: [
              {
                kind: 'SAVE_ABILITY',
                subjectId: 'TEST',
                scaling: fixture.rank,
                grantId: `save-rank:${fixture.rank}`
              },
              {
                kind: 'SKILL',
                subjectId: 'test-skill',
                scaling: fixture.rank,
                grantId: `skill-rank:${fixture.rank}`
              }
            ]
          }),
          derivedBaseFacts: {
            abilities: [
              {
                abilityId: 'TEST',
                baseScore: fixture.score,
                bonuses: [],
                scoreOverride: null
              }
            ],
            savingThrows: [
              {
                abilityId: 'TEST',
                abilityIndex: 0,
                proficiencySubjectId: 'TEST',
                proficiencyOverride: null,
                bonuses: [
                  {
                    kind: 'PROFICIENCY',
                    sourceId: 'test-proficiency',
                    operation: 'ADD'
                  }
                ],
                totalOverride: null
              }
            ],
            skills: [
              {
                skillId: 'test-skill',
                governingAbilityId: 'TEST',
                governingAbilityIndex: 0,
                governingAbilityOverride: null,
                proficiencySubjectIds: ['test-skill'],
                proficiencyOverride: null,
                bonuses: [
                  {
                    kind: 'PROFICIENCY',
                    sourceId: 'test-proficiency',
                    operation: 'ADD'
                  }
                ],
                totalOverride: null,
                passiveOverride: null
              }
            ],
            initiative: { abilityId: 'TEST', abilityIndex: 0, bonuses: [] },
            spellcasting: {
              abilityId: 'TEST',
              abilityIndex: 0,
              saveDcBonuses: [],
              attackBonuses: []
            }
          }
        })
      })
      const result = characterRulePolicyOutputSchema.parse(evaluated.result).derivedStats
      const proficiencyBonus = 2 + Math.floor((fixture.totalLevel - 1) / 4)
      const abilityModifier = Math.floor((fixture.score - 10) / 2)
      const rankMultiplier = fixture.rank === 'HALF' ? 0.5 : fixture.rank === 'DOUBLE' ? 2 : 1
      const proficiencyValue = Math.floor(proficiencyBonus * rankMultiplier)
      const expectedTotal = abilityModifier + proficiencyValue

      expect(result.proficiencyBonus.effective).toBe(proficiencyBonus)
      expect(result.abilities[0]?.modifier.effective).toBe(abilityModifier)
      expect(result.savingThrows[0]?.total.effective).toBe(expectedTotal)
      expect(result.skills[0]?.total.effective).toBe(expectedTotal)
      expect(result.skills[0]?.passive.effective).toBe(10 + expectedTotal)
      expect(result.initiative.effective).toBe(abilityModifier)
      expect(result.spellcasting?.saveDc.effective).toBe(8 + proficiencyBonus + abilityModifier)
      expect(result.spellcasting?.attackBonus.effective).toBe(proficiencyBonus + abilityModifier)
    }
  })

  it('resolves spell slots for none, single, multiclass, and pact casters', async () => {
    const fullCasterLimits: SpellLimits = [
      { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }] },
      {
        classLevel: 5,
        slots: [
          { spellLevel: 1, slotCount: 4 },
          { spellLevel: 2, slotCount: 3 },
          { spellLevel: 3, slotCount: 2 }
        ]
      },
      { classLevel: 17, slots: [{ spellLevel: 9, slotCount: 1 }] }
    ]
    const halfCasterLimits: SpellLimits = [
      { classLevel: 1, slots: [] },
      { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 2 }] },
      { classLevel: 17, slots: [{ spellLevel: 5, slotCount: 1 }] }
    ]
    const thirdCasterLimits: SpellLimits = [
      { classLevel: 1, slots: [] },
      { classLevel: 3, slots: [{ spellLevel: 1, slotCount: 2 }] },
      { classLevel: 19, slots: [{ spellLevel: 4, slotCount: 1 }] }
    ]
    const pactLimits: SpellLimits = [
      { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 1 }] },
      { classLevel: 5, slots: [{ spellLevel: 3, slotCount: 2 }] }
    ]
    const fixtures = [
      spellcastingFixture([], []),
      spellcastingFixture(
        [{ classId: 'wizard', level: 5 }],
        [spellcastingClass('wizard', CHARGE_RESET_KIND.LONG_REST, fullCasterLimits)]
      ),
      spellcastingFixture(
        [
          { classId: 'wizard', level: 2 },
          { classId: 'paladin', level: 4 },
          { classId: 'eldritch-knight', level: 3 }
        ],
        [
          spellcastingClass('wizard', CHARGE_RESET_KIND.LONG_REST, fullCasterLimits),
          spellcastingClass('paladin', CHARGE_RESET_KIND.LONG_REST, halfCasterLimits),
          spellcastingClass('eldritch-knight', CHARGE_RESET_KIND.LONG_REST, thirdCasterLimits)
        ]
      ),
      spellcastingFixture(
        [
          { classId: 'wizard', level: 1 },
          { classId: 'warlock', level: 5 }
        ],
        [
          spellcastingClass('wizard', CHARGE_RESET_KIND.LONG_REST, fullCasterLimits),
          spellcastingClass('warlock', CHARGE_RESET_KIND.SHORT_REST, pactLimits)
        ]
      )
    ]

    const expectedSpellSlots = [
      { maxByLevel: {}, pactMagic: null, fusionStrategy: 'NONE' },
      {
        maxByLevel: { 1: 4, 2: 3, 3: 2 },
        pactMagic: null,
        fusionStrategy: 'SINGLE_CLASS'
      },
      {
        maxByLevel: { 1: 4, 2: 3, 3: 2 },
        pactMagic: null,
        fusionStrategy: 'MULTICLASS_FUSED'
      },
      {
        maxByLevel: { 1: 2 },
        pactMagic: { slots: 2, level: 3 },
        fusionStrategy: 'SINGLE_CLASS'
      }
    ] as const

    for (const [index, { snapshot, registry }] of fixtures.entries()) {
      const expected = expectedSpellSlots[index]!
      const evaluated = await evaluateZenRuleModel({
        document: dnd5e2014CharacterPolicyDocument,
        modelKey: 'character-policy',
        context: policyFacts({
          totalLevel: Math.max(1, snapshot.totalLevel),
          spellcastingClasses: buildCharacterSpellSlotRuleFacts(snapshot, registry),
          spellSlotUsageFacts: [
            { kind: 'STANDARD', spellLevel: 1, rawUsed: 99 },
            { kind: 'PACT', rawUsed: 99 }
          ]
        })
      })
      const result = characterRulePolicyOutputSchema.parse(evaluated.result).spellSlots

      expect(
        Object.fromEntries(
          result.maxByLevel.map(({ spellLevel, slotCount }) => [spellLevel, slotCount])
        )
      ).toEqual(expected.maxByLevel)
      expect(
        result.pactMagic && {
          slots: result.pactMagic.slots,
          level: result.pactMagic.level
        }
      ).toEqual(expected.pactMagic)
      for (const slot of result.maxByLevel) {
        expect(slot.effectiveUsed).toBe(Math.min(slot.rawUsed, slot.slotCount))
        expect(slot.remaining).toBe(Math.max(slot.slotCount - slot.effectiveUsed, 0))
      }
      if (result.pactMagic) {
        expect(result.pactMagic.effectiveUsed).toBe(
          Math.min(result.pactMagic.rawUsed, result.pactMagic.slots)
        )
        expect(result.pactMagic.remaining).toBe(
          Math.max(result.pactMagic.slots - result.pactMagic.effectiveUsed, 0)
        )
      }
      expect(result.fusionStrategy).toBe(expected.fusionStrategy)
    }
  })

  it('resolves every charge base kind, scaling, bonuses, and clamps', async () => {
    const context = {
      abilities: { STRENGTH: 18, WISDOM: 14 },
      classLevels: { fighter: 5 },
      sourceClassLevel: 5,
      spellCastLevel: 3,
      skillBonuses: { arcana: 7 },
      proficiencyBonus: 3,
      totalLevel: 8
    }
    const charges = [
      compileCharge({
        id: 'ability',
        resetKind: CHARGE_RESET_KIND.LONG_REST,
        limitKind: 'ABILITY_MODIFIER',
        scalingKind: 'NONE',
        ability: 'STRENGTH',
        multiplier: 2,
        min: 1,
        max: 7
      }),
      compileCharge({
        id: 'character',
        resetKind: CHARGE_RESET_KIND.LONG_REST,
        limitKind: 'CHARACTER_LEVEL',
        scalingKind: 'NONE',
        multiplier: 0.5,
        min: 1,
        max: 3
      }),
      compileCharge({
        id: 'class',
        resetKind: CHARGE_RESET_KIND.SHORT_REST,
        limitKind: 'CLASS_LEVEL',
        scalingKind: 'NONE',
        classId: 'fighter'
      }),
      compileCharge({
        id: 'parent-class',
        resetKind: CHARGE_RESET_KIND.SHORT_REST,
        limitKind: 'PARENT_CLASS_LEVEL',
        scalingKind: 'NONE'
      }),
      compileCharge({
        id: 'spell-level',
        resetKind: CHARGE_RESET_KIND.MANUAL,
        limitKind: 'SPELL_CAST_LEVEL',
        scalingKind: 'NONE',
        multiplier: 2
      }),
      compileCharge({
        id: 'fixed-with-bonuses',
        resetKind: CHARGE_RESET_KIND.MANUAL,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1,
        bonuses: [
          {
            id: 'wisdom',
            bonusKind: CHARGE_BONUS_KIND.ABILITY_MODIFIER,
            ability: 'WISDOM',
            multiplier: 2,
            min: 1,
            max: 3,
            order: 1
          },
          {
            id: 'proficiency',
            bonusKind: CHARGE_BONUS_KIND.PROFICIENCY_BONUS,
            order: 2
          },
          {
            id: 'arcana',
            bonusKind: CHARGE_BONUS_KIND.SKILL_BONUS,
            skillId: 'arcana',
            multiplier: 0.5,
            order: 3
          }
        ]
      }),
      compileCharge({
        id: 'per-level',
        resetKind: CHARGE_RESET_KIND.LONG_REST,
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'PER_LEVEL',
        levels: [
          { id: 'level-1', level: 1, amount: 1 },
          { id: 'level-5', level: 5, amount: 4 },
          { id: 'level-9', level: 9, amount: 7 }
        ]
      })
    ]
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        totalLevel: context.totalLevel,
        grantFoldFacts: {
          ...dnd5e2014CharacterGrantFoldEmptyInput,
          base: {
            ...dnd5e2014CharacterGrantFoldEmptyInput.base,
            totalLevel: context.totalLevel,
            classes: [{ classId: 'fighter', level: 5, spellcasting: false }]
          }
        },
        derivedBaseFacts: {
          abilities: [
            { abilityId: 'STRENGTH', baseScore: 18, bonuses: [], scoreOverride: null },
            { abilityId: 'WISDOM', baseScore: 14, bonuses: [], scoreOverride: null },
            { abilityId: 'INTELLIGENCE', baseScore: 24, bonuses: [], scoreOverride: null }
          ],
          savingThrows: [],
          skills: [
            {
              skillId: 'arcana',
              governingAbilityId: 'INTELLIGENCE',
              governingAbilityIndex: 2,
              governingAbilityOverride: null,
              proficiencySubjectIds: ['arcana'],
              proficiencyOverride: null,
              bonuses: [],
              totalOverride: null,
              passiveOverride: null
            }
          ],
          initiative: { abilityId: 'STRENGTH', abilityIndex: 0, bonuses: [] },
          spellcasting: null
        },
        chargeCalculations: charges.map((charge, index) =>
          buildCharacterChargeRuleFact(charge, `${charge.id}:${index}`, {
            sourceLevel: { kind: 'CLASS_LEVEL', classId: 'fighter' },
            spellCastLevel: context.spellCastLevel
          })
        )
      })
    })
    const results = characterRulePolicyOutputSchema.parse(evaluated.result).chargeMaximums

    expect(results.map(({ maximum }) => maximum)).toEqual([7, 3, 5, 5, 6, 10, 4])
    expect(
      results.every(({ state, reasonCode }) => state === 'RESOLVED' && reasonCode === 'CALCULATED')
    ).toBe(true)
    expect(results[5]?.bonusContributions.map(({ value }) => value)).toEqual([3, 3, 3])
    expect(results[6]?.baseContribution?.sourceId).toBe('level-5')
  })

  it('fails charge calculation closed when a required primitive fact is missing', async () => {
    const charge = compileCharge({
      id: 'missing-wisdom',
      resetKind: CHARGE_RESET_KIND.MANUAL,
      limitKind: 'ABILITY_MODIFIER',
      scalingKind: 'NONE',
      ability: 'WISDOM'
    })
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        chargeCalculations: [buildCharacterChargeRuleFact(charge, 'missing-wisdom')]
      })
    })

    expect(characterRulePolicyOutputSchema.parse(evaluated.result).chargeMaximums).toEqual([
      {
        calculationId: 'missing-wisdom',
        sourceId: 'missing-wisdom',
        state: 'UNRESOLVED',
        maximum: null,
        reasonCode: 'MISSING_REQUIRED_FACT',
        baseContribution: null,
        bonusContributions: []
      }
    ])
  })

  it('keeps repeated authored charge bonuses isolated by calculation instance', async () => {
    const charge = compileCharge({
      id: 'shared-feature-charge',
      resetKind: CHARGE_RESET_KIND.LONG_REST,
      limitKind: 'PARENT_CLASS_LEVEL',
      scalingKind: 'NONE',
      bonuses: [{ id: 'proficiency', bonusKind: CHARGE_BONUS_KIND.PROFICIENCY_BONUS, order: 1 }]
    })
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        totalLevel: 8,
        grantFoldFacts: {
          ...dnd5e2014CharacterGrantFoldEmptyInput,
          base: {
            ...dnd5e2014CharacterGrantFoldEmptyInput.base,
            totalLevel: 8,
            classes: [
              { classId: 'fighter', level: 2, spellcasting: false },
              { classId: 'wizard', level: 6, spellcasting: true }
            ]
          }
        },
        chargeCalculations: [
          buildCharacterChargeRuleFact(charge, 'CLASS:fighter:feature:shared-charge', {
            sourceLevel: { kind: 'CLASS_LEVEL', classId: 'fighter' }
          }),
          buildCharacterChargeRuleFact(charge, 'CLASS:wizard:feature:shared-charge', {
            sourceLevel: { kind: 'CLASS_LEVEL', classId: 'wizard' }
          })
        ]
      })
    })

    expect(characterRulePolicyOutputSchema.parse(evaluated.result).chargeMaximums).toEqual([
      {
        calculationId: 'CLASS:fighter:feature:shared-charge',
        sourceId: 'shared-feature-charge',
        state: 'RESOLVED',
        maximum: 5,
        reasonCode: 'CALCULATED',
        baseContribution: { sourceId: 'shared-feature-charge', value: 2 },
        bonusContributions: [{ sourceId: 'shared-feature-charge:bonus:1:0', value: 3 }]
      },
      {
        calculationId: 'CLASS:wizard:feature:shared-charge',
        sourceId: 'shared-feature-charge',
        state: 'RESOLVED',
        maximum: 9,
        reasonCode: 'CALCULATED',
        baseContribution: { sourceId: 'shared-feature-charge', value: 6 },
        bonusContributions: [{ sourceId: 'shared-feature-charge:bonus:1:0', value: 3 }]
      }
    ])
  })

  it('evaluates normalized eligibility groups in the same policy invocation', async () => {
    const result = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: {
        contractVersion: 4,
        grantFoldFacts: {
          ...dnd5e2014CharacterGrantFoldEmptyInput,
          base: {
            ...dnd5e2014CharacterGrantFoldEmptyInput.base,
            classes: [{ classId: 'fighter', level: 1, spellcasting: false }]
          }
        },
        totalLevel: 1,
        derivedBaseFacts: {
          ...policyFacts().derivedBaseFacts,
          abilities: [{ abilityId: 'STR', baseScore: 16, bonuses: [], scoreOverride: null }]
        },
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
        resourcePoolCandidates: [],
        eligibilityFacets: [
          {
            evaluationId: 'feat:shield-master',
            sourceState: { carried: false, equipped: false, attuned: false },
            groups: [
              {
                groupId: 'strength-group',
                conditions: [
                  {
                    conditionId: 'strength',
                    constraint: 'INCLUDE',
                    kind: 'PREDICATE',
                    predicateCode: 'ABILITY_SCORE',
                    authoringMode: 'SELECTED',
                    abilityId: 'STR',
                    min: 15,
                    max: null,
                    requiredIds: [],
                    category: null,
                    requiredProperties: [],
                    minimumRank: null
                  }
                ]
              },
              {
                groupId: 'fighter-group',
                conditions: [
                  {
                    conditionId: 'fighter',
                    constraint: 'INCLUDE',
                    kind: 'PREDICATE',
                    predicateCode: 'CLASS_LEVEL',
                    authoringMode: 'SELECTED',
                    abilityId: null,
                    min: null,
                    max: null,
                    requiredIds: ['fighter'],
                    category: null,
                    requiredProperties: [],
                    minimumRank: null
                  },
                  {
                    conditionId: 'forbidden',
                    constraint: 'EXCLUDE',
                    kind: 'PREDICATE',
                    predicateCode: 'WHILE_SOURCE_EQUIPPED',
                    authoringMode: 'ALL',
                    abilityId: null,
                    min: null,
                    max: null,
                    requiredIds: [],
                    category: null,
                    requiredProperties: [],
                    minimumRank: null
                  }
                ]
              }
            ]
          }
        ],
        rest: {
          totalHitDice: 0,
          currentExhaustion: 0,
          attunementSlotOverride: null
        }
      }
    })

    expect(characterRulePolicyOutputSchema.parse(result.result).eligibilityFacets).toEqual([
      { evaluationId: 'feat:shield-master', passed: true, failures: [] }
    ])
  })

  it('inverts unsupported conditions for EXCLUDE constraints', async () => {
    const result = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: {
        contractVersion: 4,
        grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
        totalLevel: 1,
        derivedBaseFacts: policyFacts().derivedBaseFacts,
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
        resourcePoolCandidates: [],
        eligibilityFacets: [
          {
            evaluationId: 'feat:unavailable',
            sourceState: { carried: false, equipped: false, attuned: false },
            groups: [
              {
                groupId: 'unavailable-group',
                conditions: [
                  {
                    conditionId: 'missing-feature',
                    constraint: 'INCLUDE',
                    kind: 'PREDICATE',
                    predicateCode: 'FEATURE_OBTAINED',
                    authoringMode: 'SELECTED',
                    abilityId: null,
                    min: null,
                    max: null,
                    requiredIds: ['feature:training'],
                    category: null,
                    requiredProperties: [],
                    minimumRank: null
                  },
                  {
                    conditionId: 'unknown',
                    constraint: 'EXCLUDE',
                    kind: 'UNSUPPORTED'
                  }
                ]
              }
            ]
          }
        ],
        rest: {
          totalHitDice: 0,
          currentExhaustion: 0,
          attunementSlotOverride: null
        }
      }
    })

    expect(characterRulePolicyOutputSchema.parse(result.result).eligibilityFacets).toEqual([
      {
        evaluationId: 'feat:unavailable',
        passed: false,
        failures: [
          {
            conditionId: 'missing-feature',
            reasonCode: 'REQUIRED_CONDITION_FAILED'
          }
        ]
      }
    ])
  })
})
