import { describe, expect, it } from 'vitest'
import type { DBLike } from '#types'
import { hydrateChargeById } from '../domains/grants/repositories/helpers.js'
import { upsertCharge } from '../domains/shared/upserts/charge.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

type TestDb = DBLike & InMemoryDb

function createDb(): TestDb {
  return new InMemoryDb() as unknown as TestDb
}

describe('source charge persistence', () => {
  it('persists a nested source charge as cost-only and clears stale owned charge children', async () => {
    const db = createDb()
    const chargeId = 'warping-strike-charge-use'

    db.insertRow('charges', {
      id: chargeId,
      scaling_kind: 'PER_LEVEL',
      reset_kind: 'DAILY'
    }, ['id'], 'none')
    db.insertRow('charge_scaling_levels', {
      id: 'stale-scaling-level',
      charge_id: chargeId,
      level: 5,
      amount: 2,
      sort_order: 5
    }, ['id'], 'none')
    db.insertRow('charge_bonuses', {
      id: 'stale-charge-bonus',
      charge_id: chargeId,
      bonus_kind: 'PROFICIENCY_BONUS',
      ability_code: null,
      skill_id: null,
      multiplier: null,
      min: null,
      max: null,
      sort_order: 1
    }, ['id'], 'none')

    await upsertCharge(db, {
      id: chargeId,
      limitKind: 'SOURCE_CHARGES',
      scalingKind: 'NONE',
      cost: 1
    })

    expect(db.snapshot('charges')).toEqual([
      { id: chargeId, scaling_kind: 'NONE', reset_kind: null }
    ])
    expect(db.snapshot('charge_limits')).toEqual([
      {
        charge_id: chargeId,
        limit_kind: 'SOURCE_CHARGES',
        class_id: null,
        ability_code: null,
        amount: null,
        cost: 1,
        multiplier: null,
        min: null,
        max: null
      }
    ])
    expect(db.snapshot('charge_scaling_levels')).toEqual([])
    expect(db.snapshot('charge_bonuses')).toEqual([])

    await expect(hydrateChargeById(db, chargeId, true)).resolves.toEqual({
      id: chargeId,
      limitKind: 'SOURCE_CHARGES',
      scalingKind: 'NONE',
      cost: 1
    })
    await expect(hydrateChargeById(db, chargeId)).rejects.toThrow(
      'cannot use SOURCE_CHARGES in this authored position'
    )
  })
})
