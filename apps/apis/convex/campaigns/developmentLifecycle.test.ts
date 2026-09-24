import { makeFunctionReference } from 'convex/server'
import { jsonToConvex } from 'convex/values'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { describe, expect, it } from 'vitest'
import type {
  DevelopmentCampaignFixture,
  DevelopmentCampaignInspection,
  DevelopmentCampaignRemovedInput,
  DevelopmentCampaignRollbackInput
} from '@artificer-toolkit/schema/api/developmentCampaignLifecycle'
import {
  campaignStoredVehicleCleanupSchema,
  campaignStoredVehicleCleanupSegmentSchema,
  campaignStoredVehicleCleanupTotalSchema
} from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { api, components } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { assertAbsent } from './developmentLifecycle'

const inspect = makeFunctionReference<
  'query',
  DevelopmentCampaignFixture,
  DevelopmentCampaignInspection
>('campaigns/developmentLifecycle:inspect')
const assertRemoved = makeFunctionReference<'query', DevelopmentCampaignRemovedInput, null>(
  'campaigns/developmentLifecycle:assertRemoved'
)
const inspectPersonal = makeFunctionReference<'query', DevelopmentCampaignFixture, string>(
  'campaigns/developmentLifecycle:inspectPersonal'
)
const verifyRollback = makeFunctionReference<
  'action',
  DevelopmentCampaignRollbackInput,
  { rolledBack: true }
>('campaigns/developmentLifecycle:verifyDeletionRollback')
const stepCopy = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobs:step'
)
const runCopy = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobs:run'
)
const cleanupCopy = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobCleanup:cleanup'
)
const runDeletion = makeFunctionReference<
  'action',
  { jobId: Id<'campaignDeletionJobs'>; revision: number },
  null
>('campaigns/deletionJobs:run')

async function deletionJob(t: Awaited<ReturnType<typeof fixture>>['t'], campaignId: string) {
  const job = await t.run((ctx) =>
    ctx.db
      .query('campaignDeletionJobs')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
  )
  if (!job) throw new Error('Missing Campaign deletion job.')
  return job
}

async function finishDeletion(t: Awaited<ReturnType<typeof fixture>>['t'], campaignId: string) {
  for (let page = 0; page < 1000; page++) {
    const job = await deletionJob(t, campaignId)
    if (job.status === 'DELETED') return job
    if (job.status === 'FAILED') throw new Error('Campaign deletion failed.')
    await t.action(runDeletion, { jobId: job._id, revision: job.revision })
  }
  throw new Error('Campaign deletion did not converge.')
}

async function setup(withRun = true) {
  const base = await fixture()
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: 'draft_00000000000' + index + '@example.invalid' }
        }
      })
    }
  })
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const session = await base.owner.caller.mutation(api.campaigns.sessions.create, {
    campaignId: campaign.id
  })
  let run: Awaited<
    ReturnType<typeof base.owner.caller.mutation<typeof api.encounters.runs.create>>
  > | null = null
  if (withRun) {
    const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
      gameSystemId: srdSystemRecord.id,
      name: 'Personal protected Blueprint',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Fixture enemy', maxHitPoints: 3 }]
    })
    const {
      version,
      updatedAt: _updatedAt,
      ...settings
    } = await base.owner.caller.query(api.campaigns.playSettings.get, { campaignId: campaign.id })
    await base.owner.caller.mutation(api.campaigns.playSettings.save, {
      ...settings,
      expectedVersion: version,
      automationMode: 'MANUAL',
      manualReminderMode: 'OFF',
      initiativePolicyDefinitionId: null,
      initiativeTieDefinitionId: null
    })
    run = await base.owner.caller.mutation(api.encounters.runs.create, {
      campaignId: campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
  }
  const target: DevelopmentCampaignFixture = {
    ownerUserId: base.owner.userId,
    campaignId: campaign.id,
    gameSystemId: srdSystemRecord.id,
    userIds: [base.owner.userId, base.other.userId]
  }
  const deletion = {
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    confirmation: 'DELETE' as const
  }
  return { ...base, campaign, session, run, target, deletion }
}

