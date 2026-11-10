import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  acceptCampaignOwnershipTransferInputSchema,
  campaignDetailDtoSchema,
  campaignOwnershipTransferRequestResultSchema,
  CreateCampaignInput,
  requestCampaignOwnershipTransferInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { api } from '../_generated/api'

const requestTransfer = makeFunctionReference<
  'mutation',
  z.input<typeof requestCampaignOwnershipTransferInputSchema>,
  z.output<typeof campaignOwnershipTransferRequestResultSchema>
>('campaigns/ownership:request')
const acceptTransfer = makeFunctionReference<
  'mutation',
  z.input<typeof acceptCampaignOwnershipTransferInputSchema>,
  z.output<typeof campaignDetailDtoSchema>
>('campaigns/ownership:accept')

const campaignInput: CreateCampaignInput = {
  name: 'Ownership transfer',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, campaignInput)
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  return { ...base, campaign }
}

async function transfer(base: Awaited<ReturnType<typeof setup>>) {
  await base.owner.caller.mutation(requestTransfer, {
    campaignId: base.campaign.id,
    recipientUserId: base.other.userId
  })
}

async function state(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    campaigns: await ctx.db.query('campaigns').collect(),
    memberships: await ctx.db.query('campaignMemberships').collect(),
    transfers: await ctx.db.query('campaignOwnershipTransfers').collect(),
    assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
    overlays: await ctx.db.query('campaignCharacterStates').collect(),
    authoredRoots: await ctx.db.query('authoredRoots').collect()
  }))
}

