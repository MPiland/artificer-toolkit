// @vitest-environment node
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { startLocalR2 } from '../../tests/localR2'
import { verifyEncounterLifecycle } from '../../tests/developmentEncounterLifecycle'
import { verifyEncounterAutomation } from '../../tests/developmentEncounterAutomation'
import { verifyEncounterTransactions } from '../../tests/developmentEncounterTransactions'
import {
  prepareEncounterCutoverFixture,
  verifyEncounterCutoverContention
} from '../../tests/developmentEncounterCutover'
import { verifySceneEntities } from '../../tests/developmentSceneEntities'
import { api, components, internal } from '../_generated/api'
import type { ActionCtx } from '../_generated/server'
import type { FunctionArgs } from 'convex/server'
import * as rollRandom from '../lib/rollRandom'

let server: Awaited<ReturnType<typeof startLocalR2>>
beforeEach(async () => {
  server = await startLocalR2()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
})
afterEach(async () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await server.close()
})

it('runs the shared Manual/Automatic/Assisted lifecycles, native map/Scene binding and cleanup through local transactions', async () => {
  const { t, other: owner, owner: player, character } = await readySheetFixture()
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
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
  const clients: Pick<Parameters<typeof verifySceneEntities>[0], 'owner' | 'player' | 'anonymous'> =
    {
      owner: {
        query: (query, ...args) => owner.caller.run((ctx) => ctx.runQuery(query, ...args)),
        mutation: (mutation, ...args) =>
          owner.caller.run((ctx) => ctx.runMutation(mutation, ...args)),
        action: (action, ...args) => {
          const invoke = (ctx: ActionCtx) => ctx.runAction(action, ...args)
          return owner.caller.action<typeof invoke>(invoke)
        }
      },
      player: {
        query: (query, ...args) => player.caller.run((ctx) => ctx.runQuery(query, ...args)),
        mutation: (mutation, ...args) =>
          player.caller.run((ctx) => ctx.runMutation(mutation, ...args)),
        action: (action, ...args) => {
          const invoke = (ctx: ActionCtx) => ctx.runAction(action, ...args)
          return player.caller.action<typeof invoke>(invoke)
        }
      },
      anonymous: {
        query: (query, ...args) => t.run((ctx) => ctx.runQuery(query, ...args)),
        mutation: (mutation, ...args) => t.run((ctx) => ctx.runMutation(mutation, ...args)),
        action: (action, ...args) => {
          const invoke = (ctx: ActionCtx) => ctx.runAction(action, ...args)
          return t.action<typeof invoke>(invoke)
        }
      }
    }
  const policies = createEncounterLifecyclePolicyFixture(owner.userId)
  expect(await t.mutation(internal.content.import.bootstrap, policies.bootstrap)).toEqual({
    inserted: 2,
    reused: 1
  })
  expect(await t.mutation(internal.content.import.importDefinitions, policies.imported)).toEqual({
    inserted: 6,
    reused: 0
  })
  const result = await verifyEncounterLifecycle({ ...clients, campaignId: campaign.id })
  await t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  const automated = await verifyEncounterAutomation({
    owner: clients.owner,
    player: clients.player,
    campaignId: campaign.id,
    session: result.session,
    blueprint: result.blueprint,
    characterId: character.id,
    policies,
    sceneFixture: result
  })
  expect(automated).toHaveLength(4)
  await verifySceneEntities({
    ...clients,
    playerUserId: player.userId,
    campaignId: campaign.id,
    fixture: result
  })
  const rollbackRun = await verifyEncounterTransactions({
    owner: clients.owner,
    player: clients.player,
    ownerUserId: owner.userId,
    playerUserId: player.userId,
    campaignId: campaign.id,
    fixture: result,
    concurrent: (actor, reference, args) =>
      (actor === 'OWNER' ? owner.caller : player.caller).run((ctx) =>
        ctx.runMutation(reference, args)
      ),
    rollback: (input) => {
      const args = { ...input, ownerUserId: owner.userId, campaignId: campaign.id }
      const reference = makeFunctionReference<'action', typeof args, { rolledBack: true }>(
        'encounters/developmentLifecycle:verifyRollback'
      )
      return owner.caller.action(reference, args)
    }
  })
  const retainedBindings = await t.run(async (ctx) => ({
    scenes: await ctx.db.query('encounterSceneBindings').take(7),
    actors: await ctx.db.query('encounterActorTokenBindings').take(6)
  }))
  expect(retainedBindings.scenes).toHaveLength(6)
  expect(retainedBindings.actors).toHaveLength(5)
  for (const run of automated) {
    expect(
      retainedBindings.scenes.filter((binding) => binding.encounterId === run.id)
    ).toHaveLength(1)
    expect(retainedBindings.actors.filter((binding) => binding.encounterId === run.id)).toEqual([
      expect.objectContaining({
        encounterId: run.id,
        actorId: run.actors.find((actor) => actor.kind === 'CHARACTER')!.id,
        sceneId: result.scenes[0].liveSceneId,
        tokenId: result.scenes[0].tokenIds[0]
      })
    ])
  }
  expect(
    retainedBindings.scenes.filter((binding) => binding.encounterId === rollbackRun.projection.id)
  ).toEqual([expect.objectContaining({ sceneId: rollbackRun.sceneId })])
  expect(
    retainedBindings.actors.filter((binding) => binding.encounterId === rollbackRun.projection.id)
  ).toEqual([
    expect.objectContaining({
      sceneId: rollbackRun.sceneId,
      actorId: rollbackRun.actorId,
      tokenId: rollbackRun.tokenId
    })
  ])
  expect(server.objects.size).toBeGreaterThan(0)
  const tiedRolls = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(0)
  const cutoverFixture = await prepareEncounterCutoverFixture({
    owner: clients.owner,
    campaignId: campaign.id,
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    lifecycle: result
  }).finally(() => tiedRolls.mockRestore())
  expect(cutoverFixture.initiativeOrderResolutions).toBeGreaterThan(0)
  await verifyEncounterCutoverContention({
    owner: clients.owner,
    peer: { ...clients.owner },
    fixture: cutoverFixture
  })
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
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
      .unique()
    if (!profile) throw new Error('Missing fixture owner.')
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: 'user', where: [{ field: '_id', value: profile.authUserId }] },
      onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
    })
  })
  await expect(owner.caller.query(api.account.identity, {})).rejects.toThrow('Unauthenticated')
  vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000)
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.size).toBe(0)
}, 60000)
