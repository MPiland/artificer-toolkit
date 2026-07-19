import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { describe, expect, it } from 'vitest'
import { seedShortswordPlusOneEquipment } from '#domains/authoredRouteStory.fixtures'

describe('dense equipment authoring route fixture', () => {
  it('keeps the Shortsword +1 payload schema-valid and deterministic', () => {
    const equipment = equipmentAuthoredDtoSchema.parse(seedShortswordPlusOneEquipment)

    expect(equipment).toMatchObject({
      category: 'VARIANT',
      label: 'Shortsword +1',
      maxBonus: 1,
      properties: ['MAGIC']
    })
    expect(equipment.effects).toHaveLength(1)
    expect(equipment.modifiers).toHaveLength(2)
  })

  it('models attack and damage bonuses as equipped-source grants', () => {
    const equipment = equipmentAuthoredDtoSchema.parse(seedShortswordPlusOneEquipment)

    expect(equipment.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueDomainCode: 'ATTACK_ROLL',
          modifierKind: 'BONUS',
          scope: 'SOURCE',
          payload: { valueKind: 'FIXED', amount: 1 }
        }),
        expect.objectContaining({
          valueDomainCode: 'DAMAGE',
          modifierKind: 'BONUS',
          scope: 'SOURCE',
          payload: { valueKind: 'FIXED', amount: 1 }
        })
      ])
    )

    for (const modifier of equipment.modifiers ?? []) {
      expect(modifier.restrictions?.groups[0]?.contexts?.[0]?.conditions?.[0]).toMatchObject({
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: 'WHILE_SOURCE_EQUIPPED'
      })
    }
  })
})
