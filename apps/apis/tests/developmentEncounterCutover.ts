import assert from 'node:assert/strict'
import { ConvexClient, type ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  encounterGmProjectionDtoSchema,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { api } from '../convex/_generated/api.js'
import {
  assertDomainRejection,
  type DevelopmentClient,
  executeEncounterCommand
} from './developmentClient'
import type { DevelopmentHttpClient } from './developmentHttpClient'
import {
  bindScene,
  bindToken,
  type verifyEncounterLifecycle
} from './developmentEncounterLifecycle'
import {
  createEncounterLifecycleScene,
  type EncounterLifecycleSceneOptions
} from './developmentEncounterScenes'
import {
  cutoverWorkloadActionEffectId,
  cutoverWorkloadActionFeatureId,
  cutoverWorkloadBonusActionEffectId,
  cutoverWorkloadBonusActionFeatureId,
  cutoverWorkloadReactionEffectId,
  cutoverWorkloadReactionFeatureId
} from './fixtures/encounterAction'

type ActionClient = DevelopmentClient & Pick<ConvexHttpClient, 'action'>
type RollbackOperation = { kind: 'COMMAND'; input: EncounterExecuteInput }
const inspectMovementReactionDamage = makeFunctionReference<
  'query',
  { campaignId: string; encounterId: string; rootCommandId: string; terminalCommandId: string },
  {
    occurrenceId: string
    sourceActorId: string
    targetActorId: string
    resultPath: string
    requestedAmounts: number[]
    appliedAmount: number
    beforeHitPoints: number
    afterHitPoints: number
  }
>('encounters/developmentLifecycle:movementReactionDamage')

// Authenticated V12/V14/V15 fixture.  It deliberately starts a new aggregate so
// concurrency contenders never share lifecycle setup receipts.
export async function prepareEncounterCutoverFixture({
  owner,
  campaignId,
  initiativePolicyDefinitionId,
  lifecycle
}: {
  owner: ActionClient
  campaignId: string
  initiativePolicyDefinitionId: string
  lifecycle: Awaited<ReturnType<typeof verifyEncounterLifecycle>>
}) {
  // Assisted with the GM's auto-roll on: initiative settles without score prompts.
  await owner.mutation(api.account.setAutoRollDice, { autoRollDice: true })
  const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null
  })
  const currentPresentation = await owner.query(api.scenes.presentations.get, { campaignId })
  const presentation = await owner.action(api.scenes.presentations.setLive, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    campaignId,
    sceneId: lifecycle.scenes[0]!.liveSceneId,
    expectedPresentationVersion: currentPresentation?.version ?? null
  })
  const run = await owner.mutation(api.encounters.runs.create, {
    campaignId,
    blueprintId: lifecycle.blueprint.id,
    commandId: crypto.randomUUID()
  })
  let started = await owner.mutation(executeEncounterCommand, {
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version
    }
  })
  let initiativeOrderResolutions = 0
  while (started.occurrence?.status === 'PENDING') {
    assert.ok(initiativeOrderResolutions++ < 20, 'Cutover initiative did not settle.')
    const pending = started.occurrence.pending
    if (pending?.kind !== 'INITIATIVE_ORDER')
      throw new Error('Auto-rolled cutover initiative requested an unexpected continuation.')
    assert.ok(pending.optionIds[0])
    started = await owner.mutation(executeEncounterCommand, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version,
        correlationId: null,
        occurrenceId: started.occurrence.occurrenceId,
        expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: pending.requestId,
          entityId: pending.optionIds[0]
        }
      }
    })
  }
  assert.equal(started.projection.status, 'ACTIVE')
  const bound = await owner.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    encounterId: run.id,
    commandId: crypto.randomUUID()
  })
  assert.equal(bound.sceneId, lifecycle.scenes[0]!.liveSceneId)
  const actor = started.projection.actors.find(
    (candidate) => candidate.id === started.projection.currentActorId
  )
  if (!actor) throw new Error('Cutover fixture Run has no current actor.')
  const tokenId = lifecycle.scenes[0]!.tokenIds[0]
  if (!tokenId) throw new Error('Cutover fixture Scene has no token.')
  const binding = await owner.mutation(bindToken, {
    input: {
      type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      commandId: crypto.randomUUID(),
      encounterId: run.id,
      expectedEncounterVersion: started.projection.version,
      actorId: actor.id,
      sceneId: bound.sceneId,
      tokenId
    }
  })
  return {
    presentation,
    run: binding.projection,
    sceneId: bound.sceneId,
    tokenId,
    initiativeOrderResolutions
  }
}

export async function readAuthoritativeSceneToken(
  owner: ActionClient,
  input: { sceneId: string; tokenId: string }
) {
  const header = await owner.query(api.scenes.recipientReads.header, { sceneId: input.sceneId })
  const tokens = await owner.action(api.scenes.recipientActions.entities, {
    sceneId: input.sceneId,
    expectedRecipientRevision: header.recipientRevision,
    expectedVersion: header.version,
    collection: 'tokens',
    afterEntityId: null,
    numItems: 8
  })
  assert.equal(tokens.next, null)
  const entry = tokens.page.find(({ value }) => value.entity.id === input.tokenId)
  if (!entry || entry.value.collection !== 'tokens')
    throw new Error('Cutover fixture token is absent from the authoritative Scene.')
  return { header, token: entry.value.entity }
}

const MEASURED_SAMPLES = 1

export const encounterCutoverWorkloadDefinition = {
  gm: 1,
  players: 5,
  actors: 11,
  rounds: 8,
  actionsPerActorTurn: 2,
  reactionsPerActorTurn: 1,
  thresholds: {
    peerPreviewP95Ms: 150,
    durablePeerConvergenceP95Ms: 250,
    durablePeerConvergenceP99Ms: 500,
    authoritativeCommandP95Ms: 1_000,
    sceneOnlyHostP95Ms: 100,
    ruleBoundHostP95Ms: 250,
    localColdCommandMs: 500
  }
} as const

export type EncounterCutoverWorkload = {
  maximumMs: number
  p50Ms: number
  p95Ms: number
  samples: number
  commandsPerSample: number
  independentCommandsPerSample: number
  commandSamples: number
  workloadMaximumMs: number
  rawCommandSamples: readonly EncounterCutoverCommandSample[]
  byOperation: Record<EncounterCutoverOperation, EncounterCutoverOperationSummary>
  reactionCompositeDurationsMs: readonly number[]
}

type EncounterCutoverOperation =
  | 'RESOLVE_ACTION'
  | 'SCENE_MOVE'
  | 'REACTION_RESPONSE'
  | 'ADVANCE_TURN'
export type EncounterCutoverCommandSample = {
  operation: EncounterCutoverOperation
  durationMs: number
}
type EncounterCutoverOperationSummary = {
  samples: number
  p50Ms: number
  p95Ms: number
  maximumMs: number
  rawDurationsMs: readonly number[]
}

const workloadOperations = [
  'RESOLVE_ACTION',
  'SCENE_MOVE',
  'REACTION_RESPONSE',
  'ADVANCE_TURN'
] as const satisfies readonly EncounterCutoverOperation[]

async function timeCutoverCommand<T>(
  operation: EncounterCutoverOperation,
  samples: EncounterCutoverCommandSample[],
  execute: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now()
  const result = await execute()
  samples.push({ operation, durationMs: performance.now() - startedAt })
  return result
}

export type EncounterCutoverWorkItem = {
  aggregate: 'PRIMARY' | 'INDEPENDENT'
  round: number
  actor: number
  participant: 'GM' | `PLAYER_${number}`
  kind: 'ACTION' | 'REACTION' | 'END_TURN'
  ordinal: number
}

