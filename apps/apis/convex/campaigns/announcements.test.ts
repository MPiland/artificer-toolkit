import { createHash } from 'node:crypto'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignAnnouncementDto,
  CreateCampaignAnnouncementInput,
  CampaignAnnouncementListInput,
  CampaignAnnouncementListPage
} from '@artificer-toolkit/schema/api/campaignAnnouncements'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { api, internal } from '../_generated/api'
import type { CampaignConversationDto } from '@artificer-toolkit/schema/api/campaignCommunication'

const openParty = makeFunctionReference<
  'mutation',
  { campaignId: string; kind: 'PARTY' },
  CampaignConversationDto
>('campaigns/conversations:open')

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const create = makeFunctionReference<
  'mutation',
  CreateCampaignAnnouncementInput,
  CampaignAnnouncementDto
>('campaigns/announcements:create')
const list = makeFunctionReference<
  'query',
  CampaignAnnouncementListInput,
  CampaignAnnouncementListPage
>('campaigns/announcements:list')
const get = makeFunctionReference<
  'query',
  { campaignId: string; announcementPublicId: string },
  CampaignAnnouncementDto
>('campaigns/announcements:get')

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Announcement test',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const membershipId = await base.t.run(async (ctx) => {
    const now = new Date().toISOString()
    const id = await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: now,
      joinedAt: now,
      leftAt: null
    })
    return id
  })
  const { id: partyId } = await base.other.caller.mutation(openParty, {
    campaignId: campaign.id,
    kind: 'PARTY'
  })
  return { ...base, campaign, partyId, membershipId }
}

function input(campaignId: string): CreateCampaignAnnouncementInput {
  return {
    campaignId,
    commandId: crypto.randomUUID(),
    scope: 'TABLE',
    title: 'fuck',
    body: 'shitstorm'
  }
}

