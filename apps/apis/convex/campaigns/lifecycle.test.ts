import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  archiveCampaignInputSchema,
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignListInput,
  CampaignListPage,
  CampaignLookupInput
} from '@artificer-toolkit/schema/api/campaignList'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, components } from '../_generated/api'
import { fixture as characterFixture } from '../../tests/fixtures/characters'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const archive = makeFunctionReference<
  'mutation',
  z.input<typeof archiveCampaignInputSchema>,
  CampaignDetailDto
>('campaigns/archive:archive')
const get = makeFunctionReference<'query', CampaignLookupInput, CampaignDetailDto>(
  'campaigns/queries:get'
)
const settings = makeFunctionReference<'query', CampaignLookupInput, CampaignDetailDto>(
  'campaigns/queries:settings'
)
const list = makeFunctionReference<'query', CampaignListInput, CampaignListPage>(
  'campaigns/queries:list'
)
const input: CreateCampaignInput = {
  name: 'A Campaign',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}
const pageInput = (cursor: string | null = null, numItems = 48): CampaignListInput => ({
  paginationOpts: { cursor, numItems }
})

async function fixture() {
  const base = await characterFixture()
  await base.owner.caller.mutation(api.account.updateProfile, {
    username: 'CampaignOwner',
    bio: null
  })
  await base.other.caller.mutation(api.account.updateProfile, {
    username: 'CampaignPlayer',
    bio: null
  })
  return base
}

async function stored(t: Awaited<ReturnType<typeof fixture>>['t']) {
  return t.run(async (ctx) => ({
    campaigns: await ctx.db.query('campaigns').collect(),
    memberships: await ctx.db.query('campaignMemberships').collect(),
    settings: await ctx.db.query('campaignPlaySettings').collect(),
    routes: await ctx.db.query('authoredRouteIds').collect(),
    sequence: await ctx.db.query('authoredRouteSequence').collect()
  }))
}

