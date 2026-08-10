import { describe, expect, it } from 'vitest'
import type { DBLike } from '../types/index.js'
import { createCampaignCollaborationRepository } from '../repositories/campaignCollaboration.js'

describe('campaign collaboration repository', () => {
  it('applies the membership cutoff and keyset cursor before fetching limit plus one', async () => {
    const cursorCalls: unknown[][] = []
    const listCalls: unknown[][] = []
    const expressionBuilder = Object.assign((...args: unknown[]) => ({ comparison: args }), {
      and: (parts: unknown[]) => ({ and: parts }),
      or: (parts: unknown[]) => ({ or: parts })
    })
    const cursorBuilder = {
      select: (...args: unknown[]) => {
        cursorCalls.push(['select', ...args])
        return cursorBuilder
      },
      where: (...args: unknown[]) => {
        cursorCalls.push(['where', ...args])
        return cursorBuilder
      },
      executeTakeFirst: async () => ({
        created_at: '2026-08-06T12:00:00.000Z',
        id: '00000000-0000-0000-0000-000000000002'
      })
    }
    const listBuilder = {
      selectAll: () => listBuilder,
      where: (...args: unknown[]) => {
        listCalls.push([
          'where',
          typeof args[0] === 'function'
            ? (args[0] as (builder: typeof expressionBuilder) => unknown)(expressionBuilder)
            : args
        ])
        return listBuilder
      },
      orderBy: (...args: unknown[]) => {
        listCalls.push(['orderBy', ...args])
        return listBuilder
      },
      limit: (...args: unknown[]) => {
        listCalls.push(['limit', ...args])
        return listBuilder
      },
      execute: async () => []
    }
    let selectCount = 0
    const db = {
      selectFrom: () => (selectCount++ === 0 ? cursorBuilder : listBuilder)
    } as unknown as DBLike

    await expect(
      createCampaignCollaborationRepository(db).listRoomEntries({
        campaignId: 'campaign-1',
        room: 'PARTY',
        conversationId: 'conversation-1',
        accessStartedAt: '2026-08-01T00:00:00.000Z',
        cursorId: '00000000-0000-0000-0000-000000000002',
        limit: 25
      })
    ).resolves.toEqual([])

    expect(cursorCalls).toContainEqual(['where', 'created_at', '>=', '2026-08-01T00:00:00.000Z'])
    expect(listCalls).toContainEqual(['where', ['created_at', '>=', '2026-08-01T00:00:00.000Z']])
    expect(listCalls).toContainEqual(['where', ['conversation_id', '=', 'conversation-1']])
    expect(listCalls).toContainEqual(['limit', 26])
    expect(listCalls).toContainEqual(['orderBy', 'created_at', 'desc'])
    expect(listCalls).toContainEqual(['orderBy', 'id', 'desc'])
    expect(listCalls).toContainEqual([
      'where',
      {
        or: [
          {
            comparison: ['created_at', '<', '2026-08-06T12:00:00.000Z']
          },
          {
            and: [
              {
                comparison: ['created_at', '=', '2026-08-06T12:00:00.000Z']
              },
              {
                comparison: ['id', '<', '00000000-0000-0000-0000-000000000002']
              }
            ]
          }
        ]
      }
    ])
  })

  it('does not expose room traffic counts', () => {
    const repository = createCampaignCollaborationRepository({} as DBLike)
    expect(Object.keys(repository).filter((name) => /count.*room|room.*count/i.test(name))).toEqual(
      []
    )
  })

  it('uses the room selected by entry lookups without querying the conversation again', async () => {
    let selectCount = 0
    const entry = {
      id: 'entry-1',
      campaign_id: 'campaign-1',
      conversation_id: 'conversation-1',
      kind: 'CHAT',
      author_user_id: 'user-1',
      author_character_id: null,
      mode: 'OOC',
      body: 'Hello',
      roll_payload: null,
      username_snapshot: 'User',
      character_name_snapshot: null,
      client_nonce: 'nonce-1',
      edited_at: null,
      unsent_at: null,
      created_at: '2026-08-06T12:00:00.000Z',
      room: 'PARTY'
    }
    const builder = {
      innerJoin: () => builder,
      selectAll: () => builder,
      select: () => builder,
      where: () => builder,
      executeTakeFirst: async () => entry
    }
    const db = {
      selectFrom: () => {
        selectCount += 1
        return builder
      }
    } as unknown as DBLike
    const repository = createCampaignCollaborationRepository(db)

    await expect(
      repository.findIdempotentRoomEntry({
        campaignId: 'campaign-1',
        authorUserId: 'user-1',
        clientNonce: 'nonce-1'
      })
    ).resolves.toMatchObject({ room: 'PARTY' })
    await expect(repository.findRoomEntry('campaign-1', 'entry-1')).resolves.toMatchObject({
      room: 'PARTY'
    })
    expect(selectCount).toBe(2)
  })

  it('returns null when an expected-version update loses the race', async () => {
    const whereCalls: unknown[][] = []
    let updatedValues: unknown
    const builder = {
      set: (values: unknown) => {
        updatedValues = values
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
      createCampaignCollaborationRepository(db).updateCampaignNoteSection({
        campaignId: 'campaign-1',
        id: 'note-1',
        expectedVersion: 3,
        title: 'People',
        content: '<p>Updated</p>',
        visibility: 'SHARED',
        category: 'PEOPLE',
        sortOrder: 1,
        updatedBy: 'user-1',
        updatedAt: '2026-08-06T12:00:00.000Z'
      })
    ).resolves.toBeNull()

    expect(whereCalls).toContainEqual(['version', '=', 3])
    expect(updatedValues).toMatchObject({ category: 'PEOPLE', version: 4 })
  })

  it('tombstones an authored chat by clearing its body', async () => {
    const whereCalls: unknown[][] = []
    let updatedValues: unknown
    const builder = {
      set: (values: unknown) => {
        updatedValues = values
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
      createCampaignCollaborationRepository(db).tombstoneChat({
        campaignId: 'campaign-1',
        id: 'entry-1',
        authorUserId: 'user-1',
        unsentAt: '2026-08-06T12:00:00.000Z'
      })
    ).resolves.toBeNull()

    expect(updatedValues).toEqual({
      body: null,
      unsent_at: '2026-08-06T12:00:00.000Z'
    })
    expect(whereCalls).toContainEqual(['author_user_id', '=', 'user-1'])
    expect(whereCalls).toContainEqual(['kind', '=', 'CHAT'])
    expect(whereCalls).toContainEqual(['unsent_at', 'is', null])
  })
})
