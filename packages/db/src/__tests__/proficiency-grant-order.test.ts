import { describe, expect, it } from 'vitest'

import type { ProficiencyGrantAuthored } from '@artificer-toolkit/shared/authored'
import type { DBLike } from '#types'
import { createProficiencyGrantRepository } from '../repositories/index.js'
import { upsertProficiencyGrant } from '../domains/grants/upserts/proficiency.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

const savingThrowGrant: ProficiencyGrantAuthored = {
  id: 'saving-throw-grant',
  grantKind: 'PROFICIENCY_GRANT',
  proficiencyKind: 'SAVE_ABILITY',
  order: 0,
  selectionKind: 'GRANTED',
  scalingKind: 'NONE',
  authoringModeKind: 'SELECTED',
  abilities: ['STRENGTH', 'CONSTITUTION'],
  level: 'FULL'
}

describe('save-ability proficiency order', () => {
  it('persists the authored ability order', async () => {
    const db = new InMemoryDb()

    await upsertProficiencyGrant(db as unknown as DBLike, savingThrowGrant)

    expect(db.snapshot('proficiency_grant_save_abilities')).toEqual([
      {
        proficiency_grant_id: savingThrowGrant.id,
        ability_code: 'STRENGTH',
        sort_order: 1
      },
      {
        proficiency_grant_id: savingThrowGrant.id,
        ability_code: 'CONSTITUTION',
        sort_order: 2
      }
    ])
  })

  it('hydrates by persisted order instead of database row order', async () => {
    const db = new InMemoryDb()
    await upsertProficiencyGrant(db as unknown as DBLike, savingThrowGrant)
    await db
      .deleteFrom('proficiency_grant_save_abilities')
      .where('proficiency_grant_id', '=', savingThrowGrant.id)
      .execute()
    await db
      .insertInto('proficiency_grant_save_abilities')
      .values([
        {
          proficiency_grant_id: savingThrowGrant.id,
          ability_code: 'CONSTITUTION',
          sort_order: 2
        },
        {
          proficiency_grant_id: savingThrowGrant.id,
          ability_code: 'STRENGTH',
          sort_order: 1
        }
      ])
      .execute()

    const repository = createProficiencyGrantRepository(db as unknown as DBLike)

    await expect(repository.findById(savingThrowGrant.id)).resolves.toEqual(savingThrowGrant)
  })
})
