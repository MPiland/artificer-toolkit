import { describe, expect, it } from 'vitest'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import type { NodeRuntimeSourceReader } from './nodeRuntimeSourceContract.js'

const reader: NodeRuntimeSourceReader = async (table) => {
  switch (table) {
    case 'equipment_properties':
      return [{ equipment_id: 'longbow', property_code: 'RANGED' }]
    case 'equipment':
      return [{ id: 'longbow', category: 'WEAPON' }]
    default:
      return []
  }
}

const condition = {
  kind: 'PREDICATE',
  constraint: 'INCLUDE',
  predicateCode: 'EQUIPMENT_PROPERTY',
  authoringModeKind: 'SELECTED',
  properties: ['RANGED']
}

function normalize(contextMode: 'ALL' | 'SELECTED', values: Record<string, unknown>) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'facetCondition',
    systemId: 'dnd5e-2014',
    values,
    parentValues: { subject: 'EQUIPMENT', authoringModeKind: contextMode }
  })
}

describe('facet condition equipment options', () => {
  it('keeps an equipment property or category on a context that covers all equipment', async () => {
    const property = await normalize('ALL', condition)
    expect(property.clearedPaths).toEqual([])
    expect(property.values).toMatchObject({ properties: ['RANGED'] })

    const category = await normalize('ALL', {
      kind: 'PREDICATE',
      constraint: 'INCLUDE',
      predicateCode: 'EQUIPMENT_CATEGORY',
      category: 'WEAPON'
    })
    expect(category.clearedPaths).toEqual([])
    expect(category.values).toMatchObject({ category: 'WEAPON' })
  })

  it('still clears a property when the context selects equipment but none is chosen', async () => {
    const result = await normalize('SELECTED', condition)

    expect(result.clearedPaths).toEqual([['properties']])
    expect(result.values).toMatchObject({ properties: [] })
  })
})