describe('native Campaign ownership transfer', () => {
  it('upserts a seven-day transfer without changing Campaign ownership or version', async () => {
    const base = await setup()
    const before = await state(base)
    const firstRequestedAt = Date.now()
    await expect(
      base.owner.caller.mutation(requestTransfer, {
        campaignId: base.campaign.id,
        recipientUserId: base.other.userId
      })
    ).resolves.toEqual({ ok: true })
    const firstCompletedAt = Date.now()
    const first = await base.t.run((ctx) =>
      ctx.db
        .query('campaignOwnershipTransfers')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
    )
    if (!first) throw new Error('Missing ownership transfer.')
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    expect(Date.parse(first.expiresAt)).toBeGreaterThanOrEqual(firstRequestedAt + sevenDays)
    expect(Date.parse(first.expiresAt)).toBeLessThanOrEqual(firstCompletedAt + sevenDays)
    await base.t.run((ctx) =>
      ctx.db.patch(first._id, { expiresAt: new Date(Date.now() - 1000).toISOString() })
    )
    const renewalRequestedAt = Date.now()
    await base.owner.caller.mutation(requestTransfer, {
      campaignId: base.campaign.id,
      recipientUserId: base.other.userId
    })
    const renewalCompletedAt = Date.now()
    const after = await state(base)
    const renewed = after.transfers[0]
    expect(renewed?._id).toBe(first._id)
    expect(Date.parse(renewed!.expiresAt)).toBeGreaterThan(Date.now())
    expect(Date.parse(renewed!.expiresAt)).toBeGreaterThanOrEqual(renewalRequestedAt + sevenDays)
    expect(Date.parse(renewed!.expiresAt)).toBeLessThanOrEqual(renewalCompletedAt + sevenDays)
    expect(after.campaigns).toEqual(before.campaigns)
    expect(after.memberships).toEqual(before.memberships)
    expect(after.assignments).toEqual(before.assignments)
    expect(after.overlays).toEqual(before.overlays)
    expect(after.authoredRoots).toEqual(before.authoredRoots)
  })

  it('rejects non-owner requests, owner recipients, and archived Campaign requests atomically', async () => {
    const base = await setup()
    await expect(
      base.other.caller.mutation(requestTransfer, {
        campaignId: base.campaign.id,
        recipientUserId: base.owner.userId
      })
    ).rejects.toThrow('Only the Campaign owner')
    await expect(
      base.owner.caller.mutation(requestTransfer, {
        campaignId: base.campaign.id,
        recipientUserId: base.owner.userId
      })
    ).rejects.toThrow('active player recipient')
    await base.owner.caller.mutation(api.campaigns.archive.archive, {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version
    })
    const before = await state(base)
    await expect(
      base.owner.caller.mutation(requestTransfer, {
        campaignId: base.campaign.id,
        recipientUserId: base.other.userId
      })
    ).rejects.toThrow('Archived Campaigns')
    expect(await state(base)).toEqual(before)
  })

  it('accepts the exact recipient, advances one epoch, changes roles, and consumes the offer', async () => {
    const base = await setup()
    expect(
      (await base.owner.caller.query(api.accountEntitlements.get, {})).usage.activeHostedCampaigns
    ).toBe(1)
    expect(
      (await base.other.caller.query(api.accountEntitlements.get, {})).usage.activeHostedCampaigns
    ).toBe(0)
    await transfer(base)
    const before = await state(base)
    const priorOwner = before.memberships.find((member) => member.userId === base.owner.userId)
    const priorPlayer = before.memberships.find((member) => member.userId === base.other.userId)
    if (!priorOwner || !priorPlayer) throw new Error('Missing ownership transfer members.')
    await expect(
      base.owner.caller.mutation(acceptTransfer, { campaignId: base.campaign.id })
    ).rejects.toThrow('invalid or expired')
    expect(await state(base)).toEqual(before)
    const detail = await base.other.caller.mutation(acceptTransfer, {
      campaignId: base.campaign.id
    })
    expect(
      (await base.owner.caller.query(api.accountEntitlements.get, {})).usage.activeHostedCampaigns
    ).toBe(0)
    expect(
      (await base.other.caller.query(api.accountEntitlements.get, {})).usage.activeHostedCampaigns
    ).toBe(1)
    expect(detail).toMatchObject({
      id: base.campaign.id,
      role: 'OWNER',
      version: base.campaign.version + 1
    })
    expect(detail.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: base.owner.userId, role: 'PLAYER' }),
        expect.objectContaining({ userId: base.other.userId, role: 'OWNER' })
      ])
    )
    const after = await state(base)
    const evictions = await base.t.run((ctx) =>
      ctx.db.system
        .query('_scheduled_functions')
        .collect()
        .then((jobs) => jobs.filter((job) => job.name === 'liveSessions/control:evictUser'))
    )
    expect(evictions.map((job) => job.args)).toEqual([
      [
        {
          campaignId: base.campaign.id,
          userId: priorOwner.userId,
          membershipEpoch: priorOwner.accessStartedAt ?? priorOwner.joinedAt
        }
      ],
      [
        {
          campaignId: base.campaign.id,
          userId: priorPlayer.userId,
          membershipEpoch: priorPlayer.accessStartedAt ?? priorPlayer.joinedAt
        }
      ]
    ])
    expect(after.transfers).toEqual([])
    expect(after.campaigns[0]).toMatchObject({
      ownerUserId: base.other.userId,
      version: base.campaign.version + 1
    })
    expect(after.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: base.owner.userId,
          role: 'PLAYER',
          accessStartedAt: expect.any(String)
        }),
        expect.objectContaining({
          userId: base.other.userId,
          role: 'OWNER',
          accessStartedAt: expect.any(String)
        })
      ])
    )
    const nextOwner = after.memberships.find((member) => member.userId === base.other.userId)
    const formerOwner = after.memberships.find((member) => member.userId === base.owner.userId)
    expect(Date.parse(nextOwner!.accessStartedAt)).toBeGreaterThan(
      Math.max(Date.parse(priorOwner.accessStartedAt), Date.parse(priorPlayer.accessStartedAt))
    )
    expect(formerOwner!.accessStartedAt).toBe(nextOwner!.accessStartedAt)
    expect(after.assignments).toEqual(before.assignments)
    expect(after.overlays).toEqual(before.overlays)
    await expect(
      base.other.caller.mutation(acceptTransfer, { campaignId: base.campaign.id })
    ).rejects.toThrow('invalid or expired')
    expect(await state(base)).toEqual(after)
  })

  it('moves the Campaign scope revision on accept, which is what makes a live room reload its roles', async () => {
    const base = await setup()
    const campaignRevision = () =>
      base.t.run(
        async (ctx) =>
          (
            await ctx.db
              .query('sceneVisionRevisions')
              .withIndex('by_scope_id', (q) =>
                q.eq('scope', 'CAMPAIGN').eq('id', base.campaign.id)
              )
              .unique()
          )?.revision
      )
    const created = await campaignRevision()
    await transfer(base)
    expect(await campaignRevision()).toBe(created)
    await base.other.caller.mutation(acceptTransfer, { campaignId: base.campaign.id })
    const accepted = await campaignRevision()
    expect(accepted).toEqual(expect.any(String))
    expect(accepted).not.toBe(created)
  })

  it('rejects an expired offer at the exact boundary and preserves all state', async () => {
    const base = await setup()
    await transfer(base)
    await base.t.run(async (ctx) => {
      const offer = await ctx.db
        .query('campaignOwnershipTransfers')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
      if (!offer) throw new Error('Missing ownership transfer.')
      await ctx.db.patch(offer._id, { expiresAt: new Date(Date.now()).toISOString() })
    })
    const before = await state(base)
    await expect(
      base.other.caller.mutation(acceptTransfer, { campaignId: base.campaign.id })
    ).rejects.toThrow('invalid or expired')
    expect(await state(base)).toEqual(before)
  })

  it('rejects stale from-owner and LEFT recipients without mutating the offer', async () => {
    const stale = await setup()
    await transfer(stale)
    await stale.t.run(async (ctx) => {
      const offer = await ctx.db
        .query('campaignOwnershipTransfers')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', stale.campaign.id))
        .unique()
      if (!offer) throw new Error('Missing ownership transfer.')
      await ctx.db.patch(offer._id, { fromUserId: crypto.randomUUID() })
    })
    const staleBefore = await state(stale)
    await expect(
      stale.other.caller.mutation(acceptTransfer, { campaignId: stale.campaign.id })
    ).rejects.toThrow('invalid or expired')
    expect(await state(stale)).toEqual(staleBefore)

    const left = await setup()
    await transfer(left)
    await left.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', left.campaign.id).eq('userId', left.other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing recipient membership.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    const leftBefore = await state(left)
    await expect(
      left.other.caller.mutation(acceptTransfer, { campaignId: left.campaign.id })
    ).rejects.toThrow('Campaign not found')
    expect(await state(left)).toEqual(leftBefore)
  })

  it('rejects at hosted-campaign capacity atomically, then accepts after the limit is released', async () => {
    const base = await setup()
    await transfer(base)
    const existing = await base.other.caller.mutation(api.campaigns.create.create, {
      ...campaignInput,
      name: 'Existing hosted Campaign'
    })
    const before = await state(base)
    await expect(
      base.other.caller.mutation(acceptTransfer, { campaignId: base.campaign.id })
    ).rejects.toThrow('activeHostedCampaigns limit')
    expect(await state(base)).toEqual(before)
    await base.other.caller.mutation(api.campaigns.archive.archive, {
      campaignId: existing.id,
      expectedVersion: existing.version
    })
    await expect(
      base.other.caller.mutation(acceptTransfer, { campaignId: base.campaign.id })
    ).resolves.toMatchObject({ role: 'OWNER', version: base.campaign.version + 1 })
  })
})
