import { describe, expect, it } from 'vitest'
import type { EquipmentAuthored, FeatureAuthored } from '#authored'
import {
  EQUIPMENT_CATEGORY_CODE,
  MEASUREMENT_UNIT_CODE,
  SUBJECT
} from '#core'
import { compileEquipment, compileFeature } from '#compilers'

describe('compiled owner restrictions', () => {
  it('preserves feature restrictions', () => {
    const authored = {
      id: 'heavy-armor-training',
      label: 'Heavy Armor Training',
      description: 'Requires the prerequisite feature.',
      order: 1,
      restrictions: {
        id: 'feature-restrictions',
        groups: [
          {
            id: 'feature-restriction-group',
            order: 1,
            contexts: [
              {
                id: 'feature-restriction-context',
                order: 1,
                subject: SUBJECT.CHARACTER,
                conditions: [
                  {
                    id: 'feature-obtained-condition',
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'FEATURE_OBTAINED',
                    featureIds: ['armor-training']
                  }
                ]
              }
            ]
          }
        ]
      }
    } satisfies FeatureAuthored

    expect(compileFeature(authored).restrictions).toEqual(authored.restrictions)
  })

  it('preserves equipment restrictions', () => {
    const authored = {
      kind: SUBJECT.EQUIPMENT,
      id: 'restricted-item',
      label: 'Restricted Item',
      description: null,
      category: EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
      properties: [],
      weight: {
        amount: 1,
        unit: MEASUREMENT_UNIT_CODE.POUNDS
      },
      rarityId: 'common',
      restrictions: {
        id: 'equipment-restrictions',
        groups: [
          {
            id: 'equipment-restriction-group',
            order: 1,
            contexts: [
              {
                id: 'equipment-restriction-context',
                order: 1,
                subject: SUBJECT.CHARACTER,
                conditions: [{
                  id: 'feature-obtained-condition',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'FEATURE_OBTAINED',
                  featureIds: ['armor-training']
                }]
              }
            ]
          }
        ]
      },
      requiresAttunement: true,
      userId: 'user-1',
      systemId: 'system-1'
    } satisfies EquipmentAuthored

    expect(compileEquipment(authored).restrictions).toEqual(authored.restrictions)
    expect(compileEquipment(authored).requiresAttunement).toBe(true)
  })
})
