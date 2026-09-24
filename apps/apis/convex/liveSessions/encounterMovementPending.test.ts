// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  liveSessionMovementSettlementSchema,
  type LiveSessionMovementCommitInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import { readRunActors, readRunState } from '../encounters/documents'
import { commitLiveMovement } from './encounterMovementCommit'
import { readLiveSessionRulesRevisions } from './rulesRevisions'

type Fixture = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>
type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')

async function setAssisted(value: Fixture) {
  await value.base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    if (!row) throw new Error('Movement Run is unavailable.')
    const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
    const next = encounterRunStateSchema.parse({ ...state, automationMode: 'ASSISTED' })
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(next),
      stateChecksum: checksumCanonicalJson(next)
    })
  })
}

async function records(value: Fixture) {
  return value.base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    effects: await ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
      )
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    runCommands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', value.base.campaign.id).eq('commandId', value.rootInput.commandId)
      )
      .collect(),
    scene: await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', value.sceneId))
      .unique(),
    sceneState: await ctx.db
      .query('sceneLiveStates')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', value.sceneId))
      .unique(),
    sceneCommands: await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', value.sceneId).eq('commandId', value.rootInput.commandId)
      )
      .collect(),
    sceneEntities: await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', value.sceneId).eq('collection', 'tokens').eq('entityId', value.moverTokenId)
      )
      .collect()
  }))
}

function geometrySave(value: Fixture) {
  return value.base.t.run((ctx) =>
    ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
      .unique()
  )
}

async function preparePrivateCommit(value: Fixture) {
  await value.owner.caller.mutation(observe, {
    saveId: value.saveId,
    characterRevisions: []
  })
  const beforePreparation = await records(value)
  // Native preparation supplies trusted rule evidence; this test exercises only private publication.
  const preparation = await value.owner.caller.mutation(prepare, value.request)
  expect(await records(value)).toEqual(beforePreparation)
  const epoch = crypto.randomUUID()
  await value.base.t.run((ctx) =>
    ctx.db.insert('campaignLiveAuthorities', {
      campaignId: value.base.campaign.id,
      sessionId: value.base.run.sessionId,
      epoch,
      phase: 'DO_ACTIVE',
      activationFingerprint: '0'.repeat(64),
      persistedSequence: 0,
      persistedStateChecksum: '0'.repeat(64),
      createdAt: value.base.campaign.createdAt,
      updatedAt: value.base.campaign.createdAt
    })
  )
  const revisions = await value.owner.caller.run((ctx) =>
    readLiveSessionRulesRevisions(ctx, {
      systemId: value.base.campaign.gameSystemId,
      campaignId: value.base.campaign.id,
      sessionId: value.base.run.sessionId
    })
  )
  const base: Omit<LiveSessionMovementCommitInput, 'rules' | 'settlements'> = {
    campaignId: value.base.campaign.id,
    sessionId: value.base.run.sessionId,
    authorityEpoch: epoch,
    expectedUserId: value.owner.userId,
    expectedRole: 'OWNER',
    movement: {
      encounterId: value.base.run.id,
      saveId: value.saveId,
      baseTokenOrdinal: 1
    },
    preparation,
    revisions,
    maintenanceOwners: [],
    finish: value.request
  }
  return { base, preparation }
}

function publish(value: Fixture, input: LiveSessionMovementCommitInput) {
  return value.owner.caller.run((ctx) => commitLiveMovement(ctx, input))
}

