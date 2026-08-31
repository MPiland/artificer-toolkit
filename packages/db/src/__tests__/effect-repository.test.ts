import { describe, expect, it } from 'vitest'
import { createEffectRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

const EFFECT_TEST_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const DEXTERITY_ABILITY_DEFINITION_ID = '00000000-0000-0000-0011-000200000000'
const WISDOM_ABILITY_DEFINITION_ID = '00000000-0000-0000-0011-000500000000'
const CONSTITUTION_ABILITY_DEFINITION_ID = '00000000-0000-0000-0011-000300000000'

describe('createEffectRepository', () => {
  it('requires an authoritative parent System to hydrate an Effect saving throw', async () => {
    const db = new InMemoryDb()
    const effect = {
      id: 'effect-system-bound-read',
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: 'SAVING_THROW' as const,
        savingThrow: {
          id: 'effect-system-bound-read-save',
          dcMethod: 'FIXED_DC' as const,
          abilityDefinitionId: DEXTERITY_ABILITY_DEFINITION_ID,
          baseDc: 12
        },
        activation: { code: 'ACTION' as const, amount: 1 },
        range: {
          id: 'effect-system-bound-read-range',
          rangeKind: 'SELF' as const
        }
      },
      paths: []
    }

    await createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID).upsert(effect)

    await expect(createEffectRepository(db as never).findById(effect.id)).rejects.toThrow(
      'requires an authoritative parent System'
    )
  })

  it('rejects malformed cross-System saving throw parents and bonuses on read', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)
    const effect = {
      id: 'effect-system-ownership-read',
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: 'SAVING_THROW' as const,
        savingThrow: {
          id: 'effect-system-ownership-read-save',
          dcMethod: 'DERIVED_DC' as const,
          abilityDefinitionId: DEXTERITY_ABILITY_DEFINITION_ID,
          baseDc: 8,
          bonuses: [
            {
              id: 'effect-system-ownership-read-bonus',
              bonusKind: 'ABILITY_MODIFIER' as const,
              abilityDefinitionId: CONSTITUTION_ABILITY_DEFINITION_ID
            }
          ]
        },
        activation: { code: 'ACTION' as const, amount: 1 },
        range: {
          id: 'effect-system-ownership-read-range',
          rangeKind: 'SELF' as const
        }
      },
      paths: []
    }

    await repository.upsert(effect)
    db.insertRow(
      'saving_throws',
      {
        id: effect.invocation.savingThrow.id,
        system_id: 'other-system',
        ability_definition_id: DEXTERITY_ABILITY_DEFINITION_ID,
        dc_method: 'DERIVED_DC',
        base_dc: 8
      },
      ['id'],
      'doUpdateSet'
    )

    await expect(repository.findById(effect.id)).rejects.toThrow(
      'does not match authoritative System'
    )

    db.insertRow(
      'saving_throws',
      {
        id: effect.invocation.savingThrow.id,
        system_id: EFFECT_TEST_SYSTEM_ID,
        ability_definition_id: DEXTERITY_ABILITY_DEFINITION_ID,
        dc_method: 'DERIVED_DC',
        base_dc: 8
      },
      ['id'],
      'doUpdateSet'
    )
    db.insertRow(
      'saving_throw_dc_bonuses',
      {
        id: 'effect-system-ownership-read-bonus',
        saving_throw_id: effect.invocation.savingThrow.id,
        system_id: 'other-system',
        bonus_kind: 'ABILITY_MODIFIER',
        ability_definition_id: CONSTITUTION_ABILITY_DEFINITION_ID,
        amount: null,
        sort_order: 1
      },
      ['id'],
      'doUpdateSet'
    )

    await expect(repository.findById(effect.id)).rejects.toThrow(
      'does not match authoritative System'
    )
  })

  it('rejects a saving-throw Effect without an owning System before persistence', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never)

    await expect(
      repository.upsert({
        id: 'effect-without-system',
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'SAVING_THROW',
          savingThrow: {
            id: 'save-without-system',
            dcMethod: 'FIXED_DC',
            abilityDefinitionId: DEXTERITY_ABILITY_DEFINITION_ID,
            baseDc: 12
          },
          activation: { code: 'ACTION', amount: 1 },
          range: { id: 'range-without-system', rangeKind: 'SELF' }
        },
        paths: []
      })
    ).rejects.toThrow('requires an owning System')

    await expect(repository.findById('effect-without-system')).resolves.toBeNull()
  })

  it('round-trips an incoming saving-throw trigger through passive effect persistence', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)

    await repository.upsert({
      id: 'effect-incoming-save-1',
      order: 1,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'INCOMING_SAVING_THROW',
        range: {
          id: 'effect-incoming-save-1-range',
          rangeKind: 'SELF'
        }
      },
      paths: [
        {
          id: 'effect-incoming-save-1-path',
          order: 1,
          pathCode: 'PASSIVE',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'effect-incoming-save-1-result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'effect-incoming-save-1-outcome',
                effectKind: 'CONDITION',
                conditionId: 'protected'
              }
            ]
          }
        }
      ]
    })

    await expect(repository.findById('effect-incoming-save-1')).resolves.toMatchObject({
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'INCOMING_SAVING_THROW'
      },
      paths: [
        {
          pathCode: 'PASSIVE'
        }
      ]
    })
  })

  it('round-trips a direct saving-throw effect with owned shape, duration, and damage payloads', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)

    await repository.upsert({
      id: 'effect-direct-1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'saving-throw-1',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: WISDOM_ABILITY_DEFINITION_ID,
          baseDc: 15,
          bonuses: [
            {
              id: 'saving-throw-static-bonus-1',
              bonusKind: 'STATIC_BONUS',
              amount: 1
            }
          ]
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        resourceUse: {
          chargeId: 'resource-charge-1',
          cost: 2
        },
        range: {
          id: 'range-1',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        },
        shape: {
          id: 'shape-1',
          shapeKind: 'LINE',
          length: {
            amount: 20,
            unit: 'FEET'
          },
          width: {
            amount: 5,
            unit: 'FEET'
          }
        }
      },
      paths: [
        {
          id: 'save-fail-1',
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'save-fail-1__result',
            resultKind: 'SINGLE',
            duration: {
              id: 'duration-1',
              durationKind: 'ROUND',
              amount: 1
            },
            outcomes: [
              {
                id: 'save-fail-1-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'fire',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '2d6',
                bonuses: [
                  {
                    id: 'damage-bonus-1',
                    bonusKind: 'ABILITY_BONUS',
                    ability: 'WISDOM',
                    order: 1
                  }
                ]
              }
            ]
          }
        },
        {
          id: 'save-success-1',
          order: 2,
          pathCode: 'ON_SAVE_SUCCESS',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'save-success-1__result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'save-success-1-entry',
                effectKind: 'CONDITION',
                conditionId: 'singed'
              }
            ]
          }
        }
      ]
    })

    await expect(repository.findById('effect-direct-1')).resolves.toMatchObject({
      id: 'effect-direct-1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'saving-throw-1',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: WISDOM_ABILITY_DEFINITION_ID,
          baseDc: 15,
          bonuses: [
            {
              id: 'saving-throw-static-bonus-1',
              bonusKind: 'STATIC_BONUS',
              amount: 1
            }
          ]
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        resourceUse: {
          chargeId: 'resource-charge-1',
          cost: 2
        },
        range: {
          id: 'range-1',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        },
        shape: {
          id: 'shape-1',
          shapeKind: 'LINE',
          length: {
            amount: 20,
            unit: 'FEET'
          },
          width: {
            amount: 5,
            unit: 'FEET'
          }
        }
      },
      paths: [
        {
          id: 'save-fail-1',
          pathCode: 'ON_SAVE_FAIL',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'save-fail-1__result',
            resultKind: 'SINGLE',
            duration: {
              id: 'duration-1',
              durationKind: 'ROUND',
              amount: 1
            },
            outcomes: [
              {
                id: 'save-fail-1-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'fire',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '2d6',
                bonuses: [
                  {
                    id: 'damage-bonus-1',
                    bonusKind: 'ABILITY_BONUS',
                    ability: 'WISDOM',
                    order: 1
                  }
                ]
              }
            ]
          }
        },
        {
          id: 'save-success-1',
          pathCode: 'ON_SAVE_SUCCESS',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'save-success-1__result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'save-success-1-entry',
                effectKind: 'CONDITION',
                conditionId: 'singed'
              }
            ]
          }
        }
      ]
    })
  })

  it('hydrates until-dispelled durations without requiring an amount', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)

    await repository.upsert({
      id: 'effect-until-dispelled-1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'effect-until-dispelled-1-saving-throw',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: WISDOM_ABILITY_DEFINITION_ID,
          baseDc: 15
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'effect-until-dispelled-1-range',
          rangeKind: 'DISTANCE',
          amount: 30,
          unit: 'FEET'
        }
      },
      paths: [
        {
          id: 'effect-until-dispelled-1-path',
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'effect-until-dispelled-1-result',
            resultKind: 'SINGLE',
            duration: {
              id: 'effect-until-dispelled-1-duration',
              durationKind: 'UNTIL_DISPELLED'
            },
            outcomes: [
              {
                id: 'effect-until-dispelled-1-condition',
                effectKind: 'CONDITION',
                conditionId: 'blinded'
              }
            ]
          }
        }
      ]
    })

    await expect(repository.findById('effect-until-dispelled-1')).resolves.toMatchObject({
      paths: [
        {
          resultBlock: {
            duration: {
              id: 'effect-until-dispelled-1-duration',
              durationKind: 'UNTIL_DISPELLED'
            }
          }
        }
      ]
    })
  })

  it('hydrates numeric database strings as authored numbers', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)

    await repository.upsert({
      id: 'effect-numeric-strings',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'numeric-saving-throw',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: DEXTERITY_ABILITY_DEFINITION_ID,
          baseDc: 13
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'numeric-range',
          rangeKind: 'DISTANCE',
          amount: 25,
          unit: 'FEET'
        },
        shape: {
          id: 'numeric-shape',
          shapeKind: 'SPHERE',
          radius: {
            amount: 10,
            unit: 'FEET'
          }
        }
      },
      paths: [
        {
          id: 'numeric-path',
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'numeric-path__result',
            resultKind: 'SINGLE',
            duration: {
              id: 'numeric-duration',
              durationKind: 'ROUND',
              amount: 1
            },
            outcomes: [
              {
                id: 'numeric-damage',
                effectKind: 'DAMAGE',
                damageTypeId: 'piercing',
                valueKind: 'FIXED',
                scalingKind: 'NONE',
                amount: 1,
                bonuses: [
                  {
                    id: 'numeric-damage-bonus',
                    bonusKind: 'ABILITY_BONUS',
                    ability: 'DEXTERITY',
                    multiplier: 2,
                    min: 1,
                    max: 3,
                    order: 1
                  }
                ]
              }
            ]
          }
        }
      ]
    })
    db.insertRow(
      'characteristic_ranges',
      {
        characteristic_id: 'numeric-range',
        kind: 'DISTANCE',
        min: '25',
        unit_code: 'FEET',
        scaling: null
      },
      ['characteristic_id'],
      'doUpdateSet'
    )
    db.insertRow(
      'characteristic_shape_dimensions',
      {
        characteristic_id: 'numeric-shape',
        dimension: 'RADIUS',
        amount: '10',
        unit_code: 'FEET',
        scaling: null
      },
      ['characteristic_id', 'dimension'],
      'doUpdateSet'
    )
    db.insertRow(
      'characteristic_durations',
      {
        characteristic_id: 'numeric-duration',
        kind: 'ROUND',
        amount: '1',
        scaling: null
      },
      ['characteristic_id'],
      'doUpdateSet'
    )
    db.insertRow(
      'damage_values',
      {
        damage_id: 'numeric-damage',
        amount: '1',
        dice: null,
        multiplier: null,
        min: null,
        max: null
      },
      ['damage_id'],
      'doUpdateSet'
    )
    db.insertRow(
      'damage_bonuses',
      {
        id: 'numeric-damage-bonus',
        damage_id: 'numeric-damage',
        bonus_kind: 'ABILITY_BONUS',
        ability_code: 'DEXTERITY',
        skill_id: null,
        multiplier: '2',
        min: '1',
        max: '3',
        sort_order: 1
      },
      ['id'],
      'doUpdateSet'
    )

    const effect = (await repository.findById('effect-numeric-strings')) as unknown as {
      invocation?: {
        range?: { amount?: unknown }
        shape?: { radius?: { amount?: unknown } }
      }
      paths?: Array<{
        resultBlock?: {
          duration?: { amount?: unknown }
          outcomes?: Array<{
            amount?: unknown
            bonuses?: Array<{
              multiplier?: unknown
              min?: unknown
              max?: unknown
            }>
          }>
        }
      }>
    }
    const outcome = effect.paths?.[0]?.resultBlock?.outcomes?.[0]
    const bonus = outcome?.bonuses?.[0]

    expect(effect.invocation?.range?.amount).toBe(25)
    expect(typeof effect.invocation?.range?.amount).toBe('number')
    expect(effect.invocation?.shape?.radius?.amount).toBe(10)
    expect(typeof effect.invocation?.shape?.radius?.amount).toBe('number')
    expect(effect.paths?.[0]?.resultBlock?.duration?.amount).toBe(1)
    expect(typeof effect.paths?.[0]?.resultBlock?.duration?.amount).toBe('number')
    expect(outcome?.amount).toBe(1)
    expect(typeof outcome?.amount).toBe('number')
    expect(bonus?.multiplier).toBe(2)
    expect(bonus?.min).toBe(1)
    expect(bonus?.max).toBe(3)
  })

  it('round-trips a passive saving-throw effect with passive save-fail/save-success paths', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)

    await repository.upsert({
      id: 'effect-passive-save-1',
      order: 1,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'effect-passive-save-1-saving-throw',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: WISDOM_ABILITY_DEFINITION_ID,
          baseDc: 15
        },
        range: {
          id: 'effect-passive-save-1-range',
          rangeKind: 'SELF'
        },
        shape: {
          id: 'effect-passive-save-1-shape',
          shapeKind: 'SPHERE',
          radius: {
            amount: 15,
            unit: 'FEET'
          }
        }
      },
      paths: [
        {
          id: 'effect-passive-save-1-fail',
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'effect-passive-save-1-fail__result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'effect-passive-save-1-fail-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'radiant',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '3d8'
              }
            ]
          }
        },
        {
          id: 'effect-passive-save-1-success',
          order: 2,
          pathCode: 'ON_SAVE_SUCCESS',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'effect-passive-save-1-success__result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'effect-passive-save-1-success-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'radiant',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '3d8'
              }
            ]
          }
        }
      ]
    })

    await expect(repository.findById('effect-passive-save-1')).resolves.toMatchObject({
      id: 'effect-passive-save-1',
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'effect-passive-save-1-saving-throw',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: WISDOM_ABILITY_DEFINITION_ID,
          baseDc: 15
        },
        range: {
          id: 'effect-passive-save-1-range',
          rangeKind: 'SELF'
        }
      },
      paths: [
        {
          id: 'effect-passive-save-1-fail',
          pathCode: 'ON_SAVE_FAIL'
        },
        {
          id: 'effect-passive-save-1-success',
          pathCode: 'ON_SAVE_SUCCESS'
        }
      ]
    })
  })

  it('round-trips a source-DC saving throw with the target save ability', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)

    await repository.upsert({
      id: 'effect-source-save-1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'effect-source-save-1-saving-throw',
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: DEXTERITY_ABILITY_DEFINITION_ID
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'effect-source-save-1-range',
          rangeKind: 'SELF'
        }
      },
      paths: [
        {
          id: 'effect-source-save-1-fail',
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'effect-source-save-1-fail__result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'effect-source-save-1-fail-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'fire',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '2d6'
              }
            ]
          }
        }
      ]
    })

    await expect(repository.findById('effect-source-save-1')).resolves.toMatchObject({
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'effect-source-save-1-saving-throw',
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: DEXTERITY_ABILITY_DEFINITION_ID
        }
      }
    })
  })

  it('round-trips a derived saving throw DC with ability and proficiency bonuses', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)

    await repository.upsert({
      id: 'effect-derived-save-1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'effect-derived-save-1-saving-throw',
          dcMethod: 'DERIVED_DC',
          abilityDefinitionId: DEXTERITY_ABILITY_DEFINITION_ID,
          baseDc: 8,
          bonuses: [
            {
              id: 'effect-derived-save-1-ability-bonus',
              bonusKind: 'ABILITY_MODIFIER',
              abilityDefinitionId: CONSTITUTION_ABILITY_DEFINITION_ID
            },
            {
              id: 'effect-derived-save-1-proficiency-bonus',
              bonusKind: 'PROFICIENCY_BONUS'
            }
          ]
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'effect-derived-save-1-range',
          rangeKind: 'SELF'
        }
      },
      paths: [
        {
          id: 'effect-derived-save-1-fail',
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'effect-derived-save-1-fail__result',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'effect-derived-save-1-fail-entry',
                effectKind: 'DAMAGE',
                damageTypeId: 'fire',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '2d6'
              }
            ]
          }
        }
      ]
    })

    await expect(repository.findById('effect-derived-save-1')).resolves.toMatchObject({
      invocation: {
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'effect-derived-save-1-saving-throw',
          dcMethod: 'DERIVED_DC',
          abilityDefinitionId: DEXTERITY_ABILITY_DEFINITION_ID,
          baseDc: 8,
          bonuses: [
            {
              id: 'effect-derived-save-1-ability-bonus',
              bonusKind: 'ABILITY_MODIFIER',
              abilityDefinitionId: CONSTITUTION_ABILITY_DEFINITION_ID
            },
            {
              id: 'effect-derived-save-1-proficiency-bonus',
              bonusKind: 'PROFICIENCY_BONUS'
            }
          ]
        }
      }
    })
  })

  it('round-trips a roll-table effect with mixed damage and condition entries', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, EFFECT_TEST_SYSTEM_ID)

    await repository.upsert({
      id: 'effect-roll-table-1',
      order: 2,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'ENTER_AREA',
        range: {
          id: 'range-2',
          rangeKind: 'SELF'
        }
      },
      paths: [
        {
          id: 'passive-table-1',
          order: 1,
          pathCode: 'PASSIVE',
          groupType: 'CHOICE',
          selectionKind: 'ROLL_TABLE',
          rollTableKind: 'RANGE',
          dieConfig: '1d6',
          rows: [
            {
              id: 'entry-1',
              order: 1,
              rollRange: [1, 3],
              resolutionKind: 'RESULT',
              resultBlock: {
                id: 'entry-1__result',
                resultKind: 'SINGLE',
                duration: {
                  id: 'entry-duration-1',
                  durationKind: 'TURN',
                  amount: 1
                },
                outcomes: [
                  {
                    id: 'entry-1',
                    effectKind: 'DAMAGE',
                    damageTypeId: 'fire',
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 4
                  }
                ]
              }
            },
            {
              id: 'entry-2',
              order: 2,
              rollRange: [4, 6],
              resolutionKind: 'RESULT',
              resultBlock: {
                id: 'entry-2__result',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'entry-2',
                    effectKind: 'CONDITION',
                    conditionId: 'prone'
                  }
                ]
              }
            }
          ]
        }
      ]
    })

    await expect(repository.findById('effect-roll-table-1')).resolves.toMatchObject({
      id: 'effect-roll-table-1',
      order: 2,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'ENTER_AREA',
        range: {
          id: 'range-2',
          rangeKind: 'SELF'
        }
      },
      paths: [
        {
          id: 'passive-table-1',
          pathCode: 'PASSIVE',
          selectionKind: 'ROLL_TABLE',
          rollTableKind: 'RANGE',
          dieConfig: '1d6',
          rows: [
            {
              id: 'entry-1',
              rollRange: [1, 3],
              resultBlock: {
                id: 'entry-1__result',
                resultKind: 'SINGLE',
                duration: {
                  id: 'entry-duration-1',
                  durationKind: 'TURN',
                  amount: 1
                },
                outcomes: [
                  {
                    id: 'entry-1',
                    effectKind: 'DAMAGE',
                    damageTypeId: 'fire',
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 4
                  }
                ]
              }
            },
            {
              id: 'entry-2',
              rollRange: [4, 6],
              resultBlock: {
                id: 'entry-2__result',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'entry-2',
                    effectKind: 'CONDITION',
                    conditionId: 'prone'
                  }
                ]
              }
            }
          ]
        }
      ]
    })
  })
})
