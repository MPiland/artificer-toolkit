import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignContentShareDto,
  CreateCampaignInput,
  ShareCampaignContentInput,
  CampaignDetailDto
} from '@artificer-toolkit/schema/api/campaignCore'
import type { AuthoredDeleteActiveInput } from '@artificer-toolkit/schema/api/authoredPublication'
import type { CampaignPartyInventoryMutationInput } from '@artificer-toolkit/schema/api/campaignInventory'
import type { listCampaignEventsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import {
  decodeCampaignEventPage,
  type CampaignEventPageTransportDto
} from '@artificer-toolkit/schema/api/campaignEventTransport'
import type {
  CampaignPartyItemPage,
  CampaignPartyCurrencyPage,
  CampaignInventoryAuditPageTransport
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { decodeCampaignInventoryAuditPage } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { catalogueMetadata, syncCatalogueMetadata } from '../content/catalogueMetadata'
import { api } from '../_generated/api'
import * as equipmentRelationships from '../content/equipmentRelationships'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import {
  corruptPublishedVersionPayload,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { insertAuthoredVersion } from '../content/documents'
import { readHeldPartyEquipment } from './partyInventoryDocuments'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const items = makeFunctionReference<
  'query',
  {
    campaignId: string
    paginationOpts: { cursor: string | null; numItems: number }
  },
  CampaignPartyItemPage
>('campaigns/partyInventory:items')
const currencies = makeFunctionReference<
  'query',
  {
    campaignId: string
    paginationOpts: { cursor: string | null; numItems: number }
  },
  CampaignPartyCurrencyPage
>('campaigns/partyInventory:currencies')
const mutate = makeFunctionReference<
  'mutation',
  { input: CampaignPartyInventoryMutationInput },
  { eventId: string }
>('campaigns/partyInventoryCommands:mutate')
const audit = makeFunctionReference<
  'query',
  { campaignId: string; cursor?: string; limit?: number },
  CampaignInventoryAuditPageTransport
>('campaigns/inventoryAudit:list')
const events = makeFunctionReference<
  'query',
  z.input<typeof listCampaignEventsInputSchema>,
  CampaignEventPageTransportDto
>('campaigns/events:list')
const share = makeFunctionReference<'mutation', ShareCampaignContentInput, CampaignContentShareDto>(
  'campaigns/contentShares:share'
)
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)

const campaignInput: CreateCampaignInput = {
  name: 'Party inventory',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

function pageInput(campaignId: string, cursor: string | null = null, numItems = 48) {
  return { campaignId, paginationOpts: { cursor, numItems } }
}

function addItem(
  campaignId: string,
  expectedOwnerVersion: number,
  quantity = 1,
  idempotencyKey = crypto.randomUUID()
): Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_ADD' }> {
  return {
    campaignId,
    expectedOwnerVersion,
    idempotencyKey,
    kind: 'ITEM_ADD',
    equipmentId: club.id,
    quantity
  }
}

function adjustCurrency(
  campaignId: string,
  expectedOwnerVersion: number,
  amount: number,
  idempotencyKey = crypto.randomUUID()
): Extract<CampaignPartyInventoryMutationInput, { kind: 'CURRENCY_ADJUST' }> {
  return {
    campaignId,
    expectedOwnerVersion,
    idempotencyKey,
    kind: 'CURRENCY_ADJUST',
    denominationId: srdSystemRecord.currencies[3]!.id,
    amount
  }
}

async function setup() {
  const { owner: player, other: gm, ...base } = await readySheetFixture()
  const campaign = await gm.caller.mutation(createCampaign, campaignInput)
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  await base.t.run((ctx) =>
    ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: player.userId,
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  )
  const readStored = () =>
    base.t.run(async (ctx) => ({
      inventory: await ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .unique(),
      items: await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      currencies: await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      events: await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect()
    }))
  return { ...base, campaign, gm, player, readStored }
}

async function ownedEquipment(
  t: Awaited<ReturnType<typeof readySheetFixture>>['t'],
  userId: string,
  id = crypto.randomUUID(),
  label = 'Secret Club'
) {
  return t.run(async (ctx) => {
    const template = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', club.id))
      .unique()
    if (!template) throw new Error('Missing Club fixture.')
    const current = await versionWithCompilation(ctx, await ctx.db.get(template.currentVersionId))
    if (!current) throw new Error('Missing Club version fixture.')
    const contentSourceId = crypto.randomUUID()
    const document = equipmentAuthoredDtoSchema.parse({
      ...club,
      id,
      userId,
      status: 'ACTIVE',
      label
    })
    const checksum = checksumRuleDocument(document)
    const publicVersionId = crypto.randomUUID()
    const versionId = await insertAuthoredVersion(
      ctx,
      {
        subjectKind: current.subjectKind,
        id,
        systemId: current.systemId,
        label: document.label,
        checksum,
        contentSourceId,
        versionId: publicVersionId,
        version: current.version,
        documentSchemaVersion: current.documentSchemaVersion
      },
      canonicalizeRuleDocument(document),
      (await equipmentRelationships.compileCurrentEquipment(ctx, document, null)).compilation
    )
    const rootId = await ctx.db.insert('authoredRoots', {
      id,
      subjectKind: 'EQUIPMENT',
      systemId: srdSystemRecord.id,
      parentEquipmentId: null,
      label: document.label,
      checksum,
      contentSourceId,
      ownerUserId: userId,
      currentVersionId: versionId,
      currentVersionPublicId: publicVersionId
    })
    await ctx.db.insert('contentSources', {
      ...SRD_CONTENT_SOURCE,
      id: contentSourceId,
      kind: 'USER',
      ownerUserId: userId
    })
    await syncCatalogueMetadata(
      ctx,
      rootId,
      await catalogueMetadata(
        ctx,
        { subjectKind: 'EQUIPMENT', document },
        { checksum, publicId: id, createdAt: Date.now() }
      )
    )
    await ctx.db.insert('authoredRouteIds', {
      subjectKind: 'EQUIPMENT',
      subjectId: id,
      ownerUserId: userId,
      routeNumber: 1000,
      publicId: id
    })
    return { id, rootId, versionId, document }
  })
}

describe('native Campaign party inventory', () => {
  it('lists from root facts while commands keep per-item and later source validation', async () => {
    const { t, campaign, gm, readStored } = await setup()
    await gm.caller.mutation(mutate, { input: addItem(campaign.id, 0) })
    await gm.caller.mutation(mutate, { input: addItem(campaign.id, 1) })
    const stored = await readStored()
    expect(stored.items).toHaveLength(2)
    const second = stored.items[1]!
    expect(second.retainedRulesJson).toBeTypeOf('string')
    const resolve = vi.spyOn(equipmentRelationships, 'resolveCurrentEquipment')
    const compile = vi.spyOn(equipmentRelationships, 'compileCurrentEquipment')
    try {
      const page = await gm.caller.query(items, pageInput(campaign.id))
      expect(page.page).toHaveLength(2)
      // RELIABILITY-21.2 and .13: the page neither compiles nor resolves held Equipment (D163); it
      // reads root catalogue facts, since each parse timed the page out at Convex's 1 s limit on CI.
      expect(resolve).not.toHaveBeenCalled()
      expect(compile).not.toHaveBeenCalled()
      const readHeld = () =>
        t.run(async (ctx) => {
          const stored = await ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
            .unique()
          const item = await ctx.db.get(second._id)
          if (!stored || !item) throw new Error('Missing Campaign item.')
          return readHeldPartyEquipment(ctx, stored, item)
        })
      await expect(readHeld()).resolves.toMatchObject({ id: club.id })
      await t.run((ctx) => ctx.db.patch(second._id, { retainedRulesJson: '{}' }))
      await expect(readHeld()).rejects.toThrow()
      await t.run(async (ctx) => {
        await ctx.db.patch(second._id, {
          retainedRulesJson: second.retainedRulesJson
        })
        await corruptPublishedVersionPayload(ctx, club.id)
      })
      await expect(readHeld()).rejects.toThrow(/checksum|identity/i)
    } finally {
      resolve.mockRestore()
      compile.mockRestore()
    }
  })

  it('starts empty, supports item CRUD, owner/version guards, exact replay, and owner audit', async () => {
    const { gm, player, campaign, readStored } = await setup()
    await expect(gm.caller.query(items, pageInput(campaign.id))).resolves.toMatchObject({
      owner: { kind: 'CAMPAIGN', campaignId: campaign.id },
      version: 0,
      page: []
    })
    await expect(player.caller.query(items, pageInput(campaign.id))).resolves.toMatchObject({
      version: 0,
      page: []
    })

    const add = addItem(campaign.id, 0, 5)
    const first = await gm.caller.mutation(mutate, {
      input: { ...add, equipmentId: add.equipmentId.toUpperCase() }
    })
    expect(first.eventId).toMatch(/^[0-9a-f-]{36}$/)
    const listed = await gm.caller.query(items, pageInput(campaign.id))
    expect(listed).toMatchObject({
      version: 1,
      page: [{ label: 'Club', quantity: 5, containerId: null }]
    })
    expect(listed.page[0]).not.toHaveProperty('equipmentId')
    const stored = await readStored()
    expect(stored.inventory).toMatchObject({ version: 1 })
    expect(stored.items[0]).toMatchObject({
      equipmentId: club.id,
      quantity: 5,
      campaignId: campaign.id
    })
    expect(stored.items[0]).not.toHaveProperty('label')
    expect(stored.events[0]).toMatchObject({
      type: 'PARTY_ITEM_ADD',
      visibility: 'OWNER',
      actorUserId: gm.userId,
      inventoryAudit: true
    })
    expect(stored.events[0]).not.toHaveProperty('payload')

    await expect(gm.caller.mutation(mutate, { input: add })).resolves.toEqual(first)
    await expect(player.caller.mutation(mutate, { input: add })).rejects.toThrow(
      'Only the Campaign owner'
    )
    await expect(gm.caller.mutation(mutate, { input: { ...add, quantity: 6 } })).rejects.toThrow(
      'different input'
    )
    await expect(
      gm.caller.mutation(mutate, {
        input: {
          ...add,
          idempotencyKey: crypto.randomUUID(),
          expectedOwnerVersion: 0
        }
      })
    ).rejects.toThrow('changed')

    const itemId = listed.page[0]!.id
    const update = {
      campaignId: campaign.id,
      expectedOwnerVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      kind: 'ITEM_UPDATE' as const,
      itemId,
      quantity: 7
    }
    await gm.caller.mutation(mutate, { input: update })
    const consume = {
      campaignId: campaign.id,
      expectedOwnerVersion: 2,
      idempotencyKey: crypto.randomUUID(),
      kind: 'ITEM_CONSUME' as const,
      itemId,
      amount: 2
    }
    await gm.caller.mutation(mutate, { input: consume })
    expect((await gm.caller.query(items, pageInput(campaign.id))).page[0]).toMatchObject({
      quantity: 5
    })
    await gm.caller.mutation(mutate, {
      input: {
        campaignId: campaign.id,
        expectedOwnerVersion: 3,
        idempotencyKey: crypto.randomUUID(),
        kind: 'ITEM_REMOVE',
        itemId
      }
    })
    expect((await gm.caller.query(items, pageInput(campaign.id))).page).toEqual([])
    await expect(gm.caller.mutation(mutate, { input: { ...consume, amount: 3 } })).rejects.toThrow(
      'different input'
    )

    const history = await gm.caller.query(audit, {
      campaignId: campaign.id,
      limit: 20
    })
    const decoded = decodeCampaignInventoryAuditPage(history)
    expect(decoded.events).toHaveLength(4)
    expect(
      decoded.events.every(
        (event) => event.actorUserId === gm.userId && event.visibility === 'OWNER'
      )
    ).toBe(true)
    expect(JSON.stringify(history)).not.toMatch(/commandId|inputFingerprint|Secret/)
    await expect(player.caller.query(audit, { campaignId: campaign.id })).rejects.toThrow(
      'Only the Campaign owner'
    )
  })

  it('conserves RULESET currency, rejects overspend and overflow, and drains more than 48 balances', async () => {
    const { gm, campaign, readStored } = await setup()
    const denominationId = srdSystemRecord.currencies[3]!.id
    await gm.caller.mutation(mutate, {
      input: adjustCurrency(campaign.id, 0, 10)
    })
    await gm.caller.mutation(mutate, {
      input: adjustCurrency(campaign.id, 1, -4)
    })
    expect((await gm.caller.query(currencies, pageInput(campaign.id))).page).toEqual([
      expect.objectContaining({
        kind: 'RULESET',
        denominationId,
        amount: 6,
        containerId: null
      })
    ])
    const before = await readStored()
    await expect(
      gm.caller.mutation(mutate, { input: adjustCurrency(campaign.id, 2, -7) })
    ).rejects.toThrow('enough currency')
    expect(await readStored()).toEqual(before)
    const overflow = await setup()
    await expect(
      overflow.gm.caller.mutation(mutate, {
        input: adjustCurrency(overflow.campaign.id, 0, Number.MAX_SAFE_INTEGER)
      })
    ).resolves.toBeDefined()
    await expect(
      overflow.gm.caller.mutation(mutate, {
        input: adjustCurrency(overflow.campaign.id, 1, 1)
      })
    ).rejects.toThrow('supported range')

    const grouped = await setup()
    await grouped.t.run(async (ctx) => {
      await ctx.db.insert('campaignPartyInventories', {
        campaignId: grouped.campaign.id,
        version: 0
      })
      for (let index = 0; index < 50; index++) {
        await ctx.db.insert('campaignPartyCurrencies', {
          campaignId: grouped.campaign.id,
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          denominationId,
          amount: 1,
          containerId: null
        })
      }
    })
    await grouped.gm.caller.mutation(mutate, {
      input: adjustCurrency(grouped.campaign.id, 0, -50)
    })
    expect(
      (await grouped.readStored()).currencies.filter((row) => row.denominationId === denominationId)
    ).toEqual([])
  })

  it.each(['ITEM', 'CURRENCY'] as const)(
    'rejects reads and writes when %s custody has lost its owner',
    async (kind) => {
      const { t, gm, campaign, readStored } = await setup()
      await gm.caller.mutation(mutate, {
        input: kind === 'ITEM' ? addItem(campaign.id, 0) : adjustCurrency(campaign.id, 0, 1)
      })
      await t.run(async (ctx) => {
        const owner = await ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId_vehicleId', (q) =>
            q.eq('campaignId', campaign.id).eq('vehicleId', undefined)
          )
          .unique()
        if (!owner) throw new Error('Missing owner fixture.')
        await ctx.db.delete(owner._id)
      })
      const before = await readStored()
      await expect(gm.caller.query(items, pageInput(campaign.id))).rejects.toThrow(
        'owner is unavailable'
      )
      await expect(gm.caller.query(currencies, pageInput(campaign.id))).rejects.toThrow(
        'owner is unavailable'
      )
      await expect(gm.caller.mutation(mutate, { input: addItem(campaign.id, 0) })).rejects.toThrow(
        'owner is unavailable'
      )
      await expect(
        gm.caller.mutation(mutate, {
          input: adjustCurrency(campaign.id, 0, 1)
        })
      ).rejects.toThrow('owner is unavailable')
      expect(await readStored()).toEqual(before)
    }
  )

  it('rolls back inventory rows and owner version when audit insertion fails', async () => {
    const { gm, campaign, readStored } = await setup()
    const before = await readStored()
    const parse = vi.spyOn(campaignStoredEventSchema, 'parse').mockImplementationOnce(() => {
      throw new Error('audit fixture failure')
    })
    try {
      await expect(
        gm.caller.mutation(mutate, { input: addItem(campaign.id, 0, 2) })
      ).rejects.toThrow('audit fixture failure')
    } finally {
      parse.mockRestore()
    }
    expect(await readStored()).toEqual(before)
  })

  it('masks inventory labels in owner history while hiding owner events from members', async () => {
    const { t, gm, player, campaign, character, readStored } = await setup()
    const homebrew = await ownedEquipment(t, gm.userId, crypto.randomUUID(), 'Fucking Club')
    await gm.caller.mutation(share, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: homebrew.id
    })
    const result = await gm.caller.mutation(mutate, {
      input: { ...addItem(campaign.id, 0), equipmentId: homebrew.id }
    })
    const inventoryHistory = decodeCampaignInventoryAuditPage(
      await gm.caller.query(audit, { campaignId: campaign.id, limit: 20 })
    )
    expect(inventoryHistory.events[0]?.payload).toMatchObject({
      itemLabel: '****ing Club'
    })
    const ownerHistory = decodeCampaignEventPage(
      await gm.caller.query(events, {
        campaignId: campaign.id,
        characterId: character.id
      })
    )
    expect(ownerHistory.events.map((event) => event.id)).toContain(result.eventId)
    expect(ownerHistory.events.find((event) => event.id === result.eventId)?.payload).toMatchObject(
      {
        itemLabel: '****ing Club'
      }
    )
    expect(JSON.stringify(ownerHistory)).not.toMatch(
      /actorUserId|commandId|inputFingerprint|inventoryAudit/
    )
    const playerHistory = decodeCampaignEventPage(
      await player.caller.query(events, {
        campaignId: campaign.id,
        characterId: character.id
      })
    )
    expect(playerHistory.events.map((event) => event.id)).not.toContain(result.eventId)
    const raw = await readStored()
    expect(
      JSON.parse(raw.events.find((event) => event.id === result.eventId)!.payloadJson)
    ).toMatchObject({
      itemLabel: 'Fucking Club'
    })
  })

  it('paginates item rows beyond eight and rejects final removal of nonempty containers', async () => {
    const { t, gm, campaign, readStored } = await setup()
    const ids: string[] = []
    for (let index = 0; index < 9; index++) {
      const result = await gm.caller.mutation(mutate, {
        input: addItem(campaign.id, index, 1)
      })
      const rows = (await readStored()).items
      ids.push(rows.find((row) => !ids.includes(row.id))!.id)
      expect(result.eventId).toBeTruthy()
    }
    let cursor: string | null = null
    const found: string[] = []
    for (let page = 0; page < 4; page++) {
      const result: CampaignPartyItemPage = await gm.caller.query(
        items,
        pageInput(campaign.id, cursor, 48)
      )
      found.push(...result.page.map((row) => row.id))
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(new Set(found)).toEqual(new Set(ids))

    const parent = ids[0]!
    const childResult = await gm.caller.mutation(mutate, {
      input: addItem(campaign.id, 9, 1)
    })
    const child = (await readStored()).items.find(
      (row) => row.id !== parent && !ids.includes(row.id)
    )
    if (!child) throw new Error('Missing child item fixture.')
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', child.id))
        .unique()
      if (!row) throw new Error('Missing child stored item.')
      await ctx.db.patch(row._id, { containerId: parent })
    })
    await expect(
      gm.caller.mutation(mutate, {
        input: {
          campaignId: campaign.id,
          expectedOwnerVersion: 10,
          idempotencyKey: crypto.randomUUID(),
          kind: 'ITEM_CONSUME',
          itemId: parent,
          amount: 1
        }
      })
    ).rejects.toThrow('container')
    await t.run(async (ctx) => {
      const childRow = await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', child.id))
        .unique()
      if (!childRow) throw new Error('Missing child stored item.')
      await ctx.db.delete(childRow._id)
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: campaign.id,
        id: crypto.randomUUID(),
        denominationId: srdSystemRecord.currencies[3]!.id,
        amount: 1,
        containerId: parent
      })
    })
    await expect(
      gm.caller.mutation(mutate, {
        input: {
          campaignId: campaign.id,
          expectedOwnerVersion: 10,
          idempotencyKey: crypto.randomUUID(),
          kind: 'ITEM_REMOVE',
          itemId: parent
        }
      })
    ).rejects.toThrow('container')
    expect((await readStored()).items.some((row) => row.id === parent)).toBe(true)
    expect(childResult.eventId).toBeTruthy()
  })

  it('allows member reads, denies foreign and archived writes, and applies explicit Homebrew sharing', async () => {
    const { t, gm, player, campaign } = await setup()
    const homebrew = await ownedEquipment(t, gm.userId)
    const homebrewInput = addItem(campaign.id, 0, 1)
    const custom = { ...homebrewInput, equipmentId: homebrew.id }
    await expect(gm.caller.mutation(mutate, { input: custom })).rejects.toThrow('unavailable')
    await gm.caller.mutation(share, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: homebrew.id
    })
    await expect(gm.caller.mutation(mutate, { input: custom })).resolves.toBeDefined()
    await expect(player.caller.query(items, pageInput(campaign.id))).resolves.toMatchObject({
      version: 1
    })
    const rootBeforeDelete = await t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', homebrew.id))
        .unique()
    )
    expect(rootBeforeDelete).not.toBeNull()
    const campaignBeforeDelete = await gm.caller.query(api.campaigns.queries.get, {
      id: campaign.id
    })
    if (!campaignBeforeDelete) throw new Error('Missing Campaign before deletion.')
    await expect(
      gm.caller.mutation(deleteActive, {
        subjectKind: 'EQUIPMENT',
        subjectId: homebrew.id
      })
    ).resolves.toBeNull()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', homebrew.id))
          .unique()
      )
    ).toBeNull()
    await expect(
      gm.caller.mutation(mutate, {
        input: {
          ...custom,
          idempotencyKey: crypto.randomUUID(),
          expectedOwnerVersion: 1
        }
      })
    ).rejects.toThrow('unavailable')
    const campaignAfterDelete = await gm.caller.query(api.campaigns.queries.get, {
      id: campaign.id
    })
    if (!campaignAfterDelete) throw new Error('Missing Campaign after deletion.')
    expect(campaignAfterDelete.version).toBe(campaignBeforeDelete.version + 1)
    const homebrewItemId = (await gm.caller.query(items, pageInput(campaign.id))).page.find(
      (row) => row.label === 'Secret Club'
    )!.id
    await gm.caller.mutation(mutate, {
      input: {
        campaignId: campaign.id,
        expectedOwnerVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        kind: 'ITEM_REMOVE',
        itemId: homebrewItemId
      }
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', homebrew.id))
          .unique()
      )
    ).toBeNull()
    await expect(
      gm.caller.mutation(mutate, {
        input: { ...addItem(crypto.randomUUID(), 0), equipmentId: club.id }
      })
    ).rejects.toThrow()
    await gm.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: campaignAfterDelete.version
    })
    await expect(gm.caller.mutation(mutate, { input: custom })).rejects.toThrow('read-only')
    await expect(gm.caller.mutation(mutate, { input: addItem(campaign.id, 1) })).rejects.toThrow(
      'read-only'
    )
    await expect(player.caller.query(items, pageInput(campaign.id))).resolves.toMatchObject({
      version: 2
    })
  })
})
