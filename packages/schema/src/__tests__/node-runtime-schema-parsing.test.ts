import { describe, expect, it } from 'vitest'

import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeResolveRequestDtoSchema,
  nodeRuntimeResolveResponseDtoSchema
} from '../api/nodeRuntime.js'

describe('node runtime schema parsing', () => {
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
