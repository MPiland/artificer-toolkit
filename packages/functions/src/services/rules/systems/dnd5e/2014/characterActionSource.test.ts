import { describe, expect, it } from 'vitest'

import {
  CHARACTER_ACTION_MODEL_KEY,
  characterActionModelInputSchema,
  characterActionModelOutputSchema
} from '@artificer-toolkit/schema/api/characterActionRules'
import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'

import { dnd5e2014CharacterActionModel } from './characterActionSource.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const document: RulePackDocumentDto = {
  schemaVersion: 1,
  models: { [CHARACTER_ACTION_MODEL_KEY]: dnd5e2014CharacterActionModel },
  fixtures: []
}

describe('D&D 5e 2014 Character action model', () => {
  it('resolves save, damage, healing, and provenance in one native evaluation', async () => {
    const input = characterActionModelInputSchema.parse({
      candidates: [
        {
          sequence: 0,
          actionId: 'feature:ACTION:effect',
          effectId: 'effect',
          sourceId: 'feature',
          source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
          mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
          activationSourceKind: 'ACTIVE_SOURCE',
          equipment: null,
          resourceUse: null,
          mechanicFacts: {
            invocation: {
              triggerCode: 'SAVING_THROW',
              activation: { code: 'ACTION', amount: 1 },
              range: { rangeKind: 'SELF', amount: null, unit: null },
              savingThrow: {
                dcMethod: 'DERIVED_DC',
                ability: 'DEX',
                baseDc: 8,
                bonuses: [
                  { bonusKind: 'ABILITY_MODIFIER', ability: 'WIS' },
                  { bonusKind: 'PROFICIENCY_BONUS' },
                  { bonusKind: 'STATIC_BONUS', amount: 1 }
                ]
              }
            },
            outcomes: [
              {
                kind: 'DAMAGE',
                pathCode: 'ON_FAILURE',
                label: null,
                damageTypeId: 'fire',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                scalingSource: null,
                classId: null,
                amountKind: null,
                amountMultiplier: null,
                values: [
                  {
                    level: null,
                    order: 0,
                    amount: null,
                    dice: '1d8',
                    multiplier: null,
                    minimum: null,
                    maximum: null
                  }
                ],
                bonuses: [
                  {
                    bonusKind: 'ABILITY_BONUS',
                    ability: 'WIS',
                    order: 0,
                    min: null,
                    max: null,
                    multiplier: null
                  },
                  {
                    bonusKind: 'PROFICIENCY_BONUS',
                    order: 1,
                    min: null,
                    max: null,
                    multiplier: null
                  }
                ]
              },
              {
                kind: 'HEAL',
                pathCode: 'ON_SUCCESS',
                label: null,
                valueKind: 'POOL',
                scalingKind: 'PER_LEVEL',
                scalingSource: 'CHARACTER_LEVEL',
                classId: null,
                temporary: false,
                values: [
                  {
                    level: null,
                    order: 0,
                    amount: 1,
                    dice: null,
                    multiplier: 2,
                    minimum: null,
                    maximum: null
                  }
                ],
                bonuses: [
                  {
                    bonusKind: 'CLASS_LEVEL',
                    classId: 'fighter',
                    order: 0,
                    min: null,
                    max: null,
                    multiplier: null
                  }
                ]
              },
              { kind: 'CONDITION', pathCode: 'ON_FAILURE', conditionId: 'prone' }
            ]
          }
        }
      ],
      activeSourceIds: ['feature'],
      activeEquipmentInstanceIds: [],
      resources: [],
      totalLevel: 5,
      classLevels: [{ classId: 'fighter', level: 3 }],
      proficiencyBonus: 3,
      abilities: [{ abilityId: 'WISDOM', modifier: 2 }],
      skills: [],
      spellcasting: null,
      attackRollModes: {
        MELEE: 'NORMAL',
        RANGED: 'NORMAL',
        SPELL: 'NORMAL',
        UNARMED: 'NORMAL'
      }
    })

    const result = await evaluateZenRuleModel({
      document,
      modelKey: CHARACTER_ACTION_MODEL_KEY,
      context: input
    })

    expect(characterActionModelOutputSchema.parse(result.result)).toEqual({
      actionDecisions: [
        {
          sequence: 0,
          actionId: 'feature:ACTION:effect',
          effectId: 'effect',
          sourceId: 'feature',
          source: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
          mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
          status: 'AVAILABLE',
          reasonCode: null,
          resourcePoolId: null,
          resourceCost: null,
          mechanic: {
            effectId: 'effect',
            trigger: 'SAVING_THROW',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: 'Self',
            attackBonus: null,
            attackRollMode: null,
            save: { ability: 'DEXTERITY', dc: 14 },
            outcomes: [
              {
                kind: 'DAMAGE',
                pathCode: 'ON_FAILURE',
                expression: '1d8 + 5',
                damageTypeId: 'fire',
                scaling: []
              },
              {
                kind: 'HEAL',
                pathCode: 'ON_SUCCESS',
                expression: '11 + 3',
                temporary: false,
                scaling: []
              },
              { kind: 'CONDITION', pathCode: 'ON_FAILURE', conditionId: 'prone' }
            ]
          }
        }
      ],
      spellCastMechanics: [],
      spellReferenceMechanics: [],
      spellCastDecisions: []
    })
  })

  it('resolves exact cast-level spell mechanics with source-specific spellcasting facts', async () => {
    const source = {
      spellId: 'fire-spell',
      sourceKind: 'CLASS' as const,
      sourceInstanceId: 'wizard-source'
    }
    const input = characterActionModelInputSchema.parse({
      candidates: [],
      spellCandidates: [
        {
          sequence: 0,
          candidateId: 'fire-spell:level:3',
          spellId: 'fire-spell',
          source,
          spellLevel: 1,
          castMode: 'SPELL_SLOT',
          castLevel: 3,
          baseEntry: false,
          resourceOwnerKey: null
        }
      ],
      spellEffects: [
        {
          spellId: 'fire-spell',
          effects: [
            {
              effectId: 'fire-effect',
              mechanicFacts: {
                invocation: {
                  triggerCode: 'SPELL_ATTACK',
                  activation: { code: 'ACTION', amount: 1 },
                  range: { rangeKind: 'DISTANCE', amount: 120, unit: 'FEET' },
                  savingThrow: null
                },
                outcomes: [
                  {
                    kind: 'DAMAGE',
                    pathCode: 'ON_SUCCESS',
                    label: null,
                    damageTypeId: 'fire',
                    valueKind: 'DICE',
                    scalingKind: 'BREAKPOINTS',
                    scalingSource: 'SPELL_CAST_LEVEL',
                    classId: null,
                    amountKind: null,
                    amountMultiplier: null,
                    values: [
                      {
                        level: 1,
                        order: 0,
                        amount: null,
                        dice: '1d8',
                        multiplier: null,
                        minimum: null,
                        maximum: null
                      },
                      {
                        level: 3,
                        order: 1,
                        amount: null,
                        dice: '2d8',
                        multiplier: null,
                        minimum: null,
                        maximum: null
                      }
                    ],
                    bonuses: []
                  }
                ]
              }
            }
          ]
        }
      ],
      spellMechanics: [{ source, attackBonus: 7, saveDc: 15, damageBonus: 2 }],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      totalLevel: 5,
      classLevels: [{ classId: 'wizard', level: 5 }],
      proficiencyBonus: 3,
      abilities: [{ abilityId: 'INTELLIGENCE', modifier: 4 }],
      skills: [],
      spellcasting: { saveDc: 15, attackBonus: 7 },
      attackRollModes: {
        MELEE: 'NORMAL',
        RANGED: 'NORMAL',
        SPELL: 'ADVANTAGE',
        UNARMED: 'NORMAL'
      }
    })

    const result = await evaluateZenRuleModel({
      document,
      modelKey: CHARACTER_ACTION_MODEL_KEY,
      context: input
    })

    expect(characterActionModelOutputSchema.parse(result.result)).toEqual({
      actionDecisions: [],
      spellCastMechanics: [
        {
          sequence: 0,
          candidateId: 'fire-spell:level:3',
          spellId: 'fire-spell',
          source,
          castLevel: 3,
          mechanics: [
            {
              effectId: 'fire-effect',
              trigger: 'SPELL_ATTACK',
              activation: { kind: 'ACTION', amount: 1 },
              rangeLabel: '120 ft',
              attackBonus: 7,
              attackRollMode: 'ADVANTAGE',
              save: null,
              outcomes: [
                {
                  kind: 'DAMAGE',
                  pathCode: 'ON_SUCCESS',
                  expression: '2d8 + 2',
                  damageTypeId: 'fire',
                  scaling: []
                }
              ]
            }
          ]
        }
      ],
      spellReferenceMechanics: [
        {
          sequence: 0,
          spellId: 'fire-spell',
          mechanics: [
            {
              effectId: 'fire-effect',
              trigger: 'SPELL_ATTACK',
              activation: { kind: 'ACTION', amount: 1 },
              rangeLabel: '120 ft',
              attackBonus: 7,
              attackRollMode: 'ADVANTAGE',
              save: null,
              outcomes: [
                {
                  kind: 'DAMAGE',
                  pathCode: 'ON_SUCCESS',
                  expression: '1d8',
                  damageTypeId: 'fire',
                  scaling: [
                    { level: 1, expression: '1d8' },
                    { level: 3, expression: '2d8' }
                  ]
                }
              ]
            }
          ]
        }
      ],
      spellCastDecisions: [
        {
          candidateId: 'fire-spell:level:3',
          status: 'UNAVAILABLE',
          reasonCode: 'NO_ELIGIBLE_SPELL_SLOT',
          slotKey: null
        }
      ]
    })
  })

  it('returns an empty mechanic list when a castable spell has no executable effects', async () => {
    const source = {
      spellId: 'utility-spell',
      sourceKind: 'CLASS' as const,
      sourceInstanceId: 'wizard-source'
    }
    const input = characterActionModelInputSchema.parse({
      candidates: [],
      spellCandidates: [
        {
          sequence: 0,
          candidateId: 'utility-spell:level:1',
          spellId: 'utility-spell',
          source,
          spellLevel: 1,
          castMode: 'SPELL_SLOT',
          castLevel: 1,
          baseEntry: true,
          resourceOwnerKey: null
        }
      ],
      spellEffects: [],
      spellMechanics: [],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      totalLevel: 1,
      classLevels: [{ classId: 'wizard', level: 1 }],
      proficiencyBonus: 2,
      abilities: [],
      skills: [],
      spellcasting: null,
      attackRollModes: {
        MELEE: 'NORMAL',
        RANGED: 'NORMAL',
        SPELL: 'NORMAL',
        UNARMED: 'NORMAL'
      }
    })

    const result = await evaluateZenRuleModel({
      document,
      modelKey: CHARACTER_ACTION_MODEL_KEY,
      context: input
    })

    expect(characterActionModelOutputSchema.parse(result.result)).toEqual({
      actionDecisions: [],
      spellCastMechanics: [
        {
          sequence: 0,
          candidateId: 'utility-spell:level:1',
          spellId: 'utility-spell',
          source,
          castLevel: 1,
          mechanics: []
        }
      ],
      spellReferenceMechanics: [],
      spellCastDecisions: [
        {
          candidateId: 'utility-spell:level:1',
          status: 'UNAVAILABLE',
          reasonCode: 'NO_ELIGIBLE_SPELL_SLOT',
          slotKey: null
        }
      ]
    })
  })

  it('selects the lowest available upcast slot and preserves non-slot cast modes', async () => {
    const source = {
      spellId: 'utility-spell',
      sourceKind: 'CLASS' as const,
      sourceInstanceId: 'wizard-source'
    }
    const input = characterActionModelInputSchema.parse({
      candidates: [],
      spellCandidates: [
        {
          sequence: 0,
          candidateId: 'utility-spell:level:1',
          spellId: 'utility-spell',
          source,
          spellLevel: 1,
          castMode: 'SPELL_SLOT',
          castLevel: 1,
          baseEntry: true,
          resourceOwnerKey: null
        },
        {
          sequence: 1,
          candidateId: 'utility-spell:at-will',
          spellId: 'utility-spell',
          source,
          spellLevel: 1,
          castMode: 'AT_WILL',
          castLevel: 1,
          baseEntry: true,
          resourceOwnerKey: null
        }
      ],
      spellSlots: [
        { slotKey: 'STANDARD:1', label: 'Level 1', level: 1, max: 2, remaining: 0 },
        { slotKey: 'STANDARD:2', label: 'Level 2', level: 2, max: 1, remaining: 1 }
      ],
      spellEffects: [],
      spellMechanics: [],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      totalLevel: 1,
      classLevels: [{ classId: 'wizard', level: 1 }],
      proficiencyBonus: 2,
      abilities: [],
      skills: [],
      spellcasting: null,
      attackRollModes: {
        MELEE: 'NORMAL',
        RANGED: 'NORMAL',
        SPELL: 'NORMAL',
        UNARMED: 'NORMAL'
      }
    })

    const result = characterActionModelOutputSchema.parse(
      (
        await evaluateZenRuleModel({
          document,
          modelKey: CHARACTER_ACTION_MODEL_KEY,
          context: input
        })
      ).result
    )

    expect(result.spellCastDecisions).toEqual([
      {
        candidateId: 'utility-spell:level:1',
        status: 'AVAILABLE',
        reasonCode: 'SPELL_SLOT_REMAINING',
        slotKey: 'STANDARD:2'
      },
      {
        candidateId: 'utility-spell:at-will',
        status: 'AVAILABLE',
        reasonCode: 'AT_WILL',
        slotKey: null
      }
    ])
  })
})
