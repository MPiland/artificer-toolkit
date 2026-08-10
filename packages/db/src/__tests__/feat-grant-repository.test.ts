import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/grants/upserts/feat.js', () => ({
  upsertFeatGrant: vi.fn(async () => {})
}))

import { createGrantRepositoryTestDb } from './helpers/grant-repository-test-db.js'
import { createFeatGrantRepository } from '../repositories/index.js'

describe('feat grant repositories', () => {
  it('hydrates a feat grant with root selected feats and charge', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [
          { feat_grant_id: 'feat-grant-1', feat_id: 'feat-1' },
          { feat_grant_id: 'feat-grant-1', feat_id: 'feat-2' }
        ],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [{ id: 'charge-1', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
        charge_limits: [
          {
            charge_id: 'charge-1',
            limit_kind: 'FIXED_AMOUNT',
            class_id: null,
            amount: 3,
            multiplier: null,
            min: null,
            max: null
          }
        ],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

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
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [{ id: 'charge-ability', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
        charge_limits: [
          {
            charge_id: 'charge-ability',
            limit_kind: 'ABILITY_MODIFIER',
            class_id: null,
            ability_code: 'WISDOM',
            amount: null,
            multiplier: 1,
            min: 1,
            max: null
          }
        ],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

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

  it('fails loudly when a hydrated charge skill bonus row is missing its skill id', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [{ id: 'charge-bad-skill', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
        charge_limits: [
          {
            charge_id: 'charge-bad-skill',
            limit_kind: 'FIXED_AMOUNT',
            class_id: null,
            amount: 1,
            multiplier: null,
            min: null,
            max: null
          }
        ],
        charge_scaling_levels: [],
        charge_bonuses: [
          {
            id: 'charge-bonus-bad-skill',
            charge_id: 'charge-bad-skill',
            bonus_kind: 'SKILL_BONUS',
            ability_code: null,
            skill_id: null,
            multiplier: null,
            min: null,
            max: null,
            sort_order: 1
          }
        ]
      }) as never
    )

    await expect(repository.findById('feat-grant-bad-charge')).rejects.toThrow('missing skill_id')
  })

  it('fails loudly when a chosen feat grant is missing its persisted count', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('feat-grant-bad-count')).rejects.toThrow(
      'missing selection_count'
    )
  })

  it('fails loudly when a granted feat grant persists selection_count', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('feat-grant-unexpected-count')).rejects.toThrow(
      'cannot hydrate selection_count for GRANTED payload'
    )
  })

  it('fails loudly when a class-level feat progression is missing its class id', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('feat-grant-bad-class')).rejects.toThrow('missing class_id')
  })

  it('fails loudly when a feat grant has an invalid persisted selection kind', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('feat-grant-bad-selection-kind')).rejects.toThrow(
      'invalid selection_kind'
    )
  })

  it('fails loudly when an all-mode feat grant has persisted selected feat rows', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [{ feat_grant_id: 'feat-grant-bad-all-feat-ids', feat_id: 'feat-1' }],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('feat-grant-bad-all-feat-ids')).rejects.toThrow(
      'cannot hydrate featIds when authoring_mode_kind is ALL'
    )
  })

  it('fails loudly when a hydrated charge has an invalid reset kind', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [{ id: 'charge-bad-reset', scaling_kind: 'NONE', reset_kind: 'EVENTUALLY' }],
        charge_limits: [
          {
            charge_id: 'charge-bad-reset',
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

    await expect(repository.findById('feat-grant-bad-reset')).rejects.toThrow('invalid reset_kind')
  })

  it('fails loudly when a hydrated charge ability bonus has an invalid ability code', async () => {
    const repository = createFeatGrantRepository(
      createGrantRepositoryTestDb({
        feat_grants: [
          {
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
          }
        ],
        feat_grant_feats: [],
        feat_grant_scaling_levels: [],
        feat_grant_scaling_level_feats: [],
        charges: [{ id: 'charge-bad-ability', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }],
        charge_limits: [
          {
            charge_id: 'charge-bad-ability',
            limit_kind: 'FIXED_AMOUNT',
            class_id: null,
            amount: 1,
            multiplier: null,
            min: null,
            max: null
          }
        ],
        charge_scaling_levels: [],
        charge_bonuses: [
          {
            id: 'charge-bonus-bad-ability',
            charge_id: 'charge-bad-ability',
            bonus_kind: 'ABILITY_MODIFIER',
            ability_code: 'LUCK',
            skill_id: null,
            multiplier: null,
            min: null,
            max: null,
            sort_order: 1
          }
        ]
      }) as never
    )

    await expect(repository.findById('feat-grant-bad-charge-ability')).rejects.toThrow(
      'invalid ability_code'
    )
  })
})
