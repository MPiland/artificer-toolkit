import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { ListCampaignInventoryAuditInput } from '@artificer-toolkit/schema/api/campaignInventory'
import {
  decodeCampaignInventoryAuditPage,
  type CampaignInventoryAuditPageTransport
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const audit = makeFunctionReference<
  'query',
  ListCampaignInventoryAuditInput,
  CampaignInventoryAuditPageTransport
>('campaigns/inventoryAudit:list')

describe('native Campaign inventory audit window', () => {
  it('bounds every page to 180 days without deleting history and rechecks expired cursors', async () => {
    const { t, owner, other } = await readySheetFixture()
    const campaign = await owner.caller.mutation(createCampaign, {
      name: 'Inventory audit window',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const now = Date.now() + 60_000
    const cutoff = now - 180 * 24 * 60 * 60 * 1000
    const times = [cutoff - 1, cutoff, cutoff, cutoff + 1_000, now]
    const ids = times.map(
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    )
    const foreignId = crypto.randomUUID()
    const nonAuditId = crypto.randomUUID()
    await t.run(async (ctx) => {
      for (const [index, time] of times.entries()) {
        await ctx.db.insert('campaignEvents', {
          id: ids[index]!,
          campaignId: campaign.id,
          actorUserId: owner.userId,
          type: 'PARTY_CURRENCY_ADJUST',
          visibility: 'OWNER',
          subjectCharacterId: null,
          // An expired malformed payload must not be loaded by this projection.
          payloadJson: index === 0 ? '{expired' : JSON.stringify({ fixture: true }),
          inventoryAudit: true as const,
          visibleInHistory: true,
          createdAt: new Date(time).toISOString()
        })
      }
      await ctx.db.insert('campaignEvents', {
        id: foreignId,
        campaignId: crypto.randomUUID(),
        actorUserId: other.userId,
        type: 'PARTY_CURRENCY_ADJUST',
        visibility: 'OWNER',
        subjectCharacterId: null,
        payloadJson: '{foreign',
        inventoryAudit: true as const,
        visibleInHistory: true,
        createdAt: new Date(now).toISOString()
      })
      await ctx.db.insert('campaignEvents', {
        id: nonAuditId,
        campaignId: campaign.id,
        actorUserId: owner.userId,
        type: 'FIXTURE_EVENT',
        visibility: 'OWNER',
        subjectCharacterId: null,
        payloadJson: '{nonAudit',
        visibleInHistory: true,
        createdAt: new Date(now).toISOString()
      })
    })
    const storedBefore = await t.run((ctx) => ctx.db.query('campaignEvents').collect())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    try {
      const first = await owner.caller.query(audit, { campaignId: campaign.id, limit: 2 })
      expect(first.events.map((event) => event.id)).toEqual([ids[4], ids[3]])
      expect(first.nextCursor).toBe(ids[3])
      const second = await owner.caller.query(audit, {
        campaignId: campaign.id,
        cursor: first.nextCursor!,
        limit: 1
      })
      expect(second.events.map((event) => event.id)).toEqual([ids[2]])
      expect(second.nextCursor).toBe(ids[2])
      const third = await owner.caller.query(audit, {
        campaignId: campaign.id,
        cursor: second.nextCursor!,
        limit: 1
      })
      expect(third.events.map((event) => event.id)).toEqual([ids[1]])
      expect(third.nextCursor).toBeNull()
      for (const cursor of [ids[0]!, foreignId, nonAuditId, crypto.randomUUID()]) {
        await expect(
          owner.caller.query(audit, { campaignId: campaign.id, cursor })
        ).resolves.toEqual({
          events: [],
          nextCursor: null
        })
      }
      await expect(other.caller.query(audit, { campaignId: campaign.id })).rejects.toThrow()
      vi.setSystemTime(now + 1)
      await expect(
        owner.caller.query(audit, { campaignId: campaign.id, cursor: ids[2] })
      ).resolves.toEqual({ events: [], nextCursor: null })
      expect(
        (await owner.caller.query(audit, { campaignId: campaign.id })).events.map(
          (event) => event.id
        )
      ).toEqual([ids[4], ids[3]])
      await owner.caller.mutation(api.campaigns.archive.archive, {
        campaignId: campaign.id,
        expectedVersion: 0
      })
      expect(
        (await owner.caller.query(audit, { campaignId: campaign.id })).events.map(
          (event) => event.id
        )
      ).toEqual([ids[4], ids[3]])
      expect(await t.run((ctx) => ctx.db.query('campaignEvents').collect())).toEqual(storedBefore)
    } finally {
      vi.useRealTimers()
    }
  })
})

it('traverses 51 qualified and masked audit rows, preserving history and current owner privacy', async () => {
  const { t, owner, other } = await readySheetFixture()
  const campaign = await owner.caller.mutation(createCampaign, {
    name: 'Complete inventory audit',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const now = Date.now() + 60_000
  const cutoff = now - 180 * 24 * 60 * 60 * 1000
  const denominationId = crypto.randomUUID()
  const campaignCurrencySystemId = crypto.randomUUID()
  const equipmentId = crypto.randomUUID()
  const custody = { kind: 'CAMPAIGN', campaignId: campaign.id, ownerId: campaign.id }
  const rows = Array.from({ length: 52 }, (_, index) => {
    const time =
      index === 0 ? cutoff - 1_001 : index <= 2 ? cutoff : cutoff + 1 + Math.floor((index - 3) / 5)
    const payload =
      index % 2 === 0
        ? {
            action: 'CURRENCY_ADJUST',
            custody,
            denominationId,
            ...(index % 4 === 0 ? { campaignCurrencySystemId } : {}),
            denominationLabel: 'Fucking Coin',
            beforeAmount: '0',
            afterAmount: '1',
            amount: 1
          }
        : {
            action: 'ITEM_ADD',
            custody,
            itemId: crypto.randomUUID(),
            equipmentId,
            itemLabel: 'Fucking Club',
            beforeQuantity: 0,
            afterQuantity: 1
          }
    return {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      campaignId: campaign.id,
      actorUserId: owner.userId,
      type: index % 2 === 0 ? 'PARTY_CURRENCY_ADJUST' : 'PARTY_ITEM_ADD',
      visibility: 'OWNER' as const,
      subjectCharacterId: null,
      payloadJson: index === 0 ? '{expired' : JSON.stringify(payload),
      inventoryAudit: true as const,
      visibleInHistory: true,
      createdAt: new Date(time).toISOString(),
      payload
    }
  })
  const foreignId = crypto.randomUUID()
  const nonAuditId = crypto.randomUUID()
  const storedRows = rows.map(({ payload: _payload, ...row }) => row)
  await t.run(async (ctx) => {
    for (const row of storedRows) await ctx.db.insert('campaignEvents', row)
    await ctx.db.insert('campaignEvents', {
      ...storedRows[51]!,
      id: foreignId,
      campaignId: crypto.randomUUID(),
      payloadJson: '{foreign'
    })
    const { inventoryAudit: _inventoryAudit, ...nonAuditRow } = storedRows[51]!
    await ctx.db.insert('campaignEvents', {
      ...nonAuditRow,
      id: nonAuditId,
      payloadJson: '{nonAudit'
    })
  })
  const before = await t.run((ctx) => ctx.db.query('campaignEvents').collect())
  const expected = rows
    .slice(1)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  vi.useFakeTimers({ toFake: ['Date'] })
  // A commit moves the next read's clock past it, so each read below gets a clock ahead of them.
  vi.setSystemTime(now - 2_000)
  try {
    await expect(other.caller.query(audit, { campaignId: campaign.id })).rejects.toThrow(
      'Campaign not found.'
    )
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    await expect(other.caller.query(audit, { campaignId: campaign.id })).rejects.toThrow(
      'Only the Campaign owner can read inventory audit history.'
    )
    const readAll = async () => {
      const ids: string[] = []
      const cursors = new Set<string>()
      let cursor: string | undefined
      while (true) {
        const input = { campaignId: campaign.id, limit: 7, ...(cursor ? { cursor } : {}) }
        const transport = await owner.caller.query(audit, input)
        expect(await owner.caller.query(audit, input)).toEqual(transport)
        const page = decodeCampaignInventoryAuditPage(transport)
        for (const event of page.events) {
          const raw = expected.find((row) => row.id === event.id)!
          expect(raw).toBeDefined()
          expect(event.payload).toEqual({
            ...raw.payload,
            ...('itemLabel' in raw.payload ? { itemLabel: '****ing Club' } : {}),
            ...('denominationLabel' in raw.payload ? { denominationLabel: '****ing Coin' } : {})
          })
          expect(event.actorUserId).toBe(owner.userId)
          expect(event.visibility).toBe('OWNER')
          ids.push(event.id)
        }
        if (page.nextCursor === null) break
        expect(cursors.has(page.nextCursor)).toBe(false)
        cursors.add(page.nextCursor)
        cursor = page.nextCursor
      }
      expect(ids).toEqual(expected.map((row) => row.id))
      expect(new Set(ids).size).toBe(51)
    }
    vi.setSystemTime(now - 1_000)
    await readAll()
    await owner.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: 0
    })
    vi.setSystemTime(now)
    await readAll()
    vi.setSystemTime(now + 1)
    await expect(
      owner.caller.query(audit, { campaignId: campaign.id, cursor: rows[2]!.id })
    ).resolves.toEqual({ events: [], nextCursor: null })
    const current = decodeCampaignInventoryAuditPage(
      await owner.caller.query(audit, { campaignId: campaign.id, limit: 100 })
    )
    expect(current.events.map((event) => event.id)).toEqual(
      expected.filter((row) => row.createdAt > new Date(cutoff).toISOString()).map((row) => row.id)
    )
    expect(await t.run((ctx) => ctx.db.query('campaignEvents').collect())).toEqual(before)
  } finally {
    vi.useRealTimers()
  }
})
