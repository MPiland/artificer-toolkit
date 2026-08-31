import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  AUTHORED_LIMITS,
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { backgroundAuthoredDtoSchema } from '../subjects/background.js'
import { classAuthoredDtoSchema } from '../subjects/class.js'
import { creatureAuthoredDtoSchema } from '../subjects/creature.js'
import { equipmentAuthoredDtoSchema } from '../subjects/equipment.js'
import { featAuthoredDtoSchema } from '../subjects/feat.js'
import { raceAuthoredDtoSchema } from '../subjects/race.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'
import { vehicleAuthoredDtoSchema } from '../subjects/vehicle.js'
import { facetDtoSchema } from '../shared/facet.js'
import { chargeBonusDtoSchema } from '../shared/charge.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { damageBonusDtoSchema, damageDtoSchema } from '../effects/damage.js'
import { healDtoSchema } from '../effects/heal.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'

const serializedRichText =
  '<b></b>'.repeat(Math.floor(AUTHORED_LIMITS.richTextSerializedCharacters / 7)) +
  'x'.repeat(AUTHORED_LIMITS.richTextSerializedCharacters % 7)

const primitiveBoundaryCases: Array<{
  name: string
  schema: z.ZodType
  exact: unknown
  plusOne: unknown
}> = [
  {
    name: 'identifier',
    schema: authoredIdentifierSchema,
    exact: 'x'.repeat(AUTHORED_LIMITS.shortTextCharacters),
    plusOne: 'x'.repeat(AUTHORED_LIMITS.shortTextCharacters + 1)
  },
  {
    name: 'short text',
    schema: authoredShortTextSchema,
    exact: 'x'.repeat(AUTHORED_LIMITS.shortTextCharacters),
    plusOne: 'x'.repeat(AUTHORED_LIMITS.shortTextCharacters + 1)
  },
  {
    name: 'plain text',
    schema: authoredPlainTextSchema,
    exact: 'x'.repeat(AUTHORED_LIMITS.plainTextCharacters),
    plusOne: 'x'.repeat(AUTHORED_LIMITS.plainTextCharacters + 1)
  },
  {
    name: 'rich text visible content',
    schema: authoredRichTextSchema,
    exact: 'x'.repeat(AUTHORED_LIMITS.richTextVisibleCharacters),
    plusOne: 'x'.repeat(AUTHORED_LIMITS.richTextVisibleCharacters + 1)
  },
  {
    name: 'rich text serialized content',
    schema: authoredRichTextSchema,
    exact: serializedRichText,
    plusOne: `${serializedRichText}x`
  },
  {
    name: 'nested collection',
    schema: authoredNestedCollectionSchema(z.object({ id: authoredIdentifierSchema })),
    exact: Array.from({ length: AUTHORED_LIMITS.nestedCollectionItems }, (_, index) => ({
      id: `item-${index}`
    })),
    plusOne: Array.from({ length: AUTHORED_LIMITS.nestedCollectionItems + 1 }, (_, index) => ({
      id: `item-${index}`
    }))
  },
  {
    name: 'reference collection',
    schema: authoredReferenceCollectionSchema(authoredIdentifierSchema),
    exact: Array.from({ length: AUTHORED_LIMITS.referenceCollectionItems }, (_, index) =>
      String(index)
    ),
    plusOne: Array.from({ length: AUTHORED_LIMITS.referenceCollectionItems + 1 }, (_, index) =>
      String(index)
    )
  }
]

const overlongLabel = 'x'.repeat(AUTHORED_LIMITS.shortTextCharacters + 1)
const exactLabel = 'x'.repeat(AUTHORED_LIMITS.shortTextCharacters)

