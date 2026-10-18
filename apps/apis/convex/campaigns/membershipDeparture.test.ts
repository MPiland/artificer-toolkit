import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  leaveCampaignInputSchema,
  removeCampaignMemberInputSchema,
  campaignMembershipDepartureResultSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { makePublishedRootOwned } from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
import { readCharacterDraft } from '../characters/documents'
import { joinCharacterPlay, readCharacterRecord } from '../characters/stateDocuments'
import * as removal from './contentShareRemoval'

const leave = makeFunctionReference<
  'mutation',
  z.input<typeof leaveCampaignInputSchema>,
  z.output<typeof campaignMembershipDepartureResultSchema>
>('campaigns/membershipDeparture:leave')
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

async function setup() {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(api.campaigns.create.create, {
    name: 'Departure table',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const membershipId = await base.t.run((ctx) =>
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
  const request = {
    campaignId: campaign.id,
    expectedCampaignVersion: campaign.version,
    expectedMembershipAccessStartedAt: campaign.createdAt,
    commandId: crypto.randomUUID()
  }
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      memberships: await ctx.db.query('campaignMemberships').collect(),
      campaigns: await ctx.db.query('campaigns').collect(),
      assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
      overlays: await ctx.db.query('campaignCharacterStates').collect(),
      shares: await ctx.db.query('campaignContentShares').collect(),
      events: await ctx.db.query('campaignEvents').collect(),
      characters: await Promise.all(
        (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
      ),
      drafts: await ctx.db.query('characterDrafts').collect(),
      conversations: await ctx.db.query('campaignConversations').collect(),
      conversationMembers: await ctx.db.query('campaignConversationMembers').collect(),
      entries: await ctx.db.query('campaignConversationEntries').collect(),
      balances: await ctx.db.query('campaignPartyCurrencies').collect()
    }))
  return { ...base, campaign, membershipId, request, snapshot }
}

async function assign(base: Awaited<ReturnType<typeof setup>>) {
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: base.campaign.id,
      userId: base.owner.userId,
      characterId: base.character.id,
      assignedAt: base.campaign.createdAt
    })
    const overlay = { adjustments: [], conditions: [] }
    await ctx.db.insert('campaignCharacterStates', {
      campaignId: base.campaign.id,
      characterId: base.character.id,
      documentJson: JSON.stringify(overlay),
      checksum: checksumRuleDocument(overlay)
    })
  })
}

async function shareBackground(base: Awaited<ReturnType<typeof setup>>, author: string) {
  await base.t.run(async (ctx) => {
    await makePublishedRootOwned(ctx, acolyte.id, author)
    await ctx.db.insert('campaignContentShares', {
      campaignId: base.campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id,
      sharedBy: author,
      createdAt: base.campaign.createdAt,
      updatedAt: base.campaign.updatedAt
    })
  })
}

