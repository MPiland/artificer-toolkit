import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CreateCampaignInput,
  CampaignDetailDto,
  CampaignAssignmentResult
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  TransferCampaignInventoryInput,
  CampaignInventoryTransferResultDto,
  CampaignPartyInventoryMutationInput,
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const assign = makeFunctionReference<
  'mutation',
  { campaignId: string; characterId: string },
  CampaignAssignmentResult
>('campaigns/assignments:assign')
const transfer = makeFunctionReference<
  'mutation',
  { input: TransferCampaignInventoryInput },
  CampaignInventoryTransferResultDto
>('campaigns/inventoryTransfers:transfer')
const mutateParty = makeFunctionReference<
  'mutation',
  { input: CampaignPartyInventoryMutationInput },
  { eventId: string }
>('campaigns/partyInventoryCommands:mutate')
const saveSystem = makeFunctionReference<
  'mutation',
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
>('campaigns/currencySystems:save')
if (fighter.category !== 'BASE') throw new Error('Expected canonical parent Fighter.')
const denominationId = fighter.startingGold.currencyId
const idFor = (index: number) => `60000000-0000-4000-8000-${String(index).padStart(12, '0')}`

async function setup() {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(create, {
    name: 'Character currency custody',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  await base.owner.caller.mutation(assign, {
    campaignId: campaign.id,
    characterId: base.character.id
  })
  const readStored = () =>
    base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, base.character.id),
      inventories: await ctx.db.query('campaignPartyInventories').collect(),
      currencies: await ctx.db.query('campaignPartyCurrencies').collect(),
      groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
  return { ...base, campaign, readStored }
}

type Fixture = Awaited<ReturnType<typeof setup>>
async function setCurrency(
  base: Fixture,
  currency: ReturnType<typeof readCharacterRecord>['state']['currency']
) {
  await base.t.run((ctx) =>
    editCharacterRecord(ctx, base.character.id, (document) => ({
      ...document,
      state: { ...document.state, currency }
    }))
  )
}
function command(
  base: Fixture,
  sourceVersion: number,
  destinationVersion: number
): Extract<TransferCampaignInventoryInput, { kind: 'CURRENCY' }> {
  return {
    kind: 'CURRENCY',
    campaignId: base.campaign.id,
    source: { kind: 'CHARACTER', characterId: base.character.id },
    destination: { kind: 'CAMPAIGN', campaignId: base.campaign.id },
    campaignCurrencySystemId: null,
    denominationId,
    amount: 5,
    expectedSourceVersion: sourceVersion,
    expectedDestinationVersion: destinationVersion,
    idempotencyKey: crypto.randomUUID()
  }
}
function currencyOf(record: NonNullable<Awaited<ReturnType<Fixture['readStored']>>['character']>) {
  return readCharacterRecord(record).state.currency
}

describe('native Character currency custody', () => {
  it('publishes both fences once, replays exact actor-bound input after later changes, and refuses lost authority', async () => {
    const base = await setup()
    const before = await base.readStored()
    const input = command(base, before.character!.play.streamVersion, 0)
    const result = await base.owner.caller.mutation(transfer, { input })
    const after = await base.readStored()
    expect(after.character!.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
    expect(
      currencyOf(after.character!)
        .flatMap((group) => group.currencies)
        .find((row) => row.currencyId === denominationId)?.amount
    ).toBe(110)
    expect(readCharacterRecord(after.character!).state.equipment).toEqual(
      readCharacterRecord(before.character!).state.equipment
    )
    expect(readCharacterRecord(after.character!).intent).toEqual(
      readCharacterRecord(before.character!).intent
    )
    expect(after.inventories).toContainEqual(
      expect.objectContaining({ campaignId: base.campaign.id, version: 1 })
    )
    expect(after.currencies).toContainEqual(expect.objectContaining({ denominationId, amount: 5 }))
    expect(after.events.find((event) => event.id === result.eventId)).toEqual(
      expect.objectContaining({
        type: 'CUSTODY_TRANSFER',
        visibility: 'OWNER',
        subjectCharacterId: base.character.id,
        actorUserId: base.owner.userId
      })
    )
    await base.other.caller.mutation(mutateParty, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId: base.campaign.id,
        denominationId,
        campaignCurrencySystemId: null,
        amount: 3,
        expectedOwnerVersion: 1,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const later = await base.readStored()
    expect(await base.owner.caller.mutation(transfer, { input })).toEqual(result)
    expect(await base.readStored()).toEqual(later)
    await expect(
      base.owner.caller.mutation(transfer, { input: { ...input, amount: 6 } })
    ).rejects.toThrow('different input')
    await expect(base.other.caller.mutation(transfer, { input })).rejects.toThrow('different input')
    expect(await base.readStored()).toEqual(later)
    await base.t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!member) throw new Error('Missing player membership.')
      await ctx.db.patch(member._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(base.owner.caller.mutation(transfer, { input })).rejects.toThrow('not found')
    expect(await base.readStored()).toEqual(later)
  })

  it('keeps colliding RULESET, current Campaign and historical Campaign balances exact and separate', async () => {
    const base = await setup()
    const system = await base.other.caller.mutation(saveSystem, {
      campaignId: base.campaign.id,
      label: 'Campaign gold',
      isReference: true,
      denominations: [
        { id: denominationId, label: 'Campaign gold', abbreviation: 'cg', scaleInReference: 1 }
      ]
    })
    const foreignId = idFor(90)
    await setCurrency(base, [
      {
        id: idFor(1),
        currencies: [
          { currencyId: denominationId, kind: 'RULESET', amount: 20 },
          {
            currencyId: denominationId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: system.id,
            amount: 7
          },
          {
            currencyId: denominationId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: foreignId,
            amount: 9
          }
        ]
      }
    ])
    const initial = await base.readStored()
    const ruleInput = { ...command(base, initial.character!.play.streamVersion, 0), amount: 3 }
    await base.owner.caller.mutation(transfer, { input: ruleInput })
    const rule = await base.readStored()
    const campaignInput = {
      ...command(base, rule.character!.play.streamVersion, 1),
      campaignCurrencySystemId: system.id.toUpperCase(),
      amount: 2
    }
    const result = await base.owner.caller.mutation(transfer, { input: campaignInput })
    const after = await base.readStored()
    expect(currencyOf(after.character!)).toEqual([
      {
        id: idFor(1),
        currencies: [
          { currencyId: denominationId, kind: 'RULESET', amount: 17 },
          {
            currencyId: denominationId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: system.id,
            amount: 5
          },
          {
            currencyId: denominationId,
            kind: 'CAMPAIGN',
            campaignCurrencySystemId: foreignId,
            amount: 9
          }
        ]
      }
    ])
    expect(after.currencies).toHaveLength(2)
    expect(after.currencies.find((row) => row.campaignCurrencySystemId === undefined)?.amount).toBe(
      3
    )
    expect(after.currencies.find((row) => row.campaignCurrencySystemId === system.id)?.amount).toBe(
      2
    )
    expect(
      await base.owner.caller.mutation(transfer, {
        input: { ...campaignInput, campaignCurrencySystemId: system.id }
      })
    ).toEqual(result)
    expect(await base.readStored()).toEqual(after)
  })

  it('drains more than 48 Character groups completely and retains unrelated historical holdings', async () => {
    const base = await setup()
    const foreign = {
      id: idFor(90),
      currencies: [
        {
          currencyId: idFor(91),
          kind: 'CAMPAIGN' as const,
          campaignCurrencySystemId: idFor(92),
          amount: 4
        }
      ]
    }
    await setCurrency(base, [
      ...Array.from({ length: 49 }, (_, index) => ({
        id: idFor(index + 1),
        currencies: [{ currencyId: denominationId, kind: 'RULESET' as const, amount: 1 }]
      })),
      foreign
    ])
    const before = await base.readStored()
    await base.owner.caller.mutation(transfer, {
      input: { ...command(base, before.character!.play.streamVersion, 0), amount: 49 }
    })
    const after = await base.readStored()
    expect(currencyOf(after.character!)).toEqual([foreign])
    expect(after.currencies).toHaveLength(1)
    expect(after.currencies[0]?.amount).toBe(49)
    expect(after.character!.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
  })

  it('accepts party currency into a Character and rolls back both owners after late failure or overflow', async () => {
    const base = await setup()
    await base.other.caller.mutation(mutateParty, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId: base.campaign.id,
        denominationId,
        campaignCurrencySystemId: null,
        amount: 6,
        expectedOwnerVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const before = await base.readStored()
    const input = {
      ...command(base, 1, before.character!.play.streamVersion),
      source: { kind: 'CAMPAIGN' as const, campaignId: base.campaign.id },
      destination: { kind: 'CHARACTER' as const, characterId: base.character.id },
      amount: 6
    }
    await expect(
      base.owner.caller.run(async (ctx) => {
        await ctx.runMutation(transfer, { input })
        throw new Error('Abort after mixed currency settlement')
      })
    ).rejects.toThrow('Abort after mixed currency settlement')
    expect(await base.readStored()).toEqual(before)
    await base.owner.caller.mutation(transfer, { input })
    const after = await base.readStored()
    expect(
      currencyOf(after.character!)
        .flatMap((group) => group.currencies)
        .find((row) => row.currencyId === denominationId)?.amount
    ).toBe(121)
    expect(after.currencies).toHaveLength(0)
    expect(after.inventories[0]?.version).toBe(2)
    expect(after.character!.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
    await base.other.caller.mutation(mutateParty, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId: base.campaign.id,
        denominationId,
        campaignCurrencySystemId: null,
        amount: 1,
        expectedOwnerVersion: 2,
        idempotencyKey: crypto.randomUUID()
      }
    })
    await setCurrency(base, [
      {
        id: idFor(1),
        currencies: [
          { currencyId: denominationId, kind: 'RULESET', amount: Number.MAX_SAFE_INTEGER }
        ]
      }
    ])
    const overflow = await base.readStored()
    await expect(
      base.owner.caller.mutation(transfer, {
        input: {
          ...input,
          amount: 1,
          expectedSourceVersion: 3,
          expectedDestinationVersion: overflow.character!.play.streamVersion,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow('supported range')
    expect(await base.readStored()).toEqual(overflow)
  })
})
