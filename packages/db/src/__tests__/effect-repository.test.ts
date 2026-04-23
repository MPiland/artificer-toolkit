import { describe, expect, it } from 'vitest'
import { createEffectRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

describe('createEffectRepository', () => {
  it('round-trips a direct saving-throw effect with owned shape, duration, and damage payloads', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never)

    await repository.upsert({
      id: 'effect-direct-1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'saving-throw-1',
          savingThrowKind: 'FIXED_VALUE',
          ability: 'WISDOM',
          dc: 15
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'range-1',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        },
        shape: {
          id: 'shape-1',
          shapeKind: 'SPHERE',
          radius: {
            amount: 20,
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
          savingThrowKind: 'FIXED_VALUE',
          ability: 'WISDOM',
          dc: 15
        },
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'range-1',
          rangeKind: 'DISTANCE',
          amount: 60,
          unit: 'FEET'
        },
        shape: {
          id: 'shape-1',
          shapeKind: 'SPHERE',
          radius: {
            amount: 20,
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

  it('round-trips a passive saving-throw effect with passive save-fail/save-success paths', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never)

    await repository.upsert({
      id: 'effect-passive-save-1',
      order: 1,
      invocation: {
        kind: 'PASSIVE',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: 'effect-passive-save-1-saving-throw',
          savingThrowKind: 'FIXED_VALUE',
          ability: 'WISDOM',
          dc: 15
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
          savingThrowKind: 'FIXED_VALUE',
          ability: 'WISDOM',
          dc: 15
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

  it('round-trips a roll-table effect with mixed damage and condition entries', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never)

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