// Who acts for the 1-based workload actor: the GM for the first, players in turn for the rest.
function cutoverWorkloadParticipant(actor: number): EncounterCutoverWorkItem['participant'] {
  return actor === 1
    ? 'GM'
    : `PLAYER_${((actor - 2) % encounterCutoverWorkloadDefinition.players) + 1}`
}

export function scheduleEncounterCutoverWorkload(
  aggregate: EncounterCutoverWorkItem['aggregate'] = 'PRIMARY'
): EncounterCutoverWorkItem[] {
  const schedule: EncounterCutoverWorkItem[] = []
  for (let round = 1; round <= encounterCutoverWorkloadDefinition.rounds; round++)
    for (let actor = 1; actor <= encounterCutoverWorkloadDefinition.actors; actor++) {
      const participant = cutoverWorkloadParticipant(actor)
      for (
        let ordinal = 1;
        ordinal <= encounterCutoverWorkloadDefinition.actionsPerActorTurn;
        ordinal++
      )
        schedule.push({ aggregate, round, actor, participant, kind: 'ACTION', ordinal })
      // Each turn ends with a move that provokes the next actor's opportunity reaction, except the
      // last: with eleven actors on two dispositions (D17), no hostile reactor both remains and gets
      // its reaction back before the next round needs it, so the last turn only ends ("up to one").
      schedule.push({
        aggregate,
        round,
        actor,
        participant,
        kind: actor < encounterCutoverWorkloadDefinition.actors ? 'REACTION' : 'END_TURN',
        ordinal: 1
      })
    }
  return schedule
}

function countWorkItems(
  schedules: readonly (readonly EncounterCutoverWorkItem[])[],
  kind: EncounterCutoverWorkItem['kind']
) {
  return schedules.reduce(
    (total, schedule) => total + schedule.filter((item) => item.kind === kind).length,
    0
  )
}

export function assertEncounterCutoverWorkload(workload: EncounterCutoverWorkload) {
  assert.equal(workload.samples, MEASURED_SAMPLES)
  assert.equal(workload.commandsPerSample, scheduleEncounterCutoverWorkload().length)
  assert.equal(
    workload.independentCommandsPerSample,
    scheduleEncounterCutoverWorkload('INDEPENDENT').length
  )
  const schedules = [
    scheduleEncounterCutoverWorkload(),
    scheduleEncounterCutoverWorkload('INDEPENDENT')
  ]
  const reactions = workload.samples * countWorkItems(schedules, 'REACTION')
  assert.equal(
    workload.byOperation.RESOLVE_ACTION.samples,
    workload.samples * countWorkItems(schedules, 'ACTION')
  )
  assert.equal(workload.byOperation.SCENE_MOVE.samples, reactions)
  assert.equal(
    workload.byOperation.ADVANCE_TURN.samples,
    reactions + workload.samples * countWorkItems(schedules, 'END_TURN')
  )
  assert.ok(workload.byOperation.REACTION_RESPONSE.samples >= reactions)
  assert.equal(workload.reactionCompositeDurationsMs.length, reactions)
  assert.equal(workload.rawCommandSamples.length, workload.commandSamples)
  assert.equal(
    workload.commandSamples,
    workloadOperations.reduce(
      (total, operation) => total + workload.byOperation[operation].samples,
      0
    )
  )
  assert.ok(
    workload.p95Ms <= encounterCutoverWorkloadDefinition.thresholds.authoritativeCommandP95Ms
  )
  for (const operation of workloadOperations)
    assert.ok(
      workload.byOperation[operation].p95Ms <=
        encounterCutoverWorkloadDefinition.thresholds.authoritativeCommandP95Ms,
      `${operation} p95 exceeded the authoritative command threshold.`
    )
}

export async function measureEncounterCutoverWorkload(
  execute: (
    schedules: readonly [readonly EncounterCutoverWorkItem[], readonly EncounterCutoverWorkItem[]]
  ) => Promise<{
    commandSamples: readonly EncounterCutoverCommandSample[]
    reactionCompositeDurationsMs: readonly number[]
  }>
): Promise<EncounterCutoverWorkload> {
  const schedules = [
    scheduleEncounterCutoverWorkload(),
    scheduleEncounterCutoverWorkload('INDEPENDENT')
  ] as const
  const rawCommandSamples: EncounterCutoverCommandSample[] = []
  const reactionCompositeDurationsMs: number[] = []
  let workloadMaximumMs = 0
  for (let index = 0; index < MEASURED_SAMPLES; index++) {
    const startedAt = performance.now()
    const measurement = await execute(schedules)
    workloadMaximumMs = Math.max(workloadMaximumMs, performance.now() - startedAt)
    const actions = countWorkItems(schedules, 'ACTION')
    const reactions = countWorkItems(schedules, 'REACTION')
    const turnEnds = reactions + countWorkItems(schedules, 'END_TURN')
    for (const operation of workloadOperations) {
      const count = measurement.commandSamples.filter(
        (sample) => sample.operation === operation
      ).length
      if (operation === 'RESOLVE_ACTION') assert.equal(count, actions)
      else if (operation === 'REACTION_RESPONSE') assert.ok(count >= reactions)
      else if (operation === 'ADVANCE_TURN') assert.equal(count, turnEnds)
      else assert.equal(count, reactions)
    }
    assert.equal(measurement.reactionCompositeDurationsMs.length, reactions)
    assert.ok(
      measurement.commandSamples.every(
        (sample) => Number.isFinite(sample.durationMs) && sample.durationMs >= 0
      )
    )
    assert.ok(
      measurement.reactionCompositeDurationsMs.every(
        (duration) => Number.isFinite(duration) && duration >= 0
      )
    )
    rawCommandSamples.push(...measurement.commandSamples)
    reactionCompositeDurationsMs.push(...measurement.reactionCompositeDurationsMs)
  }
  const summarize = (rawDurationsMs: readonly number[]): EncounterCutoverOperationSummary => {
    const sorted = [...rawDurationsMs].sort((left, right) => left - right)
    return {
      samples: sorted.length,
      p50Ms: sorted[Math.ceil(0.5 * sorted.length) - 1]!,
      p95Ms: sorted[Math.ceil(0.95 * sorted.length) - 1]!,
      maximumMs: sorted.at(-1)!,
      rawDurationsMs
    }
  }
  const byOperation = Object.fromEntries(
    workloadOperations.map((operation) => [
      operation,
      summarize(
        rawCommandSamples
          .filter((sample) => sample.operation === operation)
          .map((sample) => sample.durationMs)
      )
    ])
  ) as Record<EncounterCutoverOperation, EncounterCutoverOperationSummary>
  const total = summarize(rawCommandSamples.map((sample) => sample.durationMs))
  return {
    samples: MEASURED_SAMPLES,
    commandSamples: total.samples,
    workloadMaximumMs,
    commandsPerSample: schedules[0].length,
    independentCommandsPerSample: schedules[1].length,
    p50Ms: total.p50Ms,
    p95Ms: total.p95Ms,
    maximumMs: total.maximumMs,
    rawCommandSamples,
    byOperation,
    reactionCompositeDurationsMs
  }
}
type CutoverWorkloadAggregate = {
  aggregate: EncounterCutoverWorkItem['aggregate']
  /** The GM's client for this aggregate's Campaign; players share one client each across both. */
  gm: DevelopmentHttpClient
  /** Measured commits: the Run version and when its initiator's acknowledgement arrived. */
  commits: { version: number; committedAt: number }[]
  actorIds: readonly string[]
  positions: readonly { x: number; y: number }[]
  tokenIds: readonly string[]
  run: ReturnType<typeof encounterGmProjectionDtoSchema.parse>
  sceneId: string
  sceneVersion: number
  presentation: { version: number }
}

