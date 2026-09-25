import assert from 'node:assert/strict'
import { ConvexClient, type ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import type {
  SceneGeometryCommandResult,
  SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SceneCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { api } from '../convex/_generated/api.js'
import {
  type DevelopmentClient,
  executeEncounterCommand,
  executeEncounterCommandAction
} from './developmentClient'
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
type SceneTokenMovementCommandInputDto = Extract<SceneCommandInputDto, { type: 'MOVE_SCENE_TOKEN' }>
const executeGeometry = makeFunctionReference<
  'action',
  SceneGeometryExecuteInput,
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
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
  const presentation = await owner.mutation(api.scenes.presentations.set, {
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
    unrelatedSceneId: lifecycle.scenes[1].liveSceneId,
    tokenId,
    initiativeOrderResolutions
  }
}

async function readAuthoritativeToken(
  owner: ActionClient,
  fixture: Awaited<ReturnType<typeof prepareEncounterCutoverFixture>>
) {
  return readAuthoritativeSceneToken(owner, { sceneId: fixture.sceneId, tokenId: fixture.tokenId })
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

export async function verifyEncounterCutoverContention({
  owner,
  peer,
  fixture
}: {
  owner: ActionClient
  peer: ActionClient
  fixture: Awaited<ReturnType<typeof prepareEncounterCutoverFixture>>
}) {
  assert.notEqual(owner, peer, 'Cutover contenders require independent HTTP clients.')
  const { header, token } = await readAuthoritativeToken(owner, fixture)
  const input = (commandId: string): SceneTokenMovementCommandInputDto => ({
    type: 'MOVE_SCENE_TOKEN',
    sceneId: fixture.sceneId,
    commandId,
    expectedSceneVersion: header.version,
    expectedEncounterVersion: fixture.run.version,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    tokenId: token.id,
    path: [token.position, { x: token.position.x + token.width, y: token.position.y }]
  })
  const inputs = [input(crypto.randomUUID()), input(crypto.randomUUID())] as const
  const presentation = { expectedPresentationVersion: fixture.presentation.version }
  await assert.rejects(
    owner.action(executeGeometry, { input: input(crypto.randomUUID()) }),
    /Bound Scene movement requires a presentation context\./
  )
  await assert.rejects(
    owner.action(executeGeometry, {
      input: { ...input(crypto.randomUUID()), expectedEncounterVersion: fixture.run.version + 1 },
      presentation
    }),
    /Spatial Encounter scope is stale\./
  )
  assert.deepEqual(
    await owner.query(api.scenes.recipientReads.header, { sceneId: fixture.sceneId }),
    header
  )
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: fixture.run.id }),
    fixture.run
  )
  const contenders = await Promise.allSettled([
    owner.action(executeGeometry, { input: inputs[0], presentation }),
    peer.action(executeGeometry, { input: inputs[1], presentation })
  ])
  assert.equal(
    contenders.filter((result) => result.status === 'fulfilled').length,
    1,
    contenders
      .map((result) => (result.status === 'rejected' ? String(result.reason) : 'fulfilled'))
      .join('\n')
  )
  const winnerIndex = contenders.findIndex((result) => result.status === 'fulfilled')
  const winner = contenders[winnerIndex]
  const loser = contenders[1 - winnerIndex]
  if (!winner || winner.status !== 'fulfilled' || !loser || loser.status !== 'rejected')
    throw new Error('Cutover movement contention did not produce one winner and one stale loser.')
  assert.match(
    String(loser.reason),
    /Scene target changed before this command completed\.|Scene changed before geometry publication\.|Encounter version is stale\.|Spatial Encounter scope is stale\./
  )
  assert.equal(winner.value.replayed, false)
  const afterWinner = await owner.query(api.scenes.liveReads.header, { sceneId: fixture.sceneId })
  assert.equal(afterWinner.version, header.version + 1)
  const runAfterWinner = await owner.query(api.encounters.projectionReads.get, {
    encounterId: fixture.run.id
  })
  assert.deepEqual(runAfterWinner, fixture.run, 'Uninterrupted movement must preserve the Run.')
  const replay = await owner.action(executeGeometry, { input: inputs[winnerIndex]!, presentation })
  assert.deepEqual(replay, { ...winner.value, replayed: true })
  const afterReplay = await owner.query(api.scenes.liveReads.header, { sceneId: fixture.sceneId })
  assert.deepEqual(afterReplay, afterWinner, 'A replay must not append another Scene write.')
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: fixture.run.id }),
    runAfterWinner
  )
  assert.notEqual(fixture.sceneId, fixture.unrelatedSceneId)
  const independentHeaders = await Promise.all([
    owner.query(api.scenes.liveReads.header, { sceneId: fixture.sceneId }),
    peer.query(api.scenes.liveReads.header, { sceneId: fixture.unrelatedSceneId })
  ])
  const independentInputs = independentHeaders.map(
    (
      current
    ): Extract<
      SceneCommandInputDto,
      {
        type: 'SET_SCENE_AMBIENT_ILLUMINATION'
      }
    > => ({
      type: 'SET_SCENE_AMBIENT_ILLUMINATION',
      sceneId: current.id,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: current.version,
      illumination:
        current.ambientIllumination === 'ORDINARY_DARKNESS' ? 'BRIGHT' : 'ORDINARY_DARKNESS'
    })
  )
  const clients = [owner, peer] as const
  const independentResults = await Promise.allSettled(
    clients.map((client, index) =>
      client.mutation(api.scenes.commands.execute, { input: independentInputs[index]! })
    )
  )
  for (const [index, result] of independentResults.entries()) {
    if (result.status !== 'fulfilled')
      throw new Error(`Independent Scene write failed: ${String(result.reason)}`)
    assert.equal(result.value.replayed, false)
    const current = await owner.query(api.scenes.liveReads.header, {
      sceneId: independentHeaders[index]!.id
    })
    assert.equal(current.version, independentHeaders[index]!.version + 1)
    assert.equal(current.ambientIllumination, independentInputs[index]!.illumination)
    assert.deepEqual(
      await clients[index]!.mutation(api.scenes.commands.execute, {
        input: independentInputs[index]!
      }),
      {
        ...result.value,
        replayed: true
      }
    )
    assert.deepEqual(
      await owner.query(api.scenes.liveReads.header, { sceneId: current.id }),
      current
    )
  }
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: fixture.run.id }),
    runAfterWinner
  )
  return winner.value
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
  kind: 'ACTION' | 'REACTION'
  ordinal: number
}

