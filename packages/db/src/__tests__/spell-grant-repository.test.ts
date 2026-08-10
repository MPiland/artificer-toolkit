import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/grants/upserts/spell.js', () => ({
  upsertSpellGrant: vi.fn(async () => {})
}))

import { createGrantRepositoryTestDb } from './helpers/grant-repository-test-db.js'
import { createSpellGrantRepository } from '../repositories/index.js'

describe('spell grant repositories', () => {
  it('hydrates a spell grant with per-level selected payload and cast override', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-1',
            sort_order: 2,
            selection_kind: 'CHOSEN',
            scaling_kind: 'PER_LEVEL',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            selection_duplicate_policy: null,
            scaling_source: 'CLASS_LEVEL',
            class_id: 'class-1',
            charge_id: 'charge-1',
            restriction_id: null,
            filter_id: null,
            cast_at_level: 2
          }
        ],
        spell_grant_attributes: [
          { spell_grant_id: 'spell-grant-1', attribute_code: 'LIMITED_USE', sort_order: 1 },
          { spell_grant_id: 'spell-grant-1', attribute_code: 'CAST_AT_LEVEL', sort_order: 2 }
        ],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [
          {
            id: 'spell-level-1',
            spell_grant_id: 'spell-grant-1',
            level: 5,
            sort_order: 1,
            authoring_mode_kind: 'SELECTED',
            selection_count: 1,
            selection_duplicate_policy: 'UNIQUE'
          }
        ],
        spell_grant_scaling_level_spells: [
          { scaling_level_id: 'spell-level-1', spell_id: 'spell-1' }
        ],
        charges: [{ id: 'charge-1', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
        charge_limits: [
          {
            charge_id: 'charge-1',
            limit_kind: 'FIXED_AMOUNT',
            class_id: null,
            amount: 1,
            multiplier: null,
            min: null,
            max: null
          }
        ],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-1')).resolves.toEqual({
      id: 'spell-grant-1',
      grantKind: 'SPELL_GRANT',
      order: 2,
      castAtLevel: 2,
      attributes: ['LIMITED_USE', 'CAST_AT_LEVEL'],
      selectionKind: 'CHOSEN',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'CLASS_LEVEL',
        classId: 'class-1',
        levels: [
          {
            id: 'spell-level-1',
            level: 5,
            order: 1,
            authoringModeKind: 'SELECTED',
            count: 1,
            selectionDuplicatePolicy: 'UNIQUE',
            spellIds: ['spell-1']
          }
        ]
      },
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1,
        bonuses: undefined
      }
    })
  })

  it('hydrates explicit spell grant attributes without deriving them from charges or cast level', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-explicit-attributes',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'NONE',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            scaling_source: null,
            class_id: null,
            charge_id: null,
            restriction_id: null,
            filter_id: null,
            cast_at_level: null,
            casting_ability_code: 'INTELLIGENCE'
          }
        ],
        spell_grant_attributes: [
          {
            spell_grant_id: 'spell-grant-explicit-attributes',
            attribute_code: 'CAST_AT_WILL',
            sort_order: 1
          },
          {
            spell_grant_id: 'spell-grant-explicit-attributes',
            attribute_code: 'SELF_ONLY',
            sort_order: 2
          }
        ],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-explicit-attributes')).resolves.toEqual({
      id: 'spell-grant-explicit-attributes',
      grantKind: 'SPELL_GRANT',
      order: 1,
      castAtLevel: undefined,
      castingAbility: 'INTELLIGENCE',
      attributes: ['CAST_AT_WILL', 'SELF_ONLY'],
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: undefined,
      spellIds: undefined,
      charges: undefined,
      filters: undefined,
      restrictions: undefined
    })
  })

  it('fails loudly when a hydrated class-level charge is missing class ownership', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-bad-charge',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'NONE',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            scaling_source: null,
            class_id: null,
            charge_id: 'charge-bad-class',
            restriction_id: null,
            filter_id: null,
            cast_at_level: null
          }
        ],
        spell_grant_attributes: [],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [{ id: 'charge-bad-class', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
        charge_limits: [
          {
            charge_id: 'charge-bad-class',
            limit_kind: 'CLASS_LEVEL',
            class_id: null,
            amount: null,
            multiplier: 1,
            min: null,
            max: null
          }
        ],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-bad-charge')).rejects.toThrow('missing class_id')
  })

  it('fails loudly when a class-level spell progression is missing its class id', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-bad-progression-class',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'PER_LEVEL',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            scaling_source: 'CLASS_LEVEL',
            class_id: null,
            charge_id: null,
            restriction_id: null,
            filter_id: null,
            cast_at_level: null
          }
        ],
        spell_grant_attributes: [],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-bad-progression-class')).rejects.toThrow(
      'missing class_id'
    )
  })

  it('fails loudly when a spell grant has an invalid persisted scaling kind', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-bad-scaling-kind',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'SOMETIMES',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            scaling_source: null,
            class_id: null,
            charge_id: null,
            restriction_id: null,
            filter_id: null,
            cast_at_level: null
          }
        ],
        spell_grant_attributes: [],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-bad-scaling-kind')).rejects.toThrow(
      'invalid scaling_kind'
    )
  })

  it('fails loudly when a granted spell grant persists selection_count', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-unexpected-count',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'NONE',
            authoring_mode_kind: 'ALL',
            selection_count: 1,
            scaling_source: null,
            class_id: null,
            charge_id: null,
            restriction_id: null,
            filter_id: null,
            cast_at_level: null
          }
        ],
        spell_grant_attributes: [],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-unexpected-count')).rejects.toThrow(
      'cannot hydrate selection_count for GRANTED payload'
    )
  })

  it('fails loudly when a spell grant has an invalid persisted attribute code', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-bad-attribute',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'NONE',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            scaling_source: null,
            class_id: null,
            charge_id: null,
            restriction_id: null,
            filter_id: null,
            cast_at_level: null
          }
        ],
        spell_grant_attributes: [
          {
            spell_grant_id: 'spell-grant-bad-attribute',
            attribute_code: 'SOMETIMES',
            sort_order: 1
          }
        ],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-bad-attribute')).rejects.toThrow(
      'invalid attribute_code'
    )
  })

  it('fails loudly when a spell grant hydrates charges without LIMITED_USE', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-bad-limited-use',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'NONE',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            scaling_source: null,
            class_id: null,
            charge_id: 'charge-1',
            restriction_id: null,
            filter_id: null,
            cast_at_level: null
          }
        ],
        spell_grant_attributes: [
          {
            spell_grant_id: 'spell-grant-bad-limited-use',
            attribute_code: 'CAST_AT_WILL',
            sort_order: 1
          }
        ],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [{ id: 'charge-1', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
        charge_limits: [
          {
            charge_id: 'charge-1',
            limit_kind: 'FIXED_AMOUNT',
            class_id: null,
            amount: 1,
            multiplier: null,
            min: null,
            max: null
          }
        ],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-bad-limited-use')).rejects.toThrow(
      'cannot hydrate charges without LIMITED_USE'
    )
  })

  it('fails loudly when a spell grant hydrates castAtLevel without CAST_AT_LEVEL', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-bad-cast-level',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'NONE',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            scaling_source: null,
            class_id: null,
            charge_id: null,
            restriction_id: null,
            filter_id: null,
            cast_at_level: 3
          }
        ],
        spell_grant_attributes: [
          {
            spell_grant_id: 'spell-grant-bad-cast-level',
            attribute_code: 'CAST_AT_WILL',
            sort_order: 1
          }
        ],
        spell_grant_spells: [],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-bad-cast-level')).rejects.toThrow(
      'cannot hydrate castAtLevel without CAST_AT_LEVEL'
    )
  })

  it('fails loudly when an all-mode spell grant has persisted selected spell rows', async () => {
    const repository = createSpellGrantRepository(
      createGrantRepositoryTestDb({
        spell_grants: [
          {
            id: 'spell-grant-bad-all-spell-ids',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'NONE',
            authoring_mode_kind: 'ALL',
            selection_count: null,
            scaling_source: null,
            class_id: null,
            charge_id: null,
            restriction_id: null,
            filter_id: null,
            cast_at_level: null
          }
        ],
        spell_grant_attributes: [],
        spell_grant_spells: [
          { spell_grant_id: 'spell-grant-bad-all-spell-ids', spell_id: 'spell-1' }
        ],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('spell-grant-bad-all-spell-ids')).rejects.toThrow(
      'cannot hydrate spellIds when authoring_mode_kind is ALL'
    )
  })
})
