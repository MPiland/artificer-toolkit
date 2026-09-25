import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { describe, expect, it } from 'vitest'
import {
  seedAstralTearAwakenedEquipment,
  seedShortswordPlusOneEquipment
} from '#domains/authoredRouteStory.fixtures'

describe('dense equipment authoring route fixture', () => {
  it('keeps the Shortsword +1 payload schema-valid and deterministic', () => {
    const equipment = equipmentAuthoredDtoSchema.parse(seedShortswordPlusOneEquipment)

    expect(equipment).toMatchObject({
      category: 'VARIANT',
      label: 'Shortsword +1',
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

  it('models the Astral Tear with one item charge pool and two charge-consuming features', () => {
    const equipment = equipmentAuthoredDtoSchema.parse(seedAstralTearAwakenedEquipment)

    expect(equipment).toMatchObject({
      category: 'WEAPON',
      label: 'The Astral Tear Awakened',
      requiresAttunement: true,
      properties: ['FINESSE', 'LIGHT', 'VEX'],
      charges: {
        amount: 3,
        resetKind: 'DAWN'
      },
      cost: {
        amount: 2000
      },
      weight: {
        amount: 2,
        unit: 'POUNDS'
      }
    })
    expect(equipment.features?.map((feature) => feature.label)).toEqual([
      'Warping Strike',
      'Spells'
    ])
    expect(equipment.features?.map((feature) => feature.charges)).toEqual([
      {
        id: 'astral-tear-warping-strike-charges',
        limitKind: 'SOURCE_CHARGES',
        scalingKind: 'NONE',
        cost: 1
      },
      {
        id: 'astral-tear-spells-charges',
        limitKind: 'SOURCE_CHARGES',
        scalingKind: 'NONE',
        cost: 1
      }
    ])
  })

  it('models the Astral Tear on-hit damage as a radiant or necrotic choice', () => {
    const equipment = equipmentAuthoredDtoSchema.parse(seedAstralTearAwakenedEquipment)
    const hitPath = equipment.effects?.[0]?.paths[0]

    expect(hitPath).toMatchObject({
      pathCode: 'ON_HIT',
      selectionKind: 'CHOICE'
    })
    if (!hitPath || hitPath.selectionKind !== 'CHOICE') {
      throw new Error('Expected the Astral Tear hit path to be a choice.')
    }

    expect(
      hitPath.options.map((option) => {
        if (!isChoiceOption(option)) {
          throw new Error('Expected Astral Tear on-hit choice options to include result blocks.')
        }

        return {
          label: option.label,
          ...readDamageOutcome(option.resultBlock)
        }
      })
    ).toEqual([
      {
        label: 'Radiant',
        damageTypeId: '00000000-0000-0000-0004-000b00000000',
        diceConfig: '1d6'
      },
      {
        label: 'Necrotic',
        damageTypeId: '00000000-0000-0000-0004-000700000000',
        diceConfig: '1d6'
      }
    ])
  })
})

type AstralTearChoiceOption = {
  label: string
  resultBlock: unknown
}

function isChoiceOption(option: unknown): option is AstralTearChoiceOption {
  return (
    isRecord(option) &&
    typeof option.label === 'string' &&
    isRecord(option.resultBlock) &&
    Array.isArray(option.resultBlock.outcomes)
  )
}

function readDamageOutcome(resultBlock: unknown) {
  const maybeOutcome =
    isRecord(resultBlock) && Array.isArray(resultBlock.outcomes) && resultBlock.outcomes.length > 0
      ? resultBlock.outcomes[0]
      : undefined

  if (!isRecord(maybeOutcome)) {
    return { damageTypeId: undefined, diceConfig: undefined }
  }

  return {
    damageTypeId:
      typeof maybeOutcome.damageTypeId === 'string' ? maybeOutcome.damageTypeId : undefined,
    diceConfig: typeof maybeOutcome.diceConfig === 'string' ? maybeOutcome.diceConfig : undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