export function scheduleEncounterCutoverWorkload(
  aggregate: EncounterCutoverWorkItem['aggregate'] = 'PRIMARY'
): EncounterCutoverWorkItem[] {
  const schedule: EncounterCutoverWorkItem[] = []
  for (let round = 1; round <= encounterCutoverWorkloadDefinition.rounds; round++)
    for (let actor = 1; actor <= encounterCutoverWorkloadDefinition.actors; actor++) {
      const participant =
        actor === 1
          ? 'GM'
          : (`PLAYER_${((actor - 2) % encounterCutoverWorkloadDefinition.players) + 1}` as const)
      for (
        let ordinal = 1;
        ordinal <= encounterCutoverWorkloadDefinition.actionsPerActorTurn;
        ordinal++
      )
        schedule.push({ aggregate, round, actor, participant, kind: 'ACTION', ordinal })
      for (
        let ordinal = 1;
        ordinal <= encounterCutoverWorkloadDefinition.reactionsPerActorTurn;
        ordinal++
      )
        schedule.push({ aggregate, round, actor, participant, kind: 'REACTION', ordinal })
    }
  return schedule
}

export function assertEncounterCutoverWorkload(workload: EncounterCutoverWorkload) {
  assert.equal(workload.samples, MEASURED_SAMPLES)
  assert.equal(workload.commandsPerSample, scheduleEncounterCutoverWorkload().length)
  assert.equal(
    workload.independentCommandsPerSample,
    scheduleEncounterCutoverWorkload('INDEPENDENT').length
  )
  assert.equal(
    workload.byOperation.RESOLVE_ACTION.samples,
    workload.samples *
      (scheduleEncounterCutoverWorkload().filter((item) => item.kind === 'ACTION').length +
        scheduleEncounterCutoverWorkload('INDEPENDENT').filter((item) => item.kind === 'ACTION')
          .length)
  )
  const reactions =
    workload.samples *
    (scheduleEncounterCutoverWorkload().filter((item) => item.kind === 'REACTION').length +
      scheduleEncounterCutoverWorkload('INDEPENDENT').filter((item) => item.kind === 'REACTION')
        .length)
  assert.equal(workload.byOperation.SCENE_MOVE.samples, reactions)
  assert.equal(workload.byOperation.ADVANCE_TURN.samples, reactions)
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
    const actions = [...schedules[0], ...schedules[1]].filter(
      (item) => item.kind === 'ACTION'
    ).length
    const reactions = schedules[0].length + schedules[1].length - actions
    for (const operation of workloadOperations) {
      const count = measurement.commandSamples.filter(
        (sample) => sample.operation === operation
      ).length
      if (operation === 'RESOLVE_ACTION') assert.equal(count, actions)
      else if (operation === 'REACTION_RESPONSE') assert.ok(count >= reactions)
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

async function prepareCutoverWorkloadAggregate({
  owner,
  campaignId,
  initiativePolicyDefinitionId,
  blueprintId,
  playerUserIds,
  aggregate
}: {
  owner: ActionClient
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
  const presentation = await owner.mutation(api.scenes.presentations.set, {
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
  for (let index = 0; index < actorIds.length; index += 2)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(executeEncounterCommand, {
          command: {
            type: 'UPDATE_ACTOR',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version,
            actorId: actorIds[index]!,
            sideId: partySideId
          }
        })
      ).projection
    )
  await owner.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    encounterId: run.id,
    commandId: crypto.randomUUID()
  })
  run = encounterGmProjectionDtoSchema.parse(
    await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
  )
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
  owner: ActionClient,
  aggregate: CutoverWorkloadAggregate,
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
  const result = await timeCutoverCommand('RESOLVE_ACTION', commandSamples, () =>
    owner.mutation(executeEncounterCommand, {
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
  aggregate.run = encounterGmProjectionDtoSchema.parse(result.projection)
  const targetAfter = aggregate.run.actors.find((actor) => actor.id === targetActorId)
  if (!targetAfter) throw new Error('V15 workload action target disappeared.')
  assert.equal(targetAfter.currentHitPoints, targetBefore.currentHitPoints - 1)
}

async function executeCutoverWorkloadReaction(
  owner: ActionClient,
  aggregate: CutoverWorkloadAggregate,
  item: EncounterCutoverWorkItem,
  commandSamples: EncounterCutoverCommandSample[],
  inspectPending?: (
    pending: NonNullable<NonNullable<SceneGeometryCommandResult['occurrence']>['pending']>
  ) => Promise<void>,
  observeDurable?: (version: number, submittedAt: number) => Promise<void>
) {
  const actorIndex = item.actor - 1
  const actorId = aggregate.actorIds[actorIndex]
  const reactorIndex =
    actorIndex === aggregate.actorIds.length - 1 ? actorIndex - 1 : actorIndex + 1
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
  const startedAt = performance.now()
  const priorSceneVersion = aggregate.sceneVersion
  const rootCommandId = crypto.randomUUID()
  const issued = await timeCutoverCommand('SCENE_MOVE', commandSamples, () =>
    owner.action(executeGeometry, {
      input: {
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
      presentation: { expectedPresentationVersion: aggregate.presentation.version }
    })
  )
  assert.equal(issued.replayed, false)
  assert.equal(issued.occurrence?.status, 'PENDING')
  const pending = issued.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('V15 workload movement did not create one reaction occurrence.')
  assert.equal(pending.choice.reactorActorId, reactorActorId)
  assert.equal(pending.choice.reactorTokenId, aggregate.tokenIds[reactorIndex])
  assert.equal(pending.choice.options.length, 1)
  const option = pending.choice.options[0]
  assert.equal(option?.actionId, cutoverWorkloadActionId(reactorActorId, 'REACTION'))
  if (!option) throw new Error('V15 workload reaction option is unavailable.')
  await inspectPending?.(pending)
  let terminalCommandId = crypto.randomUUID()
  let responseSubmittedAt = Date.now()
  let resolved = await timeCutoverCommand('REACTION_RESPONSE', commandSamples, () =>
    owner.action(executeEncounterCommandAction, {
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
                : [continuation.request.max, continuation.request.max]
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
    responseSubmittedAt = Date.now()
    resolved = await timeCutoverCommand('REACTION_RESPONSE', commandSamples, () =>
      owner.action(executeEncounterCommandAction, {
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
  assert.equal(resolved.occurrence?.occurrenceId, pending.occurrenceId)
  assert.equal(resolved.occurrence?.status, 'COMPLETE')
  aggregate.run = encounterGmProjectionDtoSchema.parse(resolved.projection)
  const moverAfter = aggregate.run.actors.find((actor) => actor.id === actorId)
  if (!moverAfter) throw new Error('V15 workload mover disappeared.')
  const receipt = await owner.query(inspectMovementReactionDamage, {
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
    await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: aggregate.run.id
    }),
    null,
    'A V15 movement path may create exactly one pending reaction occurrence.'
  )
  aggregate.sceneVersion = (
    await owner.query(api.scenes.liveReads.header, { sceneId: aggregate.sceneId })
  ).version
  assert.ok(aggregate.sceneVersion > priorSceneVersion)
  await observeDurable?.(aggregate.sceneVersion, responseSubmittedAt)
  aggregate.run = encounterGmProjectionDtoSchema.parse(
    (
      await timeCutoverCommand('ADVANCE_TURN', commandSamples, () =>
        owner.mutation(executeEncounterCommand, {
          command: {
            type: 'ADVANCE_TURN',
            encounterId: aggregate.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: aggregate.run.version
          }
        })
      )
    ).projection
  )
  assert.equal(aggregate.run.currentActorId, nextActorId)
  return performance.now() - startedAt
}

async function verifyCutoverWorkloadPreflight({
  owner,
  peer,
  aggregate,
  players
}: {
  owner: ActionClient
  peer: ActionClient
  aggregate: CutoverWorkloadAggregate
  players: readonly ConvexClient[]
}) {
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
    owner,
    aggregate,
    {
      aggregate: aggregate.aggregate,
      round: 1,
      actor: 1,
      participant: 'GM',
      kind: 'REACTION',
      ordinal: 1
    },
    [],
    async () => {
      const pending = await Promise.all(
        players.map((player) =>
          player.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: aggregate.run.id
          })
        )
      )
      assert.deepEqual(
        pending,
        Array.from({ length: encounterCutoverWorkloadDefinition.players }, () => null)
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
    return { clients, unsubscribers }
  } catch (error) {
    for (const unsubscribe of unsubscribers) unsubscribe()
    await Promise.all(clients.map((client) => client.close()))
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function verifyEncounterCutoverWorkload({
  owner,
  peer,
  deploymentUrl,
  playerFetchTokens,
  playerUserIds,
  campaignId,
  independentCampaignId,
  initiativePolicyDefinitionId,
  creatureId,
  browserAccounts,
  preflightOnly = false
}: {
  owner: ActionClient
  peer: ActionClient
  deploymentUrl: string
  playerFetchTokens: readonly (() => Promise<string>)[]
  playerUserIds: readonly string[]
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
  assert.notEqual(owner, peer, 'V15 contention requires independent GM HTTP clients.')
  assert.notEqual(campaignId, independentCampaignId, 'V15 aggregates require distinct Campaigns.')
  assert.equal(playerUserIds.length, encounterCutoverWorkloadDefinition.players)
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
    owner,
    campaignId: independentCampaignId,
    initiativePolicyDefinitionId,
    blueprintId: blueprint.id,
    playerUserIds,
    aggregate: 'INDEPENDENT'
  })
  const subscriptions = await subscribeCutoverWorkloadPlayers(deploymentUrl, playerFetchTokens, [
    primary.run.id,
    independent.run.id
  ])
  let browser: Awaited<
    ReturnType<
      (typeof import('../../web/tests/convex/v15WorkloadBrowser'))['openV15WorkloadBrowser']
    >
  > | null = null
  try {
    await verifyCutoverWorkloadPreflight({
      owner,
      peer,
      aggregate: primary,
      players: subscriptions.clients
    })
    if (browserAccounts) {
      const { openV15WorkloadBrowser } = await import('../../web/tests/convex/v15WorkloadBrowser')
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
          await Promise.all([
            executeCutoverWorkloadAction(
              owner,
              primary,
              {
                aggregate: 'PRIMARY',
                round: 1,
                actor: 1,
                participant: 'GM',
                kind: 'ACTION',
                ordinal
              },
              commandSamples
            ),
            executeCutoverWorkloadAction(
              peer,
              independent,
              {
                aggregate: 'INDEPENDENT',
                round: 1,
                actor: 1,
                participant: 'GM',
                kind: 'ACTION',
                ordinal
              },
              commandSamples
            )
          ])
        await browser?.preview({ measure: false })
      } finally {
        console.log(`V15 native preflight action diagnostic: ${JSON.stringify({ commandSamples })}`)
      }
    }
    if (preflightOnly)
      return { preflight: 'passed' as const, browserPreview: browser ? ('passed' as const) : null }
    const aggregates = { PRIMARY: primary, INDEPENDENT: independent }
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
              const client = item.aggregate === 'PRIMARY' ? owner : peer
              return item.kind === 'ACTION'
                ? executeCutoverWorkloadAction(client, aggregate, item, commandSamples)
                : executeCutoverWorkloadReaction(
                    client,
                    aggregate,
                    item,
                    commandSamples,
                    undefined,
                    item.aggregate === 'PRIMARY' ? browser?.observeDurable.bind(browser) : undefined
                  )
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
    assertEncounterCutoverWorkload(workload)
    return {
      ...workload,
      browser:
        browser?.summary({
          previewSamples: encounterCutoverWorkloadDefinition.rounds * 3,
          durableSamples:
            encounterCutoverWorkloadDefinition.rounds * encounterCutoverWorkloadDefinition.actors
        }) ?? null
    }
  } finally {
    await browser?.close()
    for (const unsubscribe of subscriptions.unsubscribers) unsubscribe()
    await Promise.all(subscriptions.clients.map((client) => client.close()))
  }
}
