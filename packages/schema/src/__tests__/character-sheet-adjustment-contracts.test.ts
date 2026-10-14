import { describe, expect, it } from 'vitest'
import { AUTHORED_LENGTH_AMOUNT_MAX } from '../shared/authoredLimits.js'
import {
  characterMovementDisplayPreferenceDtoSchema,
  characterResourceOwnerRefDtoSchema,
  characterSheetAdjustmentWriteDtoSchema
} from '../api/characterSheet.js'

const characterId = '10000000-0000-4000-8000-000000000001'
const actorId = '10000000-0000-4000-8000-000000000002'
const adjustmentId = '10000000-0000-4000-8000-000000000003'
const targetId = '10000000-0000-4000-8000-000000000004'

const metadata = {
  id: adjustmentId,
  characterId,
  actorId,
  sourceNote: 'Player adjustment'
}

describe('character Sheet adjustment contracts', () => {
  it.each([
    {
      ...metadata,
      family: 'ABILITY',
      ability: 'STRENGTH',
      field: 'OTHER_MODIFIER',
      value: 2
    },
    {
      ...metadata,
      family: 'SAVING_THROW',
      ability: 'DEXTERITY',
      field: 'PROFICIENCY_OVERRIDE',
      value: 'DOUBLE'
    },
    {
      ...metadata,
      family: 'SKILL',
      skillId: targetId,
      field: 'GOVERNING_ABILITY_OVERRIDE',
      value: 'WISDOM'
    },
    {
      ...metadata,
      family: 'PASSIVE',
      skillId: targetId,
      field: 'TOTAL_OVERRIDE',
      value: 18
    },
    {
      ...metadata,
      family: 'SENSE',
      senseId: targetId,
      field: 'RANGE_OVERRIDE',
      value: { amount: 60, unit: 'FEET' }
    },
    {
      ...metadata,
      family: 'MOVEMENT',
      speedId: targetId,
      field: 'SPEED_OVERRIDE',
      value: { amount: 35, unit: 'FEET' }
    },
    {
      ...metadata,
      family: 'HIT_POINTS',
      field: 'MAXIMUM_MODIFIER',
      value: -5
    },
    {
      ...metadata,
      family: 'SPELL',
      source: {
        spellId: targetId,
        sourceKind: 'CLASS',
        sourceInstanceId: 'class-instance'
      },
      field: 'DC_BONUS',
      value: 1
    },
    {
      ...metadata,
      family: 'ITEM',
      itemInstanceId: targetId,
      field: 'SILVERED',
      value: true
    },
    {
      ...metadata,
      family: 'COMPANION',
      companionInstanceId: targetId,
      field: 'SIZE_OVERRIDE',
      value: 'MEDIUM'
    },
    {
      ...metadata,
      family: 'DEFENSE',
      defenseKind: 'RESISTANCE',
      damageTypeId: targetId,
      field: 'ADDITION',
      value: true
    },
    {
      ...metadata,
      family: 'PROFICIENCY',
      proficiencyKind: 'TOOL',
      targetId,
      field: 'ADDITION',
      value: true
    }
  ])('parses a closed $family adjustment', (adjustment) => {
    expect(characterSheetAdjustmentWriteDtoSchema.parse(adjustment)).toEqual(adjustment)
  })

  it('rejects field/value combinations outside the closed union', () => {
    expect(() =>
      characterSheetAdjustmentWriteDtoSchema.parse({
        ...metadata,
        family: 'SKILL',
        skillId: targetId,
        field: 'PROFICIENCY_OVERRIDE',
        value: 2
      })
    ).toThrow()
  })

  it('types a sense range override as a length, never a bare number', () => {
    const sense = { ...metadata, family: 'SENSE', senseId: targetId, field: 'RANGE_OVERRIDE' }
    expect(() => characterSheetAdjustmentWriteDtoSchema.parse({ ...sense, value: 30 })).toThrow()
    expect(
      characterSheetAdjustmentWriteDtoSchema.parse({
        ...sense,
        value: { amount: 30, unit: 'FEET' }
      })
    ).toMatchObject({ value: { amount: 30, unit: 'FEET' } })
  })

  it('types a speed override as a length, never a bare number', () => {
    const speed = { ...metadata, family: 'MOVEMENT', speedId: targetId, field: 'SPEED_OVERRIDE' }
    for (const value of [
      35,
      { amount: 35 },
      { amount: 35, unit: 'FURLONGS' },
      { amount: 35, unit: 'feet' },
      { amount: AUTHORED_LENGTH_AMOUNT_MAX + 1, unit: 'FEET' },
      { amount: -5, unit: 'FEET' }
    ])
      expect(
        () => characterSheetAdjustmentWriteDtoSchema.parse({ ...speed, value }),
        JSON.stringify(value)
      ).toThrow()
    expect(
      characterSheetAdjustmentWriteDtoSchema.parse({
        ...speed,
        value: { amount: 12, unit: 'YARDS' }
      })
    ).toMatchObject({ value: { amount: 12, unit: 'YARDS' } })
  })

  it('keeps source notes short and single-line', () => {
    expect(() =>
      characterSheetAdjustmentWriteDtoSchema.parse({
        ...metadata,
        sourceNote: 'First line\nSecond line',
        family: 'ABILITY',
        ability: 'STRENGTH',
        field: 'SCORE_OVERRIDE',
        value: 18
      })
    ).toThrow()
  })

  it('keeps manual provenance note-only', () => {
    const adjustment = characterSheetAdjustmentWriteDtoSchema.parse({
      ...metadata,
      sourceCategory: 'MAGIC',
      sourceLabel: 'Arcane focus',
      family: 'ABILITY',
      ability: 'INTELLIGENCE',
      field: 'OTHER_MODIFIER',
      value: 1
    })

    expect(adjustment).not.toHaveProperty('sourceCategory')
    expect(adjustment).not.toHaveProperty('sourceLabel')
    expect(adjustment).toMatchObject({ sourceNote: 'Player adjustment' })
  })

  it('requires an available explicit movement identity', () => {
    expect(characterMovementDisplayPreferenceDtoSchema.parse({ mode: 'AUTO' })).toEqual({
      mode: 'AUTO'
    })
    expect(
      characterMovementDisplayPreferenceDtoSchema.parse({
        mode: 'EXPLICIT',
        speedId: targetId
      })
    ).toEqual({ mode: 'EXPLICIT', speedId: targetId })
  })

  it('keeps resource owners instance scoped', () => {
    expect(
      characterResourceOwnerRefDtoSchema.parse({
        kind: 'ITEM_INSTANCE',
        chargeId: 'charges',
        itemInstanceId: targetId
      })
    ).toEqual({
      kind: 'ITEM_INSTANCE',
      chargeId: 'charges',
      itemInstanceId: targetId
    })
  })
})