const workloadGrid = {
  kind: 'SQUARE' as const,
  origin: { x: 0, y: 0 },
  cellSize: 100,
  distancePerCell: 5,
  diagonalPolicy: 'EQUAL' as const,
  unit: 'FEET' as const
}
const workloadMap = { width: 2048, height: 2048 }

function cutoverWorkloadPositions() {
  return Array.from({ length: encounterCutoverWorkloadDefinition.actors }, (_, index) => {
    const angle = (2 * Math.PI * index) / encounterCutoverWorkloadDefinition.actors
    return {
      x: Math.round(1024 + 700 * Math.cos(angle)),
      y: Math.round(1024 + 700 * Math.sin(angle))
    }
  })
}

function cutoverWorkloadActionId(actorId: string, kind: 'ACTION' | 'BONUS_ACTION' | 'REACTION') {
  const [featureId, effectId] =
    kind === 'ACTION'
      ? [cutoverWorkloadActionFeatureId, cutoverWorkloadActionEffectId]
      : kind === 'BONUS_ACTION'
        ? [cutoverWorkloadBonusActionFeatureId, cutoverWorkloadBonusActionEffectId]
        : [cutoverWorkloadReactionFeatureId, cutoverWorkloadReactionEffectId]
  return `${actorId}:FEATURE:${featureId}:EFFECT:${effectId}`
}

function participantClient(
  aggregate: CutoverWorkloadAggregate,
  players: readonly DevelopmentHttpClient[],
  participant: EncounterCutoverWorkItem['participant']
) {
  if (participant === 'GM') return aggregate.gm
  const player = players[Number(participant.slice('PLAYER_'.length)) - 1]
  if (!player) throw new Error(`V15 workload ${participant} has no client.`)
  return player
}

// A player's result carries their own projection, so the GM's current projection is reread. A commit's
// acknowledgement time anchors durable convergence: Convex has committed before the room acknowledges.
async function readWorkloadRun(aggregate: CutoverWorkloadAggregate, committedAt: number) {
  aggregate.run = encounterGmProjectionDtoSchema.parse(
    await aggregate.gm.query(api.encounters.projectionReads.get, { encounterId: aggregate.run.id })
  )
  aggregate.commits.push({ version: aggregate.run.version, committedAt })
}

async function prepareCutoverWorkloadAggregate({
  owner,
  campaignId,
  initiativePolicyDefinitionId,
  blueprintId,
  playerUserIds,
  aggregate
}: {
  owner: DevelopmentHttpClient
  campaignId: string
  initiativePolicyDefinitionId: string
  blueprintId: string
  playerUserIds: readonly string[]
  aggregate: EncounterCutoverWorkItem['aggregate']
}): Promise<CutoverWorkloadAggregate> {
  const positions = cutoverWorkloadPositions()
  const tokenIds = positions.map(() => crypto.randomUUID())
  const token = (index: number): EncounterLifecycleSceneOptions['tokens'][number] => ({
    id: tokenIds[index]!,
    assetId: null,
    controlledByUserIds: index === 0 ? [...playerUserIds] : [],
    height: 100,
    hidden: false,
    label: `${aggregate} workload actor ${index + 1}`,
    locked: false,
    position: positions[index]!,
    rotationDegrees: 0,
    vision: null,
    width: 100
  })
  const tokens: EncounterLifecycleSceneOptions['tokens'] = [
    token(0),
    token(1),
    ...positions.slice(2).map((_, index) => token(index + 2))
  ]
  const scene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name: `V15 ${aggregate.toLowerCase()} workload scene`,
    options: { map: workloadMap, grid: workloadGrid, tokens }
  })
  // The workload measures server-rolled turns and reactions: Assisted with the GM's auto-roll on.
  await owner.mutation(api.account.setAutoRollDice, { autoRollDice: true })
  const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null
  })
  const currentPresentation = await owner.query(api.scenes.presentations.get, { campaignId })
  const presentation = await owner.action(api.scenes.presentations.setLive, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    campaignId,
    sceneId: scene.liveSceneId,
    expectedPresentationVersion: currentPresentation?.version ?? null
  })
  const created = await owner.mutation(api.encounters.runs.create, {
    campaignId,
    blueprintId,
    commandId: crypto.randomUUID()
  })
  // Bind natively before START opens the Session room; while the room owns the presented Scene,
  // Convex refuses a native binding and the GM binds through the room (D47).
  await owner.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    encounterId: created.id,
    commandId: crypto.randomUUID()
  })
  let started = await owner.mutation(executeEncounterCommand, {
    command: {
      type: 'START',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: created.version
    }
  })
  for (let resolutions = 0; started.occurrence?.status === 'PENDING'; resolutions++) {
    assert.ok(resolutions < 24, `${aggregate} workload initiative did not settle.`)
    const pending = started.occurrence.pending
    if (!pending) throw new Error(`${aggregate} workload initiative request is unavailable.`)
    const resolution =
      pending.kind === 'INITIATIVE_EVIDENCE'
        ? {
            kind: 'ENTER_INTEGER' as const,
            requestId: pending.request.requestId,
            value: pending.request.max
          }
        : pending.kind === 'INITIATIVE_ORDER' && pending.optionIds[0]
          ? {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId: pending.optionIds[0]
            }
          : null
    if (!resolution) throw new Error(`${aggregate} workload initiative requested ${pending.kind}.`)
    started = await owner.mutation(executeEncounterCommand, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: created.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version,
        correlationId: null,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        resolution
      }
    })
  }
  let run = encounterGmProjectionDtoSchema.parse(started.projection)
  assert.equal(run.status, 'ACTIVE')
  assert.equal(run.actors.length, encounterCutoverWorkloadDefinition.actors)
  if (!run.currentActorId) throw new Error(`${aggregate} workload has no current actor.`)
  const actorIds = [run.currentActorId]
  for (let index = 1; index <= encounterCutoverWorkloadDefinition.actors; index++) {
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(executeEncounterCommand, {
          command: {
            type: 'ADVANCE_TURN',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version
          }
        })
      ).projection
    )
    if (!run.currentActorId) throw new Error(`${aggregate} workload lost its current actor.`)
    if (index < encounterCutoverWorkloadDefinition.actors) actorIds.push(run.currentActorId)
  }
  assert.equal(run.currentActorId, actorIds[0])
  assert.equal(new Set(actorIds).size, encounterCutoverWorkloadDefinition.actors)
  const sideBindings = await owner.query(api.encounters.projectionReads.actorSides, {
    encounterId: run.id,
    expectedVersion: run.version
  })
  const partySideId = sideBindings?.sides.find((side) => side.label === 'Party')?.id
  const oppositionSideId = sideBindings?.sides.find((side) => side.label === 'Opposition')?.id
  if (!partySideId || !oppositionSideId || partySideId === oppositionSideId)
    throw new Error(`${aggregate} workload opposing sides are unavailable.`)
  assert.equal(sideBindings.actors.length, actorIds.length)
  assert.ok(sideBindings.actors.every((actor) => actor.sideId === oppositionSideId))
  // Alternate sides and dispositions, and give each actor after the GM's first to its player (V15.3).
  for (const [index, actorId] of actorIds.entries()) {
    const participant = cutoverWorkloadParticipant(index + 1)
    const controllerUserId =
      participant === 'GM' ? null : playerUserIds[Number(participant.slice('PLAYER_'.length)) - 1]
    if (controllerUserId === undefined)
      throw new Error(`${aggregate} workload ${participant} has no user.`)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(executeEncounterCommand, {
          command: {
            type: 'UPDATE_ACTOR',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version,
            actorId,
            // Disposition decides hostility for reactions (D17); sides only order initiative.
            ...(index % 2 === 0
              ? { sideId: partySideId, disposition: 'FRIENDLY' as const }
              : { disposition: 'HOSTILE' as const }),
            ...(controllerUserId ? { controllerUserIds: [controllerUserId] } : {})
          }
        })
      ).projection
    )
  }
  for (const [index, actorId] of actorIds.entries())
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(bindToken, {
          input: {
            type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
            commandId: crypto.randomUUID(),
            encounterId: run.id,
            expectedEncounterVersion: run.version,
            actorId,
            sceneId: scene.liveSceneId,
            tokenId: tokenIds[index]!
          }
        })
      ).projection
    )
  assert.equal(run.currentActorId, actorIds[0])
  const header = await owner.query(api.scenes.liveReads.header, { sceneId: scene.liveSceneId })
  return {
    aggregate,
    gm: owner,
    commits: [],
    actorIds,
    positions,
    tokenIds,
    run,
    sceneId: scene.liveSceneId,
    sceneVersion: header.version,
    presentation
  }
}