describe('reserved native Campaign lifecycle proof', () => {
  it('starts the deletion fixture through public manual initiative commands and retains its active native Run', async () => {
    const base = await setup()
    let run = base.run
    if (!run) throw new Error('Missing public Run fixture.')
    expect(run.automationMode).toBe('MANUAL')
    expect(run.initiativePolicy).toBeNull()
    for (const [index, actor] of run.actors.entries()) {
      const result = await base.owner.caller.mutation(api.encounters.commands.execute, {
        command: {
          type: 'SET_INITIATIVE',
          encounterId: run.id,
          expectedVersion: run.version,
          commandId: crypto.randomUUID(),
          actorId: actor.id,
          initiative: 20 - index,
          manualOrder: index
        }
      })
      run = encounterGmProjectionDtoSchema.parse(result.projection)
    }
    const result = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: run.id,
        expectedVersion: run.version,
        commandId: crypto.randomUUID()
      }
    })
    expect(result.projection.status).toBe('ACTIVE')
    const state = await base.t.query(inspect, base.target)
    const decoded: unknown = jsonToConvex(JSON.parse(state.campaignStateJson))
    expect(decoded).toMatchObject({
      encounterRuns: [expect.objectContaining({ id: run.id, status: 'ACTIVE' })],
      encounterRunActors: run.actors.map((actor) => expect.objectContaining({ id: actor.id }))
    })
  }, 30_000)
  it('retains every native notebook row when valid content exceeds the former 200 KB evidence limit', async () => {
    const base = await setup(false)
    const content = '<p>' + 'x'.repeat(19_000) + '</p>'
    for (let index = 0; index < 12; index++)
      await base.owner.caller.mutation(api.campaigns.notebooks.create, {
        campaignId: base.campaign.id,
        title: 'Complete evidence note ' + index,
        content,
        visibility: index % 2 ? 'SHARED' : 'GM_PRIVATE',
        category: 'GENERAL'
      })
    const page = await base.owner.caller.query(api.campaigns.notebooks.list, {
      campaignId: base.campaign.id,
      paginationOpts: { cursor: null, numItems: 8 }
    })
    expect(page.isDone).toBe(false)
    const noteSectionId = page.page[0]?.id
    if (!noteSectionId) throw new Error('Missing notebook reference fixture.')
    await expect(
      base.owner.caller.mutation(api.campaigns.sessionReferences.create, {
        campaignId: base.campaign.id,
        sessionId: base.session.id,
        target: { kind: 'CAMPAIGN_NOTE', noteSectionId }
      })
    ).resolves.toMatchObject({
      campaignId: base.campaign.id,
      sessionId: base.session.id,
      target: { kind: 'CAMPAIGN_NOTE', noteSectionId }
    })
    const nativeRows = await base.t.run(async (ctx) =>
      (
        await ctx.db
          .query('campaignNotebookSections')
          .withIndex('by_campaignId_sortOrder_id', (q) => q.eq('campaignId', base.campaign.id))
          .collect()
      ).sort((a, b) => a._id.localeCompare(b._id))
    )
    const state = await base.t.query(inspect, base.target)
    expect(new TextEncoder().encode(JSON.stringify(state)).byteLength).toBeGreaterThan(200_000)
    const decoded: unknown = jsonToConvex(JSON.parse(state.campaignStateJson))
    expect(decoded).toBeTypeOf('object')
    expect(nativeRows).toHaveLength(12)
    expect(nativeRows.every((row) => row.content === content)).toBe(true)
    expect((decoded as Record<string, unknown>).campaignNotebookSections).toEqual(nativeRows)
  }, 30_000)
  it('captures the complete indexed catalogue and exact Campaign route', async () => {
    const base = await setup(false)
    const characterId = crypto.randomUUID()
    await base.owner.caller.mutation(api.characters.drafts.create, {
      id: characterId,
      systemId: srdSystemRecord.id
    })
    const orphanChunk = await base.t.run(async (ctx) => {
      const _id = await ctx.db.insert('characterDraftPayloadChunks', {
        characterId,
        payloadId: crypto.randomUUID(),
        chunkIndex: 0,
        bytes: new TextEncoder().encode('{}').buffer
      })
      return ctx.db.get(_id)
    })
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'P09CatalogueOwner',
      bio: null
    })
    await base.other.caller.mutation(api.account.updateProfile, {
      username: 'P09CataloguePlayer',
      bio: null
    })
    await base.owner.caller.mutation(api.social.profiles.initialize, {})
    const otherSocial = await base.other.caller.mutation(api.social.profiles.initialize, {})
    if (!otherSocial.profilePublicId) throw new Error('Missing public fixture Social profile.')
    await base.owner.caller.mutation(api.social.blocks.create, {
      profilePublicId: otherSocial.profilePublicId
    })
    const socialBefore = await base.t.run(async (ctx) => {
      const sort = <T extends { _id: string }>(rows: T[]) =>
        rows.sort((a, b) => a._id.localeCompare(b._id))
      return {
        socialProfiles: sort(await ctx.db.query('socialProfiles').collect()),
        socialActionRateLimits: sort(await ctx.db.query('socialActionRateLimits').collect()),
        socialProfileInvalidations: sort(
          await ctx.db.query('socialProfileInvalidations').collect()
        ),
        socialBlocks: sort(await ctx.db.query('socialBlocks').collect()),
        socialBlockInvalidations: sort(await ctx.db.query('socialBlockInvalidations').collect())
      }
    })
    expect(socialBefore.socialProfiles).toHaveLength(2)
    expect(socialBefore.socialBlocks).toHaveLength(1)
    expect(socialBefore.socialBlockInvalidations).toHaveLength(1)
    expect(socialBefore.socialActionRateLimits).toHaveLength(1)
    const state = await base.t.query(inspect, base.target)
    const decoded: unknown = JSON.parse(state.campaignStateJson)
    expect(decoded).toMatchObject({
      campaigns: [expect.objectContaining({ id: base.campaign.id })],
      authoredRouteIds: [
        expect.objectContaining({ subjectId: base.campaign.id, publicId: base.campaign.publicId })
      ],
      encounterRuns: [],
      encounterRunActors: [],
      campaignPlaySettings: [expect.objectContaining({ campaignId: base.campaign.id })],
      sceneFogChunks: [],
      sceneDefinitionEntities: [],
      campaignConversationEntryPayloads: [],
      campaignCurrencyDenominations: [],
      campaignClockRecoveries: [],
      encounterRuleReceipts: []
    })
    expect(state.descendants.encounterIds).toEqual([])
    const personal: unknown = jsonToConvex(JSON.parse(state.personalStateJson))
    expect(personal).toMatchObject({
      encounterBlueprints: []
    })
    expect(
      (personal as Record<string, Record<string, unknown>[]>).characterDraftPayloadChunks
    ).toContainEqual(orphanChunk)
    expect(personal).toBeTypeOf('object')
    for (const [key, nativeRows] of Object.entries(socialBefore))
      expect((personal as Record<string, unknown>)[key]).toEqual(nativeRows)
    await base.owner.caller.mutation(api.campaigns.deletion.remove, base.deletion)
    expect(await deletionJob(base.t, base.campaign.id)).toMatchObject({ status: 'DELETING' })
    expect(await base.t.query(inspect, base.target)).toEqual(state)
    expect(await finishDeletion(base.t, base.campaign.id)).toMatchObject({ status: 'DELETED' })
    const personalAfter: unknown = jsonToConvex(
      JSON.parse(
        await base.t.query(
          makeFunctionReference<'query', DevelopmentCampaignFixture, string>(
            'campaigns/developmentLifecycle:inspectPersonal'
          ),
          base.target
        )
      )
    )
    for (const [key, nativeRows] of Object.entries(socialBefore))
      expect((personalAfter as Record<string, unknown>)[key]).toEqual(nativeRows)
    expect(
      (personalAfter as Record<string, Record<string, unknown>[]>).characterDraftPayloadChunks
    ).toContainEqual(orphanChunk)
  }, 30_000)
  it('observes real DELETE child/root writes then restores the literal complete scope on rollback', async () => {
    const base = await setup()
    const run = base.run
    if (!run) throw new Error('Missing public Run fixture.')
    await base.t.run(async (ctx) => {
      const grant = {
        campaignId: base.campaign.id,
        campaignVersion: 0,
        vehicleId: crypto.randomUUID(),
        vehicleVersion: 0,
        sourceInventoryVersion: 0,
        actorUserId: base.owner.userId,
        eventId: crypto.randomUUID(),
        commandId: crypto.randomUUID(),
        inputFingerprint: checksumCanonicalJson({ fixture: 'campaign-lifecycle-rollback' }),
        mode: 'DESTROY' as const,
        beforeAvailability: 'UNAVAILABLE' as const,
        label: null,
        vehicleDefinitionId: crypto.randomUUID()
      }
      const job = campaignStoredVehicleCleanupSchema.parse({
        id: crypto.randomUUID(),
        grant,
        grantChecksum: checksumCanonicalJson({ operation: 'VEHICLE_CLEANUP_GRANT', grant }),
        status: 'RUNNING',
        phase: 'VALIDATE_ITEMS',
        cursor: null,
        pageDone: true,
        pending: [],
        validated: { items: 0, topLevelItems: 0, currencyGroups: 0, currencies: 0 },
        applied: { items: 0, topLevelItems: 0, currencyGroups: 0, currencies: 0 },
        sequence: 0,
        applyStarted: false,
        releaseComplete: false,
        purgeTable: 0,
        sourceInventoryVersion: 0,
        destinationInventoryVersion: null,
        failureReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      await ctx.db.insert('campaignVehicleCleanupJobs', job)
      await ctx.db.insert(
        'campaignVehicleCleanupTotals',
        campaignStoredVehicleCleanupTotalSchema.parse({
          jobId: job.id,
          denominationId: crypto.randomUUID(),
          sourceAmount: '0',
          targetId: null,
          targetBeforeAmount: 0,
          placeholder: false,
          locked: false,
          applied: false
        })
      )
      await ctx.db.insert(
        'campaignVehicleCleanupSegments',
        campaignStoredVehicleCleanupSegmentSchema.parse({
          jobId: job.id,
          sequence: 0,
          phase: 'FINALIZE',
          ids: [],
          beforeAmounts: [],
          afterAmounts: [],
          createdAt: new Date().toISOString()
        })
      )
      for (let index = 0; index < 33; index += 1)
        await ctx.db.insert('campaignPartyItems', {
          campaignId: base.campaign.id,
          id: crypto.randomUUID(),
          equipmentId: crypto.randomUUID(),
          quantity: 1,
          containerId: null
        })
    })
    const before = await base.t.query(inspect, base.target)
    const scheduledBefore = await base.t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect()
    )
    await expect(
      base.owner.caller.action(verifyRollback, { fixture: base.target, deletion: base.deletion })
    ).resolves.toEqual({ rolledBack: true })
    expect(await base.t.query(inspect, base.target)).toEqual(before)
    expect(
      await base.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    ).toEqual(scheduledBefore)
  }, 30_000)
  it('allows a completed copy job only inside rollback, then requires scheduled cleanup after DELETE', async () => {
    const base = await setup(false)
    await base.owner.caller.mutation(api.account.updateProfile, {
      username: 'RollbackCopyOwner',
      bio: null
    })
    await base.t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: base.owner.userId, tier: 'PRO_GM' })
    )
    await base.owner.caller.mutation(api.campaigns.notebooks.create, {
      campaignId: base.campaign.id,
      title: 'Rollback copy note',
      content: '<p>copy me</p>',
      visibility: 'SHARED',
      category: 'GENERAL'
    })
    const copy = await base.owner.caller.mutation(api.campaigns.copyJobs.begin, {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version,
      commandId: crypto.randomUUID(),
      notebookCategories: ['GENERAL']
    })
    await base.t.mutation(stepCopy, { copyId: copy.copyId })
    await base.t.mutation(runCopy, { copyId: copy.copyId })
    const completed = await base.owner.caller.query(api.campaigns.copyJobs.progress, {
      copyId: copy.copyId
    })
    if (!completed.destination) throw new Error('Completed copy is missing its destination.')
    expect(completed.status).toBe('COMPLETED')
    const before = await base.t.query(inspect, base.target)
    const scheduledBefore = await base.t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect()
    )

    await expect(
      base.owner.caller.action(verifyRollback, { fixture: base.target, deletion: base.deletion })
    ).resolves.toEqual({ rolledBack: true })
    expect(await base.t.query(inspect, base.target)).toEqual(before)
    expect(
      await base.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    ).toEqual(scheduledBefore)

    await base.owner.caller.mutation(api.campaigns.deletion.remove, base.deletion)
    expect(await deletionJob(base.t, base.campaign.id)).toMatchObject({ status: 'DELETING' })
    await expect(
      base.t.query(assertRemoved, { fixture: base.target, descendants: before.descendants })
    ).rejects.toThrow('campaigns')
    expect(await finishDeletion(base.t, base.campaign.id)).toMatchObject({ status: 'DELETED' })
    await expect(
      base.t.run(async (ctx) => {
        const job = await ctx.db
          .query('campaignCopyJobs')
          .withIndex('by_publicId', (q) => q.eq('id', copy.copyId))
          .unique()
        if (!job) throw new Error('Missing completed copy job.')
        await ctx.db.patch(job._id, { updatedAt: '2000-01-01T00:00:00.000Z' })
        return assertAbsent(ctx, { fixture: base.target, descendants: before.descendants })
      })
    ).rejects.toThrow('campaignCopyJobs')
    await expect(
      base.t.query(assertRemoved, { fixture: base.target, descendants: before.descendants })
    ).rejects.toThrow('campaignCopyJobs')
    expect(
      (await base.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).some(
        (job) => job.name === 'campaigns/copyJobCleanup:cleanup'
      )
    ).toBe(true)
    await base.t.mutation(cleanupCopy, { copyId: copy.copyId })
    await expect(
      base.t.query(assertRemoved, { fixture: base.target, descendants: before.descendants })
    ).resolves.toBeNull()
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', completed.destination!.id))
          .unique()
      )
    ).toBeTruthy()
  }, 30_000)
  it('checks missing-parent descendants and refuses an orphan Actor after public DELETE', async () => {
    const base = await setup()
    const run = base.run
    if (!run) throw new Error('Missing public Run fixture.')
    const before = await base.t.query(inspect, base.target)
    const actor = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
        .first()
    )
    if (!actor) throw new Error('Missing fixture Actor.')
    await base.owner.caller.mutation(api.campaigns.deletion.remove, base.deletion)
    expect(await finishDeletion(base.t, base.campaign.id)).toMatchObject({ status: 'DELETED' })
    await expect(
      base.t.query(assertRemoved, { fixture: base.target, descendants: before.descendants })
    ).resolves.toBeNull()
    const { _id, _creationTime, ...stored } = actor
    await base.t.run((ctx) => ctx.db.insert('encounterRunActors', stored))
    await expect(
      base.t.query(assertRemoved, { fixture: base.target, descendants: before.descendants })
    ).rejects.toThrow('encounterRunActors')
  })
  it('refuses anonymous, foreign caller, nonfixture and nonlocal origin without changing the complete scope', async () => {
    const base = await setup()
    const run = base.run
    if (!run) throw new Error('Missing public Run fixture.')
    const before = await base.t.query(inspect, base.target)
    const operation = { fixture: base.target, deletion: base.deletion }
    await expect(base.t.action(verifyRollback, operation)).rejects.toThrow('Unauthenticated')
    await expect(base.other.caller.action(verifyRollback, operation)).rejects.toThrow(
      'Fixture owner does not match'
    )
    const fixtureProfile = await base.t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    )
    if (!fixtureProfile) throw new Error('Missing reserved fixture profile.')
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: fixtureProfile.authUserId }],
          update: { email: 'ordinary@example.invalid' }
        }
      })
    )
    await expect(base.owner.caller.action(verifyRollback, operation)).rejects.toThrow(
      'Fixture account is required.'
    )
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: fixtureProfile.authUserId }],
          update: { email: 'draft_000000000001@example.invalid' }
        }
      })
    )
    expect(await base.t.query(inspect, base.target)).toEqual(before)
    const origin = process.env.SITE_URL
    try {
      process.env.SITE_URL = 'https://example.com'
      await expect(base.t.query(inspect, base.target)).rejects.toThrow(
        'development application origin'
      )
    } finally {
      if (origin === undefined) delete process.env.SITE_URL
      else process.env.SITE_URL = origin
    }
    expect(await base.t.query(inspect, base.target)).toEqual(before)
  })
  it('deletes an archived owner Campaign, every fixture descendant and its route while retaining byte-exact personal state', async () => {
    const base = await setup()
    const run = base.run
    if (!run) throw new Error('Missing public Run fixture.')
    const archived = await base.owner.caller.mutation(api.campaigns.archive.archive, {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version
    })
    const before = await base.t.query(inspect, base.target)
    const personalBefore = await base.t.query(inspectPersonal, base.target)
    expect(JSON.parse(personalBefore)).toMatchObject({
      encounterBlueprints: [expect.objectContaining({ id: run.blueprintId })]
    })
    await expect(
      base.owner.caller.mutation(api.campaigns.deletion.remove, {
        ...base.deletion,
        expectedVersion: archived.version
      })
    ).resolves.toEqual({ ok: true })
    expect(await deletionJob(base.t, base.campaign.id)).toMatchObject({
      status: 'DELETING',
      expectedVersion: archived.version,
      ownerUserId: base.owner.userId
    })
    await expect(
      base.owner.caller.query(api.campaigns.deletion.status, { campaignId: base.campaign.id })
    ).resolves.toMatchObject({ status: 'DELETING' })
    const scheduled = await base.t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect()
    )
    expect(scheduled.filter((job) => job.name === 'campaigns/deletionJobs:run')).toHaveLength(1)
    expect(scheduled.filter((job) => job.name === 'campaigns/deletionJobs:watchdog')).toHaveLength(
      1
    )
    await expect(
      base.other.caller.query(api.campaigns.deletion.status, { campaignId: base.campaign.id })
    ).rejects.toThrow('Campaign not found.')
    await expect(
      base.owner.caller.mutation(api.campaigns.deletion.remove, {
        ...base.deletion,
        expectedVersion: archived.version
      })
    ).resolves.toEqual({ ok: true })
    expect(await finishDeletion(base.t, base.campaign.id)).toMatchObject({ status: 'DELETED' })
    await expect(
      base.owner.caller.query(api.campaigns.deletion.status, { campaignId: base.campaign.id })
    ).resolves.toMatchObject({ status: 'DELETED' })
    await expect(
      base.t.query(assertRemoved, { fixture: base.target, descendants: before.descendants })
    ).resolves.toBeNull()
    expect(
      await base.t.run(async (ctx) =>
        Promise.all([
          ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
            .unique(),
          ctx.db
            .query('authoredRouteIds')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', base.campaign.id))
            .unique()
        ])
      )
    ).toEqual([null, null])
    expect(await base.t.query(inspectPersonal, base.target)).toBe(personalBefore)
  })
})
