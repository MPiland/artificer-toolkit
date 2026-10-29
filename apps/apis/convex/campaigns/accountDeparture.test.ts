import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, internal } from '../_generated/api'
import { runAccountDeletionStep } from '../../tests/fixtures/accountDeletion'
import { startAccountDeletion } from '../accountDeletionJobs'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import * as reconciliation from './contentShareRemoval'
import { departAccountCampaignMembership } from './accountDeparture'

afterEach(() => vi.useRealTimers())

type Fixture = Pick<Awaited<ReturnType<typeof setupCharacterRun>>, 't'>

/** Puts the account in a scheduled deletion job, at the CAMPAIGNS step. */
async function startDeletion(base: Fixture, userId: string) {
  // Fake timers keep the scheduler from running the job's steps behind the test.
  vi.useFakeTimers()
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    await startAccountDeletion(ctx, profile?.authUserId ?? crypto.randomUUID(), userId)
  })
}

/** Runs the CAMPAIGNS step until the job moves on, as the scheduler would. */
async function departAccount(base: Fixture, userId: string) {
  for (;;) {
    await runAccountDeletionStep(base.t, userId, internal.campaigns.accountDeparture.step)
    const job = await base.t.run((ctx) =>
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
    )
    if (job?.step !== 'CAMPAIGNS') return null
  }
}

async function setup() {
  const base = await setupCharacterRun()
  const campaign = base.campaign
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
  })
  const draft = await base.player.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'VEHICLE',
    subjectId: cart.id
  })
  if (!draft.updatedAt) throw new Error('Missing Vehicle draft revision.')
  const publication = await base.player.caller.mutation(api.content.publication.publishDraft, {
    subjectKind: 'VEHICLE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  await base.player.caller.mutation(api.campaigns.contentShares.share, {
    campaignId: campaign.id,
    subjectKind: 'VEHICLE',
    subjectId: publication.subjectId
  })
  const vehicle = await base.owner.caller.mutation(api.campaigns.vehicles.create, {
    campaignId: campaign.id,
    vehicleDefinitionId: publication.subjectId
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignPartyInventories', { campaignId: campaign.id, version: 0 })
    await ctx.db.insert('campaignPartyInventories', {
      campaignId: campaign.id,
      vehicleId: vehicle.id,
      version: 0
    })
    await ctx.db.insert('campaignPartyCurrencies', {
      campaignId: campaign.id,
      id: crypto.randomUUID(),
      denominationId: srdSystemRecord.currencies[0]!.id,
      amount: 7,
      containerId: null
    })
    await ctx.db.insert('campaignPartyCurrencies', {
      campaignId: campaign.id,
      vehicleId: vehicle.id,
      id: crypto.randomUUID(),
      denominationId: srdSystemRecord.currencies[0]!.id,
      amount: 5,
      containerId: null
    })
  })
  await base.owner.caller.mutation(api.campaigns.vehicles.lifecycle, {
    input: {
      action: 'MAKE_UNAVAILABLE',
      campaignId: campaign.id,
      vehicleId: vehicle.id,
      expectedVersion: vehicle.version,
      idempotencyKey: crypto.randomUUID()
    }
  })
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      campaigns: await ctx.db.query('campaigns').collect(),
      memberships: await ctx.db.query('campaignMemberships').collect(),
      assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
      overlays: await ctx.db.query('campaignCharacterStates').collect(),
      shares: await ctx.db.query('campaignContentShares').collect(),
      events: await ctx.db.query('campaignEvents').collect(),
      sessions: await ctx.db.query('campaignSessions').collect(),
      attendance: await ctx.db.query('campaignSessionAttendance').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      vehicles: await ctx.db.query('campaignVehicles').collect(),
      inventories: await ctx.db.query('campaignPartyInventories').collect(),
      currencies: await ctx.db.query('campaignPartyCurrencies').collect(),
      characters: await ctx.db.query('characters').collect(),
      plays: await ctx.db.query('characterPlayStates').collect(),
      profiles: await ctx.db.query('userProfiles').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect()
    }))
  await startDeletion(base, base.player.userId)
  const depart = () => departAccount(base, base.player.userId)
  return { ...base, campaign, vehicle, publication, snapshot, depart }
}

