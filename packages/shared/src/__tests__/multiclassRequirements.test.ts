import { describe, expect, it } from 'vitest'

import { evaluateMulticlassRequirements } from '../domains/character/multiclassRequirements.js'

describe('evaluateMulticlassRequirements', () => {
  const requirements = {
    groups: [
      {
        requirements: [{ ability: 'STRENGTH' as const, min: 13 }]
      },
      {
        requirements: [{ ability: 'DEXTERITY' as const, min: 13 }]
      }
    ]
  }

  it('accepts any complete requirement group and reports each unmet alternative otherwise', () => {
    expect(evaluateMulticlassRequirements(requirements, { DEXTERITY: 13 })).toEqual({
      passes: true,
      unmetRequirementGroups: [requirements.groups[0]]
    })
    expect(evaluateMulticlassRequirements(requirements, { STRENGTH: 12, DEXTERITY: 12 })).toEqual({
      passes: false,
      unmetRequirementGroups: requirements.groups
    })
  })

  it('treats an absent requirement group list as unrestricted', () => {
    expect(evaluateMulticlassRequirements({ groups: [] }, {})).toEqual({
      passes: true,
      unmetRequirementGroups: []
    })
  })
})
