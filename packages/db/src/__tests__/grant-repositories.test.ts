import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/grants/upserts/feat.js', () => ({
  upsertFeatGrant: vi.fn(async () => {})
}))

vi.mock('../domains/grants/upserts/sense.js', () => ({
  upsertSenseGrant: vi.fn(async () => {})
}))

vi.mock('../domains/grants/upserts/spell.js', () => ({
  upsertSpellGrant: vi.fn(async () => {})
}))

import { createFeatGrantRepository } from '../repositories/index.js'
import { createSenseGrantRepository } from '../repositories/index.js'
import { createSpellGrantRepository } from '../repositories/index.js'

type RowMap = Record<string, unknown[]>

function createFakeDb(rowsByTable: RowMap) {
  return {
    selectFrom(table: string) {
      const state = {
        filtered: [...(rowsByTable[table] ?? [])]
      }

      const builder = {
        select() {
          return builder
        },
        selectAll() {
          return builder
        },
        where(column: string, op: string, value: string | string[]) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            if (op === 'in' && Array.isArray(value)) {
              return value.includes(String(record[column]))
            }

            return record[column] === value
          })
          return builder
        },
        orderBy(column: string) {
          state.filtered = [...state.filtered].sort((left, right) => {
            const leftValue = (left as Record<string, number | string>)[column]
            const rightValue = (right as Record<string, number | string>)[column]
            return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
          })
          return builder
        },
        async execute() {
          return state.filtered
        },
        async executeTakeFirst() {
          return state.filtered[0] ?? undefined
        }
      }

      return builder
    }
  }
}

