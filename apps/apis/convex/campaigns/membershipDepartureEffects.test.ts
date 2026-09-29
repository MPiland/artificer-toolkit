import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  campaignMembershipDepartureResultSchema,
  removeCampaignMemberInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import {
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, makePublishedRootOwned } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { readCharacterDraft } from '../characters/documents'
import {
  joinCharacterPlay,
  readCharacterRecord,
  readCharacterRow
} from '../characters/stateDocuments'

const removeMember = makeFunctionReference<
  'mutation',
  z.input<typeof removeCampaignMemberInputSchema>,
  z.output<typeof campaignMembershipDepartureResultSchema>
>('campaigns/membershipDeparture:removeMember')
const saveCurrency = makeFunctionReference<
  'mutation',
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
>('campaigns/currencySystems:save')

const campaignInput = {
  name: 'Membership departure effects',
  format: 'ONGOING' as const,
  toneTags: ['HEROIC' as const],
  contentMaturity: 'STANDARD' as const,
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

async function createCampaign(base: Awaited<ReturnType<typeof readySheetFixture>>) {
  const campaign = await base.other.caller.mutation(api.campaigns.create.create, campaignInput)
  const departingUserId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: departingUserId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  })
  return { ...base, campaign, departingUserId }
}

async function shareOwnedRoot(
  base: Awaited<ReturnType<typeof createCampaign>>,
  subjectId: string,
  ownerUserId: string
) {
  await base.t.run(async (ctx) => {
    await makePublishedRootOwned(ctx, subjectId, ownerUserId)
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique()
    if (!root) throw new Error('Missing authored fixture.')
    await ctx.db.insert('campaignContentShares', {
      campaignId: base.campaign.id,
      subjectKind: root.subjectKind,
      subjectId,
      sharedBy: ownerUserId,
      createdAt: base.campaign.createdAt,
      updatedAt: base.campaign.updatedAt
    })
  })
}