describe('native Campaign creation and member reads', () => {
  it('atomically creates the root, owner membership, default settings and stable route', async () => {
    const { t, owner, other } = await fixture()
    const campaign = await owner.caller.mutation(create, input)
    expect(campaign).toMatchObject({
      name: input.name,
      status: 'ACTIVE',
      role: 'OWNER',
      version: 0,
      gameSystemId: input.gameSystemId,
      primaryRulesCatalogueId: input.primaryRulesCatalogueId,
      memberCount: 1,
      playerCount: 0,
      additionalRulesCatalogueIds: [],
      assignedCharacter: null,
      memberships: [
        { userId: owner.userId, username: 'CampaignOwner', role: 'OWNER', assignedCharacter: null }
      ],
      capabilities: { edit: true, readTableChat: true, readPartyChat: false }
    })
    expect(campaign.id).toMatch(/^[0-9a-f-]{36}$/)
    const state = await stored(t)
    expect(state.campaigns).toHaveLength(1)
    expect(state.memberships).toHaveLength(1)
    expect(state.settings).toHaveLength(1)
    expect(state.settings[0]).toMatchObject({
      campaignId: campaign.id,
      version: 0,
      automationMode: 'ASSISTED',
      initiativePolicyDefinitionId: null,
      initiativeTieDefinitionId: null,
      optionalCombatRuleDefinitionIds: []
    })
    await expect(owner.caller.query(get, { id: campaign.id })).resolves.toEqual(campaign)
    await expect(owner.caller.query(get, { id: campaign.publicId })).resolves.toEqual(campaign)
    expect((await owner.caller.query(list, pageInput())).page).toEqual([
      expect.objectContaining({ id: campaign.id })
    ])
    expect(await stored(t)).toEqual(state)
    expect((await other.caller.query(list, pageInput())).page).toEqual([])
    await expect(other.caller.query(get, { id: campaign.publicId })).rejects.toThrow(
      'Campaign not found.'
    )
    await expect(t.query(get, { id: campaign.id })).rejects.toThrow('Unauthenticated')
    await expect(t.mutation(create, input)).rejects.toThrow('Unauthenticated')
  })

  it('enforces active-host entitlement atomically and does not count archived Campaigns', async () => {
    const { t, owner } = await fixture()
    const results = await Promise.allSettled([
      owner.caller.mutation(create, input),
      owner.caller.mutation(create, input)
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect((await stored(t)).campaigns).toHaveLength(1)
    const created = results.find((result) => result.status === 'fulfilled')
    if (created?.status !== 'fulfilled') throw new Error('Missing Campaign fixture.')
    expect(
      (await owner.caller.query(api.accountEntitlements.get, {})).usage.activeHostedCampaigns
    ).toBe(1)
    await owner.caller.mutation(archive, {
      campaignId: created.value.id,
      expectedVersion: created.value.version
    })
    expect(
      (await owner.caller.query(api.accountEntitlements.get, {})).usage.activeHostedCampaigns
    ).toBe(0)
    await expect(owner.caller.mutation(create, input)).resolves.toMatchObject({ status: 'ACTIVE' })
    expect(
      (await owner.caller.query(api.accountEntitlements.get, {})).usage.activeHostedCampaigns
    ).toBe(1)
    expect((await stored(t)).campaigns).toHaveLength(2)
  })

  it('archives only with current owner authority and version, preserving member reads and stored data', async () => {
    const { t, owner, other } = await fixture()
    const campaign = await owner.caller.mutation(create, input)
    const command = { campaignId: campaign.id, expectedVersion: campaign.version }
    await expect(t.mutation(archive, command)).rejects.toThrow('Unauthenticated')
    await expect(other.caller.mutation(archive, command)).rejects.toThrow('Campaign not found.')
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
    const before = await stored(t)
    await expect(other.caller.mutation(archive, command)).rejects.toThrow('cannot perform')
    await expect(
      owner.caller.mutation(archive, {
        ...command,
        expectedVersion: command.expectedVersion + 1
      })
    ).rejects.toThrow('Campaign changed')
    expect(await stored(t)).toEqual(before)

    const archived = await owner.caller.mutation(archive, command)
    const closures = await t.run((ctx) =>
      ctx.db.system
        .query('_scheduled_functions')
        .collect()
        .then((jobs) => jobs.filter((job) => job.name === 'liveSessions/control:send'))
    )
    expect(closures.map((job) => job.args)).toEqual([
      [{ campaignId: campaign.id, operation: { type: 'CLOSE_ROOM' } }]
    ])
    expect(archived).toMatchObject({
      ...campaign,
      status: 'ARCHIVED',
      version: campaign.version + 1,
      updatedAt: expect.any(String),
      memberCount: 2,
      playerCount: 1,
      memberships: expect.any(Array),
      capabilities: {
        ...campaign.capabilities,
        edit: false,
        archive: false,
        delete: true,
        invite: false,
        manageMembers: false,
        manageCharacters: false,
        manageActiveCampaign: false,
        // CAMPAIGN-7: an active owner assigns and transfers like a player; archiving revokes both.
        assignOwnCharacter: false,
        manageSharedContent: false,
        shareOwnedContent: false,
        managePartyInventory: false,
        transferOwnInventory: false,
        manageNotes: false,
        contributeSessionNotes: false
      }
    })
    const after = await stored(t)
    expect(after).toEqual({
      ...before,
      campaigns: [
        { ...before.campaigns[0], status: 'ARCHIVED', version: 1, updatedAt: archived.updatedAt }
      ]
    })
    await expect(owner.caller.query(get, { id: campaign.publicId })).resolves.toEqual(archived)
    await expect(other.caller.query(get, { id: campaign.id })).resolves.toMatchObject({
      status: 'ARCHIVED',
      role: 'PLAYER',
      capabilities: { readPartyChat: true, assignOwnCharacter: false }
    })
    expect((await other.caller.query(list, pageInput())).page[0]).toMatchObject({
      id: campaign.id,
      status: 'ARCHIVED',
      version: archived.version
    })
    await expect(owner.caller.mutation(archive, command)).rejects.toThrow('read-only')
    await expect(
      owner.caller.mutation(archive, { ...command, expectedVersion: archived.version })
    ).rejects.toThrow('read-only')
    expect(await stored(t)).toEqual(after)
  })

  it('rolls back archival when the final shared detail cannot be projected', async () => {
    const { t, owner } = await fixture()
    const campaign = await owner.caller.mutation(create, input)
    await owner.caller.mutation(api.campaigns.sessions.create, { campaignId: campaign.id })
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!profile) throw new Error('Missing profile fixture.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { displayUsername: 'x'.repeat(31) }
        }
      })
    })
    const before = await stored(t)
    const scheduledBefore = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect()
    )
    await expect(
      owner.caller.mutation(archive, {
        campaignId: campaign.id,
        expectedVersion: campaign.version
      })
    ).rejects.toThrow()
    expect(await stored(t)).toEqual(before)
    expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual(
      scheduledBefore
    )
  })

  it('rejects unavailable or foreign catalogue bindings without issuing a route or partial Campaign', async () => {
    const { t, owner } = await fixture()
    const before = await stored(t)
    await expect(
      owner.caller.mutation(create, { ...input, primaryRulesCatalogueId: crypto.randomUUID() })
    ).rejects.toThrow('primary Rules Catalogue')
    await expect(
      owner.caller.mutation(create, {
        ...input,
        additionalRulesCatalogueIds: [crypto.randomUUID()]
      })
    ).rejects.toThrow('additional Rules Catalogue')
    await expect(
      owner.caller.mutation(create, {
        ...input,
        additionalRulesCatalogueIds: [input.primaryRulesCatalogueId]
      })
    ).rejects.toThrow('implicitly')
    await expect(
      owner.caller.mutation(create, { ...input, gameSystemId: crypto.randomUUID() })
    ).rejects.toThrow('Game System')
    expect(await stored(t)).toEqual(before)
    await t.run(async (ctx) => {
      const catalogue = await ctx.db
        .query('rulesCatalogues')
        .withIndex('by_publicId', (q) => q.eq('id', input.primaryRulesCatalogueId))
        .unique()
      if (!catalogue) throw new Error('Missing catalogue fixture.')
      await ctx.db.patch(catalogue._id, { gameSystemId: crypto.randomUUID() })
    })
    await expect(owner.caller.mutation(create, input)).rejects.toThrow('primary Rules Catalogue')
    expect(await stored(t)).toEqual(before)
  })

  it('rolls back root and route writes when final membership projection fails', async () => {
    const { t, owner } = await fixture()
    const before = await stored(t)
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!profile) throw new Error('Missing profile fixture.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { displayUsername: 'x'.repeat(31) }
        }
      })
    })
    await expect(owner.caller.mutation(create, input)).rejects.toThrow()
    expect(await stored(t)).toEqual(before)
  })

  it('projects current membership and username while keeping the owner settings view private', async () => {
    const { t, owner, other } = await fixture()
    const campaign = await owner.caller.mutation(create, {
      ...input,
      name: 'Fuck the dragons',
      description: '<p>Fuck the dragons</p>'
    })
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
    const memberView = await other.caller.query(get, { id: campaign.id })
    expect(memberView.name).not.toContain('Fuck')
    expect(memberView.description).toContain('<p>')
    expect(memberView).toMatchObject({
      role: 'PLAYER',
      memberCount: 2,
      playerCount: 1,
      capabilities: { edit: false, readPartyChat: true }
    })
    expect(memberView.memberships.map((member) => member.userId)).toEqual([
      owner.userId,
      other.userId
    ])
    await expect(other.caller.query(settings, { id: campaign.id })).rejects.toThrow(
      'Campaign not found.'
    )
    await expect(owner.caller.query(settings, { id: campaign.id })).resolves.toMatchObject({
      name: 'Fuck the dragons',
      description: '<p>Fuck the dragons</p>'
    })
    await owner.caller.mutation(api.account.updateProfile, { username: 'RenamedOwner', bio: null })
    expect((await other.caller.query(get, { id: campaign.id })).memberships[0]!.username).toBe(
      'RenamedOwner'
    )
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing player fixture.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(other.caller.query(get, { id: campaign.id })).rejects.toThrow(
      'Campaign not found.'
    )
    expect((await other.caller.query(list, pageInput())).page).toEqual([])
  })

  it('paginates complete membership history and preserves archived owner delete/read-only permissions', async () => {
    const { t, owner } = await fixture()
    await t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: owner.userId, tier: 'PRO_GM' })
    )
    const created: CampaignDetailDto[] = []
    for (let index = 0; index < 10; index++)
      created.push(await owner.caller.mutation(create, { ...input, name: `Campaign ${index}` }))
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', created[0]!.id))
        .unique()
      if (!row) throw new Error('Missing Campaign fixture.')
      await ctx.db.patch(row._id, { status: 'ARCHIVED' })
    })
    const ids: string[] = []
    let cursor: string | null = null
    for (let pageNumber = 0; pageNumber < 11; pageNumber++) {
      const page: CampaignListPage = await owner.caller.query(list, pageInput(cursor, 2))
      ids.push(...page.page.map((campaign) => campaign.id))
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(ids).toHaveLength(10)
    expect(new Set(ids)).toEqual(new Set(created.map((campaign) => campaign.id)))
    const archived = await owner.caller.query(get, { id: created[0]!.id })
    expect(archived.capabilities).toMatchObject({
      edit: false,
      archive: false,
      delete: true,
      readTableChat: true,
      readPartyChat: false
    })
  })

  it('fails closed on inconsistent owner authority and route identity', async () => {
    const { t, owner, other } = await fixture()
    const campaign = await owner.caller.mutation(create, input)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign fixture.')
      await ctx.db.patch(row._id, { ownerUserId: other.userId })
    })
    await expect(owner.caller.query(get, { id: campaign.id })).rejects.toThrow('authority mismatch')
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign fixture.')
      await ctx.db.patch(row._id, { ownerUserId: owner.userId, publicId: 'corrupted-alias' })
    })
    await expect(owner.caller.query(get, { id: campaign.id })).rejects.toThrow('authority mismatch')
  })
})
