import {
  NODE_SUBJECT,
  PREDICATE_REGISTRY,
  RELATIONS,
  RELATION_CODES,
  type SubjectWithRelations
} from '@artificer-toolkit/shared/core'
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
          predicateCode: 'SOURCE_CREATURE_TYPE',
          authoringModeKind: 'SELECTED',
          creatureTypeIds: ['fiend']
        }
      ],
      [
        'CREATURE',
        {
          predicateCode: 'SOURCE_TRAIT',
          authoringModeKind: 'SELECTED',
          traits: ['MAGICAL']
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
                  authoringModeKind: 'ALL',
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

  it('accepts exactly the relations the shared RELATIONS table defines for each subject', () => {
    const facetFor = (subject: string, relationCode: string) => ({
      id: 'relation-facet',
      groups: [
        {
          id: 'group-1',
          order: 1,
          contexts: [
            {
              id: 'context-1',
              order: 1,
              subject,
              ...(subject === 'CHARACTER' ? {} : { authoringModeKind: 'ALL' }),
              conditions: [
                {
                  id: 'condition-1',
                  order: 1,
                  kind: 'EXISTS',
                  constraint: 'INCLUDE',
                  relationCode,
                  authoringModeKind: 'ALL'
                }
              ]
            }
          ]
        }
      ]
    })

    for (const subject of nodeSubjectCodeSchema.options) {
      const related = Object.keys(RELATIONS[subject as SubjectWithRelations] ?? {})
      for (const relationCode of relationCodeSchema.options) {
        expect(
          facetDtoSchema.safeParse(facetFor(subject, relationCode)).success,
          `${subject} -> ${relationCode}`
        ).toBe(related.includes(relationCode))
      }
    }
  })
})