describe('native Campaign announcements', () => {
  it('derives the PARTY target when compatibility callers omit or null the private id', async () => {
    const { owner, campaign, partyId } = await setup()
    const command = {
      ...input(campaign.id),
      scope: 'PARTY'
    } as const
    const omitted = await owner.caller.mutation(create, command)
    expect(omitted).toMatchObject({ partyId })
    expect(await owner.caller.mutation(create, command)).toEqual(omitted)
    expect(
      await owner.caller.mutation(create, {
        ...input(campaign.id),
        scope: 'PARTY',
        partyId: null
      })
    ).toMatchObject({ partyId })
  }, 15_000)

  it('canonicalizes UUID storage and lookup without changing original command fingerprint bytes', async () => {
    const { t, owner, other, campaign, partyId } = await setup()
    const command: CreateCampaignAnnouncementInput = {
      ...input(campaign.id.toUpperCase()),
      commandId: crypto.randomUUID().toUpperCase(),
      scope: 'PARTY',
      partyId: partyId.toUpperCase()
    }
    const announcement = await owner.caller.mutation(create, command)
    expect(announcement).toMatchObject({ campaignId: campaign.id, partyId })
    expect(await owner.caller.mutation(create, command)).toEqual(announcement)
    // SQL UUID equality finds the same command, but its differently cased input is still a conflict.
    await expect(
      owner.caller.mutation(create, { ...command, commandId: command.commandId.toLowerCase() })
    ).rejects.toThrow('different input')
    expect(
      await other.caller.query(get, {
        campaignId: campaign.id.toUpperCase(),
        announcementPublicId: announcement.announcementPublicId.toUpperCase()
      })
    ).toMatchObject({ announcementPublicId: announcement.announcementPublicId })
    const rows = await t.run((ctx) => ctx.db.query('campaignAnnouncements').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.commandId).toBe(command.commandId.toLowerCase())
    const sorted = Object.fromEntries(
      Object.entries(command).sort(([a], [b]) => a.localeCompare(b))
    )
    expect(rows[0]?.inputFingerprint).toBe(
      createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
    )
  })
  it('publishes once with the legacy fingerprint and fixed-summary notification in the same transaction', async () => {
    const { t, owner, other, campaign } = await setup()
    const command = input(campaign.id)
    const announcement = await owner.caller.mutation(create, command)
    expect(await owner.caller.mutation(create, command)).toEqual(announcement)
    await expect(owner.caller.mutation(create, { ...command, body: 'Changed' })).rejects.toThrow(
      'different input'
    )
    const state = await t.run(async (ctx) => ({
      announcements: await ctx.db.query('campaignAnnouncements').collect(),
      notifications: await ctx.db.query('notificationDeliveryIntents').collect()
    }))
    expect(state.announcements).toHaveLength(1)
    const normalized = { ...command, partyId: null }
    const sorted = Object.fromEntries(
      Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))
    )
    expect(state.announcements[0]?.inputFingerprint).toBe(
      createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
    )
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0]).toMatchObject({
      recipientUserId: other.userId,
      sourcePublicId: announcement.announcementPublicId,
      data: {
        campaignPublicId: campaign.publicId,
        summary: 'A new Campaign announcement is available.',
        scope: 'TABLE'
      }
    })
    expect(JSON.stringify(state.notifications)).not.toMatch(/fuck|shitstorm/)
    expect(announcement.title).toBe('fuck')
    expect(
      await other.caller.query(get, {
        campaignId: campaign.id,
        announcementPublicId: announcement.announcementPublicId
      })
    ).toBeDefined()
  })

  it('hides PARTY rows and page metadata from the owner and closes deep links when a player leaves', async () => {
    const { t, owner, other, campaign, partyId, membershipId } = await setup()
    await other.caller.mutation(api.notifications.updatePreferences, {
      category: 'CAMPAIGN',
      inApp: true,
      email: false
    })
    const privateAnnouncement = await owner.caller.mutation(create, {
      ...input(campaign.id),
      scope: 'PARTY',
      partyId
    })
    const lookup = {
      campaignId: campaign.id,
      announcementPublicId: privateAnnouncement.announcementPublicId
    }
    const pageInput = { campaignId: campaign.id, paginationOpts: { cursor: null, numItems: 1 } }
    expect(await owner.caller.query(list, pageInput)).toMatchObject({ page: [], isDone: true })
    await expect(owner.caller.query(get, lookup)).rejects.toThrow('Announcement not found')
    const playerView = await other.caller.query(get, lookup)
    expect(playerView.title).not.toBe('fuck')
    expect(playerView.body).not.toBe('shitstorm')
    expect((await other.caller.query(list, pageInput)).page).toEqual([playerView])
    expect(await t.mutation(internal.notifications.delivery.dispatch, {})).toBe(1)
    expect(await t.mutation(internal.notifications.delivery.dispatch, {})).toBe(0)
    const feed = await other.caller.query(api.notifications.feed, {})
    expect(feed).toMatchObject({
      unseenCount: 1,
      items: [
        {
          sourcePublicId: privateAnnouncement.announcementPublicId,
          data: {
            kind: 'CAMPAIGN_ANNOUNCEMENT',
            scope: 'PARTY',
            summary: 'A new Campaign announcement is available.'
          }
        }
      ]
    })
    expect(await owner.caller.query(api.notifications.feed, {})).toEqual({
      items: [],
      unseenCount: 0
    })
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(other.caller.query(get, lookup)).rejects.toThrow('Campaign not found')
    await expect(other.caller.query(list, pageInput)).rejects.toThrow('Campaign not found')
    expect(await other.caller.query(api.notifications.feed, {})).toEqual(feed)
    expect(
      await t.run((ctx) => ctx.db.query('notificationDeliveryIntents').collect())
    ).toHaveLength(1)
  })

  it('checks write authority, target and invariants atomically and keeps archived reads', async () => {
    const { t, owner, other, campaign, partyId, membershipId } = await setup()
    const command = input(campaign.id)
    await expect(t.mutation(create, command)).rejects.toThrow('Unauthenticated')
    await expect(other.caller.mutation(create, command)).rejects.toThrow('Campaign not found')
    await expect(
      owner.caller.mutation(create, { ...command, scope: 'PARTY', partyId: crypto.randomUUID() })
    ).rejects.toThrow('Campaign not found')
    await expect(
      owner.caller.mutation(create, { ...command, scope: 'TABLE', partyId })
    ).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(membershipId, { role: 'OWNER' }))
    await expect(owner.caller.mutation(create, command)).rejects.toThrow(
      'membership authority mismatch'
    )
    expect(await t.run((ctx) => ctx.db.query('campaignAnnouncements').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('notificationDeliveryIntents').collect())).toEqual([])
    await t.run((ctx) => ctx.db.patch(membershipId, { role: 'PLAYER' }))
    const announcement = await owner.caller.mutation(create, command)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      await ctx.db.patch(row!._id, { status: 'ARCHIVED' })
    })
    await expect(owner.caller.mutation(create, command)).rejects.toThrow('read-only')
    expect(
      await owner.caller.query(get, {
        campaignId: campaign.id,
        announcementPublicId: announcement.announcementPublicId
      })
    ).toEqual(announcement)
  })

  it('paginates the full visible history and excludes active players without a PARTY membership from delivery', async () => {
    const { t, owner, other, campaign, partyId } = await setup()
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignConversationMembers')
        .withIndex('by_conversationId_userId', (q) =>
          q.eq('conversationId', partyId).eq('userId', other.userId)
        )
        .unique()
      await ctx.db.delete(row!._id)
    })
    await owner.caller.mutation(create, { ...input(campaign.id), scope: 'PARTY', partyId })
    expect(await t.run((ctx) => ctx.db.query('notificationDeliveryIntents').collect())).toEqual([])
    const published = await Promise.all(
      [1, 2, 3].map(async (n) =>
        owner.caller.mutation(create, { ...input(campaign.id), title: `Message ${n}` })
      )
    )
    const ids: string[] = []
    let cursor: string | null = null
    for (let i = 0; i < 4; i++) {
      const result: CampaignAnnouncementListPage = await other.caller.query(list, {
        campaignId: campaign.id,
        paginationOpts: { cursor, numItems: 1 }
      })
      ids.push(...result.page.map((row) => row.announcementPublicId))
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(ids.sort()).toEqual(published.map((row) => row.announcementPublicId).sort())
  })
})