async function executeCutoverWorkloadAction(
  aggregate: CutoverWorkloadAggregate,
  players: readonly DevelopmentHttpClient[],
  item: EncounterCutoverWorkItem,
  commandSamples: EncounterCutoverCommandSample[]
) {
  const actorIndex = item.actor - 1
  const actorId = aggregate.actorIds[actorIndex]
  const targetActorId = aggregate.actorIds[(actorIndex + 1) % aggregate.actorIds.length]
  if (!actorId || !targetActorId) throw new Error('V15 workload action actor is unavailable.')
  assert.equal(aggregate.run.currentActorId, actorId)
  const targetBefore = aggregate.run.actors.find((actor) => actor.id === targetActorId)
  if (!targetBefore) throw new Error('V15 workload action target is unavailable.')
  const actor = participantClient(aggregate, players, item.participant)
  await timeCutoverCommand('RESOLVE_ACTION', commandSamples, () =>
    actor.mutation(executeEncounterCommand, {
      command: {
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings: [],
        encounterId: aggregate.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: aggregate.run.version,
        actorId,
        targetActorId,
        actionId: cutoverWorkloadActionId(actorId, item.ordinal === 1 ? 'ACTION' : 'BONUS_ACTION'),
        optionalCombatIntent: null,
        sceneContext: null
      }
    })
  )
  await readWorkloadRun(aggregate, Date.now())
  const targetAfter = aggregate.run.actors.find((candidate) => candidate.id === targetActorId)
  if (!targetAfter) throw new Error('V15 workload action target disappeared.')
  assert.equal(targetAfter.currentHitPoints, targetBefore.currentHitPoints - 1)
}

/** A turn that provokes no reaction: its actor's controller only ends it. */
async function executeCutoverWorkloadEndTurn(
  aggregate: CutoverWorkloadAggregate,
  players: readonly DevelopmentHttpClient[],
  item: EncounterCutoverWorkItem,
  commandSamples: EncounterCutoverCommandSample[]
) {
  const actorId = aggregate.actorIds[item.actor - 1]
  const nextActorId = aggregate.actorIds[item.actor % aggregate.actorIds.length]
  if (!actorId || !nextActorId) throw new Error('V15 workload turn actor is unavailable.')
  assert.equal(aggregate.run.currentActorId, actorId)
  await timeCutoverCommand('ADVANCE_TURN', commandSamples, () =>
    participantClient(aggregate, players, item.participant).mutation(executeEncounterCommand, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: aggregate.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: aggregate.run.version
      }
    })
  )
  await readWorkloadRun(aggregate, Date.now())
  assert.equal(aggregate.run.currentActorId, nextActorId)
}
/**
 * One reaction turn, each command from the member controlling its actor: the mover's bound move
 * through the room, the reactor's response and any dice continuations, then the mover ends the turn.
 */
