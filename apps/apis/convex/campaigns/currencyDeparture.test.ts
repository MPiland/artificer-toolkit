import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { editCharacterRecord, writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { returnDepartingCharacterCurrency } from './currencyDeparture'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const saveCurrency = makeFunctionReference<
  'mutation',
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
>('campaigns/currencySystems:save')

async function setup(amounts = [2, 3], destination = 7) {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(create, {
    name: 'Currency departure',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const system = await base.other.caller.mutation(saveCurrency, {
    campaignId: campaign.id,
    label: 'Table tokens',
    isReference: true,
    denominations: [{ label: 'Token', abbreviation: 'tk', scaleInReference: 1 }]
  })
  const denominationId = system.denominations[0]!.id
  const personalId = srdSystemRecord.currencies[0]!.id
  const foreignId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    await editCharacterRecord(ctx, base.character.id, (character) => ({
      ...character,
      state: {
        ...character.state,
        currency: [
          {
            id: crypto.randomUUID(),
            currencies: [
              { currencyId: personalId, amount: 11 },
              { currencyId: foreignId, amount: 4 }
            ]
          },
          ...amounts.map((amount) => ({
            id: crypto.randomUUID(),
            currencies: [{ currencyId: denominationId, amount }]
          }))
        ]
      }
    }))
    await ctx.db.insert('campaignPartyInventories', {
      campaignId: campaign.id,
      version: 0
    })
    await ctx.db.insert('campaignPartyCurrencies', {
      campaignId: campaign.id,
      id: crypto.randomUUID(),
      denominationId,
      campaignCurrencySystemId: system.id,
      amount: destination,
      containerId: null
    })
  })
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, base.character.id),
      balances: await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      groups: await ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      inventory: await ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId_vehicleId', (q) =>
          q.eq('campaignId', campaign.id).eq('vehicleId', undefined)
        )
        .unique(),
      events: await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect()
    }))
  const depart = (failAfter = false, reason = 'CHARACTER_UNASSIGNED') =>
    base.t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, base.character.id)
      const storedCampaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row || !storedCampaign) throw new Error('Missing departure fixture.')
      const character = readCharacterRecord(row)
      const result = await returnDepartingCharacterCurrency({
        ctx,
        campaign: storedCampaign,
        characterId: row.id,
        actorUserId: base.owner.userId,
        state: character.state,
        reason
      })
      await writeCharacterRecord(ctx, row, { document: { ...character, state: result.state } })
      if (failAfter) throw new Error('Later reconciliation failed.')
      return result
    })
  return {
    ...base,
    campaign,
    system,
    denominationId,
    personalId,
    foreignId,
    snapshot,
    depart
  }
}

