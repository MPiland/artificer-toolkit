import { describe, expect, it } from 'vitest'
import { labelCharacterConditions } from '../character/characterConditionLabels.js'

const POISONED = {
  id: '00000000-0000-4000-8000-0000000000d1',
  label: 'Poisoned',
  description: 'Disadvantage on attack rolls and ability checks.'
}

describe('Character condition labels', () => {
  it('labels each condition from the System, with its description and notes', () => {
    expect(
      labelCharacterConditions(
        [{ conditionTypeId: POISONED.id, notes: 'Bitten' }, { conditionTypeId: POISONED.id }],
        [POISONED]
      )
    ).toEqual([
      {
        conditionTypeId: POISONED.id,
        label: 'Poisoned',
        description: POISONED.description,
        notes: 'Bitten'
      },
      { conditionTypeId: POISONED.id, label: 'Poisoned', description: POISONED.description }
    ])
  })

  it('fails loudly on a condition type the System does not define', () => {
    const missingId = '00000000-0000-4000-8000-0000000000d2'
    expect(() => labelCharacterConditions([{ conditionTypeId: missingId }], [POISONED])).toThrow(
      missingId
    )
  })
})