async function executeCutoverWorkloadReaction(
  aggregate: CutoverWorkloadAggregate,
  players: readonly DevelopmentHttpClient[],
  item: EncounterCutoverWorkItem,
  commandSamples: EncounterCutoverCommandSample[],
  inspectPending?: (pending: { occurrenceId: string }) => Promise<void>,
  observeDurable?: (version: number, submittedAt: number) => Promise<void>
) {
  const actorIndex = item.actor - 1
  const actorId = aggregate.actorIds[actorIndex]
  const reactorIndex = actorIndex + 1
  const reactorActorId = aggregate.actorIds[reactorIndex]
  const nextActorId = aggregate.actorIds[(actorIndex + 1) % aggregate.actorIds.length]
  const origin = aggregate.positions[actorIndex]
  const reactorPosition = aggregate.positions[reactorIndex]
  const tokenId = aggregate.tokenIds[actorIndex]
  if (!actorId || !reactorActorId || !origin || !reactorPosition || !tokenId)
    throw new Error('V15 workload reaction geometry is unavailable.')
  assert.equal(aggregate.run.currentActorId, actorId)
  const moverBefore = aggregate.run.actors.find((actor) => actor.id === actorId)
  if (!moverBefore) throw new Error('V15 workload mover is unavailable.')
  const mover = participantClient(aggregate, players, item.participant)
  const reactor = participantClient(
    aggregate,
    players,
    cutoverWorkloadParticipant(reactorIndex + 1)
  )
  const startedAt = performance.now()
  const priorSceneVersion = aggregate.sceneVersion
  const rootCommandId = crypto.randomUUID()
  // Encounter-bound moves go only through the room on its presented Scene (D42, D43).
  const { result: issued } = await timeCutoverCommand('SCENE_MOVE', commandSamples, () =>
    mover.executeSceneCommand(
      {
        type: 'MOVE_SCENE_TOKEN',
        sceneId: aggregate.sceneId,
        commandId: rootCommandId,
        expectedSceneVersion: aggregate.sceneVersion,
        expectedEncounterVersion: aggregate.run.version,
        correlationId: null,
        movementKind: 'VOLUNTARY',
        tokenId,
        path: [origin, { x: reactorPosition.x + 100, y: reactorPosition.y }, origin]
      },
      { expectedPresentationVersion: aggregate.presentation.version }
    )
  )
  // A mover who cannot see the change gets only the version bump; otherwise its result names the
  // pending decision.
  if (issued) {
    assert.equal(issued.replayed, false)
    assert.equal(issued.occurrence?.status, 'PENDING')
  }
  // The reactor's controller sees the decision as the tabletop reads it.
  const pending = await reactor.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: aggregate.run.id
  })
  if (
    !pending ||
    pending.kind !== 'MOVEMENT_REACTION' ||
    (issued && pending.occurrenceId !== issued.occurrence?.occurrenceId)
  )
    throw new Error('V15 workload movement did not create one reaction occurrence.')
  assert.equal(pending.choice.reactorActorId, reactorActorId)
  assert.equal(pending.choice.reactorTokenId, aggregate.tokenIds[reactorIndex])
  assert.equal(pending.choice.options.length, 1)
  const option = pending.choice.options[0]
  assert.equal(option?.actionId, cutoverWorkloadActionId(reactorActorId, 'REACTION'))
  if (!option) throw new Error('V15 workload reaction option is unavailable.')
  await inspectPending?.(pending)
  let terminalCommandId = crypto.randomUUID()
  let resolved = await timeCutoverCommand('REACTION_RESPONSE', commandSamples, () =>
    reactor.mutation(executeEncounterCommand, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: terminalCommandId,
        encounterId: aggregate.run.id,
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'OPTION', optionId: option.optionId }
      }
    })
  )
  for (let continuations = 0; resolved.occurrence?.status === 'PENDING'; continuations++) {
    assert.ok(continuations < 4, 'V15 workload reaction did not settle.')
    const continuation = resolved.occurrence.pending
    if (!continuation) throw new Error('V15 workload reaction continuation is unavailable.')
    const resolution =
      continuation.kind === 'D20_EVIDENCE'
        ? {
            kind: 'ENTER_DICE' as const,
            requestId: continuation.request.requestId,
            rawFaces:
              continuation.request.rollMode === 'NORMAL'
                ? [continuation.request.max]
                : [continuation.request.max, continuation.request.max],
            rollMode: continuation.request.rollMode
          }
        : continuation.kind === 'ACTION_OUTCOME_EVIDENCE'
          ? {
              kind: 'ENTER_INTEGER' as const,
              requestId: continuation.request.requestId,
              value: continuation.request.max
            }
          : null
    if (!resolution) throw new Error(`V15 workload reaction requested ${continuation.kind}.`)
    terminalCommandId = crypto.randomUUID()
    resolved = await timeCutoverCommand('REACTION_RESPONSE', commandSamples, () =>
      reactor.mutation(executeEncounterCommand, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          commandId: terminalCommandId,
          encounterId: aggregate.run.id,
          expectedVersion: continuation.encounterVersion,
          occurrenceId: continuation.occurrenceId,
          expectedOccurrenceVersion: continuation.occurrenceVersion,
          correlationId: null,
          resolution
        }
      })
    )
  }
  const responseCommittedAt = Date.now()
  assert.equal(resolved.occurrence?.occurrenceId, pending.occurrenceId)
  assert.equal(resolved.occurrence?.status, 'COMPLETE')
  await readWorkloadRun(aggregate, responseCommittedAt)
  const moverAfter = aggregate.run.actors.find((actor) => actor.id === actorId)
  if (!moverAfter) throw new Error('V15 workload mover disappeared.')
  const receipt = await aggregate.gm.query(inspectMovementReactionDamage, {
    campaignId: aggregate.run.campaignId,
    encounterId: aggregate.run.id,
    rootCommandId,
    terminalCommandId
  })
  assert.equal(receipt.occurrenceId, pending.occurrenceId)
  assert.equal(receipt.sourceActorId, reactorActorId)
  assert.equal(receipt.targetActorId, actorId)
  assert.ok(
    receipt.resultPath === 'ON_HIT' ||
      receipt.resultPath === 'ON_MISS' ||
      receipt.resultPath === 'ON_CRIT',
    'V15 reaction used an unauthored result path.'
  )
  const expectedDamage = receipt.resultPath === 'ON_CRIT' ? 2 : 1
  assert.deepEqual(
    receipt.requestedAmounts,
    Array.from({ length: expectedDamage }, () => 1)
  )
  assert.equal(receipt.appliedAmount, expectedDamage)
  assert.equal(receipt.beforeHitPoints, moverBefore.currentHitPoints)
  assert.equal(receipt.afterHitPoints, moverBefore.currentHitPoints - expectedDamage)
  assert.equal(moverAfter.currentHitPoints, receipt.afterHitPoints)
  assert.equal(
    await aggregate.gm.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: aggregate.run.id
    }),
    null,
    'A V15 movement path may create exactly one pending reaction occurrence.'
  )
  aggregate.sceneVersion = (
    await aggregate.gm.query(api.scenes.liveReads.header, { sceneId: aggregate.sceneId })
  ).version
  assert.ok(aggregate.sceneVersion > priorSceneVersion)
  await observeDurable?.(aggregate.sceneVersion, responseCommittedAt)
  // Players end their own actor's turn.
  await timeCutoverCommand('ADVANCE_TURN', commandSamples, () =>
    mover.mutation(executeEncounterCommand, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: aggregate.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: aggregate.run.version
      }
    })
  )
  await readWorkloadRun(aggregate, Date.now())
  assert.equal(aggregate.run.currentActorId, nextActorId)
  return performance.now() - startedAt
}

/**
 * V15.1 checks on the primary aggregate before measuring: a same-version race with one winner and
 * one stale loser, exact replay, a refused turn and a refused player command that leave no trace, a
 * rolled-back transaction, and a reaction decision only its controller can see.
 */
async function verifyCutoverWorkloadPreflight({
  peer,
  aggregate,
  players,
  subscribers,
  rollback
}: {
  peer: DevelopmentHttpClient
  aggregate: CutoverWorkloadAggregate
  players: readonly DevelopmentHttpClient[]
  subscribers: readonly ConvexClient[]
  rollback: (input: { encounterId: string; operation: RollbackOperation }) => Promise<unknown>
}) {
  const owner = aggregate.gm
  const actorId = aggregate.actorIds[0]!
  const targetActorId = aggregate.actorIds[1]!
  const action = (commandId: string) => ({
    command: {
      type: 'RESOLVE_ACTION' as const,
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: aggregate.run.id,
      commandId,
      expectedVersion: aggregate.run.version,
      actorId,
      targetActorId,
      actionId: cutoverWorkloadActionId(actorId, 'ACTION'),
      optionalCombatIntent: null,
      sceneContext: null
    }
  })
  const contenders = [action(crypto.randomUUID()), action(crypto.randomUUID())] as const
  const raced = await Promise.allSettled([
    owner.mutation(executeEncounterCommand, contenders[0]),
    peer.mutation(executeEncounterCommand, contenders[1])
  ])
  assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1)
  const winnerIndex = raced.findIndex((result) => result.status === 'fulfilled')
  const winner = raced[winnerIndex]
  const loser = raced[1 - winnerIndex]
  if (!winner || winner.status !== 'fulfilled' || !loser || loser.status !== 'rejected')
    throw new Error('V15 same-version contention did not produce one winner and one stale loser.')
  assert.match(String(loser.reason), /stale|changed/i)
  aggregate.run = encounterGmProjectionDtoSchema.parse(winner.value.projection)
  const afterWinner = await owner.query(api.encounters.projectionReads.get, {
    encounterId: aggregate.run.id
  })
  const timelineAfterWinner = await owner.query(api.encounters.timelineReads.timeline, {
    encounterId: aggregate.run.id,
    limit: 100
  })
  assert.deepEqual(
    await owner.mutation(executeEncounterCommand, contenders[winnerIndex]!),
    winner.value
  )
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: aggregate.run.id }),
    afterWinner
  )
  assert.deepEqual(
    await owner.query(api.encounters.timelineReads.timeline, {
      encounterId: aggregate.run.id,
      limit: 100
    }),
    timelineAfterWinner
  )
  await assert.rejects(
    owner.mutation(executeEncounterCommand, {
      command: {
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings: [],
        encounterId: aggregate.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: aggregate.run.version,
        actorId: targetActorId,
        targetActorId: actorId,
        actionId: cutoverWorkloadActionId(targetActorId, 'ACTION'),
        optionalCombatIntent: null,
        sceneContext: null
      }
    })
  )
  // A player cannot act for the GM's actor, even on its turn.
  await assert.rejects(
    players[1]!.mutation(executeEncounterCommand, action(crypto.randomUUID())),
    (error) => assertDomainRejection(error, 'NOT_ACTOR_CONTROLLER')
  )
  // A transaction that fails after its writes leaves nothing behind.
  await rollback({
    encounterId: aggregate.run.id,
    operation: {
      kind: 'COMMAND',
      input: {
        command: {
          type: 'SET_INITIATIVE',
          encounterId: aggregate.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: aggregate.run.version,
          actorId: targetActorId,
          initiative: 30
        }
      }
    }
  })
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: aggregate.run.id }),
    afterWinner
  )
  assert.deepEqual(
    await owner.query(api.encounters.timelineReads.timeline, {
      encounterId: aggregate.run.id,
      limit: 100
    }),
    timelineAfterWinner
  )
  await executeCutoverWorkloadReaction(
    aggregate,
    players,
    {
      aggregate: aggregate.aggregate,
      round: 1,
      actor: 1,
      participant: 'GM',
      kind: 'REACTION',
      ordinal: 1
    },
    [],
    async (decision) => {
      // Only the reacting actor's player (the first) sees the decision.
      const pending = await Promise.all(
        subscribers.map((subscriber) =>
          subscriber.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: aggregate.run.id
          })
        )
      )
      assert.equal(pending[0]?.occurrenceId, decision.occurrenceId)
      assert.deepEqual(
        pending.slice(1),
        Array.from({ length: encounterCutoverWorkloadDefinition.players - 1 }, () => null)
      )
    }
  )
  for (let index = 1; index < encounterCutoverWorkloadDefinition.actors; index++)
    aggregate.run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(executeEncounterCommand, {
          command: {
            type: 'ADVANCE_TURN',
            encounterId: aggregate.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: aggregate.run.version
          }
        })
      ).projection
    )
  assert.equal(aggregate.run.currentActorId, actorId)
}