describe('grant repositories', () => {
  it('hydrates a feat grant with root selected feats and charge', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-1',
        sort_order: 1,
        selection_kind: 'CHOSEN',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'SELECTED',
        selection_count: 2,
        selection_duplicate_policy: 'UNIQUE',
        scaling_source: null,
        class_id: null,
        charge_id: 'charge-1',
        restriction_id: null
      }],
      feat_grant_feats: [
        { feat_grant_id: 'feat-grant-1', feat_id: 'feat-1' },
        { feat_grant_id: 'feat-grant-1', feat_id: 'feat-2' }
      ],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [{ id: 'charge-1', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
      charge_limits: [{ charge_id: 'charge-1', limit_kind: 'FIXED_AMOUNT', class_id: null, amount: 3, multiplier: null, min: null, max: null }],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('feat-grant-1')).resolves.toEqual({
      id: 'feat-grant-1',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      count: 2,
      selectionDuplicatePolicy: 'UNIQUE',
      featIds: ['feat-1', 'feat-2'],
      charges: {
        id: 'charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 3,
        bonuses: undefined
      }
    })
  })

  it('hydrates a feat grant with an ability-modifier charge limit', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-ability-charge',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: null,
        class_id: null,
        charge_id: 'charge-ability',
        restriction_id: null
      }],
      feat_grant_feats: [],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [{ id: 'charge-ability', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
      charge_limits: [{
        charge_id: 'charge-ability',
        limit_kind: 'ABILITY_MODIFIER',
        class_id: null,
        ability_code: 'WISDOM',
        amount: null,
        multiplier: 1,
        min: 1,
        max: null
      }],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('feat-grant-ability-charge')).resolves.toEqual({
      id: 'feat-grant-ability-charge',
      grantKind: 'FEAT_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      featIds: undefined,
      charges: {
        id: 'charge-ability',
        resetKind: 'LONG_REST',
        limitKind: 'ABILITY_MODIFIER',
        scalingKind: 'NONE',
        ability: 'WISDOM',
        multiplier: 1,
        min: 1,
        max: undefined,
        bonuses: undefined
      }
    })
  })

  it('hydrates a sense grant with per-level progression', async () => {
    const repository = createSenseGrantRepository(createFakeDb({
      sense_grants: [{
        id: 'sense-grant-1',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'PER_LEVEL',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: 'PARENT_CLASS_LEVEL',
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      sense_grant_senses: [],
      sense_grant_scaling_levels: [
        {
          id: 'level-1',
          sense_grant_id: 'sense-grant-1',
          level: 3,
          sort_order: 1,
          authoring_mode_kind: 'SELECTED',
          selection_count: null
        }
      ],
      sense_grant_scaling_level_senses: [
        { scaling_level_id: 'level-1', sense_id: 'sense-1' }
      ],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('sense-grant-1')).resolves.toEqual({
      id: 'sense-grant-1',
      grantKind: 'SENSE_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'PER_LEVEL',
      progression: {
        scalingSource: 'PARENT_CLASS_LEVEL',
        classId: undefined,
        levels: [
          {
            id: 'level-1',
            level: 3,
            order: 1,
            authoringModeKind: 'SELECTED',
            count: undefined,
            senseIds: ['sense-1']
          }
        ]
      },
      charges: undefined
    })
  })

  it('hydrates a spell grant with per-level selected payload and cast override', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
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
      charge_limits: [{ charge_id: 'charge-1', limit_kind: 'FIXED_AMOUNT', class_id: null, amount: 1, multiplier: null, min: null, max: null }],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

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
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
        cast_at_level: null
      }],
      spell_grant_attributes: [
        { spell_grant_id: 'spell-grant-explicit-attributes', attribute_code: 'CAST_AT_WILL', sort_order: 1 },
        { spell_grant_id: 'spell-grant-explicit-attributes', attribute_code: 'SELF_ONLY', sort_order: 2 }
      ],
      spell_grant_spells: [],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-explicit-attributes')).resolves.toEqual({
      id: 'spell-grant-explicit-attributes',
      grantKind: 'SPELL_GRANT',
      order: 1,
      castAtLevel: undefined,
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

  it('fails loudly when a hydrated charge skill bonus row is missing its skill id', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-bad-charge',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: null,
        class_id: null,
        charge_id: 'charge-bad-skill',
        restriction_id: null
      }],
      feat_grant_feats: [],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [{ id: 'charge-bad-skill', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
      charge_limits: [{ charge_id: 'charge-bad-skill', limit_kind: 'FIXED_AMOUNT', class_id: null, amount: 1, multiplier: null, min: null, max: null }],
      charge_scaling_levels: [],
      charge_bonuses: [{
        id: 'charge-bonus-bad-skill',
        charge_id: 'charge-bad-skill',
        bonus_kind: 'SKILL_BONUS',
        ability_code: null,
        skill_id: null,
        multiplier: null,
        min: null,
        max: null,
        sort_order: 1
      }]
    }) as never)

    await expect(repository.findById('feat-grant-bad-charge')).rejects.toThrow(
      'missing skill_id'
    )
  })

  it('fails loudly when a hydrated class-level charge is missing class ownership', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
      spell_grant_attributes: [],
      spell_grant_spells: [],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [{ id: 'charge-bad-class', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
      charge_limits: [{ charge_id: 'charge-bad-class', limit_kind: 'CLASS_LEVEL', class_id: null, amount: null, multiplier: 1, min: null, max: null }],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-bad-charge')).rejects.toThrow(
      'missing class_id'
    )
  })

  it('fails loudly when a chosen feat grant is missing its persisted count', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-bad-count',
        sort_order: 1,
        selection_kind: 'CHOSEN',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: null,
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      feat_grant_feats: [],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('feat-grant-bad-count')).rejects.toThrow(
      'missing selection_count'
    )
  })

  it('fails loudly when a granted feat grant persists selection_count', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-unexpected-count',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'ALL',
        selection_count: 1,
        scaling_source: null,
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      feat_grant_feats: [],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('feat-grant-unexpected-count')).rejects.toThrow(
      'cannot hydrate selection_count for GRANTED payload'
    )
  })

  it('fails loudly when a class-level feat progression is missing its class id', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-bad-class',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'PER_LEVEL',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: 'CLASS_LEVEL',
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      feat_grant_feats: [],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('feat-grant-bad-class')).rejects.toThrow(
      'missing class_id'
    )
  })

  it('fails loudly when a class-level sense progression is missing its class id', async () => {
    const repository = createSenseGrantRepository(createFakeDb({
      sense_grants: [{
        id: 'sense-grant-bad-class',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'PER_LEVEL',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: 'CLASS_LEVEL',
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      sense_grant_senses: [],
      sense_grant_scaling_levels: [],
      sense_grant_scaling_level_senses: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('sense-grant-bad-class')).rejects.toThrow(
      'missing class_id'
    )
  })

  it('fails loudly when a granted sense progression level persists selection_count', async () => {
    const repository = createSenseGrantRepository(createFakeDb({
      sense_grants: [{
        id: 'sense-grant-unexpected-count',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'PER_LEVEL',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: 'CHARACTER_LEVEL',
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      sense_grant_senses: [],
      sense_grant_scaling_levels: [{
        id: 'sense-level-unexpected-count',
        sense_grant_id: 'sense-grant-unexpected-count',
        level: 2,
        sort_order: 1,
        authoring_mode_kind: 'ALL',
        selection_count: 1
      }],
      sense_grant_scaling_level_senses: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('sense-grant-unexpected-count')).rejects.toThrow(
      'cannot hydrate selection_count for GRANTED payload'
    )
  })

  it('fails loudly when a class-level spell progression is missing its class id', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
      spell_grant_attributes: [],
      spell_grant_spells: [],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-bad-progression-class')).rejects.toThrow(
      'missing class_id'
    )
  })

  it('fails loudly when a feat grant has an invalid persisted selection kind', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-bad-selection-kind',
        sort_order: 1,
        selection_kind: 'MAYBE',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: null,
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      feat_grant_feats: [],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('feat-grant-bad-selection-kind')).rejects.toThrow(
      'invalid selection_kind'
    )
  })

  it('fails loudly when a spell grant has an invalid persisted scaling kind', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
      spell_grant_attributes: [],
      spell_grant_spells: [],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-bad-scaling-kind')).rejects.toThrow(
      'invalid scaling_kind'
    )
  })

  it('fails loudly when a granted spell grant persists selection_count', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
      spell_grant_attributes: [],
      spell_grant_spells: [],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-unexpected-count')).rejects.toThrow(
      'cannot hydrate selection_count for GRANTED payload'
    )
  })

  it('fails loudly when a spell grant has an invalid persisted attribute code', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
      spell_grant_attributes: [
        { spell_grant_id: 'spell-grant-bad-attribute', attribute_code: 'SOMETIMES', sort_order: 1 }
      ],
      spell_grant_spells: [],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-bad-attribute')).rejects.toThrow(
      'invalid attribute_code'
    )
  })

  it('fails loudly when a spell grant hydrates charges without LIMITED_USE', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
      spell_grant_attributes: [
        { spell_grant_id: 'spell-grant-bad-limited-use', attribute_code: 'CAST_AT_WILL', sort_order: 1 }
      ],
      spell_grant_spells: [],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [{ id: 'charge-1', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
      charge_limits: [{ charge_id: 'charge-1', limit_kind: 'FIXED_AMOUNT', class_id: null, amount: 1, multiplier: null, min: null, max: null }],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-bad-limited-use')).rejects.toThrow(
      'cannot hydrate charges without LIMITED_USE'
    )
  })

  it('fails loudly when a spell grant hydrates castAtLevel without CAST_AT_LEVEL', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
      spell_grant_attributes: [
        { spell_grant_id: 'spell-grant-bad-cast-level', attribute_code: 'CAST_AT_WILL', sort_order: 1 }
      ],
      spell_grant_spells: [],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-bad-cast-level')).rejects.toThrow(
      'cannot hydrate castAtLevel without CAST_AT_LEVEL'
    )
  })

  it('fails loudly when an all-mode feat grant has persisted selected feat rows', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-bad-all-feat-ids',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: null,
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      feat_grant_feats: [{ feat_grant_id: 'feat-grant-bad-all-feat-ids', feat_id: 'feat-1' }],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('feat-grant-bad-all-feat-ids')).rejects.toThrow(
      'cannot hydrate featIds when authoring_mode_kind is ALL'
    )
  })

  it('fails loudly when an all-mode sense progression level has persisted selected sense rows', async () => {
    const repository = createSenseGrantRepository(createFakeDb({
      sense_grants: [{
        id: 'sense-grant-bad-all-level-sense-ids',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'PER_LEVEL',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: 'CHARACTER_LEVEL',
        class_id: null,
        charge_id: null,
        restriction_id: null
      }],
      sense_grant_senses: [],
      sense_grant_scaling_levels: [{
        id: 'sense-level-bad-all',
        sense_grant_id: 'sense-grant-bad-all-level-sense-ids',
        level: 2,
        sort_order: 1,
        authoring_mode_kind: 'ALL',
        selection_count: null
      }],
      sense_grant_scaling_level_senses: [{ scaling_level_id: 'sense-level-bad-all', sense_id: 'sense-1' }],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('sense-grant-bad-all-level-sense-ids')).rejects.toThrow(
      'cannot hydrate senseIds when authoring_mode_kind is ALL'
    )
  })

  it('fails loudly when an all-mode spell grant has persisted selected spell rows', async () => {
    const repository = createSpellGrantRepository(createFakeDb({
      spell_grants: [{
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
      }],
      spell_grant_attributes: [],
      spell_grant_spells: [{ spell_grant_id: 'spell-grant-bad-all-spell-ids', spell_id: 'spell-1' }],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: [],
      charges: [],
      charge_limits: [],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('spell-grant-bad-all-spell-ids')).rejects.toThrow(
      'cannot hydrate spellIds when authoring_mode_kind is ALL'
    )
  })

  it('fails loudly when a hydrated charge has an invalid reset kind', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-bad-reset',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: null,
        class_id: null,
        charge_id: 'charge-bad-reset',
        restriction_id: null
      }],
      feat_grant_feats: [],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [{ id: 'charge-bad-reset', scaling_kind: 'NONE', reset_kind: 'EVENTUALLY' }],
      charge_limits: [{ charge_id: 'charge-bad-reset', limit_kind: 'FIXED_AMOUNT', class_id: null, amount: 1, multiplier: null, min: null, max: null }],
      charge_scaling_levels: [],
      charge_bonuses: []
    }) as never)

    await expect(repository.findById('feat-grant-bad-reset')).rejects.toThrow(
      'invalid reset_kind'
    )
  })

  it('fails loudly when a hydrated charge ability bonus has an invalid ability code', async () => {
    const repository = createFeatGrantRepository(createFakeDb({
      feat_grants: [{
        id: 'feat-grant-bad-charge-ability',
        sort_order: 1,
        selection_kind: 'GRANTED',
        scaling_kind: 'NONE',
        authoring_mode_kind: 'ALL',
        selection_count: null,
        scaling_source: null,
        class_id: null,
        charge_id: 'charge-bad-ability',
        restriction_id: null
      }],
      feat_grant_feats: [],
      feat_grant_scaling_levels: [],
      feat_grant_scaling_level_feats: [],
      charges: [{ id: 'charge-bad-ability', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
      charge_limits: [{ charge_id: 'charge-bad-ability', limit_kind: 'FIXED_AMOUNT', class_id: null, amount: 1, multiplier: null, min: null, max: null }],
      charge_scaling_levels: [],
      charge_bonuses: [{
        id: 'charge-bonus-bad-ability',
        charge_id: 'charge-bad-ability',
        bonus_kind: 'ABILITY_MODIFIER',
        ability_code: 'LUCK',
        skill_id: null,
        multiplier: null,
        min: null,
        max: null,
        sort_order: 1
      }]
    }) as never)

    await expect(repository.findById('feat-grant-bad-charge-ability')).rejects.toThrow(
      'invalid ability_code'
    )
  })
})
