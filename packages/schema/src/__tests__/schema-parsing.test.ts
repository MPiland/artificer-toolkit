import { describe, expect, it } from 'vitest'

import { chargeDtoSchema, chargeUseDtoSchema } from '../shared/charge.js'
import { effectDtoSchema } from '../effects/effect.js'
import { featureDtoSchema } from '../features/feature.js'
import { facetDtoSchema } from '../shared/facet.js'
import { featGrantDtoSchema } from '../grants/feat.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { senseGrantDtoSchema } from '../grants/sense.js'
import { spellGrantDtoSchema } from '../grants/spell.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import {
  authoredDraftDtoSchema,
  authoredDraftSaveRequestDtoSchema,
  backgroundListResponseDtoSchema,
  spellResponseDtoSchema
} from '../api/content.js'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeResolveRequestDtoSchema,
  nodeRuntimeResolveResponseDtoSchema
} from '../api/nodeRuntime.js'
import {
  resourceIdParamsDtoSchema,
  systemAuthoredDtoSchema,
  systemListResponseDtoSchema
} from '../index.js'
import { classAuthoredDtoSchema, classAuthoringInputDtoSchema } from '../subjects/class.js'
import { classPrepareLimitDtoSchema } from '../subjects/shared.js'
import { creatureAuthoredDtoSchema } from '../subjects/creature.js'
import { equipmentAuthoredDtoSchema } from '../subjects/equipment.js'
import { featAuthoredDtoSchema } from '../subjects/feat.js'
import { raceAuthoredDtoSchema } from '../subjects/race.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'

type ParsedEffectForAssertions = {
  invocation: {
    kind?: string
    triggerCode?: string
    savingThrow?: unknown
  }
  paths: Array<{
    pathCode?: string
    options?: Array<Record<string, unknown>>
    rows?: Array<Record<string, unknown>>
    resultBlock?: {
      outcomes?: Array<
        Record<string, unknown> & {
          bonuses?: Array<Record<string, unknown>>
        }
      >
      lifecycle?: Record<string, unknown>
    }
  }>
}

function singleResultBlock(
  id: string,
  outcome: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    resultKind: 'SINGLE',
    outcomes: [outcome],
    ...extra
  }
}

function sequenceResultBlock(
  id: string,
  outcomes: Record<string, unknown>[],
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    resultKind: 'SEQUENCE',
    outcomes,
    ...extra
  }
}

function fixedPath(
  id: string,
  order: number,
  pathCode: string,
  resultBlock: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'FIXED',
    resultBlock,
    ...extra
  }
}

function choicePath(
  id: string,
  order: number,
  pathCode: string,
  options: Record<string, unknown>[],
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'CHOICE',
    selectionKind: 'CHOICE',
    options,
    ...extra
  }
}

describe('saving throw DTOs', () => {
  it('accepts fixed, source, and derived DC methods', () => {
    expect(
      savingThrowDtoSchema.parse({
        id: 'fixed-save',
        dcMethod: 'FIXED_DC',
        ability: 'DEXTERITY',
        baseDc: 15,
        bonuses: [{ id: 'fixed-save-static', bonusKind: 'STATIC_BONUS', amount: 1 }]
      })
    ).toMatchObject({ dcMethod: 'FIXED_DC', baseDc: 15 })

    expect(
      savingThrowDtoSchema.parse({
        id: 'source-save',
        dcMethod: 'SOURCE_SAVE_DC',
        ability: 'WISDOM'
      })
    ).toMatchObject({ dcMethod: 'SOURCE_SAVE_DC' })

    expect(
      savingThrowDtoSchema.parse({
        id: 'derived-save',
        dcMethod: 'DERIVED_DC',
        ability: 'CONSTITUTION',
        baseDc: 8,
        bonuses: [
          { id: 'derived-save-ability', bonusKind: 'ABILITY_MODIFIER', ability: 'CONSTITUTION' },
          { id: 'derived-save-proficiency', bonusKind: 'PROFICIENCY_BONUS' }
        ]
      })
    ).toMatchObject({ dcMethod: 'DERIVED_DC', baseDc: 8 })
  })

  it('rejects legacy sourceAbility payloads', () => {
    expect(() =>
      savingThrowDtoSchema.parse({
        id: 'legacy-save',
        dcMethod: 'SOURCE_SAVE_DC',
        ability: 'DEXTERITY',
        sourceAbility: 'CONSTITUTION'
      })
    ).toThrow()
  })
})

function exactRollTablePath(
  id: string,
  order: number,
  pathCode: string,
  rows: Record<string, unknown>[],
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'ROLL_TABLE',
    rollTableKind: 'EXACT',
    dieConfig: '1d4',
    rows,
    ...extra
  }
}

