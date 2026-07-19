import { NODE_SUBJECT, PREDICATE_REGISTRY, RELATION_CODES } from '@artificer-toolkit/shared/core'
import { describe, expect, it } from 'vitest'

import { nodeSubjectCodeSchema, predicateCodeSchema, relationCodeSchema } from '../shared/enums.js'
import { facetDtoSchema } from '../shared/facet.js'

describe('facet predicate contract parity', () => {
  it('keeps subject and relation vocabularies aligned with shared contracts', () => {
    expect(new Set(nodeSubjectCodeSchema.options)).toEqual(new Set(Object.keys(NODE_SUBJECT)))
    expect(new Set(relationCodeSchema.options)).toEqual(new Set(RELATION_CODES))
  })

  it('keeps the transport vocabulary aligned with the shared predicate registry', () => {
    expect(new Set(predicateCodeSchema.options)).toEqual(new Set(Object.keys(PREDICATE_REGISTRY)))
  })

  it('parses every creature and vehicle predicate payload', () => {
    const cases = [
      [
        'CREATURE',
        {
          predicateCode: 'CREATURE_CATEGORY',
          authoringModeKind: 'SELECTED',
          categories: ['MONSTER']
        }
      ],
      [
        'CREATURE',
        {
          predicateCode: 'CREATURE_TYPE',
          authoringModeKind: 'SELECTED',
          creatureTypeIds: ['humanoid']
        }
      ],
      [
        'CREATURE',
        {
          predicateCode: 'CREATURE_SIZE',
          authoringModeKind: 'SELECTED',
          sizes: ['MEDIUM']
        }
      ],
      ['CREATURE', { predicateCode: 'CREATURE_IS_MOUNT' }],
      ['CREATURE', { predicateCode: 'CREATURE_IS_COMPANION' }],
      [
        'VEHICLE',
        {
          predicateCode: 'VEHICLE_CATEGORY',
          authoringModeKind: 'SELECTED',
          categories: ['LAND']
        }
      ],
      [
        'VEHICLE',
        {
          predicateCode: 'VEHICLE_SIZE',
          authoringModeKind: 'SELECTED',
          sizes: ['LARGE']
        }
      ]
    ] as const

    for (const [subject, payload] of cases) {
      expect(() =>
        facetDtoSchema.parse({
          id: `${payload.predicateCode.toLowerCase()}-facet`,
          groups: [
            {
              id: 'group-1',
              order: 1,
              contexts: [
                {
                  id: 'context-1',
                  order: 1,
                  subject,
                  conditions: [
                    {
                      id: 'condition-1',
                      order: 1,
                      kind: 'PREDICATE',
                      constraint: 'INCLUDE',
                      ...payload
                    }
                  ]
                }
              ]
            }
          ]
        })
      ).not.toThrow()
    }
  })
})