const authoredRootBoundaryCases: Array<{
  name: string
  schema: z.ZodType
  payload: Record<string, unknown>
}> = [
  {
    name: 'background',
    schema: backgroundAuthoredDtoSchema,
    payload: {
      kind: 'BACKGROUND',
      id: 'background-1',
      label: overlongLabel,
      userId: 'user-1',
      systemId: 'system-1'
    }
  },
  {
    name: 'class',
    schema: classAuthoredDtoSchema,
    payload: {
      id: 'class-1',
      label: overlongLabel,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'SUBCLASS',
      parentClassId: 'parent-class-1'
    }
  },
  {
    name: 'creature',
    schema: creatureAuthoredDtoSchema,
    payload: {
      id: 'creature-1',
      label: overlongLabel,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'MONSTER',
      creatureTypeId: 'creature-type-1',
      size: 'MEDIUM',
      abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 10,
        CONSTITUTION: 10,
        INTELLIGENCE: 10,
        WISDOM: 10,
        CHARISMA: 10
      },
      armorClass: 10,
      hitPoints: 10,
      speeds: []
    }
  },
  {
    name: 'equipment',
    schema: equipmentAuthoredDtoSchema,
    payload: {
      kind: 'EQUIPMENT',
      id: 'equipment-1',
      label: overlongLabel,
      description: null,
      rarityId: 'common',
      userId: 'user-1',
      systemId: 'system-1',
      weight: { amount: 1, unit: 'POUNDS' },
      properties: [],
      category: 'ADVENTURING_GEAR'
    }
  },
  {
    name: 'feat',
    schema: featAuthoredDtoSchema,
    payload: {
      id: 'feat-1',
      label: overlongLabel,
      description: 'Description',
      userId: 'user-1',
      systemId: 'system-1'
    }
  },
  {
    name: 'race',
    schema: raceAuthoredDtoSchema,
    payload: {
      id: 'race-1',
      label: overlongLabel,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'SUBRACE',
      parentRaceId: 'parent-race-1'
    }
  },
  {
    name: 'spell',
    schema: spellAuthoredDtoSchema,
    payload: {
      kind: 'SPELL',
      id: 'spell-1',
      label: overlongLabel,
      description: 'Description',
      castingTime: { unit: 'ROUND', amount: 1 },
      level: 1,
      classIds: [],
      magicSchoolId: 'evocation',
      userId: 'user-1',
      systemId: 'system-1'
    }
  },
  {
    name: 'vehicle',
    schema: vehicleAuthoredDtoSchema,
    payload: {
      id: 'vehicle-1',
      label: overlongLabel,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'LAND'
    }
  }
]

describe('authored input limits', () => {
  it.each(primitiveBoundaryCases)(
    '$name accepts its exact limit and rejects limit + 1',
    (testCase) => {
      expect(testCase.schema.safeParse(testCase.exact).success).toBe(true)
      expect(testCase.schema.safeParse(testCase.plusOne).success).toBe(false)
    }
  )

  it.each(authoredRootBoundaryCases)(
    '$name accepts an exact-limit label and rejects limit + 1',
    ({ schema, payload }) => {
      expect(schema.safeParse({ ...payload, label: exactLabel }).success).toBe(true)
      expect(schema.safeParse(payload).success).toBe(false)
    }
  )

  it.each([
    [-1, false],
    [0, true],
    [9, true],
    [10, false]
  ])('validates spell level %i', (level, expected) => {
    expect(
      spellAuthoredDtoSchema.safeParse({
        kind: 'SPELL',
        id: 'spell-1',
        label: 'Spell',
        description: 'Description',
        castingTime: { unit: 'ROUND', amount: 1 },
        level,
        classIds: [],
        magicSchoolId: 'evocation',
        userId: 'user-1',
        systemId: 'system-1'
      }).success
    ).toBe(expected)
  })

  it('accepts the facet nesting limit and rejects limit + 1 without overflowing the stack', () => {
    expect(
      facetDtoSchema.safeParse(createNestedFacet(AUTHORED_LIMITS.facetNestingDepth)).success
    ).toBe(true)
    expect(
      facetDtoSchema.safeParse(createNestedFacet(AUTHORED_LIMITS.facetNestingDepth + 1)).success
    ).toBe(false)
  })

  it('counts malformed tag-like rich text that the renderer displays', () => {
    expect(
      authoredRichTextSchema.safeParse(
        `< ${'x'.repeat(AUTHORED_LIMITS.richTextVisibleCharacters)} >`
      ).success
    ).toBe(false)
  })
})