describe('schema package parsing', () => {
  it('parses generic authored draft save and response contracts', () => {
    const saveRequest = authoredDraftSaveRequestDtoSchema.parse({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      systemId: 'system-1',
      label: 'Fire Lace',
      payload: {
        id: 'spell-1',
        kind: 'SPELL',
        label: 'Fire Lace',
        status: 'DRAFT'
      }
    })
    const draft = authoredDraftDtoSchema.parse({
      publicId: 'draft-1',
      ...saveRequest,
      userId: 'user-1',
      status: 'DRAFT',
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })

    expect(saveRequest.subjectKind).toBe('SPELL')
    expect(draft.payload.label).toBe('Fire Lace')
  })

  it('parses per-level charges with nested bonuses', () => {
    const parsed = chargeDtoSchema.parse({
      id: 'arcane-recovery',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'PER_LEVEL',
      bonuses: [
        {
          id: 'prof-bonus',
          bonusKind: 'PROFICIENCY_BONUS',
          multiplier: 1,
          order: 1
        }
      ],
      levels: [
        { id: 'level-1', level: 1, amount: 1 },
        { id: 'level-5', level: 5, amount: 2 }
      ]
    })

    expect(parsed.scalingKind).toBe('PER_LEVEL')
    if (parsed.scalingKind !== 'PER_LEVEL') {
      throw new Error('Expected PER_LEVEL charge payload')
    }

    expect(parsed.levels).toHaveLength(2)
  })

  it('parses item charges that recover at dawn', () => {
    expect(
      chargeDtoSchema.parse({
        id: 'astral-tear-charges',
        resetKind: 'DAWN',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 3
      })
    ).toMatchObject({
      amount: 3,
      resetKind: 'DAWN'
    })
  })

  it('allows nested source charge consumption without allowing it as an owned pool', () => {
    const sourceCharge = {
      id: 'warping-strike-charges',
      limitKind: 'SOURCE_CHARGES',
      scalingKind: 'NONE',
      cost: 1
    } as const

    expect(chargeUseDtoSchema.parse(sourceCharge)).toEqual(sourceCharge)
    expect(chargeDtoSchema.safeParse(sourceCharge).success).toBe(false)
    expect(
      chargeUseDtoSchema.safeParse({
        ...sourceCharge,
        cost: 0
      }).success
    ).toBe(false)
  })

  it('parses effects with nested saving throw invocations and fixed paths', () => {
    const parsed = effectDtoSchema.parse({
      id: 'burning-hands-effect',
      order: 1,
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'dex-save',
          dcMethod: 'FIXED_DC',
          ability: 'DEXTERITY',
          baseDc: 13
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'self-range',
          rangeKind: 'SELF'
        }
      },
      paths: [
        fixedPath(
          'burning-hands-direct',
          1,
          'ON_SAVE_FAIL',
          singleResultBlock('burning-hands-result', {
            id: 'burning-hands-direct-entry',
            effectKind: 'DAMAGE',
            damageTypeId: 'fire',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '3d6'
          })
        )
      ]
    }) as unknown as ParsedEffectForAssertions

    expect(parsed.paths).toHaveLength(1)
    expect(parsed.invocation.triggerCode).toBe('SAVING_THROW')
    expect(parsed.paths[0]).toMatchObject({
      pathCode: 'ON_SAVE_FAIL'
    })
  })

  it('parses passive effects with saving throw invocations', () => {
    const parsed = effectDtoSchema.parse({
      id: 'spirit-guardians-effect',
      order: 1,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'spirit-guardians-save',
          dcMethod: 'FIXED_DC',
          ability: 'WISDOM',
          baseDc: 15
        },
        range: {
          id: 'spirit-guardians-range',
          rangeKind: 'SELF'
        },
        shape: {
          id: 'spirit-guardians-shape',
          shapeKind: 'SPHERE',
          radius: {
            amount: 15,
            unit: 'FEET'
          }
        }
      },
      paths: [
        fixedPath(
          'spirit-guardians-save-fail',
          1,
          'ON_SAVE_FAIL',
          singleResultBlock('spirit-guardians-save-fail-result', {
            id: 'spirit-guardians-save-fail-entry',
            effectKind: 'DAMAGE',
            damageTypeId: 'radiant',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '3d8'
          })
        ),
        fixedPath(
          'spirit-guardians-save-success',
          2,
          'ON_SAVE_SUCCESS',
          singleResultBlock('spirit-guardians-save-success-result', {
            id: 'spirit-guardians-save-success-entry',
            effectKind: 'DAMAGE',
            damageTypeId: 'radiant',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '3d8'
          })
        )
      ]
    }) as unknown as ParsedEffectForAssertions

    expect(parsed.invocation.kind).toBe('PASSIVE')
    expect(parsed.invocation.triggerCode).toBe('SAVING_THROW')
    expect('savingThrow' in parsed.invocation).toBe(true)
  })

  it('parses labeled choice options and roll-table rows for authored copy', () => {
    const parsed = effectDtoSchema.parse({
      id: 'choice-copy-effect',
      order: 1,
      invocation: {
        triggerCode: 'SPELL_ATTACK',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'choice-copy-range',
          rangeKind: 'DISTANCE',
          amount: 30,
          unit: 'FEET'
        }
      },
      paths: [
        choicePath('choice-copy-direct', 1, 'ON_HIT', [
          {
            id: 'choice-copy-direct-option',
            order: 1,
            label: 'Primary Result',
            description: 'The main outcome when the effect resolves.',
            resultBlock: singleResultBlock('choice-copy-direct-result', {
              id: 'choice-copy-direct-entry',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 10
            })
          }
        ]),
        exactRollTablePath('choice-copy-roll', 2, 'ON_HIT', [
          {
            id: 'choice-copy-roll-entry',
            order: 1,
            rollValue: 1,
            resolutionKind: 'RESULT',
            resultBlock: singleResultBlock('choice-copy-roll-result', {
              id: 'choice-copy-roll-outcome',
              effectKind: 'MANUAL_ADJUDICATION',
              label: 'Primary Result',
              instructions: 'Resolve the selected table result.',
              reasonCode: 'NARRATIVE_JUDGMENT'
            })
          }
        ])
      ]
    }) as unknown as ParsedEffectForAssertions

    expect(parsed.paths[0]?.options?.[0]).toMatchObject({
      label: 'Primary Result',
      description: 'The main outcome when the effect resolves.'
    })

    expect(parsed.paths[1]?.rows?.[0]).not.toHaveProperty('label')
    expect(parsed.paths[1]?.rows?.[0]).not.toHaveProperty('description')
  })

  it('parses non-damage outcome families such as apply-grant and rule fallbacks', () => {
    const parsed = effectDtoSchema.parse({
      id: 'shield-effect',
      order: 1,
      invocation: {
        triggerCode: 'SPELL_ATTACK',
        activation: {
          code: 'REACTION',
          amount: 1
        },
        range: {
          id: 'shield-range',
          rangeKind: 'SELF'
        }
      },
      paths: [
        fixedPath(
          'shield-grant',
          1,
          'ON_CAST',
          singleResultBlock('shield-grant-result', {
            id: 'shield-grant-entry',
            effectKind: 'APPLY_GRANT',
            grants: {
              modifiers: [
                {
                  grantKind: 'MODIFIER_GRANT',
                  id: 'shield-ac-bonus',
                  order: 1,
                  selectionKind: 'GRANTED',
                  valueDomainCode: 'ARMOR_CLASS',
                  modifierKind: 'BONUS',
                  scope: 'GLOBAL',
                  payload: {
                    valueKind: 'FIXED',
                    amount: 5
                  }
                }
              ]
            }
          })
        ),
        fixedPath(
          'shield-rule',
          2,
          'ON_CAST',
          singleResultBlock('shield-rule-result', {
            id: 'shield-rule-entry',
            effectKind: 'MANUAL_ADJUDICATION',
            label: 'Shield rule fallback',
            instructions: 'Resolve the shield rule that is not represented by the typed grant.',
            reasonCode: 'NARRATIVE_JUDGMENT'
          })
        )
      ]
    }) as unknown as ParsedEffectForAssertions

    expect(parsed.paths).toHaveLength(2)
  })

  it('parses result-block lifecycle metadata and sequential outcomes', () => {
    const parsed = effectDtoSchema.parse({
      id: 'dissonant-whispers-effect',
      order: 1,
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'wis-save',
          dcMethod: 'FIXED_DC',
          ability: 'WISDOM',
          baseDc: 14
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'dw-range',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        }
      },
      paths: [
        fixedPath(
          'dw-sequence',
          1,
          'ON_SAVE_FAIL',
          sequenceResultBlock(
            'dw-sequence-result',
            [
              {
                id: 'dw-damage-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'psychic',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '3d6'
              },
              {
                id: 'dw-move-entry',
                effectKind: 'FORCED_MOVEMENT',
                direction: 'AWAY_FROM_SOURCE',
                distanceMode: 'UP_TO_SPEED',
                actionEconomy: 'REACTION'
              }
            ],
            {
              lifecycle: {
                recurringKind: 'NONE',
                consumeOnFirstEvent: 'ON_ATTACK_ROLL',
                endOnEvents: ['ON_CAST_SPELL']
              }
            }
          )
        )
      ]
    }) as {
      paths?: Array<{
        resultBlock?: {
          outcomes?: Array<{
            effectKind?: string
          }>
          lifecycle?: { consumeOnFirstEvent?: string }
        }
      }>
    }

    expect(parsed.paths?.[0]?.resultBlock).toMatchObject({
      outcomes: [{ effectKind: 'DAMAGE' }, { effectKind: 'FORCED_MOVEMENT' }],
      lifecycle: { consumeOnFirstEvent: 'ON_ATTACK_ROLL' }
    }) as unknown as ParsedEffectForAssertions
  })

  it('parses activated feature-style effects with on-use healing bonuses', () => {
    const parsed = effectDtoSchema.parse({
      id: 'second-wind-effect',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'BONUS_ACTION',
          amount: 1
        },
        range: {
          id: 'second-wind-range',
          rangeKind: 'SELF'
        },
        targeting: {
          selectionKind: 'SELF'
        }
      },
      paths: [
        fixedPath(
          'second-wind-heal',
          1,
          'ON_USE',
          singleResultBlock('second-wind-result', {
            id: 'second-wind-heal-entry',
            effectKind: 'HEAL',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            diceConfig: '1d10',
            bonuses: [
              {
                id: 'second-wind-fighter-level',
                bonusKind: 'CLASS_LEVEL',
                classId: 'fighter',
                order: 1
              }
            ]
          })
        )
      ]
    }) as {
      paths?: Array<{
        pathCode?: string
        resultBlock?: {
          outcomes?: Array<{
            bonuses?: Array<{ bonusKind?: string; classId?: string }>
          }>
        }
      }>
    }

    expect(parsed.paths?.[0]?.pathCode).toBe('ON_USE')
    expect(parsed.paths?.[0]?.resultBlock?.outcomes?.[0]?.bonuses?.[0]).toMatchObject({
      bonusKind: 'CLASS_LEVEL',
      classId: 'fighter'
    })
  })

  it('parses long-cast spell effects with separate activation and casting time layers', () => {
    const parsed = spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'find-familiar',
      label: 'Find Familiar',
      description: 'You gain the service of a familiar.',
      castingTime: {
        unit: 'HOUR',
        amount: 1
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'conjuration',
      attributes: ['RITUAL'],
      components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
      effects: [
        {
          id: 'find-familiar-effect',
          order: 1,
          invocation: {
            triggerCode: 'ACTIVATED',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'find-familiar-range',
              rangeKind: 'DISTANCE',
              amount: 10,
              unit: 'FEET'
            },
            targeting: {
              selectionKind: 'AREA_CONTENTS'
            }
          },
          paths: [
            fixedPath(
              'find-familiar-path',
              1,
              'ON_USE',
              singleResultBlock(
                'find-familiar-result',
                {
                  id: 'find-familiar-entry',
                  effectKind: 'MANIFEST',
                  manifestKind: 'CREATURE'
                },
                {
                  duration: {
                    id: 'find-familiar-duration',
                    durationKind: 'UNTIL_DISPELLED'
                  }
                }
              )
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      effects?: Array<{
        invocation?: { activation?: { code?: string; amount?: number } }
        paths?: Array<{
          resultBlock?: { outcomes?: Array<{ effectKind?: string; manifestKind?: string }> }
        }>
      }>
    }

    expect(parsed.effects?.[0]?.invocation?.activation).toMatchObject({
      code: 'ACTION',
      amount: 1
    })
    expect((parsed as { components?: string[] }).components).toEqual([
      'VERBAL',
      'SOMATIC',
      'MATERIAL'
    ])
    expect(parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]).toMatchObject({
      effectKind: 'MANIFEST',
      manifestKind: 'CREATURE'
    })
  })

  it('parses manifest-owned nested behaviors when they use non-manifest outcomes', () => {
    const parsed = spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'arcane-sword',
      label: 'Arcane Sword',
      description: 'You create a sword-shaped plane of force.',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 7,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'arcane-sword-effect',
          order: 1,
          invocation: {
            triggerCode: 'ACTIVATED',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'arcane-sword-range',
              rangeKind: 'DISTANCE',
              amount: 60,
              unit: 'FEET'
            }
          },
          paths: [
            fixedPath(
              'arcane-sword-path',
              1,
              'ON_USE',
              singleResultBlock('arcane-sword-result', {
                id: 'arcane-sword-manifest',
                effectKind: 'MANIFEST',
                manifestKind: 'WEAPON',
                behaviors: [
                  {
                    id: 'arcane-sword-attack',
                    order: 1,
                    invocation: {
                      triggerCode: 'SPELL_ATTACK',
                      activation: {
                        code: 'BONUS_ACTION',
                        amount: 1
                      },
                      range: {
                        id: 'arcane-sword-attack-range',
                        rangeKind: 'DISTANCE',
                        amount: 5,
                        unit: 'FEET'
                      }
                    },
                    paths: [
                      fixedPath(
                        'arcane-sword-hit',
                        1,
                        'ON_HIT',
                        singleResultBlock('arcane-sword-hit-result', {
                          id: 'arcane-sword-damage',
                          effectKind: 'DAMAGE',
                          damageTypeId: 'force',
                          valueKind: 'DICE',
                          scalingKind: 'NONE',
                          diceConfig: '3d10'
                        })
                      )
                    ]
                  }
                ]
              })
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      effects?: Array<{
        paths?: Array<{
          resultBlock?: {
            outcomes?: Array<{
              behaviors?: Array<{
                paths?: Array<{
                  resultBlock?: { outcomes?: Array<{ effectKind?: string }> }
                }>
              }>
            }>
          }
        }>
      }>
    }

    expect(
      parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]?.behaviors?.[0]?.paths?.[0]
        ?.resultBlock?.outcomes?.[0]
    ).toMatchObject({
      effectKind: 'DAMAGE'
    })
  })

  it('rejects manifest-owned nested behaviors that try to manifest again', () => {
    expect(() =>
      spellAuthoredDtoSchema.parse({
        kind: 'SPELL',
        id: 'bad-nested-manifest',
        label: 'Bad Nested Manifest',
        description: 'A recursive manifest payload.',
        castingTime: {
          unit: 'ROUND',
          amount: 1
        },
        level: 4,
        classIds: ['wizard'],
        magicSchoolId: 'conjuration',
        effects: [
          {
            id: 'outer-effect',
            order: 1,
            invocation: {
              triggerCode: 'ACTIVATED',
              activation: {
                code: 'ACTION',
                amount: 1
              },
              range: {
                id: 'outer-range',
                rangeKind: 'DISTANCE',
                amount: 30,
                unit: 'FEET'
              }
            },
            paths: [
              fixedPath(
                'outer-path',
                1,
                'ON_USE',
                singleResultBlock('outer-result', {
                  id: 'outer-manifest',
                  effectKind: 'MANIFEST',
                  manifestKind: 'SUMMON',
                  behaviors: [
                    {
                      id: 'nested-effect',
                      order: 1,
                      invocation: {
                        triggerCode: 'ACTIVATED',
                        activation: {
                          code: 'ACTION',
                          amount: 1
                        },
                        range: {
                          id: 'nested-range',
                          rangeKind: 'SELF'
                        }
                      },
                      paths: [
                        fixedPath(
                          'nested-path',
                          1,
                          'ON_USE',
                          singleResultBlock('nested-result', {
                            id: 'recursive-manifest',
                            effectKind: 'MANIFEST',
                            manifestKind: 'OBJECT'
                          })
                        )
                      ]
                    }
                  ]
                })
              )
            ]
          }
        ],
        userId: 'user-1',
        systemId: 'system-1'
      })
    ).toThrow()
  })

  it('strips roll-table row labels and descriptions', () => {
    const parsed = effectDtoSchema.parse({
      id: 'bad-roll-table-metadata',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'bad-roll-range',
          rangeKind: 'DISTANCE',
          amount: 30,
          unit: 'FEET'
        }
      },
      paths: [
        exactRollTablePath('bad-roll-path', 1, 'ON_USE', [
          {
            id: 'bad-roll-entry',
            order: 1,
            label: 'Should fail',
            description: 'Roll tables should not use entry metadata.',
            rollValue: 1,
            resolutionKind: 'RESULT',
            resultBlock: singleResultBlock('bad-roll-result', {
              id: 'bad-roll-outcome',
              effectKind: 'MANUAL_ADJUDICATION',
              label: 'Rolled result',
              instructions: 'Resolve the rolled result.',
              reasonCode: 'NARRATIVE_JUDGMENT'
            })
          }
        ])
      ]
    })

    const row = (parsed as unknown as ParsedEffectForAssertions).paths[0].rows?.[0]

    expect(row).not.toHaveProperty('label')
    expect(row).not.toHaveProperty('description')
  })

  it('strips creature manifest inline behaviors', () => {
    const parsed = effectDtoSchema.parse({
      id: 'bad-creature-manifest',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'bad-creature-range',
          rangeKind: 'DISTANCE',
          amount: 10,
          unit: 'FEET'
        }
      },
      paths: [
        fixedPath(
          'bad-creature-path',
          1,
          'ON_USE',
          singleResultBlock('bad-creature-result', {
            id: 'bad-creature-entry',
            effectKind: 'MANIFEST',
            manifestKind: 'CREATURE',
            creatureId: 'owl',
            behaviors: []
          })
        )
      ]
    })

    const outcome = (parsed as unknown as ParsedEffectForAssertions).paths[0].resultBlock
      ?.outcomes?.[0]

    expect(outcome).toMatchObject({
      manifestKind: 'CREATURE',
      creatureId: 'owl'
    })
    expect(outcome).not.toHaveProperty('behaviors')
  })

  it('parses summon manifests with authored stat block data', () => {
    const parsed = effectDtoSchema.parse({
      id: 'summon-manifest',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'summon-range',
          rangeKind: 'DISTANCE',
          amount: 120,
          unit: 'FEET'
        }
      },
      paths: [
        fixedPath(
          'summon-path',
          1,
          'ON_USE',
          singleResultBlock('summon-result', {
            id: 'summon-entry',
            effectKind: 'MANIFEST',
            manifestKind: 'SUMMON',
            statBlock: {
              size: 'LARGE',
              armorClass: {
                kind: 'FIXED',
                value: 20
              },
              hitPoints: {
                kind: 'HIT_POINT_MAXIMUM'
              },
              speeds: [
                {
                  speedId: 'arcane-hand-speed',
                  amount: 60,
                  unit: 'FEET'
                }
              ],
              abilityScores: {
                STRENGTH: {
                  kind: 'FIXED',
                  value: 26
                }
              },
              damageabilityKind: 'INVULNERABLE',
              occupiesSpace: true
            }
          })
        )
      ]
    })

    expect(
      (parsed as unknown as ParsedEffectForAssertions).paths[0].resultBlock?.outcomes?.[0]
    ).toMatchObject({
      manifestKind: 'SUMMON',
      statBlock: {
        size: 'LARGE',
        armorClass: {
          kind: 'FIXED',
          value: 20
        },
        hitPoints: {
          kind: 'HIT_POINT_MAXIMUM'
        },
        speeds: [
          {
            speedId: 'arcane-hand-speed',
            amount: 60,
            unit: 'FEET'
          }
        ],
        abilityScores: {
          STRENGTH: {
            kind: 'FIXED',
            value: 26
          }
        },
        damageabilityKind: 'INVULNERABLE',
        occupiesSpace: true
      }
    })
  })

  it('parses features with nested grant groups and options', () => {
    const parsed = featureDtoSchema.parse({
      id: 'fighting-style',
      label: 'Fighting Style',
      description: 'Choose a style.',
      section: 'TRAIT',
      details: [
        {
          id: 'fighting-style-detail',
          label: 'Detail',
          description: 'Choose one of the following options.',
          order: 1
        }
      ],
      order: 1,
      grants: {
        feats: [
          {
            grantKind: 'FEAT_GRANT',
            id: 'style-choice',
            order: 1,
            selectionKind: 'CHOSEN',
            scalingKind: 'NONE',
            count: 1,
            selectionDuplicatePolicy: 'UNIQUE',
            featIds: ['archery']
          }
        ]
      },
      options: [
        {
          id: 'archery-option',
          label: 'Archery',
          description: 'Gain a ranged accuracy bonus.',
          order: 1
        }
      ]
    })

    expect(parsed.grants?.feats?.[0]?.grantKind).toBe('FEAT_GRANT')
    expect(parsed.section).toBe('TRAIT')
    expect(parsed.details?.[0]?.label).toBe('Detail')
    expect(parsed.options?.[0]?.label).toBe('Archery')
  })

  it('rejects legacy singular feature detail fields', () => {
    expect(() =>
      featureDtoSchema.parse({
        id: 'legacy-feature',
        label: 'Legacy Feature',
        description: 'Old shape.',
        detail: 'Old prose.',
        order: 1
      })
    ).toThrow()
  })

  it('parses recursive facet restrictions with predicate and exists conditions', () => {
    const parsed = facetDtoSchema.parse({
      id: 'fighter-style-restriction',
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: 'condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'CLASS_LEVEL',
                  classIds: ['fighter'],
                  min: 1
                },
                {
                  id: 'condition-2',
                  order: 2,
                  kind: 'EXISTS',
                  constraint: 'INCLUDE',
                  relationCode: 'FEATURE',
                  authoringModeKind: 'SELECTED',
                  featureIds: ['fighting-style'],
                  where: {
                    authoringModeKind: 'ALL',
                    groups: [
                      {
                        id: 'body-group-1',
                        order: 1,
                        conditions: [
                          {
                            id: 'nested-condition-1',
                            order: 1,
                            kind: 'PREDICATE',
                            constraint: 'INCLUDE',
                            predicateCode: 'FEATURE_OBTAINED',
                            featureIds: ['fighting-style']
                          }
                        ]
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    })

    expect(parsed.groups).toHaveLength(1)
  })

  it('parses explicit ALL facet authoring mode', () => {
    const parsed = facetDtoSchema.parse({
      id: 'explicit-all-facet',
      authoringModeKind: 'ALL',
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject: 'SPELL',
              conditions: [
                {
                  id: 'condition-1',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'SPELL_LEVEL',
                  min: 1
                }
              ]
            }
          ]
        }
      ]
    })

    expect(parsed.groups).toHaveLength(1)
  })

  it('parses correlated modifier grants for parameterized domains', () => {
    const parsed = modifierGrantDtoSchema.parse({
      grantKind: 'MODIFIER_GRANT',
      id: 'spell-attack-bonus',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL',
      domain: {
        attackDomain: 'SPELL'
      },
      modifierKind: 'ABILITY_MODIFIER_BONUS',
      scope: 'GLOBAL',
      payload: {
        ability: 'INTELLIGENCE',
        multiplier: 1
      }
    })

    expect(parsed.valueDomainCode).toBe('ATTACK_ROLL')
    expect((parsed as { domain: { attackDomain: string } }).domain.attackDomain).toBe('SPELL')
  })

  it('rejects chosen modifier grants without a target-binding model', () => {
    expect(() =>
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'chosen-ability-score-increase',
        order: 1,
        selectionKind: 'CHOSEN',
        count: 2,
        selectionDuplicatePolicy: 'UNIQUE',
        valueDomainCode: 'ABILITY_SCORE',
        domain: { ability: 'STRENGTH' },
        modifierKind: 'BONUS',
        scope: 'GLOBAL',
        payload: { valueKind: 'FIXED', amount: 1 }
      })
    ).toThrow()
  })

  it('parses attack roll advantage modifiers without payloads', () => {
    const parsed = modifierGrantDtoSchema.parse({
      grantKind: 'MODIFIER_GRANT',
      id: 'heavy-weapon-disadvantage',
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ATTACK_ROLL',
      domain: {
        attackDomain: 'MELEE'
      },
      modifierKind: 'DISADVANTAGE',
      scope: 'SOURCE'
    })

    expect(parsed.valueDomainCode).toBe('ATTACK_ROLL')
    expect(parsed.modifierKind).toBe('DISADVANTAGE')
  })

  it('parses ability-check and skill-check roll modes without payloads', () => {
    expect(
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'global-check-advantage',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'ABILITY_CHECK',
        domain: {},
        modifierKind: 'ADVANTAGE',
        scope: 'GLOBAL'
      }).valueDomainCode
    ).toBe('ABILITY_CHECK')

    expect(
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'athletics-disadvantage',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'SKILL_MODIFIER',
        domain: { skillId: 'skill-athletics' },
        modifierKind: 'DISADVANTAGE',
        scope: 'GLOBAL'
      }).modifierKind
    ).toBe('DISADVANTAGE')
  })

  it('parses explicit ALL grant authoring mode', () => {
    const parsed = featGrantDtoSchema.parse({
      grantKind: 'FEAT_GRANT',
      id: 'explicit-all-bonus-feat',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL'
    })

    expect(parsed.id).toBe('explicit-all-bonus-feat')
  })

  it('rejects selected grant targets that omit their required ids', () => {
    expect(() =>
      featGrantDtoSchema.parse({
        grantKind: 'FEAT_GRANT',
        id: 'bad-selected-feat-grant',
        order: 1,
        selectionKind: 'GRANTED',
        scalingKind: 'NONE',
        authoringModeKind: 'SELECTED'
      })
    ).toThrow()
  })

  it('parses explicit ALL proficiency authoring mode', () => {
    const parsed = proficiencyGrantDtoSchema.parse({
      grantKind: 'PROFICIENCY_GRANT',
      id: 'all-skill-proficiency',
      order: 1,
      proficiencyKind: 'SKILL',
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      level: 'FULL',
      authoringModeKind: 'ALL'
    })

    expect(parsed.id).toBe('all-skill-proficiency')
  })

  it('rejects selected proficiency targets that omit their required payload ids', () => {
    expect(() =>
      proficiencyGrantDtoSchema.parse({
        grantKind: 'PROFICIENCY_GRANT',
        id: 'bad-selected-proficiency',
        order: 1,
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        level: 'FULL',
        authoringModeKind: 'SELECTED'
      })
    ).toThrow()
  })

  it('rejects modifier payloads that do not match the selected domain', () => {
    expect(() =>
      modifierGrantDtoSchema.parse({
        grantKind: 'MODIFIER_GRANT',
        id: 'bad-modifier',
        order: 1,
        selectionKind: 'GRANTED',
        valueDomainCode: 'ATTACK_ROLL',
        domain: {
          ability: 'INTELLIGENCE'
        },
        modifierKind: 'BONUS',
        scope: 'GLOBAL',
        payload: {
          valueKind: 'FIXED',
          amount: 2
        }
      })
    ).toThrow()
  })

  it('requires duplicate policy only for chosen grant targets', () => {
    const cases = [
      {
        schema: proficiencyGrantDtoSchema,
        chosen: {
          grantKind: 'PROFICIENCY_GRANT',
          id: 'chosen-proficiency',
          order: 1,
          proficiencyKind: 'SKILL',
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          count: 2,
          level: 'FULL',
          authoringModeKind: 'SELECTED',
          skillIds: ['acrobatics', 'arcana']
        },
        granted: {
          grantKind: 'PROFICIENCY_GRANT',
          id: 'granted-proficiency',
          order: 1,
          proficiencyKind: 'SKILL',
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          level: 'FULL',
          authoringModeKind: 'SELECTED',
          skillIds: ['acrobatics']
        }
      },
      {
        schema: spellGrantDtoSchema,
        chosen: {
          grantKind: 'SPELL_GRANT',
          id: 'chosen-spell',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          count: 1,
          authoringModeKind: 'SELECTED',
          spellIds: ['fire-bolt']
        },
        granted: {
          grantKind: 'SPELL_GRANT',
          id: 'granted-spell',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          spellIds: ['fire-bolt']
        }
      },
      {
        schema: featGrantDtoSchema,
        chosen: {
          grantKind: 'FEAT_GRANT',
          id: 'chosen-feat',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          count: 1,
          authoringModeKind: 'SELECTED',
          featIds: ['archery']
        },
        granted: {
          grantKind: 'FEAT_GRANT',
          id: 'granted-feat',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          featIds: ['archery']
        }
      },
      {
        schema: senseGrantDtoSchema,
        chosen: {
          grantKind: 'SENSE_GRANT',
          id: 'chosen-sense',
          order: 1,
          selectionKind: 'CHOSEN',
          scalingKind: 'NONE',
          count: 1,
          authoringModeKind: 'SELECTED',
          senseIds: ['darkvision']
        },
        granted: {
          grantKind: 'SENSE_GRANT',
          id: 'granted-sense',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'SELECTED',
          senseIds: ['darkvision']
        }
      }
    ] as const

    for (const { schema, chosen, granted } of cases) {
      expect(schema.safeParse(chosen).success).toBe(false)

      const uniqueParse = schema.safeParse({
        ...chosen,
        selectionDuplicatePolicy: 'UNIQUE'
      })
      expect(uniqueParse.success).toBe(true)
      expect(uniqueParse.success ? uniqueParse.data.selectionDuplicatePolicy : undefined).toBe(
        'UNIQUE'
      )

      const repeatableParse = schema.safeParse({
        ...chosen,
        selectionDuplicatePolicy: 'REPEATABLE'
      })
      expect(repeatableParse.success).toBe(true)
      expect(
        repeatableParse.success ? repeatableParse.data.selectionDuplicatePolicy : undefined
      ).toBe('REPEATABLE')

      expect(
        schema.safeParse({
          ...granted,
          selectionDuplicatePolicy: 'UNIQUE'
        }).success
      ).toBe(false)
    }
  })

  it('keeps duplicate policy on chosen per-level grant progression entries', () => {
    const parsed = spellGrantDtoSchema.parse({
      grantKind: 'SPELL_GRANT',
      id: 'per-level-spell',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CHARACTER_LEVEL',
        levels: [
          {
            id: 'per-level-spell-1',
            level: 3,
            order: 1,
            authoringModeKind: 'SELECTED',
            count: 1,
            selectionDuplicatePolicy: 'UNIQUE',
            spellIds: ['misty-step']
          }
        ]
      }
    })

    expect(
      (parsed as { progression?: { levels: Array<{ selectionDuplicatePolicy?: string }> } })
        .progression?.levels[0]?.selectionDuplicatePolicy
    ).toBe('UNIQUE')
    expect(
      spellGrantDtoSchema.safeParse({
        ...parsed,
        selectionDuplicatePolicy: 'UNIQUE'
      }).success
    ).toBe(false)
  })

  it('rejects invalid facet predicate payloads once predicate correlation is enforced', () => {
    expect(() =>
      facetDtoSchema.parse({
        id: 'bad-facet',
        groups: [
          {
            id: 'group-1',
            order: 1,
            contexts: [
              {
                id: 'context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'SPELL_LEVEL'
                  }
                ]
              }
            ]
          }
        ]
      })
    ).toThrow()
  })

  it('parses starting equipment item unions with selected equipment choices', () => {
    const parsed = startingEquipmentDtoSchema.parse({
      id: 'fighter-start',
      sets: [
        {
          id: 'fighter-set',
          order: 1,
          groups: [
            {
              id: 'fighter-group',
              order: 1,
              options: [
                {
                  id: 'fighter-option',
                  order: 1,
                  eligibility: {
                    id: 'fighter-option-eligibility',
                    groups: [
                      {
                        id: 'fighter-option-eligibility-group',
                        order: 1,
                        contexts: [
                          {
                            id: 'fighter-option-eligibility-context',
                            order: 1,
                            subject: 'CHARACTER',
                            conditions: [
                              {
                                id: 'fighter-option-eligibility-condition',
                                order: 1,
                                kind: 'PREDICATE',
                                constraint: 'INCLUDE',
                                predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
                                authoringModeKind: 'SELECTED',
                                category: 'ARMOR',
                                properties: ['HEAVY']
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  items: [
                    {
                      id: 'martial-weapon-choice',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      category: 'WEAPON',
                      selectionKind: 'CHOSEN',
                      count: 1,
                      authoringModeKind: 'SELECTED',
                      equipmentIds: ['longsword', 'battleaxe']
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })

    expect(parsed.sets[0]?.groups[0]?.options[0]?.items[0]?.startingEquipmentKind).toBe('EQUIPMENT')
    expect(
      parsed.sets[0]?.groups[0]?.options[0]?.eligibility?.groups[0]?.contexts[0]?.conditions?.[0]
    ).toMatchObject({
      predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
      category: 'ARMOR',
      properties: ['HEAVY']
    })
  })

  it('rejects non-character eligibility facets on starting equipment options', () => {
    const result = startingEquipmentDtoSchema.safeParse({
      id: 'invalid-starting-equipment',
      sets: [
        {
          id: 'invalid-set',
          order: 1,
          groups: [
            {
              id: 'invalid-group',
              order: 1,
              options: [
                {
                  id: 'invalid-option',
                  order: 1,
                  eligibility: {
                    id: 'invalid-eligibility',
                    groups: [
                      {
                        id: 'invalid-eligibility-group',
                        order: 1,
                        contexts: [
                          {
                            id: 'invalid-eligibility-context',
                            order: 1,
                            subject: 'CREATURE'
                          }
                        ]
                      }
                    ]
                  },
                  items: []
                }
              ]
            }
          ]
        }
      ]
    })

    expect(result.success).toBe(false)
  })

  it('parses a base class with nested authored substructures', () => {
    const parsed = classAuthoredDtoSchema.parse({
      id: 'wizard',
      category: 'BASE',
      label: 'Wizard',
      subclassSelectionLevel: 2,
      description: 'A scholarly spellcaster.',
      details: [
        {
          id: 'wizard-detail',
          label: 'Arcane Study',
          description: 'You study magic.',
          order: 1
        }
      ],
      proficiencies: [
        {
          grantKind: 'PROFICIENCY_GRANT',
          id: 'wizard-saves',
          order: 1,
          proficiencyKind: 'SAVE_ABILITY',
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          level: 'FULL',
          abilities: ['INTELLIGENCE', 'WISDOM'],
          authoringModeKind: 'SELECTED'
        }
      ],
      spellcasting: {
        availableSpellIds: ['spell-fire-bolt', 'spell-magic-missile'],
        spellLimits: [
          {
            classLevel: 1,
            slots: [{ spellLevel: 1, slotCount: 2 }]
          }
        ],
        details: [
          {
            id: 'wizard-spellcasting-detail',
            label: 'Spellbook',
            description: 'Your spellbook contains wizard spells.',
            order: 1
          }
        ],
        maxSpellLevel: 9,
        charges: {
          id: 'wizard-casting-charge',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1
        }
      },
      features: [
        {
          id: 'arcane-recovery',
          label: 'Arcane Recovery',
          description: 'Recover spell energy.',
          order: 1
        }
      ],
      userId: 'user-1',
      systemId: 'system-1',
      startingGold: {
        multiplier: 4,
        currencyId: 'gp',
        dieConfig: '4d4'
      },
      startingEquipment: {
        id: 'wizard-start',
        sets: []
      },
      hitpoint: {
        ability: 'CONSTITUTION',
        dieConfig: '1d6'
      },
      multiclass: {
        id: 'wizard-multiclass',
        requirementGroups: {
          groups: [
            {
              id: 'wizard-req-group',
              requirements: [{ id: 'int-req', ability: 'INTELLIGENCE', min: 13 }]
            }
          ]
        }
      }
    }) as {
      category?: string
      subclassSelectionLevel?: number
      features?: Array<{ id?: string }>
      spellcasting?: { availableSpellIds?: string[]; details?: Array<{ label?: string }> }
    }

    expect(parsed.category).toBe('BASE')
    expect(parsed.subclassSelectionLevel).toBe(2)
    expect(parsed.features?.[0]?.id).toBe('arcane-recovery')
    expect(parsed.spellcasting?.details?.[0]?.label).toBe('Spellbook')
    expect(parsed.spellcasting?.availableSpellIds).toEqual([
      'spell-fire-bolt',
      'spell-magic-missile'
    ])
  })

  it('keeps class authoring attributes category-correct', () => {
    const input = {
      id: 'class-draft',
      label: 'Class Draft',
      systemId: 'system-1'
    }

    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'BASE',
        attributes: ['SPECIALIZATION']
      }).success
    ).toBe(false)

    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'SUBCLASS',
        attributes: ['SPECIALIZATION']
      }).success
    ).toBe(true)

    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'BASE',
        subclassSelectionLevel: 0
      }).success
    ).toBe(false)
    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'BASE',
        subclassSelectionLevel: 21
      }).success
    ).toBe(false)
    expect(
      classAuthoringInputDtoSchema.safeParse({
        ...input,
        category: 'SUBCLASS',
        subclassSelectionLevel: 3
      }).success
    ).toBe(false)
  })

  it('rejects unknown class preparation-limit codes', () => {
    expect(
      classPrepareLimitDtoSchema.safeParse({
        methodKinds: ['CLASS_LEVEL'],
        scaling: 'HALF',
        rounding: 'DOWN'
      }).success
    ).toBe(true)

    expect(
      classPrepareLimitDtoSchema.safeParse({
        methodKinds: ['UNKNOWN']
      }).success
    ).toBe(false)
    expect(
      classPrepareLimitDtoSchema.safeParse({
        methodKinds: ['CLASS_LEVEL'],
        scaling: 'UNKNOWN'
      }).success
    ).toBe(false)
    expect(
      classPrepareLimitDtoSchema.safeParse({
        methodKinds: ['CLASS_LEVEL'],
        rounding: 'UNKNOWN'
      }).success
    ).toBe(false)
  })

  it('parses a spell with effect-owned range/shape and structured scaling', () => {
    const parsed = spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'burning-hands',
      label: 'Burning Hands',
      description: 'Each creature in a 15-foot cone must make a Dexterity saving throw.',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard', 'sorcerer'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'burning-hands-effect',
          order: 1,
          invocation: {
            triggerCode: 'SAVING_THROW',
            savingThrow: {
              id: 'burning-hands-save',
              dcMethod: 'SOURCE_SAVE_DC',
              ability: 'DEXTERITY'
            },
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'burning-hands-effect-range',
              rangeKind: 'SELF'
            },
            targeting: {
              selectionKind: 'AREA_CONTENTS'
            },
            shape: {
              id: 'burning-hands-cone',
              shapeKind: 'CONE',
              length: {
                amount: 15,
                unit: 'FEET'
              }
            }
          },
          paths: [
            fixedPath(
              'burning-hands-damage',
              1,
              'ON_SAVE_FAIL',
              singleResultBlock('burning-hands-result', {
                id: 'burning-hands-damage-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'fire',
                valueKind: 'DICE',
                scalingKind: 'PER_LEVEL',
                scalingSource: 'SPELL_CAST_LEVEL',
                levels: [
                  {
                    id: 'burning-hands-level-1',
                    level: 1,
                    order: 1,
                    diceConfig: '3d6'
                  },
                  {
                    id: 'burning-hands-level-2',
                    level: 2,
                    order: 2,
                    diceConfig: '4d6'
                  }
                ]
              })
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      effects?: Array<{
        invocation: {
          range: { rangeKind: string }
          targeting?: { selectionKind?: string }
        }
        paths?: Array<{ resultBlock?: { outcomes?: Array<Record<string, unknown>> } }>
      }>
    }

    expect(parsed.effects?.[0]?.invocation.range.rangeKind).toBe('SELF')
    expect(parsed.effects?.[0]?.invocation.targeting?.selectionKind).toBe('AREA_CONTENTS')
    expect(parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]).toMatchObject({
      scalingKind: 'PER_LEVEL',
      scalingSource: 'SPELL_CAST_LEVEL'
    })
  })

  it('parses richer invocation targeting qualifiers for multi-target effects', () => {
    const parsed = effectDtoSchema.parse({
      id: 'mass-cure-wounds-effect',
      order: 1,
      invocation: {
        triggerCode: 'SPELL_ATTACK',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'mass-cure-wounds-range',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        },
        shape: {
          id: 'mass-cure-wounds-shape',
          shapeKind: 'SPHERE',
          radius: {
            amount: 30,
            unit: 'FEET'
          }
        },
        targeting: {
          selectionKind: 'CHOSEN_CREATURES',
          maxTargets: 6,
          excludedCreatureTypeIds: ['undead', 'construct']
        }
      },
      paths: [
        fixedPath(
          'mass-cure-wounds-heal',
          1,
          'ON_CAST',
          singleResultBlock('mass-cure-wounds-result', {
            id: 'mass-cure-wounds-heal-entry',
            effectKind: 'HEAL',
            valueKind: 'DICE',
            scalingKind: 'PER_LEVEL',
            scalingSource: 'SPELL_CAST_LEVEL',
            levels: [
              {
                id: 'mass-cure-wounds-level-5',
                level: 5,
                order: 1,
                diceConfig: '3d8'
              }
            ]
          })
        )
      ]
    }) as {
      invocation?: {
        targeting?: {
          selectionKind?: string
          maxTargets?: number
          excludedCreatureTypeIds?: string[]
        }
      }
    }

    expect(parsed.invocation?.targeting).toMatchObject({
      selectionKind: 'CHOSEN_CREATURES',
      maxTargets: 6,
      excludedCreatureTypeIds: ['undead', 'construct']
    })
  })

  it('rejects legacy placeholder values once nested enums are tightened', () => {
    expect(() =>
      effectDtoSchema.parse({
        id: 'bad-effect',
        order: 1,
        invocation: {
          triggerCode: 'SAVING_THROW',
          savingThrow: {
            id: 'dex-save',
            dcMethod: 'FIXED_DC',
            ability: 'DEXTERITY',
            baseDc: 13
          },
          activation: {
            code: 'ACTION',
            amount: 1
          },
          range: {
            id: 'self-range',
            rangeKind: 'SELF'
          }
        },
        paths: [
          fixedPath(
            'bad-moment',
            1,
            'IMMEDIATE',
            singleResultBlock('bad-result', {
              id: 'bad-moment-entry',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'DICE',
              scalingKind: 'NONE',
              diceConfig: '3d6'
            })
          )
        ]
      })
    ).toThrow()
  })

  it('parses system vocabulary payloads and transport wrappers', () => {
    const system = systemAuthoredDtoSchema.parse({
      id: 'dnd-5e-srd',
      label: 'D&D 5e SRD',
      description: 'Baseline SRD system data.',
      rulesetCode: 'dnd5e',
      rulesetVersion: '2014',
      alignments: [],
      challengeRatings: [],
      conditionTypes: [],
      creatureTypes: [],
      currencies: [],
      damageTypes: [],
      heritages: [],
      languages: [],
      lifestyles: [],
      magicSchools: [],
      passives: [],
      rarities: [],
      senses: [],
      skills: [],
      speeds: [],
      terrains: [],
      userId: 'master'
    })

    const list = systemListResponseDtoSchema.parse([
      {
        id: system.id,
        label: system.label,
        description: system.description,
        rulesetCode: system.rulesetCode,
        rulesetVersion: system.rulesetVersion,
        userId: system.userId
      }
    ]) as { label?: string }[]

    const params = resourceIdParamsDtoSchema.parse({ id: system.id })

    expect(list[0]?.label).toBe('D&D 5e SRD')
    expect(system.rulesetCode).toBe('dnd5e')
    expect(system.rulesetVersion).toBe('2014')
    expect(params.id).toBe(system.id)
  })

  it('parses feat prerequisites authored on CHARACTER facets', () => {
    const feat = featAuthoredDtoSchema.parse({
      id: 'feat-elven-accuracy',
      label: 'Elven Accuracy',
      description: 'You have uncanny aim.',
      prerequisites: {
        id: 'feat-prereq-1',
        groups: [
          {
            id: 'feat-prereq-group-1',
            order: 1,
            contexts: [
              {
                id: 'feat-prereq-context-1',
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: 'feat-prereq-condition-1',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'HERITAGE',
                    authoringModeKind: 'SELECTED',
                    heritageIds: ['heritage-elven']
                  }
                ]
              }
            ]
          }
        ]
      },
      userId: 'master',
      systemId: 'system-1'
    })

    expect(feat.prerequisites?.groups[0]?.contexts[0]?.conditions?.[0]).toMatchObject({
      predicateCode: 'HERITAGE',
      heritageIds: ['heritage-elven']
    })
  })

  it('parses feat grants authored directly on feats', () => {
    const feat = featAuthoredDtoSchema.parse({
      id: 'feat-chain',
      label: 'Feat Chain',
      description: 'Unlocks a related feat.',
      details: [
        {
          id: 'feat-chain-detail',
          label: 'Detail',
          description: 'Feat prose.',
          order: 1
        }
      ],
      grants: {
        feats: [
          {
            id: 'feat-grant-1',
            order: 1,
            grantKind: 'FEAT_GRANT',
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            featIds: ['grappler']
          }
        ]
      },
      userId: 'user-1',
      systemId: 'system-1'
    })

    expect(feat.grants?.feats?.[0]).toMatchObject({
      grantKind: 'FEAT_GRANT',
      featIds: ['grappler']
    })
    expect(feat.details?.[0]?.label).toBe('Detail')
    expect(() =>
      featAuthoredDtoSchema.parse({
        id: 'legacy-feat',
        label: 'Legacy Feat',
        description: 'Old shape.',
        detail: 'Old prose.',
        userId: 'user-1',
        systemId: 'system-1'
      })
    ).toThrow()
  })

  it('parses race heritage memberships', () => {
    const race = raceAuthoredDtoSchema.parse({
      id: 'race-half-elf',
      label: 'Half-Elf',
      description: 'Bridges two lineages.',
      heritageIds: ['heritage-human', 'heritage-elven'],
      userId: 'master',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: [
        {
          speedId: 'walk',
          amount: 30,
          unit: 'FEET'
        }
      ]
    })

    expect(race).toMatchObject({
      category: 'BASE',
      heritageIds: ['heritage-human', 'heritage-elven']
    })
  })

  it('parses category-driven creatures with category-specific profile data', () => {
    const creature = creatureAuthoredDtoSchema.parse({
      id: 'river-hart',
      label: 'River Hart',
      description: 'A sure-footed beast trained for river crossings.',
      quote: 'It lowers its antlers when the water rises.',
      status: 'ACTIVE',
      category: 'BEAST',
      creatureTypeId: 'beast',
      size: 'LARGE',
      userId: 'user-1',
      systemId: 'system-1',
      abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 14,
        CONSTITUTION: 15,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 7
      },
      armorClass: 12,
      hitPoints: 32,
      speeds: [{ speedId: 'walk', amount: 50, unit: 'FEET' }],
      features: [
        {
          id: 'gore',
          label: 'Gore',
          description: 'Melee weapon attack.',
          section: 'ACTION',
          order: 1
        }
      ],
      cost: { amount: 75, currencyId: 'gold' },
      carryingCapacity: { amount: 480, unit: 'POUNDS' },
      logisticsNotes: ['Can carry a rider and light travel gear.'],
      mountProfile: {
        mountType: 'CONTROLLED',
        riderCount: 1,
        notes: 'Trained for shallow river crossings.'
      }
    })

    expect(creature.category).toBe('BEAST')
    expect(creature.mountProfile?.riderCount).toBe(1)
    expect(creature.features?.[0]?.section).toBe('ACTION')
  })

  it('normalizes creature logistics-note editor rows to the canonical string array', () => {
    const creature = creatureAuthoredDtoSchema.parse({
      id: 'pack-hart',
      label: 'Pack Hart',
      category: 'BEAST',
      creatureTypeId: 'beast',
      size: 'LARGE',
      userId: 'user-1',
      systemId: 'system-1',
      abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 14,
        CONSTITUTION: 15,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 7
      },
      armorClass: 12,
      hitPoints: 32,
      speeds: [],
      logisticsNotes: [{ value: 'Can carry a rider.' }, 'Requires a saddle.']
    })

    expect(creature.logisticsNotes).toEqual(['Can carry a rider.', 'Requires a saddle.'])
  })

  it('parses authored content list and single-resource transport wrappers', () => {
    const list = backgroundListResponseDtoSchema.parse({
      items: [
        {
          id: 'acolyte',
          publicId: 'acolyte',
          activeUpdatedAt: '2026-01-01T00:00:00.000Z',
          label: 'Acolyte',
          description: 'Temple-trained background.',
          status: 'ACTIVE',
          userId: 'master',
          systemId: 'dnd-5e-srd',
          provenance: {
            kind: 'MASTER',
            ownerUserId: null
          },
          permissions: {
            canView: true,
            canEdit: false,
            canCopy: true,
            canDelete: false
          }
        }
      ],
      drafts: [],
      meta: {
        total: 1
      }
    }) as { items: { id?: string }[] }

    const spell = spellResponseDtoSchema.parse({
      publicId: 'magic-missile',
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      hasDraft: false,
      item: {
        kind: 'SPELL',
        id: 'magic-missile',
        label: 'Magic Missile',
        description: 'Force darts.',
        castingTime: {
          unit: 'ROUND',
          amount: 1
        },
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        userId: 'master',
        systemId: 'dnd-5e-srd'
      },
      provenance: {
        kind: 'MASTER',
        ownerUserId: null
      },
      permissions: {
        canView: true,
        canEdit: false,
        canCopy: true,
        canDelete: false
      }
    }) as { item?: { id?: string }; permissions?: { canEdit?: boolean } }

    const draftOnlySpell = spellResponseDtoSchema.parse({
      publicId: 'draft-spell',
      activeUpdatedAt: null,
      hasDraft: true,
      item: null,
      draft: {
        subjectKind: 'SPELL',
        subjectId: 'draft-spell-id',
        publicId: 'draft-spell',
        userId: 'user-1',
        systemId: 'dnd-5e-srd',
        label: 'Broken Draft Spell',
        status: 'DRAFT',
        draftState: 'DRAFT_ONLY',
        baseActiveUpdatedAt: null,
        payload: {}
      },
      provenance: {
        kind: 'OWNED',
        ownerUserId: 'user-1'
      },
      permissions: {
        canView: true,
        canEdit: true,
        canCopy: false,
        canDelete: true
      },
      validationIssues: [
        {
          code: 'invalid_type',
          message: 'Required input is missing',
          path: ['castingTime', 'unit']
        }
      ]
    }) as {
      item?: unknown
      draft?: { label?: string }
      validationIssues?: Array<{ path: Array<string | number> }>
    }

    expect(list.items[0]?.id).toBe('acolyte')
    expect(spell?.permissions?.canEdit).toBe(false)
    expect(draftOnlySpell?.item).toBeNull()
    expect(draftOnlySpell?.draft?.label).toBe('Broken Draft Spell')
    expect(draftOnlySpell?.validationIssues?.[0]?.path).toEqual(['castingTime', 'unit'])
  })

  it('parses equipment attunement and limits equipment requirements to character facets', () => {
    const equipment = {
      kind: 'EQUIPMENT',
      id: 'equipment-attuned',
      label: 'Attuned Item',
      description: null,
      rarityId: 'rare',
      userId: 'user-1',
      systemId: 'system-1',
      weight: { amount: 1, unit: 'POUNDS' },
      properties: [],
      category: 'ADVENTURING_GEAR',
      requiresAttunement: true,
      restrictions: {
        id: 'equipment-requirements',
        groups: [
          {
            id: 'equipment-requirement-group',
            order: 1,
            contexts: [
              {
                id: 'equipment-requirement-context',
                order: 1,
                subject: 'CHARACTER'
              }
            ]
          }
        ]
      }
    } as const

    expect(equipmentAuthoredDtoSchema.parse(equipment)).toMatchObject({
      requiresAttunement: true,
      restrictions: {
        groups: [{ contexts: [{ subject: 'CHARACTER' }] }]
      }
    })
    expect(() =>
      equipmentAuthoredDtoSchema.parse({
        ...equipment,
        restrictions: {
          ...equipment.restrictions,
          groups: [
            {
              ...equipment.restrictions.groups[0],
              contexts: [
                {
                  ...equipment.restrictions.groups[0].contexts[0],
                  subject: 'EQUIPMENT'
                }
              ]
            }
          ]
        }
      })
    ).toThrow()
    expect(() =>
      equipmentAuthoredDtoSchema.parse({
        ...equipment,
        restrictions: {
          ...equipment.restrictions,
          groups: [
            {
              ...equipment.restrictions.groups[0],
              contexts: [
                {
                  ...equipment.restrictions.groups[0].contexts[0],
                  conditions: [
                    {
                      id: 'invalid-range-condition',
                      order: 1,
                      kind: 'PREDICATE',
                      constraint: 'INCLUDE',
                      predicateCode: 'RANGE',
                      rangeKind: ['DISTANCE']
                    }
                  ]
                }
              ]
            }
          ]
        }
      })
    ).toThrow(/not valid for CHARACTER/)
  })

  it('parses node runtime resolve and normalize contracts', () => {
    const request = nodeRuntimeResolveRequestDtoSchema.parse({
      mapId: 'startingEquipmentItem',
      values: {
        category: 'WEAPON',
        authoringModeKind: 'SELECTED'
      },
      parentValues: {
        selectionKind: 'CHOSEN'
      },
      ancestors: [{ systemId: 'dnd-5e-srd' }],
      systemId: 'dnd-5e-srd'
    })

    const response = nodeRuntimeResolveResponseDtoSchema.parse({
      mapId: 'startingEquipmentItem',
      clearPaths: [['equipmentIds']],
      steps: [
        {
          id: 'basics',
          label: 'Basics',
          description: 'Define the core identity for this item.',
          order: 10,
          sections: [
            {
              id: 'basics',
              label: 'Basics',
              order: 10,
              nodes: [
                {
                  id: 'requiresAttunement',
                  path: ['requiresAttunement'],
                  label: 'Requires Attunement',
                  kind: 'INPUT',
                  type: 'TOGGLE',
                  visible: true,
                  required: false,
                  hiddenBehavior: 'KEEP',
                  clearPaths: [],
                  authoring: { exposure: 'author' }
                },
                {
                  id: 'equipmentIds',
                  path: ['equipmentIds'],
                  label: 'Equipment',
                  kind: 'INPUT',
                  type: 'SELECT_MULTI',
                  visible: true,
                  required: false,
                  hiddenBehavior: 'KEEP',
                  clearPaths: [],
                  authoring: { exposure: 'author' },
                  options: [
                    {
                      value: 'longsword',
                      label: 'Longsword',
                      description: 'A martial melee weapon.',
                      disabled: false,
                      group: 'Weapons',
                      metadata: { category: 'WEAPON' }
                    }
                  ]
                },
                {
                  id: 'effects',
                  path: ['effects'],
                  label: 'Effects',
                  kind: 'GROUP',
                  groupKind: 'ARRAY',
                  presentation: 'focused',
                  childMapId: 'effect',
                  visible: true,
                  required: false,
                  hiddenBehavior: 'KEEP',
                  clearPaths: [],
                  authoring: {
                    exposure: 'author',
                    collection: {
                      actions: [],
                      ordering: { mode: 'derived' }
                    }
                  }
                }
              ]
            }
          ]
        }
      ],
      scopes: []
    })

    const normalizeRequest = nodeRuntimeNormalizeValuesRequestDtoSchema.parse(request)

    expect(response.steps[0]?.sections[0]?.nodes).toMatchObject([
      { type: 'TOGGLE' },
      { options: [{ value: 'longsword' }] },
      { presentation: 'focused' }
    ])
    expect(response.steps[0]?.description).toBe('Define the core identity for this item.')
    expect(normalizeRequest.mapId).toBe('startingEquipmentItem')
  })
})
