import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CopyCampaignInput,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { fixture as characterFixture } from '../../tests/fixtures/characters'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const copy = makeFunctionReference<'mutation', CopyCampaignInput, CampaignDetailDto>(
  'campaigns/copy:copy'
)

const input: CreateCampaignInput = {
  name: 'Copy source',
  description: '<p>Private source copy.</p>',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  toneDetails: 'Quietly dangerous',
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

async function setup() {
  const base = await characterFixture()
  await base.owner.caller.mutation(api.account.updateProfile, { username: 'CopyOwner', bio: null })
  await base.other.caller.mutation(api.account.updateProfile, { username: 'CopyOther', bio: null })
  await base.t.run((ctx) =>
    ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
  )
  const campaign = await base.owner.caller.mutation(create, input)
  const command = {
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    commandId: crypto.randomUUID()
  }
  const state = () =>
    base.t.run(async (ctx) => ({
      campaigns: await ctx.db.query('campaigns').collect(),
      memberships: await ctx.db.query('campaignMemberships').collect(),
      settings: await ctx.db.query('campaignPlaySettings').collect(),
      notes: await ctx.db.query('campaignNotebookSections').collect(),
      events: await ctx.db.query('campaignEvents').collect(),
      routes: await ctx.db.query('authoredRouteIds').collect(),
      usageEntries: await ctx.db.query('accountUsageEntries').collect(),
      profiles: await ctx.db.query('userProfiles').collect(),
      items: await ctx.db.query('campaignPartyItems').collect(),
      sessions: await ctx.db.query('campaignSessions').collect()
    }))
  return { ...base, campaign, command, state }
}

function fingerprint(input: CopyCampaignInput, userId: string) {
  return checksumCanonicalJson({
    operation: 'CAMPAIGN_COPIED',
    campaignId: input.campaignId.toLowerCase(),
    actorUserId: userId,
    commandId: input.commandId.toLowerCase(),
    expectedVersion: input.expectedVersion
  })
}

describe('native Campaign copy', () => {
  it('copies root metadata without automatically copying contextual notes or play state', async () => {
    const { t, owner, other, campaign, command, state } = await setup()
    await t.run(async (ctx) => {
      await ctx.db.patch(
        (await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
          .unique())!._id,
        { attunementSlotOverride: 3 }
      )
      for (const [visibility, sortOrder] of [
        ['PRIVATE', 4],
        ['SHARED', 9]
      ] as const)
        await ctx.db.insert('campaignNotebookSections', {
          id: crypto.randomUUID(),
          campaignId: campaign.id,
          title: `${visibility} raw`,
          content: `<p>${visibility} raw</p>`,
          visibility,
          category: 'PLACES',
          sortOrder,
          version: 6,
          authorUserId: other.userId,
          updatedBy: other.userId,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z'
        })
      await ctx.db.insert('campaignPartyItems', {
        campaignId: campaign.id,
        id: crypto.randomUUID(),
        equipmentId: crypto.randomUUID(),
        quantity: 1,
        containerId: null
      })
      await ctx.db.insert('campaignSessions', {
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        sessionNumber: 1,
        title: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        timeZone: null,
        status: 'OPEN',
        finishedAt: null,
        version: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    })
    const before = await state()
    const copied = await owner.caller.mutation(copy, command)
    expect(copied).toMatchObject({
      id: expect.not.stringMatching(new RegExp(`^${campaign.id}$`)),
      name: campaign.name,
      status: 'ACTIVE',
      version: 0,
      role: 'OWNER',
      attunementSlotOverride: 3,
      memberships: [{ userId: owner.userId, role: 'OWNER' }]
    })
    const after = await state()
    expect(after.campaigns.find((row) => row.id === campaign.id)).toEqual(
      before.campaigns.find((row) => row.id === campaign.id)
    )
    expect(after.notes.filter((row) => row.campaignId === campaign.id)).toEqual(before.notes)
    expect(after.notes.filter((row) => row.campaignId === copied.id)).toEqual([])
    expect(after.items.filter((row) => row.campaignId === copied.id)).toEqual([])
    expect(after.sessions.filter((row) => row.campaignId === copied.id)).toEqual([])
    expect(after.memberships.filter((row) => row.campaignId === copied.id)).toEqual([
      expect.objectContaining({ userId: owner.userId, role: 'OWNER', status: 'ACTIVE' })
    ])
    expect(after.events).toContainEqual(
      expect.objectContaining({
        campaignId: campaign.id,
        type: 'CAMPAIGN_COPIED',
        visibility: 'OWNER',
        visibleInHistory: false,
        actorUserId: owner.userId,
        payloadJson: JSON.stringify({ copiedCampaignId: copied.id, expectedVersion: 0 })
      })
    )
  })

  it('replays one owner command exactly, rejects collisions, and allows an archived source', async () => {
    const { t, owner, other, campaign, command, state } = await setup()
    const first = await owner.caller.mutation(copy, command)
    await t.run(async (ctx) => {
      const source = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!source) throw new Error('Missing source campaign.')
      await ctx.db.patch(source._id, { status: 'ARCHIVED', version: 7 })
    })
    await expect(owner.caller.mutation(copy, command)).resolves.toEqual(first)
    await expect(owner.caller.mutation(copy, { ...command, expectedVersion: 7 })).rejects.toThrow(
      'different input'
    )
    await expect(other.caller.mutation(copy, command)).rejects.toThrow('different input')
    await expect(
      owner.caller.mutation(copy, {
        ...command,
        expectedVersion: 7,
        commandId: crypto.randomUUID()
      })
    ).resolves.toMatchObject({ status: 'ACTIVE', version: 0 })
    expect((await state()).campaigns.filter((row) => row.id === first.id)).toHaveLength(1)
  })

  it('requires current destination access before returning a prior copy', async () => {
    const { t, owner, command, state } = await setup()
    const copied = await owner.caller.mutation(copy, command)
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', copied.id).eq('userId', owner.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing copied Campaign membership.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    const before = await state()
    await expect(owner.caller.mutation(copy, command)).rejects.toThrow('Campaign not found.')
    expect(await state()).toEqual(before)
  })

  it('denies nonowners, enforces hosted capacity, rejects malformed receipts, and rolls back final receipt failure', async () => {
    const outsider = await setup()
    await outsider.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: outsider.campaign.id,
        userId: outsider.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: outsider.campaign.createdAt,
        joinedAt: outsider.campaign.createdAt,
        leftAt: null
      })
    )
    await expect(outsider.other.caller.mutation(copy, outsider.command)).rejects.toThrow(
      'Only the Campaign owner'
    )

    const capacity = await characterFixture()
    await capacity.owner.caller.mutation(api.account.updateProfile, {
      username: 'Capacity',
      bio: null
    })
    const source = await capacity.owner.caller.mutation(create, input)
    await expect(
      capacity.owner.caller.mutation(copy, {
        campaignId: source.id,
        expectedVersion: source.version,
        commandId: crypto.randomUUID()
      })
    ).rejects.toThrow('activeHostedCampaigns limit')

    const malformed = await setup()
    await malformed.t.run((ctx) =>
      ctx.db.insert(
        'campaignEvents',
        campaignStoredEventSchema.parse({
          id: crypto.randomUUID(),
          campaignId: malformed.campaign.id,
          actorUserId: malformed.owner.userId,
          type: 'CAMPAIGN_COPIED',
          visibility: 'OWNER',
          subjectCharacterId: null,
          payloadJson: '{',
          visibleInHistory: false,
          commandId: malformed.command.commandId,
          inputFingerprint: fingerprint(malformed.command, malformed.owner.userId),
          createdAt: new Date().toISOString()
        })
      )
    )
    await expect(malformed.owner.caller.mutation(copy, malformed.command)).rejects.toThrow(
      'receipt is invalid'
    )

    const rollback = await setup()
    await rollback.t.run((ctx) =>
      ctx.db.insert('campaignNotebookSections', {
        id: crypto.randomUUID(),
        campaignId: rollback.campaign.id,
        title: 'Rollback note',
        content: '<p>Rollback note</p>',
        visibility: 'PRIVATE',
        category: 'PLACES',
        sortOrder: 0,
        version: 0,
        authorUserId: rollback.owner.userId,
        updatedBy: rollback.owner.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    )
    const before = await rollback.state()
    const failure = vi.spyOn(campaignStoredEventSchema, 'parse').mockImplementationOnce(() => {
      throw new Error('receipt failure')
    })
    try {
      await expect(rollback.owner.caller.mutation(copy, rollback.command)).rejects.toThrow(
        'receipt failure'
      )
    } finally {
      failure.mockRestore()
    }
    expect(await rollback.state()).toEqual(before)
  })
})