async function subscribeCutoverWorkloadPlayers(
  deploymentUrl: string,
  playerFetchTokens: readonly (() => Promise<string>)[],
  encounterIds: readonly string[]
) {
  assert.equal(playerFetchTokens.length, encounterCutoverWorkloadDefinition.players)
  const clients = playerFetchTokens.map(() => new ConvexClient(deploymentUrl, { logger: false }))
  const unsubscribers: (() => void)[] = []
  // Every Run version each player's subscription delivers, for durable convergence.
  const observations: { encounterId: string; version: number; player: number; at: number }[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const initial = clients.flatMap((client, index) => {
      client.setAuth(playerFetchTokens[index]!)
      return encounterIds.map(
        (encounterId) =>
          new Promise<void>((resolve, reject) => {
            let ready = false
            unsubscribers.push(
              client.onUpdate(
                api.encounters.projectionReads.get,
                { encounterId },
                (run) => {
                  observations.push({
                    encounterId,
                    version: run.version,
                    player: index,
                    at: Date.now()
                  })
                  if (ready) return
                  assert.equal(run.id, encounterId)
                  ready = true
                  resolve()
                },
                reject
              )
            )
          })
      )
    })
    await Promise.race([
      Promise.all(initial),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('V15 player subscriptions did not become ready.')),
          30_000
        )
      })
    ])
    return { clients, unsubscribers, observations }
  } catch (error) {
    for (const unsubscribe of unsubscribers) unsubscribe()
    await Promise.all(clients.map((client) => client.close()))
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Warm durable convergence (V15.2): for each measured commit, the slowest player's first
 * subscription delivery of that Run version or a later one, measured from the commit's
 * acknowledgement. Convex commits before the room acknowledges, so the anchor is at or after the
 * commit; a delivery that beat the acknowledgement counts as a negative duration.
 */
async function measureDurableConvergence(
  aggregates: readonly CutoverWorkloadAggregate[],
  observations: readonly { encounterId: string; version: number; player: number; at: number }[]
) {
  const players = Array.from({ length: encounterCutoverWorkloadDefinition.players }, (_, p) => p)
  const delivered = (encounterId: string, version: number, player: number) =>
    observations.find(
      (entry) =>
        entry.encounterId === encounterId && entry.player === player && entry.version >= version
    )
  const deadline = Date.now() + 15_000
  while (
    aggregates.some((aggregate) =>
      players.some((player) => !delivered(aggregate.run.id, aggregate.run.version, player))
    )
  ) {
    if (Date.now() > deadline)
      throw new Error('V15 players did not receive the final Run versions.')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const rawMs = aggregates.flatMap((aggregate) =>
    aggregate.commits.map((commit) =>
      Math.max(
        ...players.map(
          (player) => delivered(aggregate.run.id, commit.version, player)!.at - commit.committedAt
        )
      )
    )
  )
  const sorted = [...rawMs].sort((left, right) => left - right)
  const rank = (value: number) => sorted[Math.ceil(value * sorted.length) - 1]!
  return {
    samples: sorted.length,
    p50Ms: rank(0.5),
    p95Ms: rank(0.95),
    p99Ms: rank(0.99),
    maximumMs: sorted.at(-1)!,
    rawMs
  }
}
/**
 * The frozen V15 local workload. Every client keeps its Session rooms open like a tabletop tab; the
 * GM and each player act only for the actors they control. Tokens are refreshed each round so rooms
 * re-authenticate across JWT expiry.
 */
export async function verifyEncounterCutoverWorkload({
  gm,
  players,
  deploymentUrl,
  campaignId,
  independentCampaignId,
  initiativePolicyDefinitionId,
  creatureId,
  browserAccounts,
  preflightOnly = false
}: {
  gm: {
    owner: DevelopmentHttpClient
    peer: DevelopmentHttpClient
    userId: string
    fetchToken: () => Promise<string>
  }
  players: readonly {
    client: DevelopmentHttpClient
    userId: string
    fetchToken: () => Promise<string>
  }[]
  deploymentUrl: string
  campaignId: string
  independentCampaignId: string
  initiativePolicyDefinitionId: string
  creatureId: string
  browserAccounts?: {
    owner: { email: string; password: string; username: string }
    players: readonly { email: string; password: string; username: string }[]
    campaignPublicId: string
    evidenceDirectory?: string
  }
  preflightOnly?: boolean
}) {
  const { owner, peer } = gm
  assert.notEqual(owner, peer, 'V15 contention requires independent GM HTTP clients.')
  assert.notEqual(campaignId, independentCampaignId, 'V15 aggregates require distinct Campaigns.')
  assert.equal(players.length, encounterCutoverWorkloadDefinition.players)
  const playerClients = players.map(({ client }) => client)
  const playerUserIds = players.map(({ userId }) => userId)
  const refreshAuth = async () => {
    const token = await gm.fetchToken()
    owner.setAuth(token)
    peer.setAuth(token)
    for (const player of players) player.client.setAuth(await player.fetchToken())
  }
  await refreshAuth()
  // Server-rolled dice for everyone, so every command settles without a roll prompt.
  for (const client of [owner, ...playerClients])
    await client.mutation(api.account.setAutoRollDice, { autoRollDice: true })
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'V15 native workload',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: encounterCutoverWorkloadDefinition.actors }, () => ({
      kind: 'CREATURE' as const,
      sourceId: creatureId
    }))
  })
  const primary = await prepareCutoverWorkloadAggregate({
    owner,
    campaignId,
    initiativePolicyDefinitionId,
    blueprintId: blueprint.id,
    playerUserIds,
    aggregate: 'PRIMARY'
  })
  const independent = await prepareCutoverWorkloadAggregate({
    owner: peer,
    campaignId: independentCampaignId,
    initiativePolicyDefinitionId,
    blueprintId: blueprint.id,
    playerUserIds,
    aggregate: 'INDEPENDENT'
  })
  const subscriptions = await subscribeCutoverWorkloadPlayers(
    deploymentUrl,
    players.map(({ fetchToken }) => fetchToken),
    [primary.run.id, independent.run.id]
  )
  let browser: Awaited<
    ReturnType<
      (typeof import('../../web/tests/live-backend/v15WorkloadBrowser'))['openV15WorkloadBrowser']
    >
  > | null = null
  try {
    await verifyCutoverWorkloadPreflight({
      peer,
      aggregate: primary,
      players: playerClients,
      subscribers: subscriptions.clients,
      rollback: (input) =>
        owner.action(api.encounters.developmentLifecycle.verifyRollback, {
          ...input,
          ownerUserId: gm.userId,
          campaignId
        })
    })
    if (browserAccounts) {
      const { openV15WorkloadBrowser } =
        await import('../../web/tests/live-backend/v15WorkloadBrowser')
      browser = await openV15WorkloadBrowser({
        ...browserAccounts,
        map: workloadMap,
        tokenPosition: primary.positions[0]!
      })
      await browser.preview({ measure: false })
    }
    if (preflightOnly) {
      const commandSamples: EncounterCutoverCommandSample[] = []
      try {
        for (const ordinal of [1, 2] as const)
          await Promise.all(
            [primary, independent].map((aggregate) =>
              executeCutoverWorkloadAction(
                aggregate,
                playerClients,
                {
                  aggregate: aggregate.aggregate,
                  round: 1,
                  actor: 1,
                  participant: 'GM',
                  kind: 'ACTION',
                  ordinal
                },
                commandSamples
              )
            )
          )
        await browser?.preview({ measure: false })
      } finally {
        console.log(`V15 native preflight action diagnostic: ${JSON.stringify({ commandSamples })}`)
      }
      return { preflight: 'passed' as const, browserPreview: browser ? ('passed' as const) : null }
    }
    const aggregates = { PRIMARY: primary, INDEPENDENT: independent }
    // The preflight's commits warmed the path; only the measured schedule counts.
    for (const aggregate of [primary, independent]) aggregate.commits.length = 0
    const firstMeasuredRound = {
      PRIMARY: primary.run.round,
      INDEPENDENT: independent.run.round
    }
    const workload = await measureEncounterCutoverWorkload(async (schedules) => {
      const commandSamples: EncounterCutoverCommandSample[] = []
      const reactionCompositeDurationsMs: number[] = []
      for (let index = 0; index < schedules[0].length; index++) {
        const items = [schedules[0][index], schedules[1][index]] as const
        if (!items[0] || !items[1]) throw new Error('V15 workload schedules diverged.')
        if (items[0].actor === 1 && items[0].kind === 'ACTION' && items[0].ordinal === 1)
          await refreshAuth()
        const preview =
          browser &&
          items[0].kind === 'ACTION' &&
          items[0].ordinal === 1 &&
          [1, 6, 11].includes(items[0].actor)
            ? browser.preview()
            : Promise.resolve()
        const [composites] = await Promise.all([
          Promise.all(
            items.map((item) => {
              const aggregate = aggregates[item.aggregate]
              assert.equal(
                aggregate.run.round,
                firstMeasuredRound[item.aggregate] + item.round - 1,
                `${item.aggregate} workload is in the wrong Run round.`
              )
              return (
                item.kind === 'ACTION'
                  ? executeCutoverWorkloadAction(aggregate, playerClients, item, commandSamples)
                  : item.kind === 'END_TURN'
                    ? executeCutoverWorkloadEndTurn(aggregate, playerClients, item, commandSamples)
                    : executeCutoverWorkloadReaction(
                        aggregate,
                        playerClients,
                        item,
                        commandSamples,
                        undefined,
                        item.aggregate === 'PRIMARY'
                          ? browser?.observeDurable.bind(browser)
                          : undefined
                      )
              ).catch((error: unknown) => {
                throw new Error(`V15 workload item failed: ${JSON.stringify(item)}`, {
                  cause: error
                })
              })
            })
          ),
          preview
        ])
        for (const composite of composites)
          if (composite !== undefined) reactionCompositeDurationsMs.push(composite)
      }
      assert.equal(
        primary.run.round,
        firstMeasuredRound.PRIMARY + encounterCutoverWorkloadDefinition.rounds
      )
      assert.equal(
        independent.run.round,
        firstMeasuredRound.INDEPENDENT + encounterCutoverWorkloadDefinition.rounds
      )
      return { commandSamples, reactionCompositeDurationsMs }
    })
    const durable = await measureDurableConvergence(
      [primary, independent],
      subscriptions.observations
    )
    // Report the measurement before the thresholds judge it, so a missed budget keeps its numbers.
    const composites = [...workload.reactionCompositeDurationsMs].sort(
      (left, right) => left - right
    )
    console.log(
      `V15 workload measurement: ${JSON.stringify({
        commandSamples: workload.commandSamples,
        command: { p50Ms: workload.p50Ms, p95Ms: workload.p95Ms, maximumMs: workload.maximumMs },
        byOperation: Object.fromEntries(
          Object.entries(workload.byOperation).map(([operation, summary]) => [
            operation,
            {
              samples: summary.samples,
              p50Ms: summary.p50Ms,
              p95Ms: summary.p95Ms,
              maximumMs: summary.maximumMs
            }
          ])
        ),
        reactionComposite: {
          samples: composites.length,
          p50Ms: composites[Math.ceil(0.5 * composites.length) - 1],
          p95Ms: composites[Math.ceil(0.95 * composites.length) - 1]
        },
        durable: {
          samples: durable.samples,
          p50Ms: durable.p50Ms,
          p95Ms: durable.p95Ms,
          p99Ms: durable.p99Ms,
          maximumMs: durable.maximumMs
        },
        workloadMaximumMs: workload.workloadMaximumMs
      })}`
    )
    assertEncounterCutoverWorkload(workload)
    assert.ok(
      durable.p95Ms <= encounterCutoverWorkloadDefinition.thresholds.durablePeerConvergenceP95Ms,
      'V15 durable peer convergence p95 exceeded 250 ms.'
    )
    assert.ok(
      durable.p99Ms <= encounterCutoverWorkloadDefinition.thresholds.durablePeerConvergenceP99Ms,
      'V15 durable peer convergence p99 exceeded 500 ms.'
    )
    return {
      ...workload,
      durable,
      browser:
        browser?.summary({
          previewSamples: encounterCutoverWorkloadDefinition.rounds * 3,
          durableSamples: countWorkItems([scheduleEncounterCutoverWorkload()], 'REACTION')
        }) ?? null
    }
  } finally {
    await browser?.close()
    for (const unsubscribe of subscriptions.unsubscribers) unsubscribe()
    await Promise.all(subscriptions.clients.map((client) => client.close()))
    for (const client of [owner, peer, ...playerClients]) client.closeRooms()
  }
}