describe('native account Campaign departure', () => {
  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'detaches a trusted account from an %s Campaign while retaining Campaign history',
    async (status) => {
      const base = await setup()
      if (status === 'ARCHIVED') {
        const current = await base.t.run((ctx) =>
          ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
            .unique()
        )
        if (!current) throw new Error('Missing Campaign.')
        await base.owner.caller.mutation(api.campaigns.archive.archive, {
          campaignId: base.campaign.id,
          expectedVersion: current.version
        })
      }
      const before = await base.snapshot()

      await expect(base.depart()).resolves.toBeNull()

      const after = await base.snapshot()
      expect(after.memberships.find((row) => row.userId === base.player.userId)).toMatchObject({
        role: 'PLAYER',
        status: 'LEFT',
        accessStartedAt: base.campaign.createdAt,
        leftAt: expect.any(String)
      })
      expect(after.assignments).toHaveLength(0)
      expect(after.overlays).toHaveLength(0)
      expect(after.campaigns.find((row) => row.id === base.campaign.id)?.version).toBeGreaterThan(
        base.campaign.version
      )
      expect(after.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actorUserId: base.player.userId,
            type: 'CAMPAIGN_CONTENT_SHARES_REMOVED'
          })
        ])
      )
      expect(after.actors.some((actor) => actor.id === base.actor.id)).toBe(false)
      expect(after.shares.some((share) => share.sharedBy === base.player.userId)).toBe(false)
      expect(after.vehicles.some((candidate) => candidate.id === base.vehicle.id)).toBe(false)
      expect(after.currencies.some((currency) => currency.vehicleId === base.vehicle.id)).toBe(
        false
      )
      expect(
        after.currencies
          .filter((currency) => currency.vehicleId === undefined)
          .map((currency) => currency.amount)
      ).toContain(12)
      expect(after.sessions).toEqual(before.sessions)
      expect(after.attendance).toEqual(before.attendance)
      expect(after.characters).not.toEqual([])
      expect(after.profiles).toEqual(before.profiles)
      expect(
        after.scheduled
          .filter((job) => job.name === 'liveSessions/control:evictUser')
          .map((job) => job.args)
      ).toEqual([
        [
          {
            campaignId: base.campaign.id,
            userId: base.player.userId,
            membershipEpoch: base.campaign.createdAt
          }
        ]
      ])
    }
  )

  it('leaves a retained LEFT membership untouched when no assignment or direct share remains', async () => {
    const base = await setup()
    await base.depart()

    const before = await base.snapshot()

    await expect(
      base.t.run(async (ctx) => {
        const left = await ctx.db
          .query('campaignMemberships')
          .withIndex('by_userId_status_joinedAt', (q) =>
            q.eq('userId', base.player.userId).eq('status', 'LEFT')
          )
          .unique()
        if (!left) throw new Error('Missing retained LEFT membership.')
        return departAccountCampaignMembership(ctx, base.player.userId, left)
      })
    ).resolves.toBeNull()

    expect(await base.snapshot()).toEqual(before)
  })

  it('refuses owner, missing-profile, foreign Campaign, and invalid assignment state without writes', async () => {
    const owner = await readySheetFixture()
    const ownedCampaign = await owner.owner.caller.mutation(api.campaigns.create.create, {
      name: 'Owned table',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const snapshot = () =>
      owner.t.run(async (ctx) => ({
        campaigns: await ctx.db.query('campaigns').collect(),
        memberships: await ctx.db.query('campaignMemberships').collect(),
        assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
        overlays: await ctx.db.query('campaignCharacterStates').collect(),
        events: await ctx.db.query('campaignEvents').collect(),
        profiles: await ctx.db.query('userProfiles').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const missingProfile = crypto.randomUUID()
    await startDeletion(owner, owner.owner.userId)
    await startDeletion(owner, missingProfile)
    await startDeletion(owner, owner.other.userId)
    const beforeOwner = await snapshot()
    await expect(departAccount(owner, owner.owner.userId)).rejects.toThrow('Campaign ownership')
    expect(await snapshot()).toEqual(beforeOwner)

    await expect(departAccount(owner, missingProfile)).rejects.toThrow('profile is missing')
    expect(await snapshot()).toEqual(beforeOwner)

    await owner.t.run(async (ctx) => {
      await ctx.db.insert('campaignMemberships', {
        campaignId: crypto.randomUUID(),
        userId: owner.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: ownedCampaign.createdAt,
        joinedAt: ownedCampaign.createdAt,
        leftAt: null
      })
    })
    const beforeForeign = await snapshot()
    await expect(departAccount(owner, owner.other.userId)).rejects.toThrow('has no Campaign')
    expect(await snapshot()).toEqual(beforeForeign)

    const scoped = await setup()
    await scoped.t.run(async (ctx) => {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', scoped.campaign.id).eq('userId', scoped.player.userId)
        )
        .unique()
      if (!assignment) throw new Error('Missing assignment.')
      await ctx.db.patch(assignment._id, { characterId: crypto.randomUUID() })
    })
    const beforeScope = await scoped.snapshot()
    await expect(scoped.depart()).rejects.toThrow('assignment mismatch')
    expect(await scoped.snapshot()).toEqual(beforeScope)
  })

  it('rolls back account departure when later Campaign reconciliation fails', async () => {
    const base = await setup()
    const before = await base.snapshot()
    const error = new Error('Injected source reconciliation failure.')
    const remove = vi
      .spyOn(reconciliation, 'removeCampaignSharesAndReconcile')
      .mockRejectedValueOnce(error)

    try {
      await expect(base.depart()).rejects.toThrow(error.message)
      expect(await base.snapshot()).toEqual(before)
    } finally {
      remove.mockRestore()
    }
  })
})
