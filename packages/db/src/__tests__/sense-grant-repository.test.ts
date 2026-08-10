import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/grants/upserts/sense.js', () => ({
  upsertSenseGrant: vi.fn(async () => {})
}))

import { createGrantRepositoryTestDb } from './helpers/grant-repository-test-db.js'
import { createSenseGrantRepository } from '../repositories/index.js'

describe('sense grant repositories', () => {
  it('hydrates a sense grant with per-level progression', async () => {
    const repository = createSenseGrantRepository(
      createGrantRepositoryTestDb({
        sense_grants: [
          {
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
          }
        ],
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
        sense_grant_scaling_level_senses: [{ scaling_level_id: 'level-1', sense_id: 'sense-1' }],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

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

  it('fails loudly when a class-level sense progression is missing its class id', async () => {
    const repository = createSenseGrantRepository(
      createGrantRepositoryTestDb({
        sense_grants: [
          {
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
          }
        ],
        sense_grant_senses: [],
        sense_grant_scaling_levels: [],
        sense_grant_scaling_level_senses: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('sense-grant-bad-class')).rejects.toThrow('missing class_id')
  })

  it('fails loudly when a granted sense progression level persists selection_count', async () => {
    const repository = createSenseGrantRepository(
      createGrantRepositoryTestDb({
        sense_grants: [
          {
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
          }
        ],
        sense_grant_senses: [],
        sense_grant_scaling_levels: [
          {
            id: 'sense-level-unexpected-count',
            sense_grant_id: 'sense-grant-unexpected-count',
            level: 2,
            sort_order: 1,
            authoring_mode_kind: 'ALL',
            selection_count: 1
          }
        ],
        sense_grant_scaling_level_senses: [],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('sense-grant-unexpected-count')).rejects.toThrow(
      'cannot hydrate selection_count for GRANTED payload'
    )
  })

  it('fails loudly when an all-mode sense progression level has persisted selected sense rows', async () => {
    const repository = createSenseGrantRepository(
      createGrantRepositoryTestDb({
        sense_grants: [
          {
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
          }
        ],
        sense_grant_senses: [],
        sense_grant_scaling_levels: [
          {
            id: 'sense-level-bad-all',
            sense_grant_id: 'sense-grant-bad-all-level-sense-ids',
            level: 2,
            sort_order: 1,
            authoring_mode_kind: 'ALL',
            selection_count: null
          }
        ],
        sense_grant_scaling_level_senses: [
          { scaling_level_id: 'sense-level-bad-all', sense_id: 'sense-1' }
        ],
        charges: [],
        charge_limits: [],
        charge_scaling_levels: [],
        charge_bonuses: []
      }) as never
    )

    await expect(repository.findById('sense-grant-bad-all-level-sense-ids')).rejects.toThrow(
      'cannot hydrate senseIds when authoring_mode_kind is ALL'
    )
  })
})
