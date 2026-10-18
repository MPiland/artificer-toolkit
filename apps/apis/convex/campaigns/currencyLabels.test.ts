import { describe, expect, it } from 'vitest'
import type { InventoryOwnerRefDto } from '@artificer-toolkit/schema/api/campaignInventory'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'

if (fighter.category !== 'BASE' || club.category === 'VARIANT')
  throw new Error('Expected the canonical parent Fighter and Club.')
const goldId = fighter.startingGold.currencyId
const clubPriceId = club.cost?.currencyId
const gold = srdSystemRecord.currencies.find(({ id }) => id === goldId)
const clubCurrency = srdSystemRecord.currencies.find(({ id }) => id === clubPriceId)
if (!gold || !clubCurrency) throw new Error('Expected SRD gold and the Club price currency.')

describe('Campaign currency labels', () => {
  it('names a System and a Campaign currency that share one id by their own identity', async () => {
    const base = await readySheetFixture()
    const campaign = await base.other.caller.mutation(api.campaigns.create.create, {
      name: 'Currency labels',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const campaignId = campaign.id
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId,
        userId: base.owner.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    await base.owner.caller.mutation(api.campaigns.assignments.assign, {
      campaignId,
      characterId: base.character.id
    })
    const guild = await base.other.caller.mutation(api.campaigns.currencySystems.save, {
      campaignId,
      label: 'Guild coinage',
      isReference: true,
      denominations: [{ id: gold.id, label: 'Guild Mark', abbreviation: 'gm', scaleInReference: 1 }]
    })
    const party: InventoryOwnerRefDto = { kind: 'CAMPAIGN', campaignId }
    const character: InventoryOwnerRefDto = { kind: 'CHARACTER', characterId: base.character.id }
    const versionOf = async (owner: InventoryOwnerRefDto) =>
      (
        await base.owner.caller.query(api.campaigns.inventoryOwners.version, {
          input: { campaignId, owner }
        })
      ).version
    for (const [campaignCurrencySystemId, amount] of [
      [null, 5],
      [guild.id, 3]
    ] as const)
      await base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          kind: 'CURRENCY_ADJUST',
          campaignId,
          denominationId: gold.id,
          campaignCurrencySystemId,
          amount,
          expectedOwnerVersion: await versionOf(party),
          idempotencyKey: crypto.randomUUID()
        }
      })
    const before = await base.owner.caller.query(api.characters.sheetSlices.get, {
      campaignId,
      id: base.character.id,
      slice: 'INVENTORY'
    })
    if (before?.slice !== 'INVENTORY') throw new Error('Expected the Character inventory.')
    const startingGold = before.data.inventory.currencies
      .filter((currency) => currency.kind === 'RULESET' && currency.currencyId === gold.id)
      .reduce((sum, currency) => sum + currency.amount, 0)

    for (const [campaignCurrencySystemId, amount] of [
      [null, 1],
      [guild.id, 2]
    ] as const)
      await base.owner.caller.mutation(api.campaigns.inventoryTransfers.transfer, {
        input: {
          kind: 'CURRENCY',
          campaignId,
          source: party,
          destination: character,
          campaignCurrencySystemId,
          denominationId: gold.id,
          amount,
          expectedSourceVersion: await versionOf(party),
          expectedDestinationVersion: await versionOf(character),
          idempotencyKey: crypto.randomUUID()
        }
      })

    const partyCurrencies = await base.owner.caller.query(api.campaigns.partyInventory.currencies, {
      campaignId,
      paginationOpts: { cursor: null, numItems: 48 }
    })
    expect(partyCurrencies.page).toHaveLength(2)
    expect(partyCurrencies.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'RULESET',
          denominationId: gold.id,
          label: gold.label,
          abbreviation: gold.short,
          amount: 4
        }),
        expect.objectContaining({
          kind: 'CAMPAIGN',
          campaignCurrencySystemId: guild.id,
          denominationId: gold.id,
          label: 'Guild Mark',
          abbreviation: 'gm',
          amount: 1
        })
      ])
    )
    const sheet = await base.owner.caller.query(api.characters.sheetSlices.get, {
      campaignId,
      id: base.character.id,
      slice: 'INVENTORY'
    })
    if (sheet?.slice !== 'INVENTORY') throw new Error('Expected the Character inventory.')
    const held = (kind: 'RULESET' | 'CAMPAIGN') =>
      sheet.data.inventory.currencies.filter(
        (currency) => currency.kind === kind && currency.currencyId === gold.id
      )
    expect(held('RULESET').map(({ label }) => label)).toEqual(held('RULESET').map(() => gold.label))
    expect(held('RULESET').reduce((sum, { amount }) => sum + amount, 0)).toBe(startingGold + 1)
    expect(held('CAMPAIGN')).toEqual([
      expect.objectContaining({
        campaignCurrencySystemId: guild.id,
        label: 'Guild Mark (Guild coinage)',
        amount: 2
      })
    ])
    expect(sheet.data.inventory.items.find((item) => item.label === club.label)).toMatchObject({
      cost: { currencyId: clubCurrency.id },
      costLabel: clubCurrency.label
    })
  })
})
