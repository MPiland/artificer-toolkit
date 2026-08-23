import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { getCharacterPreparationOptionsQuery } from '../domains/subjects/queries/getCharacterPreparationOptionsQuery.js'
import type { DBLike } from '../types/index.js'

type QueryTrace = {
  table: string
  joins: string[]
  filters: string[]
  referenceFilters: string[]
  orderBy: string[]
}

function createQueryDb(rows: Array<{ id: string; label: string; level: number }>) {
  const trace: QueryTrace = {
    table: '',
    joins: [],
    filters: [],
    referenceFilters: [],
    orderBy: []
  }
  const query = {
    innerJoin(table: string) {
      trace.joins.push(table)
      return query
    },
    leftJoin(table: string, callback: (join: unknown) => unknown) {
      trace.joins.push(table)
      const join = {
        onRef() {
          return join
        },
        on() {
          return join
        }
      }
      callback(join)
      return query
    },
    select() {
      return query
    },
    where(column: string | ((expressionBuilder: unknown) => unknown)) {
      trace.filters.push(typeof column === 'string' ? column : '<expression>')
      return query
    },
    whereRef(left: string, _operation: string, right: string) {
      trace.referenceFilters.push(`${left}=${right}`)
      return query
    },
    orderBy(column: string) {
      trace.orderBy.push(column)
      return query
    },
    async execute() {
      return rows
    }
  }
  const db = {
    selectFrom(table: string) {
      trace.table = table
      return query
    }
  } as unknown as DBLike
  return { db, trace }
}

describe('getCharacterPreparationOptionsQuery', () => {
  it('loads only exact current active Spell summaries for an active Campaign viewer', async () => {
    const { db, trace } = createQueryDb([{ id: 'spell-1', label: 'Healing Word', level: 1 }])

    await expect(
      getCharacterPreparationOptionsQuery(db, {
        spellIds: ['spell-1'],
        systemId: 'system-1',
        ownerUserId: 'owner-1',
        viewerUserId: 'viewer-1',
        campaignId: 'campaign-1'
      })
    ).resolves.toEqual([{ id: 'spell-1', label: 'Healing Word', level: 1 }])

    expect(trace).toEqual({
      table: 'spells as spell',
      joins: [
        'spell_catalog_index_versions as catalog_index',
        'campaign_memberships as viewer_membership',
        'campaign_content_shares as share',
        'campaign_memberships as sharer_membership'
      ],
      filters: [
        'spell.id',
        'spell.system_id',
        'spell.status',
        'viewer_membership.user_id',
        '<expression>'
      ],
      referenceFilters: ['catalog_index.authored_version_id=spell.active_version_id'],
      orderBy: ['spell.label', 'spell.id']
    })

    const source = readFileSync(
      new URL(
        '../domains/subjects/queries/getCharacterPreparationOptionsQuery.ts',
        import.meta.url
      ),
      'utf8'
    )
    expect(source).toContain(".on('viewer_membership.user_id', '=', input.viewerUserId)")
    expect(source).toContain(".onRef('share.shared_by', '=', 'spell.user_id')")
    expect(source).toContain(".on('sharer_membership.status', '=', 'ACTIVE')")
    expect(source).not.toContain('spell_versions')
  })

  it('does not query when policy eligibility is empty', async () => {
    const { db, trace } = createQueryDb([])
    await expect(
      getCharacterPreparationOptionsQuery(db, {
        spellIds: [],
        systemId: 'system-1',
        ownerUserId: 'owner-1',
        viewerUserId: 'owner-1',
        campaignId: null
      })
    ).resolves.toEqual([])
    expect(trace.table).toBe('')
  })
})
