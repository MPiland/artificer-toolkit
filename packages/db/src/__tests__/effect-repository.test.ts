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
      moments: [
        {
          id: 'save-fail-1',
          moment: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          duration: {
            id: 'duration-1',
            durationKind: 'ROUND',
            amount: 1
          },
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
        },
        {
          id: 'save-success-1',
          moment: 'ON_SAVE_SUCCESS',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          effectKind: 'CONDITION',
          conditionId: 'singed'
        }
      ]
    })

    await expect(repository.findById('effect-direct-1')).resolves.toEqual({
      id: 'effect-direct-1',
      order: 1,
      invocation: {
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
      moments: [
        {
          id: 'save-fail-1',
          moment: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          duration: {
            id: 'duration-1',
            durationKind: 'ROUND',
            amount: 1
          },
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
              multiplier: undefined,
              min: undefined,
              max: undefined,
              order: 1
            }
          ]
        },
        {
          id: 'save-success-1',
          moment: 'ON_SAVE_SUCCESS',
          groupType: 'SINGLE',
          resolutionKind: 'DIRECT',
          duration: undefined,
          effectKind: 'CONDITION',
          conditionId: 'singed'
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
        triggerCode: 'ENTER_AREA',
        activation: {
          code: 'REACTION',
          amount: 1
        },
        range: {
          id: 'range-2',
          rangeKind: 'SELF'
        }
      },
      moments: [
        {
          id: 'passive-table-1',
          moment: 'PASSIVE',
          groupType: 'CHOICE',
          resolutionKind: 'ROLL_TABLE',
          rollTableKind: 'RANGE',
          dieConfig: '1d6',
          table: [
            {
              id: 'entry-1',
              rollRange: [1, 3],
              description: 'Burning cinders',
              duration: {
                id: 'entry-duration-1',
                durationKind: 'TURN',
                amount: 1
              },
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 4
            },
            {
              id: 'entry-2',
              rollRange: [4, 6],
              description: 'Slippery ice',
              effectKind: 'CONDITION',
              conditionId: 'prone'
            }
          ]
        }
      ]
    })

    await expect(repository.findById('effect-roll-table-1')).resolves.toEqual({
      id: 'effect-roll-table-1',
      order: 2,
      invocation: {
        triggerCode: 'ENTER_AREA',
        activation: {
          code: 'REACTION',
          amount: 1
        },
        range: {
          id: 'range-2',
          rangeKind: 'SELF'
        },
        shape: undefined
      },
      moments: [
        {
          id: 'passive-table-1',
          moment: 'PASSIVE',
          groupType: 'CHOICE',
          resolutionKind: 'ROLL_TABLE',
          rollTableKind: 'RANGE',
          dieConfig: '1d6',
          table: [
            {
              id: 'entry-1',
              rollRange: [1, 3],
              description: 'Burning cinders',
              duration: {
                id: 'entry-duration-1',
                durationKind: 'TURN',
                amount: 1
              },
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 4,
              bonuses: undefined
            },
            {
              id: 'entry-2',
              rollRange: [4, 6],
              description: 'Slippery ice',
              duration: undefined,
              effectKind: 'CONDITION',
              conditionId: 'prone'
            }
          ]
        }
      ]
    })
  })
})
