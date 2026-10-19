import { describe, expect, it } from 'vitest'

import { forcedMovementDtoSchema } from '../effects/forcedMovement.js'

const forcedMovement = {
  id: 'push',
  effectKind: 'FORCED_MOVEMENT',
  direction: 'ANY',
  actionEconomy: 'NONE',
  distanceMode: 'UP_TO',
  amount: 20,
  unit: 'FEET'
}

const collision = {
  id: 'collision',
  damageTypeId: '00000000-0000-4000-8000-000000000001',
  diceConfig: '1d6',
  savingThrow: {
    id: 'collision-save',
    dcMethod: 'FIXED_DC',
    abilityDefinitionId: '00000000-0000-4000-8000-000000000002',
    baseDc: 13
  },
  conditionId: '00000000-0000-4000-8000-000000000003'
}

describe('the collision of an authored forced movement (D159)', () => {
  it('parses beside the movement, keeping the struck creature’s save', () => {
    expect(forcedMovementDtoSchema.parse({ ...forcedMovement, collision })).toMatchObject({
      collision: { diceConfig: '1d6', savingThrow: { dcMethod: 'FIXED_DC', baseDc: 13 } }
    })
  })

  it('is optional', () => {
    expect(forcedMovementDtoSchema.parse(forcedMovement)).not.toHaveProperty('collision')
  })

  it('refuses a collision field it does not know', () => {
    expect(() =>
      forcedMovementDtoSchema.parse({ ...forcedMovement, collision: { ...collision, extra: 1 } })
    ).toThrow()
  })

  it('refuses a collision without its save', () => {
    const { savingThrow: _savingThrow, ...withoutSave } = collision
    expect(() =>
      forcedMovementDtoSchema.parse({ ...forcedMovement, collision: withoutSave })
    ).toThrow()
  })
})
