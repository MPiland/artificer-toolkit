import { describe, expect, it } from 'vitest'

import { chargeDtoSchema, chargeUseDtoSchema } from '../shared/charge.js'
import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { authoredDraftDtoSchema, authoredDraftSaveRequestDtoSchema } from '../api/content.js'

describe('saving throw DTOs', () => {
  it('accepts fixed, source, and derived DC methods', () => {
    expect(
      savingThrowDtoSchema.parse({
        id: 'fixed-save',
        dcMethod: 'FIXED_DC',
        ability: 'DEXTERITY',
        baseDc: 15,
        bonuses: [{ id: 'fixed-save-static', bonusKind: 'STATIC_BONUS', amount: 1 }]
      })
    ).toMatchObject({ dcMethod: 'FIXED_DC', baseDc: 15 })

    expect(
      savingThrowDtoSchema.parse({
        id: 'source-save',
        dcMethod: 'SOURCE_SAVE_DC',
        ability: 'WISDOM'
      })
    ).toMatchObject({ dcMethod: 'SOURCE_SAVE_DC' })

    expect(
      savingThrowDtoSchema.parse({
        id: 'derived-save',
        dcMethod: 'DERIVED_DC',
        ability: 'CONSTITUTION',
        baseDc: 8,
        bonuses: [
          { id: 'derived-save-ability', bonusKind: 'ABILITY_MODIFIER', ability: 'CONSTITUTION' },
          { id: 'derived-save-proficiency', bonusKind: 'PROFICIENCY_BONUS' }
        ]
      })
    ).toMatchObject({ dcMethod: 'DERIVED_DC', baseDc: 8 })
  })

  it('rejects legacy sourceAbility payloads', () => {
    expect(() =>
      savingThrowDtoSchema.parse({
        id: 'legacy-save',
        dcMethod: 'SOURCE_SAVE_DC',
        ability: 'DEXTERITY',
        sourceAbility: 'CONSTITUTION'
      })
    ).toThrow()
  })
})

describe('schema package parsing', () => {
  it('parses generic authored draft save and response contracts', () => {
    const saveRequest = authoredDraftSaveRequestDtoSchema.parse({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      systemId: 'system-1',
      label: 'Fire Lace',
      payload: {
        id: 'spell-1',
        kind: 'SPELL',
        label: 'Fire Lace',
        status: 'DRAFT'
      }
    })
    const draft = authoredDraftDtoSchema.parse({
      publicId: 'draft-1',
      ...saveRequest,
      userId: 'user-1',
      status: 'DRAFT',
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })

    expect(saveRequest.subjectKind).toBe('SPELL')
    expect(draft.payload.label).toBe('Fire Lace')
  })

  it('parses per-level charges with nested bonuses', () => {
    const parsed = chargeDtoSchema.parse({
      id: 'arcane-recovery',
      resetKind: 'LONG_REST',
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'PER_LEVEL',
      bonuses: [
        {
          id: 'prof-bonus',
          bonusKind: 'PROFICIENCY_BONUS',
          multiplier: 1,
          order: 1
        }
      ],
      levels: [
        { id: 'level-1', level: 1, amount: 1 },
        { id: 'level-5', level: 5, amount: 2 }
      ]
    })

    expect(parsed.scalingKind).toBe('PER_LEVEL')
    if (parsed.scalingKind !== 'PER_LEVEL') {
      throw new Error('Expected PER_LEVEL charge payload')
    }

    expect(parsed.levels).toHaveLength(2)
  })

  it('parses item charges that recover at dawn', () => {
    expect(
      chargeDtoSchema.parse({
        id: 'astral-tear-charges',
        resetKind: 'DAWN',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 3
      })
    ).toMatchObject({
      amount: 3,
      resetKind: 'DAWN'
    })
  })

  it('allows nested source charge consumption without allowing it as an owned pool', () => {
    const sourceCharge = {
      id: 'warping-strike-charges',
      limitKind: 'SOURCE_CHARGES',
      scalingKind: 'NONE',
      cost: 1
    } as const

    expect(chargeUseDtoSchema.parse(sourceCharge)).toEqual(sourceCharge)
    expect(chargeDtoSchema.safeParse(sourceCharge).success).toBe(false)
    expect(
      chargeUseDtoSchema.safeParse({
        ...sourceCharge,
        cost: 0
      }).success
    ).toBe(false)
  })
})