/**
 * V14.4 on the real backend: the GM and the reacting actor's player answer each step of one
 * movement reaction through the Session room at the same time. Each step has one winner and one
 * stale loser, the reaction is spent once with one mechanics receipt, and retrying the winner, the
 * loser and the root move changes nothing.
 */
export async function verifyEncounterReactionContention({
  gm,
  players,
  campaignId,
  initiativePolicyDefinitionId,
  creatureId
}: {
  gm: {
    owner: DevelopmentHttpClient
    peer: DevelopmentHttpClient
    fetchToken: () => Promise<string>
  }
  players: readonly {
    client: DevelopmentHttpClient
    userId: string
    fetchToken: () => Promise<string>
  }[]
  campaignId: string
  initiativePolicyDefinitionId: string
  creatureId: string
}) {
  const { owner, peer } = gm
  const token = await gm.fetchToken()
  owner.setAuth(token)
  peer.setAuth(token)
  for (const player of players) player.client.setAuth(await player.fetchToken())
  const playerClients = players.map(({ client }) => client)
  try {
    for (const client of [owner, ...playerClients])
      await client.mutation(api.account.setAutoRollDice, { autoRollDice: true })
    const blueprint = await owner.mutation(api.encounters.blueprints.create, {
      gameSystemId: srdSystemRecord.id,
      name: 'V14.4 reaction contention',
      commandId: crypto.randomUUID(),
      enemies: Array.from({ length: encounterCutoverWorkloadDefinition.actors }, () => ({
        kind: 'CREATURE' as const,
        sourceId: creatureId
      }))
    })
    const aggregate = await prepareCutoverWorkloadAggregate({
      owner,
      campaignId,
      initiativePolicyDefinitionId,
      blueprintId: blueprint.id,
      playerUserIds: players.map(({ userId }) => userId),
      aggregate: 'PRIMARY'
    })
    // The GM's actor moves past the next actor, whose reaction the first player controls.
    const [moverId, reactorId] = aggregate.actorIds
    const [origin, reactorPosition] = aggregate.positions
    const reactorPlayer = playerClients[0]
    if (!moverId || !reactorId || !origin || !reactorPosition || !reactorPlayer)
      throw new Error('V14.4 reaction fixture is incomplete.')
    const rivals = [peer, reactorPlayer] as const
    const presentation = { expectedPresentationVersion: aggregate.presentation.version }
    const rootCommand = {
      type: 'MOVE_SCENE_TOKEN' as const,
      sceneId: aggregate.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: aggregate.sceneVersion,
      expectedEncounterVersion: aggregate.run.version,
      correlationId: null,
      movementKind: 'VOLUNTARY' as const,
      tokenId: aggregate.tokenIds[0]!,
      path: [origin, { x: reactorPosition.x + 100, y: reactorPosition.y }, origin]
    }
    const root = await owner.executeSceneCommand(rootCommand, presentation)
    assert.equal(
      root.result?.occurrence?.status,
      'PENDING',
      `The root move raised no reaction: ${JSON.stringify(root.result).slice(0, 1500)}`
    )
    const stored = async () => ({
      run: await owner.query(api.encounters.projectionReads.get, { encounterId: aggregate.run.id }),
      timeline: await owner.query(api.encounters.timelineReads.timeline, {
        encounterId: aggregate.run.id,
        limit: 100
      }),
      pending: await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: aggregate.run.id
      }),
      scene: await owner.query(api.scenes.liveReads.header, { sceneId: aggregate.sceneId })
    })
    const steps: { winner: 'GM' | 'PLAYER'; loser: string }[] = []
    let terminalCommandId: string | null = null
    let pending = (await stored()).pending
    while (pending) {
      const current = pending
      const resolution =
        current.kind === 'MOVEMENT_REACTION' && current.choice.options[0]
          ? { kind: 'OPTION' as const, optionId: current.choice.options[0].optionId }
          : current.kind === 'D20_EVIDENCE'
            ? {
                kind: 'ENTER_DICE' as const,
                requestId: current.request.requestId,
                rawFaces:
                  current.request.rollMode === 'NORMAL'
                    ? [current.request.max]
                    : [current.request.max, current.request.max],
                rollMode: current.request.rollMode
              }
            : current.kind === 'ACTION_OUTCOME_EVIDENCE'
              ? {
                  kind: 'ENTER_INTEGER' as const,
                  requestId: current.request.requestId,
                  value: current.request.max
                }
              : null
      if (!resolution) throw new Error(`V14.4 reaction requested ${current.kind}.`)
      const contenders = rivals.map(() => ({
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE' as const,
          commandId: crypto.randomUUID(),
          encounterId: aggregate.run.id,
          expectedVersion: current.encounterVersion,
          occurrenceId: current.occurrenceId,
          expectedOccurrenceVersion: current.occurrenceVersion,
          correlationId: null,
          resolution
        }
      }))
      const raced = await Promise.allSettled(
        rivals.map((client, index) => client.mutation(executeEncounterCommand, contenders[index]!))
      )
      const winnerIndex = raced.findIndex((result) => result.status === 'fulfilled')
      const winner = raced[winnerIndex]
      const loser = raced[1 - winnerIndex]
      if (winner?.status !== 'fulfilled' || loser?.status !== 'rejected')
        throw new Error('V14.4 reaction response race needs one winner and one stale loser.')
      steps.push({ winner: winnerIndex === 0 ? 'GM' : 'PLAYER', loser: String(loser.reason) })
      console.log(`V14.4 response step: ${JSON.stringify({ kind: current.kind, ...steps.at(-1) })}`)
      terminalCommandId = contenders[winnerIndex]!.command.commandId
      // The winner's retry replays its receipt or is refused as settled; the loser's is refused.
      // Neither changes anything.
      const settled = await stored()
      const [winnerRetry, loserRetry] = await Promise.allSettled([
        rivals[winnerIndex]!.mutation(executeEncounterCommand, contenders[winnerIndex]!),
        rivals[1 - winnerIndex]!.mutation(executeEncounterCommand, contenders[1 - winnerIndex]!)
      ])
      if (winnerRetry?.status === 'fulfilled') assert.deepEqual(winnerRetry.value, winner.value)
      assert.equal(loserRetry?.status, 'rejected', 'A stale loser must stay refused on retry.')
      console.log(
        `V14.4 retries: ${JSON.stringify({ winner: winnerRetry?.status === 'fulfilled' ? 'REPLAYED' : 'REFUSED', loser: 'REFUSED' })}`
      )
      assert.deepEqual(await stored(), settled)
      pending = winner.value.occurrence?.status === 'PENDING' ? settled.pending : null
    }
    const final = await stored()
    if (!terminalCommandId) throw new Error('V14.4 reaction produced no winning response.')
    assert.equal(final.pending, null)
    const reactor = encounterGmProjectionDtoSchema
      .parse(final.run)
      .actors.find((actor) => actor.id === reactorId)
    if (!reactor) throw new Error('V14.4 reactor is unavailable.')
    assert.equal(encounterRuleUsageUsed(reactor, SRD_REACTION_ALLOWANCE_DEFINITION_ID), 1)
    // One mechanics receipt, from the winning terminal response.
    const receipt = await owner.query(inspectMovementReactionDamage, {
      campaignId: aggregate.run.campaignId,
      encounterId: aggregate.run.id,
      rootCommandId: rootCommand.commandId,
      terminalCommandId
    })
    assert.equal(receipt.sourceActorId, reactorId)
    assert.equal(receipt.targetActorId, moverId)
    // The root move's exact retry gets the room's stored receipt back, without a second publication.
    const replay = await owner.executeSceneCommand(
      rootCommand,
      presentation,
      root.expectedSessionSequence
    )
    assert.deepEqual(replay, root)
    assert.deepEqual(await stored(), final)
    const result = { proof: 'V14.4 real-backend reaction response race', status: 'PASS', steps }
    console.log(JSON.stringify(result))
    return result
  } finally {
    for (const client of [owner, peer, ...playerClients]) client.closeRooms()
  }
}