describe('native Campaign membership departure', () => {
  it.each(['leave', 'removal', 'archive'] as const)(
    'acknowledges only exact saved unshare retries after %s',
    async (transition) => {
      const base = await setup()
      await shareBackground(base, base.owner.userId)
      const unshareRequest = {
        campaignId: base.campaign.id,
        subjectKind: 'BACKGROUND' as const,
        subjectId: acolyte.id,
        sharedBy: base.owner.userId,
        expectedCampaignVersion: base.campaign.version,
        commandId: crypto.randomUUID()
      }
      const receipt = await base.owner.caller.mutation(
        api.campaigns.contentShares.unshare,
        unshareRequest
      )
      const departure = { ...base.request, expectedCampaignVersion: receipt.campaignVersion }
      if (transition === 'leave') await base.owner.caller.mutation(leave, departure)
      else if (transition === 'removal')
        await base.other.caller.mutation(removeMember, {
          ...departure,
          userId: base.owner.userId
        })
      else
        await base.t.run(async (ctx) => {
          const campaign = await ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
            .unique()
          if (!campaign) throw new Error('Missing Campaign.')
          await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
        })
      const after = await base.snapshot()
      await expect(
        base.owner.caller.mutation(api.campaigns.contentShares.unshare, unshareRequest)
      ).resolves.toEqual(receipt)
      await expect(
        base.owner.caller.mutation(api.campaigns.contentShares.unshare, {
          ...unshareRequest,
          commandId: crypto.randomUUID()
        })
      ).rejects.toThrow(transition === 'archive' ? 'Archived Campaigns' : 'Campaign not found')
      await expect(
        base.other.caller.mutation(api.campaigns.contentShares.unshare, unshareRequest)
      ).rejects.toThrow('different input')
      expect(await base.snapshot()).toEqual(after)
    }
  )

  it('retains private conversation history, revokes access, and acknowledges exact replay without new writes', async () => {
    const base = await setup()
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'DepartingPlayer',
      bio: null
    })
    await base.owner.caller.mutation(api.campaigns.chat.send, {
      campaignId: base.campaign.id,
      room: 'PARTY',
      mode: 'OOC',
      body: 'Retained private history',
      clientNonce: crypto.randomUUID()
    })
    const before = await base.snapshot()
    expect(await base.owner.caller.mutation(leave, base.request)).toEqual({ ok: true })
    const after = await base.snapshot()
    const firstEvictions = await base.t.run((ctx) =>
      ctx.db.system
        .query('_scheduled_functions')
        .collect()
        .then((jobs) => jobs.filter((job) => job.name === 'liveSessions/control:evictUser'))
    )
    expect(firstEvictions.map((job) => job.args)).toEqual([
      [
        {
          campaignId: base.campaign.id,
          userId: base.owner.userId,
          membershipEpoch: base.campaign.createdAt
        }
      ]
    ])
    expect(after.memberships.find((member) => member.userId === base.owner.userId)).toMatchObject({
      status: 'LEFT',
      accessStartedAt: base.campaign.createdAt,
      leftAt: expect.any(String)
    })
    expect(after.campaigns[0]?.version).toBe(base.campaign.version + 1)
    expect(after.conversations).toEqual(before.conversations)
    expect(after.conversationMembers).toEqual(before.conversationMembers)
    expect(after.entries).toEqual(before.entries)
    expect(after.events).toHaveLength(before.events.length + 1)
    expect(after.events.find((event) => event.commandId === base.request.commandId)).toMatchObject({
      visibility: 'OWNER',
      type: 'CAMPAIGN_CONTENT_SHARES_REMOVED',
      actorUserId: base.owner.userId
    })
    expect(
      JSON.parse(
        after.events.find((event) => event.commandId === base.request.commandId)!.payloadJson
      )
    ).toMatchObject({
      departingMembership: { userId: base.owner.userId, accessStartedAt: base.campaign.createdAt }
    })
    await expect(
      base.owner.caller.query(api.campaigns.chat.list, {
        campaignId: base.campaign.id,
        room: 'PARTY'
      })
    ).rejects.toThrow('Campaign not found')
    await expect(
      base.owner.caller.query(api.campaigns.queries.get, { id: base.campaign.id })
    ).rejects.toThrow('Campaign not found')
    expect(
      await base.owner.caller.mutation(leave, {
        ...base.request,
        campaignId: base.request.campaignId.toUpperCase(),
        commandId: base.request.commandId.toUpperCase()
      })
    ).toEqual({ ok: true })
    const replayEvictions = await base.t.run((ctx) =>
      ctx.db.system
        .query('_scheduled_functions')
        .collect()
        .then((jobs) => jobs.filter((job) => job.name === 'liveSessions/control:evictUser'))
    )
    expect(replayEvictions.map((job) => job.args)).toEqual([
      firstEvictions[0]!.args,
      firstEvictions[0]!.args
    ])
    expect(await base.snapshot()).toEqual(after)
    await expect(base.other.caller.mutation(leave, base.request)).rejects.toThrow('different input')
    await expect(
      base.owner.caller.mutation(leave, {
        ...base.request,
        expectedCampaignVersion: base.request.expectedCampaignVersion + 1
      })
    ).rejects.toThrow('different input')
    expect(await base.snapshot()).toEqual(after)
  })

  it('does not apply an old replay or membership epoch to a rejoined player', async () => {
    const base = await setup()
    const request = { ...base.request, userId: base.owner.userId }
    await base.other.caller.mutation(removeMember, request)
    const later = new Date(Date.parse(base.campaign.createdAt) + 1000).toISOString()
    await base.t.run((ctx) =>
      ctx.db.patch(base.membershipId, { status: 'ACTIVE', accessStartedAt: later, leftAt: null })
    )
    const rejoined = await base.snapshot()
    expect(await base.other.caller.mutation(removeMember, request)).toEqual({ ok: true })
    await expect(
      base.other.caller.mutation(removeMember, {
        ...request,
        commandId: crypto.randomUUID(),
        expectedCampaignVersion: base.campaign.version + 1
      })
    ).rejects.toThrow('membership changed')
    expect(await base.snapshot()).toEqual(rejoined)
  })

  it('rejects owner departure, player removal, stale versions and archived Campaign writes atomically', async () => {
    const base = await setup()
    const before = await base.snapshot()
    await expect(base.other.caller.mutation(leave, base.request)).rejects.toThrow(
      'owner cannot leave'
    )
    await expect(
      base.owner.caller.mutation(removeMember, { ...base.request, userId: base.other.userId })
    ).rejects.toThrow('Only the Campaign owner')
    await expect(
      base.owner.caller.mutation(leave, {
        ...base.request,
        expectedCampaignVersion: base.campaign.version + 1
      })
    ).rejects.toThrow('Campaign changed')
    await expect(base.t.mutation(leave, base.request)).rejects.toThrow()
    expect(await base.snapshot()).toEqual(before)
    await base.t.run((ctx) => ctx.db.patch(before.campaigns[0]!._id, { status: 'ARCHIVED' }))
    const archived = await base.snapshot()
    await expect(base.owner.caller.mutation(leave, base.request)).rejects.toThrow(
      'Archived Campaigns'
    )
    expect(await base.snapshot()).toEqual(archived)
  })

  it('removes the assignment and overlay, repairing access loss while preserving the saved draft and Sheet state', async () => {
    const base = await setup()
    await assign(base)
    await shareBackground(base, base.other.userId)
    const system = await base.other.caller.mutation(saveCurrency, {
      campaignId: base.campaign.id,
      label: 'Departure tokens',
      isReference: true,
      denominations: [{ label: 'Token', abbreviation: 'tk', scaleInReference: 1 }]
    })
    const denominationId = system.denominations[0]!.id
    await base.t.run(async (ctx) => {
      await editCharacterRecord(ctx, base.character.id, (character) => ({
        ...character,
        state: {
          ...character.state,
          currency: [
            ...character.state.currency,
            {
              id: crypto.randomUUID(),
              currencies: [
                {
                  currencyId: denominationId,
                  kind: 'CAMPAIGN',
                  campaignCurrencySystemId: system.id,
                  amount: 5
                }
              ]
            }
          ]
        }
      }))
    })
    const opened = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const before = await base.snapshot()
    await base.other.caller.mutation(removeMember, { ...base.request, userId: base.owner.userId })
    const after = await base.snapshot()
    expect(after.assignments).toEqual([])
    expect(after.overlays).toEqual([])
    expect(after.shares).toEqual(before.shares)
    expect(after.characters[0]).toMatchObject({
      status: 'DRAFT',
      play: { streamVersion: before.characters[0]!.play.streamVersion + 1 }
    })
    expect(after.characters[0]?.sheetState).toEqual(before.characters[0]?.sheetState)
    expect(readCharacterRecord(after.characters[0]!).intent.background.backgroundId).toBe('')
    expect(after.drafts[0]?.id).toBe(opened.id)
    const active = after.characters[0]
    const savedDraft = after.drafts.find((candidate) => candidate.id === opened.id)
    if (!active || !savedDraft) throw new Error('Missing repaired Character draft.')
    const repairedPayload = await base.t.run(
      async (ctx) => (await readCharacterDraft(ctx, savedDraft, active)).payload
    )
    const repairedDraft = characterAuthoredDtoSchema.parse(repairedPayload.character)
    expect(after.balances).toMatchObject([
      { denominationId, campaignCurrencySystemId: system.id, amount: 5, containerId: null }
    ])
    expect(
      readCharacterRecord(after.characters[0]!)
        .state.currency.flatMap((group) => group.currencies)
        .some((currency) => currency.currencyId === denominationId)
    ).toBe(false)
    expect(
      repairedDraft.state.currency
        .flatMap((group) => group.currencies)
        .some((currency) => currency.currencyId === denominationId)
    ).toBe(false)
    expect(after.memberships.find((member) => member.userId === base.owner.userId)?.status).toBe(
      'LEFT'
    )
  })

  it('removes the departing author’s shares without pruning that author’s personal content', async () => {
    const base = await setup()
    await assign(base)
    await shareBackground(base, base.owner.userId)
    await base.owner.caller.mutation(leave, base.request)
    const after = await base.snapshot()
    expect(after.shares).toEqual([])
    expect(after.characters[0]?.status).toBe('ACTIVE')
    expect(readCharacterRecord(after.characters[0]!).intent.background.backgroundId).toBe(
      acolyte.id
    )
    const event = after.events.find((candidate) => candidate.commandId === base.request.commandId)
    expect(JSON.parse(event!.payloadJson!)).toMatchObject({
      reason: 'MEMBER_LEFT',
      receipt: { removedShares: [{ subjectKind: 'BACKGROUND', subjectId: acolyte.id }] }
    })
  })

  it('rolls back assignment and Character cleanup if the later share-removal step fails', async () => {
    const base = await setup()
    await assign(base)
    await shareBackground(base, base.other.userId)
    const before = await base.snapshot()
    const original = removal.removeCampaignSharesAndReconcile
    const fault = vi
      .spyOn(removal, 'removeCampaignSharesAndReconcile')
      .mockImplementationOnce(async (input) => {
        await original(input)
        throw new Error('Injected after removal finalization')
      })
    try {
      await expect(base.owner.caller.mutation(leave, base.request)).rejects.toThrow(
        'Injected after removal'
      )
    } finally {
      fault.mockRestore()
    }
    expect(await base.snapshot()).toEqual(before)
  })
})