it('publishes an Assisted spatial evidence pause without settling retained no-input contact', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const first = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 250, y: 50 },
    5
  )
  const later = await seedSpatialSaveEffect(value, {
    center: { x: 300, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  await setAssisted(value)
  const { base, preparation } = await preparePrivateCommit(value)
  expect(preparation.outcome.kind).toBe('PENDING')
  if (preparation.outcome.kind !== 'PENDING') throw new Error('Expected spatial dice pause.')
  const context = preparation.outcome.pendingSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' || context.phase.kind !== 'SPATIAL_EVIDENCE')
    throw new Error('Expected pending spatial evidence before reaction choice.')
  expect(
    context.completedSpatialExecutions.map((entry) => entry.candidate.candidate.effectId)
  ).toEqual([first.id])
  expect(context.phase.currentCandidate.candidate.effectId).toBe(later.id)
  expect(context.appliedSpatialPrefix).toBeNull()
  const nextReaction = context.reactionTimeline[0]
  if (!nextReaction || nextReaction.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected later reaction choice after spatial evidence.')
  expect(context.completedSpatialExecutions[0]!.candidate.candidate.pathDistance).toBeLessThan(
    context.phase.currentCandidate.candidate.pathDistance
  )
  expect(context.phase.currentCandidate.candidate.pathDistance).toBeLessThan(
    nextReaction.group.pathDistance
  )
  const input: LiveSessionMovementCommitInput = { ...base, rules: null, settlements: [] }
  const before = await records(value)
  const frozenSave = await geometrySave(value)
  const published = await publish(value, input)
  const after = await records(value)
  const publishedSave = await geometrySave(value)
  expect(published.occurrence).toMatchObject({ status: 'PENDING' })
  expect(after.run?.version).toBe(before.run?.version)
  expect(after.actors).toEqual(before.actors)
  expect(after.effects).toEqual(before.effects)
  expect(after.occurrences).toHaveLength(before.occurrences.length + 1)
  expect(after.receipts).toHaveLength(before.receipts.length + 1)
  expect(after.runCommands).toEqual(before.runCommands)
  expect(after.sceneState?.version).toBe((before.sceneState?.version ?? before.scene!.version) + 1)
  const retained = after.occurrences.find(
    (entry) => entry.rootCommandId === value.rootInput.commandId
  )
  if (!retained?.pendingSnapshotJson) throw new Error('Pending spatial evidence was not stored.')
  expect(
    JSON.parse(retained.pendingSnapshotJson).applicationContext.completedSpatialExecutions
  ).toEqual(context.completedSpatialExecutions)
  expect(await publish(value, input)).toEqual({ ...published, replayed: true })
  expect(await records(value)).toEqual(after)
  expect(publishedSave).not.toEqual(frozenSave)
  expect(await geometrySave(value)).toEqual(publishedSave)
}, 60_000)

it('commits a spatial prefix once before a choice pause and rolls back late failure', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const effect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 275, y: 50 },
    5
  )
  const { base, preparation } = await preparePrivateCommit(value)
  expect(preparation.outcome.kind).toBe('PENDING')
  if (preparation.outcome.kind !== 'PENDING') throw new Error('Expected reaction choice pause.')
  const context = preparation.outcome.pendingSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Expected reaction choice context.')
  const prefix = context.appliedSpatialPrefix
  if (prefix?.status !== 'BATCH_COMPLETE' || prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
    throw new Error('Expected applied spatial prefix.')
  expect(prefix.executions.map((entry) => entry.candidate.candidate.effectId)).toEqual([effect.id])
  expect(prefix.spatialEffectTransitions).toEqual([
    expect.objectContaining({
      effectId: effect.id,
      transition: expect.objectContaining({ kind: 'DELETE' })
    })
  ])
  const choice = context.reactionTimeline.find((entry) => entry.kind === 'CONTROLLER_CHOICE')
  if (!choice || choice.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected controller choice after the spatial contact.')
  expect(prefix.executions[0]!.candidate.candidate.pathDistance).toBeLessThan(
    choice.group.pathDistance
  )
  const spatial = liveSessionMovementSettlementSchema.parse({
    kind: 'SPATIAL',
    executions: prefix.executions,
    transitions: prefix.spatialEffectTransitions
  })
  const rules = await value.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    if (!row) throw new Error('Movement Run is unavailable.')
    const state = readRunState(row)
    const actors = await readRunActors(ctx, state)
    const projected = actors.map((actor) => {
      const transition = prefix.encounterActorTransitions.find(
        (entry) => entry.targetActorId === actor.id
      )
      return transition
        ? encounterRunActorStateSchema.parse({
            ...actor,
            currentHitPoints: transition.after.currentHitPoints,
            tempHitPoints: transition.after.temporaryHitPoints
          })
        : actor
    })
    const facts = buildEncounterActorRuleFacts({ actors: projected })
    return bindEncounterActorRuleOutputToFacts(
      reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
        facts
      ),
      facts
    )
  })
  const input: LiveSessionMovementCommitInput = {
    ...base,
    rules,
    settlements: [spatial]
  }
  const before = await records(value)
  const frozenSave = await geometrySave(value)
  await expect(
    value.owner.caller.run(async (ctx) => {
      await commitLiveMovement(ctx, input)
      throw new Error('late private movement rollback')
    })
  ).rejects.toThrow('late private movement rollback')
  expect(await records(value)).toEqual(before)
  expect(await geometrySave(value)).toEqual(frozenSave)
  const published = await publish(value, input)
  const after = await records(value)
  const publishedSave = await geometrySave(value)
  expect(published.occurrence).toMatchObject({ status: 'PENDING' })
  expect(after.run?.version).toBe(before.run!.version + 1)
  expect(after.sceneState?.version).toBe((before.sceneState?.version ?? before.scene!.version) + 1)
  const beforeMover = before.actors.find((actor) => actor.id === value.base.mover.id)
  const afterMover = after.actors.find((actor) => actor.id === value.base.mover.id)
  if (!beforeMover || !afterMover) throw new Error('Spatial target actor is unavailable.')
  expect(
    encounterRunActorStateSchema.parse(JSON.parse(afterMover.stateJson)).currentHitPoints
  ).toBe(
    encounterRunActorStateSchema.parse(JSON.parse(beforeMover.stateJson)).currentHitPoints! - 1
  )
  expect(after.effects.map((entry) => entry.id)).not.toContain(effect.id)
  expect(after.receipts).toHaveLength(before.receipts.length + 1)
  expect(after.runCommands).toHaveLength(before.runCommands.length + 1)
  expect(await publish(value, input)).toEqual({ ...published, replayed: true })
  expect(await records(value)).toEqual(after)
  expect(publishedSave).not.toEqual(frozenSave)
  expect(await geometrySave(value)).toEqual(publishedSave)
}, 60_000)
