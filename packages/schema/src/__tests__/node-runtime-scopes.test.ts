import { describe, expect, it } from 'vitest'
import { nodeRuntimeResolveResponseDtoSchema } from '../api/nodeRuntime.js'

describe('node runtime resolved scopes', () => {
  it('parses flat nested scopes with absolute paths', () => {
    const response = nodeRuntimeResolveResponseDtoSchema.parse({
      mapId: 'equipment',
      steps: [],
      clearPaths: [],
      scopes: [
        {
          mapId: 'cost',
          path: ['cost'],
          steps: [],
          clearPaths: []
        },
        {
          mapId: 'contains',
          path: ['contains', 1],
          steps: [],
          clearPaths: [['equipmentId']]
        }
      ]
    })

    expect(response.scopes).toEqual([
      {
        mapId: 'cost',
        path: ['cost'],
        steps: [],
        clearPaths: []
      },
      {
        mapId: 'contains',
        path: ['contains', 1],
        steps: [],
        clearPaths: [['equipmentId']]
      }
    ])
  })
})
