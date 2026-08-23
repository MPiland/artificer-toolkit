import { describe, expect, it } from 'vitest'
import type { DBLike } from '../types/index.js'
import { createCampaignAdjustmentsRepository } from '../repositories/campaignAdjustments.js'

describe('campaign adjustments repository', () => {
  it('increments the expected version before saving an existing adjustment', async () => {
    const whereCalls: unknown[][] = []
    let values: unknown
    const builder = {
      set: (next: unknown) => {
        values = next
        return builder
      },
      where: (...args: unknown[]) => {
        whereCalls.push(args)
        return builder
      },
      returningAll: () => builder,
      executeTakeFirst: async () => undefined
    }
    const db = { updateTable: () => builder } as unknown as DBLike

    await expect(
      createCampaignAdjustmentsRepository(db).saveAdjustment({
        campaignId: 'campaign-1',
        characterId: 'character-1',
        family: 'SPEED',
        slotKey: 'base',
        payload: {},
        visibility: 'VISIBLE',
        createdBy: 'gm-1',
        expectedVersion: 2,
        updatedAt: '2026-08-06T12:00:00.000Z'
      })
    ).resolves.toBeNull()

    expect(values).toMatchObject({ version: 3 })
    expect(whereCalls).toContainEqual(['version', '=', 2])
  })

  it('applies the subject visibility and keyset cursor to player history', async () => {
    const cursorWhereCalls: unknown[][] = []
    const calls: unknown[][] = []
    const expressionBuilder = Object.assign((...args: unknown[]) => ({ comparison: args }), {
      and: (parts: unknown[]) => ({ and: parts }),
      or: (parts: unknown[]) => ({ or: parts })
    })
    const cursorBuilder = {
      select: () => cursorBuilder,
      where: (...args: unknown[]) => {
        cursorWhereCalls.push(args)
        return cursorBuilder
      },
      executeTakeFirst: async () => ({ created_at: '2026-08-06T12:00:00.000Z', id: 'event-2' })
    }
    const listBuilder = {
      selectAll: () => listBuilder,
      where: (...args: unknown[]) => {
        calls.push([
          'where',
          typeof args[0] === 'function'
            ? (args[0] as (builder: typeof expressionBuilder) => unknown)(expressionBuilder)
            : args
        ])
        return listBuilder
      },
      orderBy: (...args: unknown[]) => {
        calls.push(['orderBy', ...args])
        return listBuilder
      },
      limit: (...args: unknown[]) => {
        calls.push(['limit', ...args])
        return listBuilder
      },
      execute: async () => []
    }
    let selectCount = 0
    const db = {
      selectFrom: () => (selectCount++ === 0 ? cursorBuilder : listBuilder)
    } as unknown as DBLike

    await expect(
      createCampaignAdjustmentsRepository(db).listVisibleEvents({
        campaignId: 'campaign-1',
        viewer: { kind: 'SUBJECT', characterId: 'character-1' },
        cursorId: 'event-2',
        limit: 25
      })
    ).resolves.toEqual([])

    expect(calls).toContainEqual(['limit', 26])
    expect(cursorWhereCalls).toContainEqual(['kind', '!=', 'CAMPAIGN_COPIED'])
    expect(calls).toContainEqual(['where', ['kind', '!=', 'CAMPAIGN_COPIED']])
    expect(calls).toContainEqual(['orderBy', 'created_at', 'desc'])
    expect(calls).toContainEqual(['orderBy', 'id', 'desc'])
    expect(calls).toContainEqual([
      'where',
      {
        or: [
          { comparison: ['visibility', '=', 'TABLE'] },
          {
            and: [
              { comparison: ['visibility', '=', 'SUBJECT'] },
              { comparison: ['subject_character_id', '=', 'character-1'] }
            ]
          }
        ]
      }
    ])
  })

  it('deletes only the expected adjustment revision', async () => {
    const whereCalls: unknown[][] = []
    const builder = {
      where: (...args: unknown[]) => {
        whereCalls.push(args)
        return builder
      },
      returning: () => builder,
      executeTakeFirst: async () => undefined
    }
    const db = { deleteFrom: () => builder } as unknown as DBLike

    await expect(
      createCampaignAdjustmentsRepository(db).deleteAdjustmentById({
        campaignId: 'campaign-1',
        id: 'adjustment-1',
        expectedVersion: 4
      })
    ).resolves.toBe(false)

    expect(whereCalls).toContainEqual(['version', '=', 4])
  })
})
