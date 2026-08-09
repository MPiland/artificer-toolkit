import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '../types/index.js'

const sqlState = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  statements: [] as string[]
}))

vi.mock('kysely', () => {
  function render(value: unknown): string {
    return typeof value === 'object' && value !== null && 'text' in value
      ? String((value as { text: unknown }).text)
      : String(value)
  }

  const template = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings
      .map((piece, index) => `${piece}${index < values.length ? render(values[index]) : ''}`)
      .join('')

    return {
      text,
      execute: async () => {
        sqlState.statements.push(text)
        return { rows: sqlState.rows }
      }
    }
  }
  const sql = Object.assign(template, {
    join: (values: unknown[]) => ({ text: values.map(render).join(', ') }),
    table: (value: string) => ({ text: value })
  })

  return { sql }
})

import {
  CampaignContentBindingMismatchError,
  createCampaignContentRepository
} from '../repositories/campaignContent.js'

describe('campaign content repository', () => {
  beforeEach(() => {
    sqlState.rows = []
    sqlState.statements.length = 0
  })

  it('locks the Campaign before root versions and assigns the next ordered revision', async () => {
    const calls: string[] = []
    const campaignBuilder = {
      select: () => {
        calls.push('campaign.select')
        return campaignBuilder
      },
      where: () => campaignBuilder,
      forUpdate: () => {
        calls.push('campaign.forUpdate')
        return campaignBuilder
      },
      executeTakeFirst: async () => {
        calls.push('campaign.execute')
        return { id: 'campaign-1' }
      }
    }
    const versionBuilder = {
      select: () => versionBuilder,
      where: () => versionBuilder,
      orderBy: (column: string, direction: string) => {
        calls.push(`versions.orderBy:${column}:${direction}`)
        return versionBuilder
      },
      forUpdate: () => {
        calls.push('versions.forUpdate')
        return versionBuilder
      },
      execute: async () => {
        calls.push('versions.execute')
        return [{ revision: 1 }, { revision: 3 }]
      }
    }
    const db = {
      selectFrom: (table: string) => (table === 'campaigns' ? campaignBuilder : versionBuilder)
    } as unknown as DBLike

    await expect(
      createCampaignContentRepository(db).lockNextRevision({
        campaignId: 'campaign-1',
        subjectKind: 'SPELL',
        subjectId: 'spell-1'
      })
    ).resolves.toBe(4)

    expect(calls).toEqual([
      'campaign.select',
      'campaign.forUpdate',
      'campaign.execute',
      'versions.orderBy:revision:asc',
      'versions.forUpdate',
      'versions.execute'
    ])
  })

  it('approves only a still-pending version and returns null when the state race is lost', async () => {
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
      createCampaignContentRepository(db).approvePendingContentVersion({
        campaignId: 'campaign-1',
        id: 'version-1',
        reviewerUserId: 'owner-1',
        reviewedAt: '2026-08-06T12:00:00.000Z'
      })
    ).resolves.toBeNull()

    expect(whereCalls).toContainEqual(['state', '=', 'PENDING'])
    expect(updatedValues).toMatchObject({
      state: 'APPROVED',
      approved_by: 'owner-1',
      approved_at: '2026-08-06T12:00:00.000Z'
    })
  })

  it('rejects a binding whose version belongs to a different Campaign root', async () => {
    let inserted = false
    const versionBuilder = {
      select: () => versionBuilder,
      where: () => versionBuilder,
      executeTakeFirst: async () => ({
        campaign_id: 'campaign-2',
        subject_kind: 'SPELL',
        subject_id: 'spell-1',
        state: 'APPROVED'
      })
    }
    const db = {
      selectFrom: () => versionBuilder,
      insertInto: () => {
        inserted = true
        return {}
      }
    } as unknown as DBLike

    await expect(
      createCampaignContentRepository(db).bindCharacterRoot({
        campaignId: 'campaign-1',
        characterId: 'character-1',
        subjectKind: 'SPELL',
        subjectId: 'spell-1',
        contentVersionId: 'version-1'
      })
    ).rejects.toBeInstanceOf(CampaignContentBindingMismatchError)
    expect(inserted).toBe(false)
  })

  it('locks affected Character bindings in deterministic Character order', async () => {
    const orderCalls: unknown[][] = []
    const builder = {
      selectAll: () => builder,
      where: () => builder,
      orderBy: (...args: unknown[]) => {
        orderCalls.push(args)
        return builder
      },
      forUpdate: () => builder,
      execute: async () => [
        {
          campaign_id: 'campaign-1',
          character_id: 'character-b',
          subject_kind: 'SPELL',
          subject_id: 'spell-1',
          content_version_id: 'version-1',
          created_at: '2026-08-06T12:00:00.000Z',
          updated_at: '2026-08-06T12:00:00.000Z'
        },
        {
          campaign_id: 'campaign-1',
          character_id: 'character-a',
          subject_kind: 'SPELL',
          subject_id: 'spell-1',
          content_version_id: 'version-1',
          created_at: '2026-08-06T12:00:00.000Z',
          updated_at: '2026-08-06T12:00:00.000Z'
        }
      ]
    }
    const db = { selectFrom: () => builder } as unknown as DBLike

    const bindings = await createCampaignContentRepository(db).lockRootBindings({
      campaignId: 'campaign-1',
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })

    expect(orderCalls).toContainEqual(['character_id', 'asc'])
    expect(bindings.map((binding) => binding.characterId)).toEqual(['character-a', 'character-b'])
  })

  it('validates and replaces one Character binding set in deterministic root order', async () => {
    let inserted: Array<{ subject_kind: string; subject_id: string }> = []
    let deleted = false
    let validated = 0
    const versionBuilder = {
      select: () => versionBuilder,
      where: () => versionBuilder,
      executeTakeFirst: async () => ({
        campaign_id: 'campaign-1',
        subject_kind: 'SPELL',
        subject_id: validated++ === 0 ? 'spell-a' : 'spell-b',
        state: 'APPROVED'
      })
    }
    const deleteBuilder = {
      where: () => deleteBuilder,
      execute: async () => {
        deleted = true
      }
    }
    const insertBuilder = {
      values: (values: Array<{ subject_kind: string; subject_id: string }>) => {
        inserted = values
        return insertBuilder
      },
      execute: async () => undefined
    }
    const db = {
      selectFrom: () => versionBuilder,
      deleteFrom: () => deleteBuilder,
      insertInto: () => insertBuilder
    } as unknown as DBLike

    await createCampaignContentRepository(db).replaceCharacterBindings({
      campaignId: 'campaign-1',
      characterId: 'character-1',
      bindings: [
        { subjectKind: 'SPELL', subjectId: 'spell-b', contentVersionId: 'version-b' },
        { subjectKind: 'SPELL', subjectId: 'spell-a', contentVersionId: 'version-a' }
      ]
    })

    expect(deleted).toBe(true)
    expect(inserted.map((binding) => binding.subject_id)).toEqual(['spell-a', 'spell-b'])
  })

  it('deletes assignment bindings while returning structural roots and version snapshots', async () => {
    sqlState.rows = [
      {
        subject_kind: 'RACE',
        subject_id: 'race-1',
        content_version_id: 'version-race',
        revision: 2,
        snapshot: { label: 'Campaign Race' }
      },
      {
        subject_kind: 'CLASS',
        subject_id: 'class-1',
        content_version_id: 'version-class',
        revision: 4,
        snapshot: { label: 'Campaign Class' }
      }
    ]

    const removed = await createCampaignContentRepository({} as DBLike).deleteAssignmentBindings(
      'campaign-1',
      'character-1'
    )

    expect(removed).toEqual([
      {
        subjectKind: 'CLASS',
        subjectId: 'class-1',
        contentVersionId: 'version-class',
        revision: 4,
        snapshot: { label: 'Campaign Class' }
      },
      {
        subjectKind: 'RACE',
        subjectId: 'race-1',
        contentVersionId: 'version-race',
        revision: 2,
        snapshot: { label: 'Campaign Race' }
      }
    ])
    expect(sqlState.statements[0]).toContain(
      'delete from campaign_character_content_bindings binding'
    )
    expect(sqlState.statements[0]).toContain('version.snapshot')
  })
})