describe('native Campaign membership departure effects', () => {
  it('repairs remaining assigned Characters after shared Background loss and acknowledges replay', async () => {
    const base = await createCampaign(await readySheetFixture())
    await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: base.campaign.id,
        userId: base.owner.userId,
        characterId: base.character.id,
        assignedAt: base.campaign.createdAt
      })
      await ctx.db.insert('campaignCharacterStates', {
        campaignId: base.campaign.id,
        characterId: base.character.id,
        documentJson: JSON.stringify({ adjustments: [], conditions: [] }),
        checksum: checksumRuleDocument({ adjustments: [], conditions: [] })
      })
    })
    await shareOwnedRoot(base, acolyte.id, base.departingUserId)
    const draft = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const before = await base.t.run(async (ctx) => ({
      campaign: (await ctx.db.query('campaigns').collect())[0],
      character: await readCharacterRow(ctx, base.character.id),
      assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
      overlays: await ctx.db.query('campaignCharacterStates').collect(),
      drafts: await ctx.db.query('characterDrafts').collect(),
      shares: await ctx.db.query('campaignContentShares').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
    const request = {
      campaignId: base.campaign.id,
      userId: base.departingUserId,
      expectedCampaignVersion: before.campaign!.version,
      expectedMembershipAccessStartedAt: base.campaign.createdAt,
      commandId: crypto.randomUUID()
    }
    expect(await base.other.caller.mutation(removeMember, request)).toEqual({ ok: true })
    const after = await base.t.run(async (ctx) => ({
      memberships: await ctx.db.query('campaignMemberships').collect(),
      campaign: (await ctx.db.query('campaigns').collect())[0],
      character: await readCharacterRow(ctx, base.character.id),
      assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
      overlays: await ctx.db.query('campaignCharacterStates').collect(),
      drafts: await ctx.db.query('characterDrafts').collect(),
      shares: await ctx.db.query('campaignContentShares').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
    expect(after.campaign?.version).toBe(before.campaign!.version + 1)
    expect(after.shares).toEqual([])
    expect(after.assignments).toEqual(before.assignments)
    expect(after.overlays).toEqual(before.overlays)
    expect(after.character).toMatchObject({
      status: 'DRAFT',
      play: { streamVersion: before.character!.play.streamVersion + 1 }
    })
    expect(after.character?.sheetState).toEqual(before.character?.sheetState)
    const canonical = readCharacterRecord(after.character!)
    expect(canonical.intent.background.backgroundId).toBe('')
    expect(after.drafts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draft.id })])
    )
    const savedDraft = after.drafts.find((candidate) => candidate.id === draft.id)
    const active = after.character
    if (!savedDraft || !active) throw new Error('Missing preserved Character draft payload.')
    const draftPayload = await base.t.run(
      async (ctx) => (await readCharacterDraft(ctx, savedDraft, active)).payload
    )
    expect(draftPayload.character.intent.background.backgroundId).toBe('')
    expect(after.events).toHaveLength(before.events.length + 2)
    expect(after.events.every((event) => event.actorUserId === base.other.userId)).toBe(true)
    expect(after.events.find((event) => event.commandId === request.commandId)).toMatchObject({
      visibility: 'OWNER',
      type: 'CAMPAIGN_CONTENT_SHARES_REMOVED',
      actorUserId: base.other.userId
    })
    expect(await base.other.caller.mutation(removeMember, request)).toEqual({ ok: true })
    expect(
      await base.t.run(async (ctx) => ({
        memberships: await ctx.db.query('campaignMemberships').collect(),
        campaigns: await ctx.db.query('campaigns').collect(),
        characters: await Promise.all(
          (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
        ),
        assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
        overlays: await ctx.db.query('campaignCharacterStates').collect(),
        drafts: await ctx.db.query('characterDrafts').collect(),
        shares: await ctx.db.query('campaignContentShares').collect(),
        events: await ctx.db.query('campaignEvents').collect()
      }))
    ).toEqual({
      memberships: after.memberships,
      campaigns: [after.campaign],
      characters: [after.character],
      assignments: after.assignments,
      overlays: after.overlays,
      drafts: after.drafts,
      shares: after.shares,
      events: after.events
    })
  })

  it('evacuates a departing author Vehicle into party custody with a correlated OWNER event', async () => {
    const base = await createCampaign(await readySheetFixture())
    const system = await base.other.caller.mutation(saveCurrency, {
      campaignId: base.campaign.id,
      label: 'Departure tokens',
      isReference: true,
      denominations: [{ label: 'Token', abbreviation: 'tk', scaleInReference: 1 }]
    })
    const denominationId = system.denominations[0]!.id
    await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: base.campaign.id,
        userId: base.owner.userId,
        characterId: base.character.id,
        assignedAt: base.campaign.createdAt
      })
      await editCharacterRecord(ctx, base.character.id, (character) => ({
        ...character,
        state: {
          ...character.state,
          currency: [
            ...character.state.currency,
            {
              id: crypto.randomUUID(),
              currencies: [{ currencyId: denominationId, amount: 5 }]
            }
          ]
        }
      }))
    })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
    })
    const vehicleDraft = await base.owner.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'VEHICLE',
      subjectId: cart.id
    })
    if (!vehicleDraft.updatedAt) throw new Error('Missing Vehicle draft revision.')
    const vehiclePublication = await base.owner.caller.mutation(
      api.content.publication.publishDraft,
      {
        subjectKind: 'VEHICLE',
        subjectId: vehicleDraft.subjectId,
        expectedDraftUpdatedAt: vehicleDraft.updatedAt
      }
    )
    await shareOwnedRoot(base, vehiclePublication.subjectId, base.owner.userId)
    const vehicle = await base.other.caller.mutation(api.campaigns.vehicles.create, {
      campaignId: base.campaign.id,
      vehicleDefinitionId: vehiclePublication.subjectId
    })
    const itemId = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({ campaignId: base.campaign.id, version: 3 })
      )
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: vehicle.id,
          version: 1
        })
      )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: base.campaign.id,
          vehicleId: vehicle.id,
          id: itemId,
          equipmentId: club.id,
          quantity: 1,
          containerId: null
        })
      )
      await ctx.db.insert(
        'campaignPartyCurrencies',
        campaignStoredPartyCurrencySchema.parse({
          campaignId: base.campaign.id,
          vehicleId: vehicle.id,
          id: crypto.randomUUID(),
          denominationId,
          campaignCurrencySystemId: system.id,
          amount: 7,
          containerId: null
        })
      )
    })
    const currentCampaign = await base.t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
    )
    if (!currentCampaign) throw new Error('Missing Campaign.')
    const request = {
      campaignId: base.campaign.id,
      userId: base.owner.userId,
      expectedCampaignVersion: currentCampaign.version,
      expectedMembershipAccessStartedAt: base.campaign.createdAt,
      commandId: crypto.randomUUID()
    }
    expect(await base.other.caller.mutation(removeMember, request)).toEqual({ ok: true })
    const state = await base.t.run(async (ctx) => ({
      campaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique(),
      vehicle: await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', vehicle.id)
        )
        .unique(),
      inventory: await ctx.db.query('campaignPartyInventories').collect(),
      items: await ctx.db.query('campaignPartyItems').collect(),
      currencies: await ctx.db.query('campaignPartyCurrencies').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
    expect(state.campaign?.version).toBe(currentCampaign.version + 1)
    expect(state.vehicle).toBeNull()
    expect(state.inventory).toEqual([expect.objectContaining({ version: 5 })])
    expect(state.inventory.every((inventory) => !('vehicleId' in inventory))).toBe(true)
    expect(state.items).toEqual([expect.objectContaining({ id: itemId, containerId: null })])
    expect(state.items[0]).not.toHaveProperty('vehicleId')
    expect(state.currencies).toEqual([
      expect.objectContaining({ amount: 12, denominationId, campaignCurrencySystemId: system.id })
    ])
    expect(state.currencies[0]).not.toHaveProperty('vehicleId')
    expect(
      await base.t.run((ctx) => ctx.db.query('campaignCharacterAssignments').collect())
    ).toEqual([])
    const departedCharacter = await base.t.run((ctx) => readCharacterRow(ctx, base.character.id))
    const departedDocument = readCharacterRecord(departedCharacter!)
    expect(
      departedDocument.state.currency
        .flatMap((group) => group.currencies)
        .some((currency) => currency.currencyId === denominationId)
    ).toBe(false)
    expect(state.events).toHaveLength(4)
    expect(state.events.filter((event) => event.visibility === 'OWNER')).toHaveLength(3)
    expect(state.events.every((event) => event.actorUserId === base.other.userId)).toBe(true)
    expect(state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CAMPAIGN_CHARACTER_RECONCILED',
          visibility: 'SUBJECT',
          subjectCharacterId: base.character.id
        }),
        expect.objectContaining({
          type: 'CUSTODY_TRANSFER',
          visibility: 'OWNER',
          inventoryAudit: true,
          actorUserId: base.other.userId,
          subjectCharacterId: base.character.id
        }),
        expect.objectContaining({
          type: 'CAMPAIGN_VEHICLE_EVACUATED',
          visibility: 'OWNER',
          actorUserId: base.other.userId
        }),
        expect.objectContaining({
          type: 'CAMPAIGN_CONTENT_SHARES_REMOVED',
          visibility: 'OWNER',
          actorUserId: base.other.userId,
          commandId: request.commandId
        })
      ])
    )
    const removalEvent = state.events.find(
      (event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED'
    )
    const evacuationEvent = state.events.find(
      (event) => event.type === 'CAMPAIGN_VEHICLE_EVACUATED'
    )
    expect(removalEvent).toBeDefined()
    expect(JSON.parse(evacuationEvent!.payloadJson)).toMatchObject({
      removalEventId: removalEvent!.id
    })
  })
})
