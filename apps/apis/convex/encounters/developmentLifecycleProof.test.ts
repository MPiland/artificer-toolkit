// @vitest-environment node
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { deleteAccountCompletely } from '../../tests/fixtures/accountDeletion'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { verifyEncounterLifecycle } from '../../tests/developmentEncounterLifecycle'
import { verifyEncounterAutomation } from '../../tests/developmentEncounterAutomation'
import { verifyEncounterTransactions } from '../../tests/developmentEncounterTransactions'
import { prepareEncounterCutoverFixture } from '../../tests/developmentEncounterCutover'
import {
  attachRoomWorker,
  checkpointRoom,
  closeRoom,
  deliverQueuedRoomControl,
  queueRoomRolls,
  roomDevelopmentClient,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { api, components, internal } from '../_generated/api'
import type { FunctionArgs } from 'convex/server'

useLocalRoomWorker()
beforeEach(() => {
  // Real time keeps passing, so the real room's sockets and the room client's timers behave as in
  // production while Convex's scheduler still waits for the test's own clock.
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

it('runs the shared Manual and Assisted lifecycles, native map/Scene binding and cleanup through the real Session room', async () => {
  const { t, other: owner, owner: player, character } = await readySheetFixture()
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
  const server = await attachRoomWorker(t)
  await t.run(async (ctx) => {
    await ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 3 * 86_400_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
    for (const [index, userId] of [owner.userId, player.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const campaign = await owner.caller.mutation(api.campaigns.create.create, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const cleanup: FunctionArgs<
    typeof internal.encounters.developmentCampaign.removeFixtureCampaign
  > = {
    ownerUserId: owner.userId,
    playerUserId: player.userId,
    campaignId: campaign.id,
    characterId: character.id
  }
  await t.mutation(
    makeFunctionReference<
      'mutation',
      {
        ownerUserId: string
        playerUserId: string
        campaignId: string
      },
      null
    >('encounters/developmentCampaign:admitFixturePlayer'),
    {
      ownerUserId: owner.userId,
      playerUserId: player.userId,
      campaignId: campaign.id
    }
  )
  const clients = {
    owner: roomDevelopmentClient(owner.caller),
    player: roomDevelopmentClient(player.caller),
    anonymous: roomDevelopmentClient(null)
  }
  const policies = createEncounterLifecyclePolicyFixture(owner.userId)
  expect(await t.mutation(internal.content.import.bootstrap, policies.bootstrap)).toEqual({
    inserted: 2,
    reused: 1,
    replaced: 0
  })
  expect(await t.mutation(internal.content.import.importDefinitions, policies.imported)).toEqual({
    inserted: 6,
    reused: 0,
    replaced: 0
  })
  await seedRoomContentSnapshots(campaign.id)
  const result = await verifyEncounterLifecycle({ ...clients, campaignId: campaign.id })
  await importSeededSubjects(t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  // A room reads the content snapshots current when it activates, so the new creature needs a
  // rebuild and a room that starts after it.
  await closeRoom(campaign.id)
  await seedRoomContentSnapshots(campaign.id)
  const checkpoint = () => checkpointRoom(campaign.id)
  const automated = await verifyEncounterAutomation({
    owner: clients.owner,
    player: clients.player,
    campaignId: campaign.id,
    blueprint: result.blueprint,
    characterId: character.id,
    policies,
    sceneFixture: result,
    checkpoint
  })
  expect(automated).toHaveLength(4)
  // No `rollback`: the Run is held by the real room, whose bindings are room commands that Convex
  // fences (D47: `actorTokenBindings.ts:41` refuses while the room owns the Run), so Convex's own
  // binding mutation cannot be forced to roll back through it. The rollback arm (`verifyRollback`:
  // bind, raise the marker, every inspected row unchanged) is proved through the real Convex path,
  // with no room holding the Run, by `developmentLifecycle.test.ts` ("rolls back a real actor-token
  // binding and preserves every inspected row").
  await verifyEncounterTransactions({
    checkpoint,
    deliverRoomControl: () => deliverQueuedRoomControl(t),
    owner: clients.owner,
    player: clients.player,
    ownerUserId: owner.userId,
    playerUserId: player.userId,
    campaignId: campaign.id,
    fixture: result,
    concurrent: (actor, reference, args) =>
      (actor === 'OWNER' ? clients.owner : clients.player).mutation(reference, args, {
        skipQueue: true
      })
  })
  // Every Run in the proof is COMPLETED, and COMPLETE deletes its Scene and token bindings
  // (ADR 0035 Amendment 30).
  expect(
    await t.run(async (ctx) => ({
      scenes: await ctx.db.query('encounterSceneBindings').take(1),
      actors: await ctx.db.query('encounterActorTokenBindings').take(1)
    }))
  ).toEqual({ scenes: [], actors: [] })
  expect(server.objects.size).toBeGreaterThan(0)
  // Every die rolls 0, so initiative ties.
  await queueRoomRolls(campaign.id, { rolls: [], repeat: 0 })
  const cutoverFixture = await prepareEncounterCutoverFixture({
    owner: clients.owner,
    campaignId: campaign.id,
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    lifecycle: result
  }).finally(() => queueRoomRolls(campaign.id, { rolls: [] }))
  expect(cutoverFixture.initiativeOrderResolutions).toBeGreaterThan(0)
  // Closing the room checkpoints it and releases the Campaign's live authority before cleanup.
  await closeRoom(campaign.id)
  await t.mutation(
    makeFunctionReference<'mutation', typeof cleanup, null>(
      'encounters/developmentRuns:removeFixtureState'
    ),
    cleanup
  )
  await t.mutation(
    makeFunctionReference<'mutation', { ownerUserId: string; campaignId: string }, null>(
      'scenes/developmentScene:removeFixtureState'
    ),
    { ownerUserId: owner.userId, campaignId: campaign.id }
  )
  await t.mutation(
    makeFunctionReference<'mutation', typeof cleanup, null>(
      'encounters/developmentCampaign:removeFixtureCampaign'
    ),
    cleanup
  )
  const remaining = await t.run(async (ctx) => ({
    runs: await ctx.db.query('encounterRuns').take(1),
    bindings: await ctx.db.query('encounterSceneBindings').take(1),
    tokens: await ctx.db.query('encounterActorTokenBindings').take(1),
    scenes: await ctx.db.query('campaignScenes').take(1),
    campaigns: await ctx.db.query('campaigns').take(1),
    sessions: await ctx.db.query('campaignSessions').take(1),
    attendance: await ctx.db.query('campaignSessionAttendance').take(1),
    presentations: await ctx.db.query('campaignScenePresentations').take(1),
    sessionCommands: await ctx.db.query('campaignCommands').take(1),
    ownershipTransfers: await ctx.db.query('campaignOwnershipTransfers').take(1),
    media: await ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', result.assetId))
      .unique()
  }))
  expect(remaining).toMatchObject({
    runs: [],
    bindings: [],
    tokens: [],
    scenes: [],
    campaigns: [],
    sessions: [],
    attendance: [],
    presentations: [],
    sessionCommands: [],
    ownershipTransfers: [],
    media: { ownerUserId: owner.userId, status: 'READY', hasSceneReferences: false }
  })
  await t.mutation(internal.encounters.development.removeFixtureBlueprint, {
    userId: owner.userId,
    blueprintId: result.blueprint.id
  })
  await t.mutation(internal.characters.development.removePersonalFixtureCharacter, {
    userId: player.userId,
    characterId: character.id
  })
  await t.mutation(
    makeFunctionReference<'mutation', typeof policies.cleanup, null>(
      'encounters/developmentPolicies:removeFixtureState'
    ),
    policies.cleanup
  )
  const authUserId = await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
      .unique()
    if (!profile) throw new Error('Missing fixture owner.')
    return profile.authUserId
  })
  await deleteAccountCompletely(t, authUserId)
  await expect(owner.caller.query(api.account.identity, {})).rejects.toThrow('Unauthenticated')
  vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000)
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.size).toBe(0)
}, 180000)