describe('Campaign departure currency return', () => {
  it('returns only this Campaign currency, preserves group identities and personal state, and does not replay money', async () => {
    const base = await setup()
    const before = await base.snapshot()
    const original = readCharacterRecord(before.character!)
    const result = await base.depart()
    expect(result.moved).toEqual([{ denominationId: base.denominationId, amount: '5' }])
    expect(result.state).toEqual({
      ...original.state,
      currency: [
        original.state.currency[0],
        ...original.state.currency.slice(1).map((group) => ({ ...group, currencies: [] }))
      ]
    })
    const after = await base.snapshot()
    expect(after.balances).toMatchObject([
      {
        amount: 12,
        containerId: null,
        campaignCurrencySystemId: base.system.id
      }
    ])
    expect(after.inventory?.version).toBe(1)
    expect(after.character?.sheetState).toEqual(before.character?.sheetState)
    expect(after.events).toHaveLength(1)
    expect(after.events[0]).toMatchObject({
      type: 'CUSTODY_TRANSFER',
      visibility: 'OWNER',
      inventoryAudit: true,
      subjectCharacterId: base.character.id
    })
    expect(JSON.parse(after.events[0]!.payloadJson).denominations).toEqual([
      {
        denominationId: base.denominationId,
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: base.system.id,
        amount: '5',
        beforeSourceAmount: '5',
        afterSourceAmount: '0'
      }
    ])
    expect((await base.depart()).moved).toEqual([])
    expect(await base.snapshot()).toEqual(after)
  })

  it('strips deleted Campaign funds without merging or changing custody that will be purged', async () => {
    const base = await setup(
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      Number.MAX_SAFE_INTEGER
    )
    const before = await base.snapshot()
    const original = readCharacterRecord(before.character!)
    const result = await base.depart(false, 'CAMPAIGN_DELETED')
    expect(result.moved).toEqual([])
    expect(result.eventId).toBeNull()
    expect(result.state).toEqual({
      ...original.state,
      currency: [
        original.state.currency[0],
        ...original.state.currency.slice(1).map((group) => ({ ...group, currencies: [] }))
      ]
    })
    const after = await base.snapshot()
    expect(after.balances).toEqual(before.balances)
    expect(after.inventory).toEqual(before.inventory)
    expect(after.events).toEqual(before.events)
    expect(after.character?.sheetState).toEqual(before.character?.sheetState)
  })
  it('removes zero balances without an audit event or version bump', async () => {
    const base = await setup([0])
    const result = await base.depart()
    expect(result.eventId).toBeNull()
    expect(result.state.currency[1]?.currencies).toEqual([])
    const after = await base.snapshot()
    expect(after.inventory?.version).toBe(0)
    expect(after.balances[0]?.amount).toBe(7)
    expect(after.events).toEqual([])
  })

  it('does not reinterpret System coins when a custom denomination reuses their UUID', async () => {
    const base = await setup()
    await base.other.caller.mutation(saveCurrency, {
      campaignId: base.campaign.id,
      label: 'Ambiguous tokens',
      isReference: false,
      denominations: [
        { id: base.personalId, label: 'Coin', abbreviation: 'c', scaleInReference: 1 }
      ]
    })
    const before = await base.snapshot()
    const original = readCharacterRecord(before.character!)
    const result = await base.depart()
    expect(result.moved).toEqual([{ denominationId: base.denominationId, amount: '5' }])
    expect(result.state.currency[0]).toEqual(original.state.currency[0])
    expect(result.state.currency.slice(1).every((group) => group.currencies.length === 0)).toBe(
      true
    )
    const after = await base.snapshot()
    expect(after.balances).toHaveLength(1)
    expect(after.balances[0]?.amount).toBe(12)
    expect(after.inventory?.version).toBe(1)
    expect(after.events).toHaveLength(1)
  })

  it('does not create party records for a zero-only departure', async () => {
    const base = await setup([0], 0)
    const seeded = await base.snapshot()
    await base.t.run(async (ctx) => {
      for (const balance of seeded.balances) await ctx.db.delete(balance._id)
      await ctx.db.delete(seeded.inventory!._id)
    })
    const result = await base.depart()
    expect(result.state.currency[1]?.currencies).toEqual([])
    expect(result.eventId).toBeNull()
    const after = await base.snapshot()
    expect(after.balances).toEqual([])
    expect(after.inventory).toBeNull()
    expect(after.events).toEqual([])
  })

  it('uses separate purses on destination overflow and rolls back a later reconciliation failure', async () => {
    const overflow = await setup([Number.MAX_SAFE_INTEGER, 1], Number.MAX_SAFE_INTEGER)
    expect((await overflow.depart()).moved).toEqual([
      {
        denominationId: overflow.denominationId,
        amount: (BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString()
      }
    ])
    const afterOverflow = await overflow.snapshot()
    expect(afterOverflow.groups).toHaveLength(2)
    expect(
      afterOverflow.balances
        .filter((balance) => balance.groupId !== undefined)
        .reduce((sum, balance) => sum + BigInt(balance.amount), 0n)
    ).toBe(BigInt(Number.MAX_SAFE_INTEGER) + 1n)
    expect(afterOverflow.balances.find((balance) => balance.groupId === undefined)?.amount).toBe(
      Number.MAX_SAFE_INTEGER
    )
    expect(afterOverflow.inventory?.version).toBe(1)
    expect(afterOverflow.events).toHaveLength(1)
    const later = await setup()
    const prior = await later.snapshot()
    await expect(later.depart(true)).rejects.toThrow('Later reconciliation failed')
    expect(await later.snapshot()).toEqual(prior)
  })

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid stored amount %s without transferring currency',
    async (amount) => {
      const base = await setup([amount])
      const before = await base.snapshot()
      await expect(base.depart()).rejects.toThrow()
      expect(await base.snapshot()).toEqual(before)
    }
  )
  it('returns qualified custom currency while keeping a ruleset and historical identity with the same UUID', async () => {
    const base = await setup()
    const custom = await base.other.caller.mutation(saveCurrency, {
      campaignId: base.campaign.id,
      label: 'Qualified collision',
      isReference: false,
      denominations: [
        { id: base.personalId, label: 'Story coin', abbreviation: 'sc', scaleInReference: 1 }
      ]
    })
    const foreignSystemId = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      await editCharacterRecord(ctx, base.character.id, (character) => {
        character.state.currency[0]!.currencies = [
          { currencyId: base.personalId, kind: 'RULESET', amount: 11 },
          {
            currencyId: base.personalId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: custom.id,
            amount: 3
          },
          {
            currencyId: base.personalId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: foreignSystemId,
            amount: 4
          }
        ]
        return character
      })
    })
    const before = await base.snapshot()
    const original = readCharacterRecord(before.character!)
    const result = await base.depart()
    expect(result.state.currency[0]).toEqual({
      ...original.state.currency[0],
      currencies: [
        original.state.currency[0]!.currencies[0],
        original.state.currency[0]!.currencies[2]
      ]
    })
    expect(result.moved).toEqual(
      expect.arrayContaining([
        { denominationId: base.personalId, amount: '3' },
        { denominationId: base.denominationId, amount: '5' }
      ])
    )
    const after = await base.snapshot()
    expect(after.balances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          denominationId: base.personalId,
          campaignCurrencySystemId: custom.id,
          amount: 3
        }),
        expect.objectContaining({
          denominationId: base.denominationId,
          campaignCurrencySystemId: base.system.id,
          amount: 12
        })
      ])
    )
    expect(after.inventory?.version).toBe(1)
    expect((await base.depart()).moved).toEqual([])
    expect(await base.snapshot()).toEqual(after)
  })
})
