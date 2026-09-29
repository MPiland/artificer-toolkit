import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput,
  CampaignPartyInventoryMutationInput,
  deleteCampaignCurrencySystemInputSchema
} from '@artificer-toolkit/schema/api/campaignInventory'
import {
  type CampaignCurrencySystemPage,
  type CampaignPartyCurrencyPage,
  type CampaignPartyInventoryListInput,
  type CampaignInventoryAuditPageTransport
} from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { decodeCampaignInventoryAuditPage } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import {
  campaignStoredCurrencyDenominationSchema,
  campaignStoredPartyCurrencyGroupSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../_generated/api'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { importedSubject } from '../../tests/fixtures/publication'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readCharacterRecord } from '../characters/stateDocuments'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import * as currencySystemDocuments from './currencySystemDocuments'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const list = makeFunctionReference<
  'query',
  CampaignPartyInventoryListInput,
  CampaignCurrencySystemPage
>('campaigns/currencySystems:list')
const save = makeFunctionReference<'mutation', SaveCampaignCurrencySystemInput, CurrencySystemDto>(
  'campaigns/currencySystems:save'
)
const remove = makeFunctionReference<
  'mutation',
  z.input<typeof deleteCampaignCurrencySystemInputSchema>,
  null
>('campaigns/currencySystems:remove')
const partyCurrencies = makeFunctionReference<
  'query',
  CampaignPartyInventoryListInput,
  CampaignPartyCurrencyPage
>('campaigns/partyInventory:currencies')
const partyMutate = makeFunctionReference<
  'mutation',
  { input: CampaignPartyInventoryMutationInput },
  { eventId: string }
>('campaigns/partyInventoryCommands:mutate')
const inventoryAudit = makeFunctionReference<
  'query',
  { campaignId: string; cursor?: string; limit?: number },
  CampaignInventoryAuditPageTransport
>('campaigns/inventoryAudit:list')

const campaignInput: CreateCampaignInput = {
  name: 'Currency systems',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

const idFor = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`

function denomination(
  id: string | undefined,
  label: string,
  abbreviation: string,
  scaleInReference: number
) {
  return { ...(id ? { id } : {}), label, abbreviation, scaleInReference }
}

function systemInput(
  campaignId: string,
  label: string,
  denominations: SaveCampaignCurrencySystemInput['denominations'],
  options: Partial<
    Pick<SaveCampaignCurrencySystemInput, 'systemId' | 'isReference' | 'expectedVersion'>
  > = {}
): SaveCampaignCurrencySystemInput {
  return {
    campaignId,
    label,
    denominations,
    isReference: options.isReference ?? false,
    ...(options.systemId ? { systemId: options.systemId } : {}),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion })
  }
}

function partyAdjust(
  campaignId: string,
  expectedOwnerVersion: number,
  denominationId: string,
  amount: number,
  idempotencyKey = crypto.randomUUID()
): Extract<CampaignPartyInventoryMutationInput, { kind: 'CURRENCY_ADJUST' }> {
  return {
    campaignId,
    expectedOwnerVersion,
    idempotencyKey,
    kind: 'CURRENCY_ADJUST',
    denominationId,
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
  const readStored = () =>
    base.t.run(async (ctx) => ({
      systems: await ctx.db
        .query('campaignCurrencySystems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      denominations: await ctx.db
        .query('campaignCurrencyDenominations')
        .withIndex('by_campaignId_systemId_sortOrder', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      inventory: await ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) =>
          q.eq('campaignId', campaign.id).eq('vehicleId', undefined)
        )
        .unique(),
      inventoryOwners: await ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      balances: await ctx.db
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

async function setAssignedCurrency(
  base: Awaited<ReturnType<typeof setup>>,
  currency: CharacterAuthored['state']['currency']
) {
  await base.t.run(async (ctx) => {
    const assignments = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
    if (!assignments.length)
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: base.campaign.id,
        userId: base.player.userId,
        characterId: base.character.id,
        assignedAt: base.campaign.createdAt
      })
    await editCharacterRecord(ctx, base.character.id, (character) => ({
      ...character,
      state: { ...character.state, currency }
    }))
  })
}

async function currencySnapshot(base: Awaited<ReturnType<typeof setup>>) {
  return { stored: await base.readStored(), character: await base.readState() }
}

function pageInput(campaignId: string, cursor: string | null = null, numItems = 48) {
  return { campaignId, paginationOpts: { cursor, numItems } }
}

describe('native Campaign currency systems', () => {
  it('creates, lists, edits, promotes, and deletes systems with reference/version guards', async () => {
    const { gm, player, campaign, readStored } = await setup()
    const baseId = idFor(1)
    const highId = idFor(2)
    const first = await gm.caller.mutation(
      save,
      systemInput(
        campaign.id,
        'Copper and Gold',
        [denomination(baseId, 'Copper', 'cp', 100), denomination(highId, 'Gold', 'gp', 1)],
        { isReference: false }
      )
    )
    expect(first).toMatchObject({ label: 'Copper and Gold', isReference: true, version: 0 })
    expect((await player.caller.query(list, pageInput(campaign.id))).page).toHaveLength(1)
    const second = await gm.caller.mutation(
      save,
      systemInput(
        campaign.id,
        'Silver and Crown',
        [denomination(idFor(3), 'Silver', 'sp', 10), denomination(idFor(4), 'Crown', 'cr', 1)],
        { isReference: true }
      )
    )
    expect(second.isReference).toBe(true)
    const stored = await readStored()
    expect(stored.systems.find((row) => row.id === first.id)).toMatchObject({
      isReference: false,
      version: 1
    })
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'No Longer Reference', first.denominations, {
          systemId: first.id,
          isReference: false,
          expectedVersion: 1
        })
      )
    ).resolves.toMatchObject({ isReference: false, version: 2 })
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Cannot Demote', second.denominations, {
          systemId: second.id,
          isReference: false,
          expectedVersion: 0
        })
      )
    ).rejects.toThrow('another reference')
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Stale', first.denominations, {
          systemId: first.id,
          expectedVersion: 1
        })
      )
    ).rejects.toThrow('changed')
    await expect(
      gm.caller.mutation(remove, {
        campaignId: campaign.id,
        systemId: second.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('another reference')
    await expect(
      player.caller.mutation(
        save,
        systemInput(campaign.id, 'Player', [denomination(undefined, 'P', 'p', 1)])
      )
    ).rejects.toThrow('Campaign owner')
    await gm.caller.mutation(remove, {
      campaignId: campaign.id,
      systemId: first.id,
      expectedVersion: 2
    })
    await gm.caller.mutation(remove, {
      campaignId: campaign.id,
      systemId: second.id,
      expectedVersion: 0
    })
    await expect(gm.caller.query(list, pageInput(campaign.id))).resolves.toMatchObject({ page: [] })
  })

  it('enforces denomination shape, normalized identity, and owned/archived write authority', async () => {
    const { gm, player, campaign } = await setup()
    const one = denomination('abcdef00-1234-4000-8000-000000000010', 'One', 'o', 1)
    const two = denomination(idFor(11), 'Two', 't', 2)
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Too Many', [
          one,
          two,
          ...Array.from({ length: 4 }, (_, index) =>
            denomination(idFor(20 + index), `D${index}`, `d${index}`, 3 + index)
          )
        ])
      )
    ).rejects.toThrow()
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'No Base', [denomination(idFor(12), 'A', 'a', 2)])
      )
    ).rejects.toThrow('exactly one')
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Duplicate Scale', [one, denomination(idFor(13), 'Three', '3', 1)])
      )
    ).rejects.toThrow('unique')
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Duplicate Name', [one, denomination(idFor(14), 'One', 'x', 2)])
      )
    ).rejects.toThrow('unique')
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Duplicate Abbreviation', [
          one,
          denomination(idFor(15), 'Other', 'o', 2)
        ])
      )
    ).rejects.toThrow('unique')
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Duplicate ID', [
          one,
          denomination(one.id!.toUpperCase(), 'Other', 'x', 2)
        ])
      )
    ).rejects.toThrow('unique')
    const created = await gm.caller.mutation(
      save,
      systemInput(campaign.id, 'Mutable', [one, two], { isReference: true })
    )
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Missing Version', created.denominations, { systemId: created.id })
      )
    ).rejects.toThrow('changed')
    await expect(
      gm.caller.mutation(save, systemInput(crypto.randomUUID(), 'Foreign', [one]))
    ).rejects.toThrow()
    await expect(
      player.caller.mutation(save, systemInput(campaign.id, 'Player', [one]))
    ).rejects.toThrow('Campaign owner')
    await gm.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: 0
    })
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Archived', created.denominations, {
          systemId: created.id,
          expectedVersion: 0
        })
      )
    ).rejects.toThrow('read-only')
    await expect(
      gm.caller.mutation(remove, {
        campaignId: campaign.id,
        systemId: created.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('read-only')
    await expect(player.caller.query(list, pageInput(campaign.id))).resolves.toMatchObject({
      page: expect.any(Array)
    })
  })

  it('preserves raw labels while masking STANDARD list output', async () => {
    const { t, gm, player, campaign, readStored } = await setup()
    const created = await gm.caller.mutation(
      save,
      systemInput(campaign.id, 'Fucking Coins', [denomination(idFor(30), 'Shit Coin', 'sc', 1)], {
        isReference: true
      })
    )
    const page = await player.caller.query(list, pageInput(campaign.id))
    expect(page.page[0]).toMatchObject({
      label: '**** Coins',
      denominations: [{ label: '**** Coin', abbreviation: 'sc' }]
    })
    expect(await readStored()).toMatchObject({
      systems: [expect.objectContaining({ label: 'Fucking Coins' })]
    })
    const rows = await t.run((ctx) =>
      ctx.db
        .query('campaignCurrencyDenominations')
        .withIndex('by_publicId', (q) => q.eq('id', created.denominations[0]!.id))
        .collect()
    )
    expect(rows[0]).toMatchObject({ label: 'Shit Coin' })
  })

  it('rolls back system, denomination, reference, and version writes when presentation fails', async () => {
    const { gm, campaign, readStored } = await setup()
    const initial = await gm.caller.mutation(
      save,
      systemInput(campaign.id, 'Initial', [denomination(idFor(35), 'Base', 'b', 1)], {
        isReference: true
      })
    )
    const before = await readStored()
    const presentation = vi
      .spyOn(currencySystemDocuments, 'presentCurrencySystem')
      .mockImplementationOnce(() => {
        throw new Error('currency presentation failure')
      })
    try {
      await expect(
        gm.caller.mutation(
          save,
          systemInput(campaign.id, 'Changed', [denomination(idFor(35), 'Base', 'b', 1)], {
            systemId: initial.id,
            isReference: true,
            expectedVersion: 0
          })
        )
      ).rejects.toThrow('currency presentation failure')
    } finally {
      presentation.mockRestore()
    }
    expect(await readStored()).toEqual(before)
  })

  it('rescales custom balances exactly, rejects lossy/unsafe edits, and bumps party version once', async () => {
    const { gm, campaign, readStored } = await setup()
    const baseId = idFor(40)
    const highId = idFor(41)
    const created = await gm.caller.mutation(
      save,
      systemInput(
        campaign.id,
        'Convertible',
        [denomination(baseId, 'Base', 'b', 1), denomination(highId, 'High', 'h', 2)],
        { isReference: true }
      )
    )
    await gm.caller.mutation(partyMutate, { input: partyAdjust(campaign.id, 0, highId, 3) })
    await expect(
      gm.caller.mutation(
        save,
        systemInput(campaign.id, 'Remove Held', [denomination(baseId, 'Base', 'b', 1)], {
          systemId: created.id,
          isReference: true,
          expectedVersion: 0
        })
      )
    ).rejects.toThrow('positive balance')
    const converted = await gm.caller.mutation(
      save,
      systemInput(
        campaign.id,
        'Convertible',
        [denomination(baseId, 'Base', 'b', 2), denomination(highId, 'High', 'h', 1)],
        { systemId: created.id, isReference: true, expectedVersion: 0 }
      )
    )
    expect(converted.version).toBe(1)
    expect(await readStored()).toMatchObject({
      inventory: { version: 2 },
      balances: [
        expect.objectContaining({
          denominationId: highId,
          amount: 6,
          campaignCurrencySystemId: created.id
        })
      ]
    })
    const beforeLoss = await readStored()
    await expect(
      gm.caller.mutation(
        save,
        systemInput(
          campaign.id,
          'Lossy',
          [denomination(baseId, 'Base', 'b', 1), denomination(highId, 'High', 'h', 4)],
          { systemId: created.id, isReference: true, expectedVersion: 1 }
        )
      )
    ).rejects.toThrow('preserve')
    expect(await readStored()).toEqual(beforeLoss)
    const overflow = await setup()
    const overflowSystem = await overflow.gm.caller.mutation(
      save,
      systemInput(
        overflow.campaign.id,
        'Overflow',
        [denomination(idFor(42), 'Base', 'b', 1), denomination(idFor(43), 'High', 'h', 2)],
        { isReference: true }
      )
    )
    await overflow.gm.caller.mutation(partyMutate, {
      input: partyAdjust(overflow.campaign.id, 0, idFor(43), Number.MAX_SAFE_INTEGER)
    })
    await expect(
      overflow.gm.caller.mutation(
        save,
        systemInput(
          overflow.campaign.id,
          'Overflow',
          [denomination(idFor(42), 'Base', 'b', 2), denomination(idFor(43), 'High', 'h', 1)],
          { systemId: overflowSystem.id, isReference: true, expectedVersion: 0 }
        )
      )
    ).rejects.toThrow('supported range')
  })

  it('supports custom adjust/replay/overspend, zero deletion, and isolates RULESET rows', async () => {
    const { t, gm, campaign, readStored } = await setup()
    const collision = srdSystemRecord.currencies[3]!.id
    const created = await gm.caller.mutation(
      save,
      systemInput(campaign.id, 'Custom', [denomination(collision, 'Fucking Coin', 'fc', 1)], {
        isReference: true
      })
    )
    const input = partyAdjust(campaign.id, 0, collision, 8)
    const first = await gm.caller.mutation(partyMutate, { input })
    await expect(gm.caller.mutation(partyMutate, { input })).resolves.toEqual(first)
    await expect(
      gm.caller.mutation(partyMutate, { input: { ...input, amount: 9 } })
    ).rejects.toThrow('different input')
    const auditPage = decodeCampaignInventoryAuditPage(
      await gm.caller.query(inventoryAudit, { campaignId: campaign.id, limit: 20 })
    )
    expect(auditPage.events[0]?.payload).toMatchObject({ denominationLabel: '**** Coin' })
    const rawAfterFirst = await readStored()
    expect(
      JSON.parse(rawAfterFirst.events.find((event) => event.inventoryAudit)!.payloadJson)
    ).toMatchObject({ denominationLabel: 'Fucking Coin' })
    expect((await gm.caller.query(partyCurrencies, pageInput(campaign.id))).page).toEqual([
      expect.objectContaining({ kind: 'CAMPAIGN', denominationId: collision, label: '**** Coin' })
    ])
    await expect(
      gm.caller.mutation(partyMutate, { input: partyAdjust(campaign.id, 1, collision, -9) })
    ).rejects.toThrow('enough currency')
    await t.run((ctx) =>
      ctx.db.insert('campaignPartyCurrencies', {
        campaignId: campaign.id,
        id: crypto.randomUUID(),
        denominationId: collision,
        amount: 4,
        containerId: null
      })
    )
    const output = await gm.caller.query(partyCurrencies, pageInput(campaign.id))
    expect(output.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'CAMPAIGN', denominationId: collision, amount: 8 }),
        expect.objectContaining({ kind: 'RULESET', denominationId: collision, amount: 4 })
      ])
    )
    await gm.caller.mutation(partyMutate, { input: partyAdjust(campaign.id, 1, collision, -8) })
    expect(
      (await readStored()).balances.some((row) => row.campaignCurrencySystemId === created.id)
    ).toBe(false)
    const corruptBalanceId = crypto.randomUUID()
    await t.run((ctx) =>
      ctx.db.insert('campaignPartyCurrencies', {
        campaignId: campaign.id,
        id: corruptBalanceId,
        denominationId: crypto.randomUUID(),
        campaignCurrencySystemId: created.id,
        amount: 0,
        containerId: null
      })
    )
    await expect(
      gm.caller.mutation(remove, {
        campaignId: campaign.id,
        systemId: created.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('denomination')
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('id', corruptBalanceId)
        )
        .unique()
      if (row) await ctx.db.delete(row._id)
    })
    await t.run((ctx) =>
      ctx.db.insert('campaignPartyCurrencies', {
        campaignId: campaign.id,
        id: crypto.randomUUID(),
        denominationId: collision,
        campaignCurrencySystemId: created.id,
        amount: 0,
        containerId: null
      })
    )
    await gm.caller.mutation(remove, {
      campaignId: campaign.id,
      systemId: created.id,
      expectedVersion: 0
    })
    expect((await readStored()).inventory).toMatchObject({ version: 3 })
  })

  it('keeps cross-Campaign custom UUIDs separate from RULESET currency resolution', async () => {
    const { gm, player, campaign } = await setup()
    const systemCurrencyId = srdSystemRecord.currencies[3]!.id
    const foreignCustomId = idFor(900)
    const secondCampaign = await player.caller.mutation(createCampaign, campaignInput)
    await gm.caller.mutation(
      save,
      systemInput(
        campaign.id,
        'Custom Gold',
        [
          denomination(systemCurrencyId, 'Campaign Gold', 'cg', 1),
          denomination(foreignCustomId, 'Foreign Coin', 'fc', 2)
        ],
        { isReference: true }
      )
    )
    await expect(
      player.caller.mutation(partyMutate, {
        input: partyAdjust(secondCampaign.id, 0, systemCurrencyId, 3)
      })
    ).resolves.toBeDefined()
    expect((await player.caller.query(partyCurrencies, pageInput(secondCampaign.id))).page).toEqual(
      [expect.objectContaining({ kind: 'RULESET', denominationId: systemCurrencyId, amount: 3 })]
    )
    await expect(
      player.caller.mutation(
        save,
        systemInput(secondCampaign.id, 'Steal', [denomination(foreignCustomId, 'Other', 'o', 1)], {
          isReference: true
        })
      )
    ).rejects.toThrow('already belongs')
    await expect(
      player.caller.mutation(partyMutate, {
        input: partyAdjust(secondCampaign.id, 1, foreignCustomId, 1)
      })
    ).rejects.toThrow()
  })

  it('keeps a removed zero denomination in the first remaining denomination without changing custody', async () => {
    const { t, gm, campaign, readStored } = await setup()
    const baseId = idFor(70)
    const removedId = idFor(71)
    const system = await gm.caller.mutation(
      save,
      systemInput(campaign.id, 'Zero fallback', [
        denomination(baseId, 'Base', 'b', 1),
        denomination(removedId, 'Removed', 'r', 2)
      ])
    )
    const balanceId = idFor(72)
    const groupId = idFor(73)
    await t.run(async (ctx) => {
      await ctx.db.insert('campaignPartyInventories', { campaignId: campaign.id, version: 0 })
      await ctx.db.insert(
        'campaignPartyCurrencyGroups',
        campaignStoredPartyCurrencyGroupSchema.parse({
          campaignId: campaign.id,
          id: groupId,
          containerId: null
        })
      )
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: campaign.id,
        id: balanceId,
        groupId,
        denominationId: removedId,
        campaignCurrencySystemId: system.id,
        amount: 0,
        containerId: null
      })
    })
    const before = (await readStored()).balances[0]!
    await gm.caller.mutation(
      save,
      systemInput(campaign.id, 'Zero fallback', [system.denominations[0]!], {
        systemId: system.id,
        expectedVersion: 0,
        isReference: true
      })
    )
    const after = await readStored()
    expect(after.balances).toEqual([{ ...before, denominationId: baseId }])
    expect(after.inventory).toMatchObject({ version: 1 })
    expect(after.denominations.map((row) => row.id)).toEqual([baseId])
  })

  it('paginates more than 48 systems and more than 48 custom grouped balances', async () => {
    const { t, gm, campaign } = await setup()
    const systemId = idFor(100)
    await t.run(async (ctx) => {
      for (let index = 0; index < 49; index++) {
        const id = idFor(100 + index)
        const denominationId = idFor(300 + index)
        await ctx.db.insert('campaignCurrencySystems', {
          campaignId: campaign.id,
          id,
          label: `System ${String(index).padStart(2, '0')}`,
          isReference: index === 0,
          version: 0
        })
        await ctx.db.insert(
          'campaignCurrencyDenominations',
          campaignStoredCurrencyDenominationSchema.parse({
            campaignId: campaign.id,
            id: denominationId,
            systemId: id,
            label: `Denomination ${index}`,
            abbreviation: `d${index}`,
            scaleInReference: 1,
            sortOrder: 0
          })
        )
      }
    })
    let cursor: string | null = null
    const systems: string[] = []
    for (let index = 0; index < 4; index++) {
      const page: CampaignCurrencySystemPage = await gm.caller.query(
        list,
        pageInput(campaign.id, cursor, 48)
      )
      systems.push(...page.page.map((row) => row.id))
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(systems).toHaveLength(49)
    expect(systemId).toBe(systems[0])

    const customSystemId = idFor(500)
    const customDenominationId = idFor(501)
    const replacementDenominationId = idFor(502)
    await t.run(async (ctx) => {
      await ctx.db.insert('campaignCurrencySystems', {
        campaignId: campaign.id,
        id: customSystemId,
        label: 'Grouped',
        isReference: false,
        version: 0
      })
      await ctx.db.insert(
        'campaignCurrencyDenominations',
        campaignStoredCurrencyDenominationSchema.parse({
          campaignId: campaign.id,
          systemId: customSystemId,
          id: customDenominationId,
          label: 'Grouped Coin',
          abbreviation: 'gc',
          scaleInReference: 1,
          sortOrder: 0
        })
      )
      await ctx.db.insert('campaignPartyInventories', { campaignId: campaign.id, version: 0 })
      for (let index = 0; index < 49; index++) {
        const groupId = idFor(700 + index)
        await ctx.db.insert(
          'campaignPartyCurrencyGroups',
          campaignStoredPartyCurrencyGroupSchema.parse({
            campaignId: campaign.id,
            id: groupId,
            containerId: null
          })
        )
        await ctx.db.insert('campaignPartyCurrencies', {
          campaignId: campaign.id,
          id: idFor(600 + index),
          groupId,
          denominationId: customDenominationId,
          campaignCurrencySystemId: customSystemId,
          amount: 2,
          containerId: null
        })
      }
    })
    await gm.caller.mutation(
      save,
      systemInput(
        campaign.id,
        'Grouped',
        [
          denomination(customDenominationId, 'Grouped Coin', 'gc', 2),
          denomination(replacementDenominationId, 'Replacement Coin', 'rc', 1)
        ],
        { systemId: customSystemId, expectedVersion: 0 }
      )
    )
    const convertedBalances = await t.run((ctx) =>
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaign_currencySystem_id', (q) =>
          q.eq('campaignId', campaign.id).eq('campaignCurrencySystemId', customSystemId)
        )
        .collect()
    )
    expect(convertedBalances).toHaveLength(49)
    expect(
      convertedBalances.every(
        (row) => row.denominationId === customDenominationId && row.amount === 1
      )
    ).toBe(true)
    expect(new Set(convertedBalances.map((row) => row.groupId)).size).toBe(49)
    await t.run(async (ctx) => {
      for (const balance of convertedBalances.slice(0, 48))
        await ctx.db.patch(balance._id, { amount: 0 })
    })
    await expect(
      gm.caller.mutation(remove, {
        campaignId: campaign.id,
        systemId: customSystemId,
        expectedVersion: 1
      })
    ).rejects.toThrow('positive balances')
    await t.run(async (ctx) => {
      for (const balance of convertedBalances.slice(0, 48))
        await ctx.db.patch(balance._id, { amount: 1 })
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
          .unique()
      )
    ).toMatchObject({ version: 1 })
    await gm.caller.mutation(partyMutate, {
      input: partyAdjust(campaign.id, 1, customDenominationId, -49)
    })
    const remaining = await t.run((ctx) =>
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaign_currencySystem_id', (q) =>
          q.eq('campaignId', campaign.id).eq('campaignCurrencySystemId', customSystemId)
        )
        .collect()
    )
    expect(remaining).toEqual([])
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
          .unique()
      )
    ).toMatchObject({ version: 2 })
  })
  it('rescales qualified assigned Character balances and blocks positive Character-only deletion', async () => {
    const { t, gm, player, campaign, character, readState } = await setup()
    const baseId = idFor(1_000)
    const highId = idFor(1_001)
    const created = await gm.caller.mutation(
      save,
      systemInput(
        campaign.id,
        'Character Coin',
        [denomination(baseId, 'Base', 'b', 1), denomination(highId, 'High', 'h', 2)],
        { isReference: true }
      )
    )
    await t.run((ctx) =>
      ctx.db.insert('campaignCharacterAssignments', {
        campaignId: campaign.id,
        userId: player.userId,
        characterId: character.id,
        assignedAt: campaign.createdAt
      })
    )
    await player.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: campaign.id,
      characterId: character.id,
      command: {
        type: 'ADJUST_CURRENCY',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        currencyId: highId,
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: created.id,
        amount: 3
      }
    })
    await gm.caller.mutation(
      save,
      systemInput(
        campaign.id,
        'Character Coin',
        [denomination(baseId, 'Base', 'b', 2), denomination(highId, 'High', 'h', 1)],
        { systemId: created.id, isReference: true, expectedVersion: 0 }
      )
    )
    const converted = (await readState()).character
    if (!converted) throw new Error('Missing assigned Character.')
    const convertedDocument = readCharacterRecord(converted)
    expect(converted.play.streamVersion).toBe(3)
    expect(convertedDocument.state.currency.flatMap((group) => group.currencies)).toContainEqual(
      expect.objectContaining({
        currencyId: highId,
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: created.id,
        amount: 6
      })
    )
    await expect(
      gm.caller.mutation(remove, {
        campaignId: campaign.id,
        systemId: created.id,
        expectedVersion: 1
      })
    ).rejects.toThrow('positive Character')
  })

  it.each([
    'loss',
    'overflow',
    'positive denomination',
    'ambiguous legacy',
    'duplicate balance'
  ] as const)('rejects assigned Character %s atomically', async (fault) => {
    const base = await setup()
    const collision = srdSystemRecord.currencies[0]!.id
    const highId = idFor(1_100)
    const created = await base.gm.caller.mutation(
      save,
      systemInput(base.campaign.id, 'Character rollback', [
        denomination(collision, 'Base', 'b', 1),
        denomination(highId, 'High', 'h', 2)
      ])
    )
    const amount = fault === 'overflow' ? Number.MAX_SAFE_INTEGER : fault === 'loss' ? 1 : 3
    const holding = {
      currencyId: highId,
      kind: 'CAMPAIGN' as const,
      campaignCurrencySystemId: created.id,
      amount
    }
    const currencies =
      fault === 'ambiguous legacy'
        ? [{ currencyId: collision, amount: 1 }]
        : fault === 'duplicate balance'
          ? [holding, { ...holding }]
          : [holding]
    await setAssignedCurrency(base, [{ id: crypto.randomUUID(), currencies }])
    const before = await currencySnapshot(base)
    const denominations =
      fault === 'positive denomination'
        ? [denomination(collision, 'Base', 'b', 1)]
        : fault === 'loss'
          ? [denomination(collision, 'Base', 'b', 1), denomination(highId, 'High', 'h', 3)]
          : fault === 'overflow'
            ? [denomination(collision, 'Base', 'b', 2), denomination(highId, 'High', 'h', 1)]
            : created.denominations
    const expected =
      fault === 'positive denomination'
        ? 'positive Character'
        : fault === 'loss'
          ? 'preserve'
          : fault === 'overflow'
            ? 'supported range'
            : fault === 'ambiguous legacy'
              ? 'ambiguous legacy identity'
              : 'duplicate balances'
    await expect(
      base.gm.caller.mutation(
        save,
        systemInput(base.campaign.id, 'Changed', denominations, {
          systemId: created.id,
          isReference: true,
          expectedVersion: 0
        })
      )
    ).rejects.toThrow(expected)
    expect(await currencySnapshot(base)).toEqual(before)
  })

  it('keeps same-ID RULESET and foreign balances literal while deleting only zero target holdings', async () => {
    const base = await setup()
    const denominationId = srdSystemRecord.currencies[0]!.id
    const created = await base.gm.caller.mutation(
      save,
      systemInput(base.campaign.id, 'Target', [denomination(denominationId, 'Target', 't', 1)])
    )
    const ruleset = { currencyId: denominationId, kind: 'RULESET' as const, amount: 11 }
    const foreign = {
      currencyId: denominationId,
      kind: 'CAMPAIGN' as const,
      campaignCurrencySystemId: idFor(1_201),
      amount: 4
    }
    const target = {
      currencyId: denominationId,
      kind: 'CAMPAIGN' as const,
      campaignCurrencySystemId: created.id,
      amount: 0
    }
    const personalGroupId = crypto.randomUUID(),
      targetGroupId = crypto.randomUUID()
    await setAssignedCurrency(base, [
      { id: personalGroupId, currencies: [ruleset, foreign] },
      { id: targetGroupId, currencies: [target] }
    ])
    const before = await base.readState()
    await base.gm.caller.mutation(remove, {
      campaignId: base.campaign.id,
      systemId: created.id,
      expectedVersion: 0
    })
    const after = await base.readState()
    if (!before.character || !after.character) throw new Error('Missing Character.')
    expect(after.character.play.streamVersion).toBe(before.character.play.streamVersion + 1)
    const prior = readCharacterRecord(before.character),
      current = readCharacterRecord(after.character)
    expect(current).toEqual({
      ...prior,
      state: { ...prior.state, currency: [{ id: personalGroupId, currencies: [ruleset, foreign] }] }
    })
    expect((await base.readStored()).systems).toEqual([])
  })

  it('rolls back Character, party and Vehicle balances after a late presentation failure', async () => {
    const base = await setup()
    const denominationId = idFor(1_300)
    const created = await base.gm.caller.mutation(
      save,
      systemInput(base.campaign.id, 'Atomic', [denomination(denominationId, 'Coin', 'c', 1)])
    )
    await setAssignedCurrency(base, [
      {
        id: crypto.randomUUID(),
        currencies: [
          {
            currencyId: denominationId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: created.id,
            amount: 4
          }
        ]
      }
    ])
    await base.gm.caller.mutation(partyMutate, {
      input: {
        ...partyAdjust(base.campaign.id, 0, denominationId, 6),
        campaignCurrencySystemId: created.id
      }
    })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
    })
    const vehicle = await base.gm.caller.mutation(api.campaigns.vehicles.create, {
      campaignId: base.campaign.id,
      vehicleDefinitionId: cart.id
    })
    await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignPartyInventories', {
        campaignId: base.campaign.id,
        vehicleId: vehicle.id,
        version: 0
      })
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        vehicleId: vehicle.id,
        id: crypto.randomUUID(),
        denominationId,
        campaignCurrencySystemId: created.id,
        amount: 7,
        containerId: null
      })
    })
    const before = await currencySnapshot(base)
    const presentation = vi
      .spyOn(currencySystemDocuments, 'presentCurrencySystem')
      .mockImplementationOnce(() => {
        throw new Error('late Character currency presentation failure')
      })
    try {
      await expect(
        base.gm.caller.mutation(
          save,
          systemInput(base.campaign.id, 'Changed', created.denominations, {
            systemId: created.id,
            isReference: true,
            expectedVersion: 0
          })
        )
      ).rejects.toThrow('late Character currency presentation failure')
    } finally {
      presentation.mockRestore()
    }
    expect(await currencySnapshot(base)).toEqual(before)
  })
})
