import { describe, expect, it } from 'vitest'

import { featureBaseDtoSchema } from '../features/base.js'
import { classAuthoredDtoSchema } from '../subjects/class.js'
import { creatureAuthoredDtoSchema } from '../subjects/creature.js'
import { raceAuthoredDtoSchema } from '../subjects/race.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'
import { vehicleAuthoredDtoSchema } from '../subjects/vehicle.js'

const abilityScores = {
  STRENGTH: 10,
  DEXTERITY: 10,
  CONSTITUTION: 10,
  INTELLIGENCE: 10,
  WISDOM: 10,
  CHARISMA: 10
}

describe('authored closed-vocabulary contracts', () => {
  it.each([
    [
      raceAuthoredDtoSchema,
      {
        id: 'race-1',
        label: 'Race',
        userId: 'user-1',
        systemId: 'system-1',
        category: 'BASE',
        selectionMode: 'DIRECT',
        size: 'not a size',
        speeds: []
      }
    ],
    [
      creatureAuthoredDtoSchema,
      {
        id: 'creature-1',
        label: 'Creature',
        userId: 'user-1',
        systemId: 'system-1',
        category: 'MONSTER',
        creatureTypeId: 'creature-type-1',
        size: 'not a size',
        abilityScores,
        naturalArmorBonus: 0,
        hitPoints: 10,
        speeds: []
      }
    ],
    [
      vehicleAuthoredDtoSchema,
      {
        id: 'vehicle-1',
        label: 'Vehicle',
        userId: 'user-1',
        systemId: 'system-1',
        category: 'LAND',
        size: 'not a size'
      }
    ]
  ])('rejects malformed size codes', (schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(false)
  })

  it('enforces class, subclass, and spellcasting attribute vocabularies', () => {
    expect(
      classAuthoredDtoSchema.safeParse({
        id: 'class-1',
        label: 'Class',
        userId: 'user-1',
        systemId: 'system-1',
        category: 'SUBCLASS',
        parentClassId: 'parent-class-1',
        attributes: ['NOT_A_CLASS_ATTRIBUTE']
      }).success
    ).toBe(false)

    expect(
      classAuthoredDtoSchema.safeParse({
        id: 'class-1',
        label: 'Class',
        userId: 'user-1',
        systemId: 'system-1',
        category: 'SUBCLASS',
        parentClassId: 'parent-class-1',
        spellcasting: {
          spellLimits: [],
          maxSpellLevel: 9,
          attributes: ['NOT_A_SPELLCASTING_ATTRIBUTE'],
          charges: {
            id: 'slots',
            resetKind: 'LONG_REST',
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            amount: 1
          }
        }
      }).success
    ).toBe(false)
  })

  it('enforces feature and spell attribute vocabularies', () => {
    expect(
      featureBaseDtoSchema.safeParse({
        id: 'feature-1',
        label: 'Feature',
        description: 'Feature description.',
        order: 0,
        attributes: ['NOT_A_FEATURE_ATTRIBUTE']
      }).success
    ).toBe(false)

    expect(
      spellAuthoredDtoSchema.safeParse({
        kind: 'SPELL',
        id: 'spell-1',
        label: 'Spell',
        description: 'Spell description.',
        castingTime: { unit: 'ROUND', amount: 1 },
        level: 1,
        classIds: [],
        magicSchoolId: 'evocation',
        userId: 'user-1',
        systemId: 'system-1',
        attributes: ['NOT_A_SPELL_ATTRIBUTE']
      }).success
    ).toBe(false)
  })

  it('normalizes bounded canonical Feature reusable-definition IDs', () => {
    const first = '11111111-1111-4111-8111-111111111111'
    const second = '22222222-2222-4222-8222-222222222222'
    expect(
      featureBaseDtoSchema.parse({
        id: 'feature-1',
        label: 'Feature',
        description: 'Feature description.',
        order: 0,
        ruleDefinitionIds: [first.toUpperCase(), second]
      }).ruleDefinitionIds
    ).toEqual([first, second])
    for (const ruleDefinitionIds of [
      [second, first],
      [first, first],
      Array.from({ length: 17 }, () => first)
    ]) {
      expect(() =>
        featureBaseDtoSchema.parse({
          id: 'feature-1',
          label: 'Feature',
          description: 'Feature description.',
          order: 0,
          ruleDefinitionIds
        })
      ).toThrow()
    }
  })

  it('rejects non-measurement speed units', () => {
    expect(
      raceAuthoredDtoSchema.safeParse({
        id: 'race-1',
        label: 'Race',
        userId: 'user-1',
        systemId: 'system-1',
        category: 'BASE',
        selectionMode: 'DIRECT',
        size: 'MEDIUM',
        speeds: [{ speedId: 'walking', amount: 30, unit: 'BANANAS' }]
      }).success
    ).toBe(false)
  })
})