describe('authored nonnegative magnitudes', () => {
  it.each([
    ['fixed damage', (amount: number) => ({ amount, valueKind: 'FIXED', scalingKind: 'NONE' })],
    ['pool damage', (amount: number) => ({ amount, valueKind: 'POOL', scalingKind: 'NONE' })],
    [
      'per-level damage',
      (amount: number) => ({
        valueKind: 'FIXED',
        scalingKind: 'PER_LEVEL',
        scalingSource: 'CHARACTER_LEVEL',
        levels: [{ id: 'level-1', level: 1, order: 1, amount }]
      })
    ],
    [
      'breakpoint damage',
      (amount: number) => ({
        valueKind: 'FIXED',
        scalingKind: 'BREAKPOINTS',
        scalingSource: 'CHARACTER_LEVEL',
        breakpoints: [{ id: 'level-1', level: 1, order: 1, value: { amount } }]
      })
    ]
  ])('%s rejects negative amounts and accepts zero', (_name, payload) => {
    const base = { id: 'damage-1', effectKind: 'DAMAGE', damageTypeId: 'fire' }
    expect(damageDtoSchema.safeParse({ ...base, ...payload(-1) }).success).toBe(false)
    expect(damageDtoSchema.safeParse({ ...base, ...payload(0) }).success).toBe(true)
  })

  it.each(['min', 'max', 'multiplier'] as const)(
    'rejects negative damage bonus %s values and accepts zero',
    (field) => {
      const base = {
        id: 'damage-bonus-1',
        bonusKind: 'PROFICIENCY_BONUS',
        order: 1
      }
      expect(damageBonusDtoSchema.safeParse({ ...base, [field]: -1 }).success).toBe(false)
      expect(damageBonusDtoSchema.safeParse({ ...base, [field]: 0 }).success).toBe(true)
    }
  )

  it.each(['amount', 'multiplier', 'min', 'max'] as const)(
    'rejects negative pool-damage %s values and accepts zero',
    (field) => {
      const payload = (value: number) => ({
        id: 'damage-1',
        effectKind: 'DAMAGE',
        damageTypeId: 'fire',
        valueKind: 'POOL',
        scalingKind: 'PER_LEVEL',
        scalingSource: 'CHARACTER_LEVEL',
        [field]: value
      })
      expect(damageDtoSchema.safeParse(payload(-1)).success).toBe(false)
      expect(damageDtoSchema.safeParse(payload(0)).success).toBe(true)
    }
  )

  it('rejects negative fixed-damage multipliers', () => {
    const payload = (multiplier: number) => ({
      id: 'damage-1',
      effectKind: 'DAMAGE',
      damageTypeId: 'fire',
      amount: 1,
      valueKind: 'FIXED',
      scalingKind: 'NONE',
      multiplier
    })
    expect(damageDtoSchema.safeParse(payload(-1)).success).toBe(false)
    expect(damageDtoSchema.safeParse(payload(0)).success).toBe(true)
  })

  it.each(['min', 'max', 'multiplier'] as const)(
    'rejects negative healing and charge bonus %s values and accepts zero',
    (field) => {
      const healPayload = (value: number) => ({
        id: 'heal-1',
        effectKind: 'HEAL',
        amount: 1,
        valueKind: 'FIXED',
        scalingKind: 'NONE',
        bonuses: [{ id: 'heal-bonus-1', bonusKind: 'PROFICIENCY_BONUS', order: 1, [field]: value }]
      })
      const chargePayload = (value: number) => ({
        id: 'charge-bonus-1',
        bonusKind: 'PROFICIENCY_BONUS',
        order: 1,
        [field]: value
      })

      expect(healDtoSchema.safeParse(healPayload(-1)).success).toBe(false)
      expect(healDtoSchema.safeParse(healPayload(0)).success).toBe(true)
      expect(chargeBonusDtoSchema.safeParse(chargePayload(-1)).success).toBe(false)
      expect(chargeBonusDtoSchema.safeParse(chargePayload(0)).success).toBe(true)
    }
  )

  it('rejects negative static saving-throw bonuses', () => {
    const payload = (amount: number) => ({
      id: 'save-1',
      dcMethod: 'FIXED_DC',
      abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
      baseDc: 10,
      bonuses: [{ id: 'save-bonus-1', bonusKind: 'STATIC_BONUS', amount }]
    })
    expect(savingThrowDtoSchema.safeParse(payload(-1)).success).toBe(false)
    expect(savingThrowDtoSchema.safeParse(payload(0)).success).toBe(true)
  })

  it('rejects negative bonus magnitudes while preserving signed penalties', () => {
    const payload = (
      modifierKind: 'BONUS' | 'PENALTY',
      value: { amount?: number; multiplier?: number; valueKind: 'FIXED' | 'PROFICIENCY_BONUS' }
    ) => ({
      grantKind: 'MODIFIER_GRANT',
      id: `${modifierKind.toLowerCase()}-1`,
      order: 1,
      selectionKind: 'GRANTED',
      valueDomainCode: 'ARMOR_CLASS',
      domain: {},
      modifierKind,
      scope: 'GLOBAL',
      payload: value
    })
    expect(
      modifierGrantDtoSchema.safeParse(payload('BONUS', { valueKind: 'FIXED', amount: -1 })).success
    ).toBe(false)
    expect(
      modifierGrantDtoSchema.safeParse(
        payload('BONUS', { valueKind: 'PROFICIENCY_BONUS', multiplier: -1 })
      ).success
    ).toBe(false)
    expect(
      modifierGrantDtoSchema.safeParse(payload('BONUS', { valueKind: 'FIXED', amount: 0 })).success
    ).toBe(true)
    expect(
      modifierGrantDtoSchema.safeParse(payload('PENALTY', { valueKind: 'FIXED', amount: -1 }))
        .success
    ).toBe(true)
  })

  it('rejects negative equipment maximum bonuses', () => {
    const payload = (maxBonus: number) => ({
      kind: 'EQUIPMENT',
      id: 'equipment-1',
      label: 'Equipment',
      description: null,
      rarityId: 'common',
      userId: 'user-1',
      systemId: 'system-1',
      weight: { amount: 1, unit: 'POUNDS' },
      properties: [],
      category: 'ADVENTURING_GEAR',
      maxBonus
    })
    expect(equipmentAuthoredDtoSchema.safeParse(payload(-1)).success).toBe(false)
    expect(equipmentAuthoredDtoSchema.safeParse(payload(0)).success).toBe(true)
  })
})

function createNestedFacet(depth: number): Record<string, unknown> {
  let where: Record<string, unknown> = {
    groups: [{ id: `body-${depth}`, order: 0 }]
  }

  for (let index = depth - 2; index >= 0; index -= 1) {
    where = {
      groups: [
        {
          id: `body-${index}`,
          order: index,
          conditions: [createExistsCondition(index, where)]
        }
      ]
    }
  }

  return {
    id: 'nested-facet',
    groups: [
      {
        id: 'group-1',
        order: 0,
        contexts: [
          {
            id: 'context-1',
            order: 0,
            subject: 'CHARACTER',
            conditions: [createExistsCondition(-1, where)]
          }
        ]
      }
    ]
  }
}

function createExistsCondition(index: number, where: Record<string, unknown>) {
  return {
    id: `exists-${index}`,
    order: index,
    kind: 'EXISTS',
    constraint: 'INCLUDE',
    relationCode: 'FEATURE',
    where
  }
}
