import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference, type FunctionReturnType } from 'convex/server'
import type {
  DevelopmentDocumentSizesInput,
  DevelopmentDocumentSizesPage
} from '@artificer-toolkit/schema/api/developmentCheckpoint'
import {
  encounterGmProjectionDtoSchema,
  type EncounterCommandInputDto
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
  latencySummary,
  measureConvergence,
  PreviewProbe,
  RoomControl,
  RoomWatch,
  type HeldEncounterSession,
  type MeasuredCommit
} from './developmentRoomMeasurement'
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
// Window markers and the document-size read are development functions that `_generated/api.d.ts`
// lists only after the gate's codegen, so they are referenced by name.
const openMeasurementWindow = makeFunctionReference<'mutation', Record<string, never>, null>(
  'liveSessions/developmentMeasurement:openWindow'
)
const closeMeasurementWindow = makeFunctionReference<'mutation', Record<string, never>, null>(
  'liveSessions/developmentMeasurement:closeWindow'
)
const checkpointDocumentSizes = makeFunctionReference<
  'query',
  DevelopmentDocumentSizesInput,
  DevelopmentDocumentSizesPage
>('liveSessions/developmentMeasurement:checkpointDocumentSizes')

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
  const settings = await owner.query(api.campaigns.playSettings.get, {
    campaignId
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null
  })
  const currentPresentation = await owner.query(api.scenes.presentations.get, {
    campaignId
  })
  await owner.action(api.scenes.presentations.setLive, {
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
  const header = await owner.query(api.scenes.recipientReads.header, {
    sceneId: input.sceneId
  })
  let afterEntityId: string | null = null
  for (;;) {
    const tokens: FunctionReturnType<typeof api.scenes.recipientActions.entities> =
      await owner.action(api.scenes.recipientActions.entities, {
        sceneId: input.sceneId,
        expectedRecipientRevision: header.recipientRevision,
        expectedVersion: header.version,
        collection: 'tokens',
        afterEntityId,
        numItems: 8
      })
    const entry = tokens.page.find(({ value }) => value.entity.id === input.tokenId)
    if (entry?.value.collection === 'tokens') return { header, token: entry.value.entity }
    if (tokens.next === null || tokens.page.length === 0)
      throw new Error('Cutover fixture token is absent from the authoritative Scene.')
    afterEntityId = tokens.page.at(-1)!.value.entity.id
  }
}

const MEASURED_SAMPLES = 1

function environmentCount(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`)
  return value
}

export const encounterCutoverWorkloadDefinition = {
  gm: 1,
  players: 5,
  actors: 11,
  rounds: 8,
  actionsPerActorTurn: 2,
  reactionsPerActorTurn: 1,
  // Out-of-combat Scene moves are paced so the window measures a span of table time, not a burst.
  // The pace is an assumption set by the user (V15_OOC_*), not a claim about normal play.
  outOfCombat: {
    stepsPerMinute: environmentCount('V15_OOC_STEPS_PER_MINUTE', 6),
    minutes: environmentCount('V15_OOC_MINUTES', 4)
  },
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
        schedule.push({
          aggregate,
          round,
          actor,
          participant,
          kind: 'ACTION',
          ordinal
        })
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
/** The room meter's cumulative totals per aggregate, as `scripts/v15Budgets.mjs` differences them. */
type RoomMeters = Record<
  EncounterCutoverWorkItem['aggregate'],
  { campaignId: string; meter: unknown }
>

type CutoverWorkloadAggregate = {
  aggregate: EncounterCutoverWorkItem['aggregate']
  campaignId: string
  /** The room meter around this Run's START, the save point its preparation measures. */
  startMeters: { before: RoomMeters; after: RoomMeters }
  /** The GM's client for this aggregate's Campaign; players share one client each across both. */
  gm: DevelopmentHttpClient
  /** The GM's view of the room, joined once START opens it: every later read comes from its frames. */
  gmWatch: RoomWatch
  actorIds: readonly string[]
  positions: readonly { x: number; y: number }[]
  tokenIds: readonly string[]
  run: ReturnType<typeof encounterGmProjectionDtoSchema.parse>
  sceneId: string
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

function workloadToken(
  token: Pick<
    EncounterLifecycleSceneOptions['tokens'][number],
    'id' | 'label' | 'position' | 'controlledByUserIds'
  >
): EncounterLifecycleSceneOptions['tokens'][number] {
  return {
    ...token,
    assetId: null,
    height: 100,
    hidden: false,
    locked: false,
    rotationDegrees: 0,
    vision: null,
    width: 100
  }
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

/**
 * An aggregate played through its room. The room is the authority: every read in a measured window
 * comes from the frames it pushes, never from Convex, which only follows at a checkpoint.
 */
type MeasuredAggregate = CutoverWorkloadAggregate & {
  /** The GM's and each player's view of this aggregate's room, kept from its frames. */
  watches: { gm: RoomWatch; players: readonly RoomWatch[] }
  /** Measured commands, for warm convergence. */
  commits: MeasuredCommit[]
}

function participantWatch(
  aggregate: MeasuredAggregate,
  participant: EncounterCutoverWorkItem['participant']
) {
  if (participant === 'GM') return aggregate.watches.gm
  const watch = aggregate.watches.players[Number(participant.slice('PLAYER_'.length)) - 1]
  if (!watch) throw new Error(`V15 workload ${participant} has no room watch.`)
  return watch
}

/**
 * Sends one Encounter command through the room as `member`, times it, and records it for
 * convergence. The aggregate then adopts the GM's view of the Run the command produced, from the
 * GM's own frames: a player's result carries only that player's projection.
 */
async function sendWorkloadCommand(
  aggregate: MeasuredAggregate,
  member: RoomWatch,
  operation: EncounterCutoverOperation,
  samples: EncounterCutoverCommandSample[],
  command: EncounterCommandInputDto
) {
  const result = await timeCutoverCommand(operation, samples, () =>
    member.client.mutation(executeEncounterCommand, { command })
  )
  aggregate.commits.push({
    commandId: command.commandId,
    initiator: member,
    version: result.projection.version
  })
  aggregate.run = await aggregate.watches.gm.run(result.projection.version)
  return result
}

async function prepareCutoverWorkloadAggregate({
  owner,
  control,
  ownerUserId,
  campaignId,
  initiativePolicyDefinitionId,
  blueprintId,
  playerUserIds,
  aggregate
}: {
  owner: DevelopmentHttpClient
  control: RoomControl
  ownerUserId: string
  campaignId: string
  initiativePolicyDefinitionId: string
  blueprintId: string
  playerUserIds: readonly string[]
  aggregate: EncounterCutoverWorkItem['aggregate']
}): Promise<CutoverWorkloadAggregate> {
  const positions = cutoverWorkloadPositions()
  const tokenIds = positions.map(() => crypto.randomUUID())
  const [first, second, ...rest] = positions.map((position, index) =>
    workloadToken({
      id: tokenIds[index]!,
      label: `${aggregate} workload actor ${index + 1}`,
      position,
      controlledByUserIds: index === 0 ? [...playerUserIds] : []
    })
  )
  if (!first || !second) throw new Error('V15 workload needs at least two tokens.')
  const tokens: EncounterLifecycleSceneOptions['tokens'] = [first, second, ...rest]
  const scene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name: `V15 ${aggregate.toLowerCase()} workload scene`,
    options: { map: workloadMap, grid: workloadGrid, tokens }
  })
  // The workload measures server-rolled turns and reactions: Assisted with the GM's auto-roll on.
  await owner.mutation(api.account.setAutoRollDice, { autoRollDice: true })
  const settings = await owner.query(api.campaigns.playSettings.get, {
    campaignId
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null
  })
  const currentPresentation = await owner.query(api.scenes.presentations.get, {
    campaignId
  })
  await owner.action(api.scenes.presentations.setLive, {
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
  // START is a save point (ADR 0035 Amendment 17): the room checkpoints before it acknowledges, so
  // the window around the command holds that save. It is not strict: opening the room's socket and
  // activating it reach Convex too, and the budget script costs only the checkpoint ingestion.
  const startMetersBefore = await readMeters(control, [{ aggregate, campaignId }])
  await owner.mutation(openMeasurementWindow, {})
  let started = await owner.mutation(executeEncounterCommand, {
    command: {
      type: 'START',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: created.version
    }
  })
  const startMetersAfter = await readMeters(control, [{ aggregate, campaignId }])
  await owner.mutation(closeMeasurementWindow, {})
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
  // START opened the room, which now holds the Run ahead of Convex: read it from the room's frames.
  const gmWatch = await RoomWatch.join(owner, ownerUserId, {
    encounterId: run.id,
    sceneId: scene.liveSceneId
  })
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
  const sideBindings = (await gmWatch.session(run.version)).actorSides
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
  return {
    aggregate,
    campaignId,
    startMeters: { before: startMetersBefore, after: startMetersAfter },
    gm: owner,
    gmWatch,
    actorIds,
    positions,
    tokenIds,
    run,
    sceneId: scene.liveSceneId
  }
}

async function executeCutoverWorkloadAction(
  aggregate: MeasuredAggregate,
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
  await sendWorkloadCommand(
    aggregate,
    participantWatch(aggregate, item.participant),
    'RESOLVE_ACTION',
    commandSamples,
    {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: aggregate.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: aggregate.run.version,
      actorId,
      target: { kind: 'ACTOR', actorId: targetActorId },
      actionId: cutoverWorkloadActionId(actorId, item.ordinal === 1 ? 'ACTION' : 'BONUS_ACTION'),
      optionalCombatIntent: null,
      sceneContext: null
    }
  )
  const targetAfter = aggregate.run.actors.find((candidate) => candidate.id === targetActorId)
  if (!targetAfter) throw new Error('V15 workload action target disappeared.')
  assert.equal(targetAfter.currentHitPoints, targetBefore.currentHitPoints - 1)
}

/** A turn that provokes no reaction: its actor's controller only ends it. */
async function executeCutoverWorkloadEndTurn(
  aggregate: MeasuredAggregate,
  item: EncounterCutoverWorkItem,
  commandSamples: EncounterCutoverCommandSample[]
) {
  const actorId = aggregate.actorIds[item.actor - 1]
  const nextActorId = aggregate.actorIds[item.actor % aggregate.actorIds.length]
  if (!actorId || !nextActorId) throw new Error('V15 workload turn actor is unavailable.')
  assert.equal(aggregate.run.currentActorId, actorId)
  await sendWorkloadCommand(
    aggregate,
    participantWatch(aggregate, item.participant),
    'ADVANCE_TURN',
    commandSamples,
    {
      type: 'ADVANCE_TURN',
      encounterId: aggregate.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: aggregate.run.version
    }
  )
  assert.equal(aggregate.run.currentActorId, nextActorId)
}
/**
 * One reaction turn, each command from the member controlling its actor: the mover's bound move
 * through the room, the reactor's response and any dice continuations, then the mover ends the turn.
 */
async function executeCutoverWorkloadReaction(
  aggregate: MeasuredAggregate,
  item: EncounterCutoverWorkItem,
  commandSamples: EncounterCutoverCommandSample[],
  inspectPending?: (pending: { occurrenceId: string; encounterVersion: number }) => Promise<void>
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
  const mover = participantWatch(aggregate, item.participant)
  const reactor = participantWatch(aggregate, cutoverWorkloadParticipant(reactorIndex + 1))
  const gm = aggregate.watches.gm
  const startedAt = performance.now()
  const priorSceneVersion = gm.scene.version
  const priorRunVersion = aggregate.run.version
  // Encounter-bound moves go only through the room on its presented Scene (D42, D43).
  const { result: issued } = await timeCutoverCommand('SCENE_MOVE', commandSamples, () =>
    mover.client.executeSceneCommand({
      type: 'MOVE_SCENE_TOKEN',
      sceneId: aggregate.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: mover.scene.version,
      expectedEncounterVersion: priorRunVersion,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      tokenId,
      path: [origin, { x: reactorPosition.x + 100, y: reactorPosition.y }, origin]
    })
  )
  // A mover who cannot see the change gets only the version bump; otherwise its result names the
  // pending decision.
  if (issued) {
    assert.equal(issued.replayed, false)
    assert.equal(issued.occurrence?.status, 'PENDING')
  }
  // The reactor's controller sees the decision in its held session, as the tabletop reads it.
  const issuedOccurrenceId = issued?.occurrence?.occurrenceId
  const pending = await reactor
    .pending(
      (candidate) =>
        candidate.kind === 'MOVEMENT_REACTION' &&
        (issuedOccurrenceId
          ? candidate.occurrenceId === issuedOccurrenceId
          : candidate.encounterVersion >= priorRunVersion),
      'the movement reaction decision'
    )
    .catch((error: unknown) => {
      const gmPending = gm.held?.state.pending
      const members = [gm, ...aggregate.watches.players].map(
        (watch) =>
          `${watch.userId.slice(0, 8)} held version ${watch.held?.version ?? 'none'}, last frame at ${Math.round(watch.sessionMarks.at(-1)?.receivedAt ?? 0)} ms, room events [${watch.client.roomEvents(watch.campaignId).join('; ')}]`
      )
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} Mover result ${issued ? `${issued.occurrence?.status ?? 'no occurrence'} at version ${issued.version}` : 'withheld'}; GM sees ${gmPending ? `${gmPending.kind} at Run version ${gmPending.encounterVersion}` : 'no pending'} at session version ${gm.held?.version ?? 'none'}; Run version before the move ${priorRunVersion}. Members: ${members.join(' | ')}.`,
        { cause: error }
      )
    })
  if (pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('V15 workload movement did not create one reaction occurrence.')
  assert.equal(pending.choice.reactorActorId, reactorActorId)
  assert.equal(pending.choice.reactorTokenId, aggregate.tokenIds[reactorIndex])
  assert.equal(pending.choice.options.length, 1)
  const option = pending.choice.options[0]
  assert.equal(option?.actionId, cutoverWorkloadActionId(reactorActorId, 'REACTION'))
  if (!option) throw new Error('V15 workload reaction option is unavailable.')
  await inspectPending?.(pending)
  let resolved = await sendWorkloadCommand(
    aggregate,
    reactor,
    'REACTION_RESPONSE',
    commandSamples,
    {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: aggregate.run.id,
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'OPTION', optionId: option.optionId }
    }
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
    resolved = await sendWorkloadCommand(aggregate, reactor, 'REACTION_RESPONSE', commandSamples, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: aggregate.run.id,
      expectedVersion: continuation.encounterVersion,
      occurrenceId: continuation.occurrenceId,
      expectedOccurrenceVersion: continuation.occurrenceVersion,
      correlationId: null,
      resolution
    })
  }
  assert.equal(resolved.occurrence?.occurrenceId, pending.occurrenceId)
  assert.equal(resolved.occurrence?.status, 'COMPLETE')
  const moverAfter = aggregate.run.actors.find((actor) => actor.id === actorId)
  if (!moverAfter) throw new Error('V15 workload mover disappeared.')
  // The reaction costs the mover one hit point, or two on a critical hit.
  const damage = moverBefore.currentHitPoints - moverAfter.currentHitPoints
  assert.ok(damage === 1 || damage === 2, `V15 reaction dealt ${damage} damage.`)
  assert.equal(
    gm.held?.state.pending ?? null,
    null,
    'A V15 movement path may create exactly one pending reaction occurrence.'
  )
  // The move's Scene change reaches every member's socket; the GM's copy is the table's.
  await gm.until(
    () => (gm.scene.version > priorSceneVersion ? gm.scene.version : null),
    'the committed Scene move'
  )
  // Players end their own actor's turn.
  await sendWorkloadCommand(aggregate, mover, 'ADVANCE_TURN', commandSamples, {
    type: 'ADVANCE_TURN',
    encounterId: aggregate.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: aggregate.run.version
  })
  assert.equal(aggregate.run.currentActorId, nextActorId)
  return performance.now() - startedAt
}

/**
 * Once COMPLETE has saved, Convex holds what the room decided: the completed Run at the room's
 * version, round, turn and every actor's hit points, and the Scene at the room's version. Encounter
 * history stays in the room for the whole Run and COMPLETE deletes it (D88), so nothing else is
 * compared.
 */
async function verifyPublishedAggregate(aggregate: MeasuredAggregate) {
  const { gm: client, watches } = aggregate
  const published = encounterGmProjectionDtoSchema.parse(
    await client.query(api.encounters.projectionReads.get, {
      encounterId: aggregate.run.id
    })
  )
  assert.equal(published.status, 'COMPLETED')
  assert.equal(published.status, aggregate.run.status)
  assert.equal(published.version, aggregate.run.version)
  assert.equal(published.round, aggregate.run.round)
  assert.equal(published.currentActorId, aggregate.run.currentActorId)
  const hitPoints = (run: typeof published) =>
    Object.fromEntries(run.actors.map((actor) => [actor.id, actor.currentHitPoints]))
  assert.deepEqual(hitPoints(published), hitPoints(aggregate.run))
  assert.equal(
    (
      await client.query(api.scenes.liveReads.header, {
        sceneId: aggregate.sceneId
      })
    ).version,
    watches.gm.scene.version
  )
}

/**
 * V15.1 checks on the primary aggregate before measuring: a same-version race with one winner and
 * one stale loser, exact replay, a refused turn and a refused player command that leave no trace,
 * and a reaction decision only its controller can see.
 */
async function verifyCutoverWorkloadPreflight({
  peer,
  aggregate
}: {
  peer: DevelopmentHttpClient
  aggregate: MeasuredAggregate
}) {
  const owner = aggregate.gm
  const { gm, players } = aggregate.watches
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
      target: { kind: 'ACTOR' as const, actorId: targetActorId },
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
  aggregate.run = await gm.run(winner.value.projection.version)
  // The room's held session is the Run the table sees; a refused or replayed command leaves it as is.
  const afterWinner = await gm.session(aggregate.run.version)
  assert.deepEqual(
    await owner.mutation(executeEncounterCommand, contenders[winnerIndex]!),
    winner.value
  )
  assert.deepEqual(gm.held, afterWinner)
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
        target: { kind: 'ACTOR', actorId },
        actionId: cutoverWorkloadActionId(targetActorId, 'ACTION'),
        optionalCombatIntent: null,
        sceneContext: null
      }
    })
  )
  // A player cannot act for the GM's actor, even on its turn.
  await assert.rejects(
    players[1]!.client.mutation(executeEncounterCommand, action(crypto.randomUUID())),
    (error) => assertDomainRejection(error, 'NOT_ACTOR_CONTROLLER')
  )
  assert.deepEqual(gm.held, afterWinner)
  await executeCutoverWorkloadReaction(
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
    async (decision) => {
      // Only the reacting actor's player (the first) sees the decision.
      const [reactor, ...others] = players
      assert.equal(reactor?.held?.state.pending?.occurrenceId, decision.occurrenceId)
      await Promise.all(others.map((other) => other.session(decision.encounterVersion)))
      assert.deepEqual(
        others.map((other) => other.held?.state.pending ?? null),
        others.map(() => null)
      )
    }
  )
  for (let index = 1; index < encounterCutoverWorkloadDefinition.actors; index++)
    await sendWorkloadCommand(aggregate, gm, 'ADVANCE_TURN', [], {
      type: 'ADVANCE_TURN',
      encounterId: aggregate.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: aggregate.run.version
    })
  assert.equal(aggregate.run.currentActorId, actorId)
}

/**
 * Joins each player of one aggregate's Campaign to its room beside the GM's watch, so the measured
 * window reads the room's frames.
 */
async function watchCutoverAggregate(
  aggregate: CutoverWorkloadAggregate,
  players: readonly { client: DevelopmentHttpClient; userId: string }[]
): Promise<MeasuredAggregate> {
  const members = await Promise.all(
    players.map(({ client, userId }) =>
      RoomWatch.join(client, userId, {
        encounterId: aggregate.run.id,
        sceneId: aggregate.sceneId
      })
    )
  )
  // The GM's token bindings synchronized the room's Scene; every watch must hold it.
  await Promise.all([aggregate.gmWatch, ...members].map((watch) => watch.synchronizedScene()))
  return {
    ...aggregate,
    watches: { gm: aggregate.gmWatch, players: members },
    commits: []
  }
}

/** The room's journal and checkpoints for one Campaign, read from its development meter route. */
async function readMeters(
  control: RoomControl,
  aggregates: readonly Pick<CutoverWorkloadAggregate, 'aggregate' | 'campaignId'>[]
) {
  return Object.fromEntries(
    await Promise.all(
      aggregates.map(async ({ aggregate, campaignId }) => [
        aggregate,
        { campaignId, meter: await control.meter(campaignId) }
      ])
    )
  ) as RoomMeters
}

/** Every document one aggregate's checkpoint writes, sized as Convex stores it. */
async function readDocumentSizes(aggregate: MeasuredAggregate) {
  const tables = new Map<string, { documents: number; totalBytes: number; maxBytes: number }>()
  let next: DevelopmentDocumentSizesPage['next'] = {
    position: 0,
    cursor: null
  }
  while (next) {
    const page: DevelopmentDocumentSizesPage = await aggregate.gm.query(checkpointDocumentSizes, {
      encounterId: aggregate.run.id,
      sceneId: aggregate.sceneId,
      ...next
    })
    const row = tables.get(page.table) ?? {
      documents: 0,
      totalBytes: 0,
      maxBytes: 0
    }
    tables.set(page.table, {
      documents: row.documents + page.documents,
      totalBytes: row.totalBytes + page.totalBytes,
      maxBytes: Math.max(row.maxBytes, page.maxBytes)
    })
    next = page.next
  }
  return Object.fromEntries(tables)
}

/**
 * The frozen V15 local workload. Every client keeps its Session rooms open like a tabletop tab; the
 * GM and each player act only for the actors they control. Tokens are refreshed each round so rooms
 * re-authenticate across JWT expiry.
 */
export async function verifyEncounterCutoverWorkload({
  gm,
  players,
  campaignId,
  independentCampaignId,
  initiativePolicyDefinitionId,
  creatureId,
  browserAccounts,
  evidenceDirectory,
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
  campaignId: string
  independentCampaignId: string
  initiativePolicyDefinitionId: string
  creatureId: string
  browserAccounts?: {
    owner: { email: string; password: string; username: string }
    players: readonly { email: string; password: string; username: string }[]
    campaignPublicId: string
  }
  /** Where the room evidence for `scripts/v15Budgets.mjs` is written. */
  evidenceDirectory?: string
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
    owner.setAuth(token, gm.fetchToken)
    peer.setAuth(token, gm.fetchToken)
    for (const player of players)
      player.client.setAuth(await player.fetchToken(), player.fetchToken)
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
  const control = await RoomControl.open(owner)
  const primary = await watchCutoverAggregate(
    await prepareCutoverWorkloadAggregate({
      owner,
      control,
      ownerUserId: gm.userId,
      campaignId,
      initiativePolicyDefinitionId,
      blueprintId: blueprint.id,
      playerUserIds,
      aggregate: 'PRIMARY'
    }),
    players
  )
  const independent = await watchCutoverAggregate(
    await prepareCutoverWorkloadAggregate({
      owner: peer,
      control,
      ownerUserId: gm.userId,
      campaignId: independentCampaignId,
      initiativePolicyDefinitionId,
      blueprintId: blueprint.id,
      playerUserIds,
      aggregate: 'INDEPENDENT'
    }),
    players
  )
  const measuredAggregates = [primary, independent]
  try {
    await verifyCutoverWorkloadPreflight({ peer, aggregate: primary })
    if (preflightOnly) {
      const commandSamples: EncounterCutoverCommandSample[] = []
      try {
        for (const ordinal of [1, 2] as const)
          await Promise.all(
            measuredAggregates.map((aggregate) =>
              executeCutoverWorkloadAction(
                aggregate,
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
      } finally {
        console.log(`V15 native preflight action diagnostic: ${JSON.stringify({ commandSamples })}`)
      }
      return { preflight: 'passed' as const }
    }
    const aggregates = { PRIMARY: primary, INDEPENDENT: independent }
    // The preflight's commits warmed the path; only the measured schedule counts.
    for (const aggregate of measuredAggregates) aggregate.commits.length = 0
    const firstMeasuredRound = {
      PRIMARY: primary.run.round,
      INDEPENDENT: independent.run.round
    }
    // Previews from the GM's socket to its players', alongside the commands: the browsers measure
    // painted previews out of combat; this measures the room's own fan-out while combat runs.
    const probe = new PreviewProbe(
      primary.watches.gm,
      primary.watches.players,
      primary.tokenIds[0]!
    )
    const dragFrom = primary.positions[0]!
    const combatMetersBefore = await readMeters(control, measuredAggregates)
    // Markers in the native Convex log bound the window: nothing between them may be a client call.
    await owner.mutation(openMeasurementWindow, {})
    const combatStartedAt = performance.now()
    const workload = await measureEncounterCutoverWorkload(async (schedules) => {
      const commandSamples: EncounterCutoverCommandSample[] = []
      const reactionCompositeDurationsMs: number[] = []
      for (let index = 0; index < schedules[0].length; index++) {
        const items = [schedules[0][index], schedules[1][index]] as const
        if (!items[0] || !items[1]) throw new Error('V15 workload schedules diverged.')
        if (items[0].actor === 1 && items[0].kind === 'ACTION' && items[0].ordinal === 1)
          await refreshAuth()
        if (
          items[0].kind === 'ACTION' &&
          items[0].ordinal === 1 &&
          [1, 6, 11].includes(items[0].actor)
        )
          await probe.drag([15, 30, 45].map((dx) => ({ x: dragFrom.x + dx, y: dragFrom.y })))
        const composites = await Promise.all(
          items.map((item) => {
            const aggregate = aggregates[item.aggregate]
            assert.equal(
              aggregate.run.round,
              firstMeasuredRound[item.aggregate] + item.round - 1,
              `${item.aggregate} workload is in the wrong Run round.`
            )
            return (
              item.kind === 'ACTION'
                ? executeCutoverWorkloadAction(aggregate, item, commandSamples)
                : item.kind === 'END_TURN'
                  ? executeCutoverWorkloadEndTurn(aggregate, item, commandSamples)
                  : executeCutoverWorkloadReaction(aggregate, item, commandSamples)
            ).catch((error: unknown) => {
              throw new Error(`V15 workload item failed: ${JSON.stringify(item)}`, {
                cause: error
              })
            })
          })
        )
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
    const combatMs = performance.now() - combatStartedAt
    const combatMetersAfter = await readMeters(control, measuredAggregates)
    await owner.mutation(closeMeasurementWindow, {})
    const memberWatches = measuredAggregates.flatMap(({ watches }) => [
      watches.gm,
      ...watches.players
    ])
    // Every member must hold each aggregate's final Run before convergence is read from its frames.
    await Promise.all(
      measuredAggregates.flatMap((aggregate) =>
        [aggregate.watches.gm, ...aggregate.watches.players].map((watch) =>
          watch.session(aggregate.run.version)
        )
      )
    )
    const convergence = measureConvergence(
      measuredAggregates.flatMap(({ commits }) => commits),
      memberWatches
    )
    const previews = probe.latenciesMs.length > 0 ? latencySummary(probe.latenciesMs) : null
    // Durability is Convex's, behind the room's journal. Nothing has saved during combat, so
    // completing each Run is the save window: COMPLETE is a save point and the room checkpoints
    // before it acknowledges (ADR 0035 Amendments 17 and 25), so the window holds one fight's COMPLETE
    // save for each aggregate. Convex must then hold the completed Run and the Scene.
    const saveMetersBefore = await readMeters(control, measuredAggregates)
    await owner.mutation(openMeasurementWindow, {})
    const completions = Object.fromEntries(
      await Promise.all(
        measuredAggregates.map(async (aggregate) => {
          const { client } = aggregate.watches.gm
          // The room may have moved the Run past the last command this driver tracked.
          const expectedVersion = (await aggregate.watches.gm.run(0)).version
          const startedAt = performance.now()
          const { projection } = await client.mutation(executeEncounterCommand, {
            command: {
              type: 'COMPLETE',
              encounterId: aggregate.run.id,
              commandId: crypto.randomUUID(),
              expectedVersion
            }
          })
          const wallMs = performance.now() - startedAt
          aggregate.run = encounterGmProjectionDtoSchema.parse(projection)
          return [aggregate.aggregate, { version: aggregate.run.version, wallMs }] as const
        })
      )
    )
    const saveMetersAfter = await readMeters(control, measuredAggregates)
    await owner.mutation(closeMeasurementWindow, {})
    for (const aggregate of measuredAggregates) await verifyPublishedAggregate(aggregate)
    const documents = Object.fromEntries(
      await Promise.all(
        measuredAggregates.map(
          async (aggregate) => [aggregate.aggregate, await readDocumentSizes(aggregate)] as const
        )
      )
    )
    // Report the measurement before the thresholds judge it, so a missed budget keeps its numbers.
    const composites = [...workload.reactionCompositeDurationsMs].sort(
      (left, right) => left - right
    )
    console.log(
      `V15 workload measurement: ${JSON.stringify({
        commandSamples: workload.commandSamples,
        command: {
          p50Ms: workload.p50Ms,
          p95Ms: workload.p95Ms,
          maximumMs: workload.maximumMs
        },
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
        convergence: {
          session: { ...convergence.session, rawMs: undefined },
          commandCommitted: convergence.commandCommitted && {
            ...convergence.commandCommitted,
            rawMs: undefined
          }
        },
        roomPreviews: previews && {
          ...previews,
          rawMs: undefined,
          dropped: probe.dropped
        },
        workloadMaximumMs: workload.workloadMaximumMs,
        combatWindowMs: combatMs
      })}`
    )
    assertEncounterCutoverWorkload(workload)
    assert.ok(
      convergence.session.p95Ms <=
        encounterCutoverWorkloadDefinition.thresholds.durablePeerConvergenceP95Ms,
      'V15 warm durable peer convergence p95 exceeded 250 ms.'
    )
    assert.ok(
      convergence.session.p99Ms <=
        encounterCutoverWorkloadDefinition.thresholds.durablePeerConvergenceP99Ms,
      'V15 warm durable peer convergence p99 exceeded 500 ms.'
    )
    assert.ok(previews, 'V15 combat previews all dropped before reaching a peer.')
    assert.ok(
      previews.p95Ms <= encounterCutoverWorkloadDefinition.thresholds.peerPreviewP95Ms,
      'V15 room preview p95 exceeded 150 ms.'
    )
    const outOfCombat = await measureOutOfCombat({
      control,
      aggregate: primary,
      refreshAuth,
      browserAccounts,
      evidenceDirectory
    })
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true })
      await writeFile(
        resolve(evidenceDirectory, 'v15-room-evidence.json'),
        JSON.stringify(
          {
            combat: {
              rounds: encounterCutoverWorkloadDefinition.rounds,
              aggregates: measuredAggregates.length,
              durationMs: combatMs,
              meters: { before: combatMetersBefore, after: combatMetersAfter },
              // One START per aggregate, each measured in its own preparation window.
              startMeters: {
                before: { ...primary.startMeters.before, ...independent.startMeters.before },
                after: { ...primary.startMeters.after, ...independent.startMeters.after }
              },
              // One COMPLETE per aggregate, all inside the save window.
              completions,
              saveMeters: { before: saveMetersBefore, after: saveMetersAfter },
              documents,
              convergence,
              roomPreviews: previews && { ...previews, dropped: probe.dropped }
            },
            outOfCombat
          },
          null,
          2
        )
      )
    }
    return { ...workload, convergence, roomPreviews: previews, outOfCombat }
  } finally {
    for (const client of [owner, peer, ...playerClients]) client.closeRooms()
  }
}

/**
 * Paced Scene moves with no Encounter. No timer saves them (ADR 0035 Amendment 25), so unlike combat
 * this window is measured over minutes to show that only authorization lease renewals reach Convex:
 * its pace is an assumption the user sets
 * (`V15_OOC_STEPS_PER_MINUTE`, `V15_OOC_MINUTES`), not a claim about normal play. The members take
 * turns moving the token they control; the six browsers, when given, paint every move and the
 * previews between them.
 */
async function measureOutOfCombat({
  control,
  aggregate,
  refreshAuth,
  browserAccounts,
  evidenceDirectory
}: {
  control: RoomControl
  aggregate: MeasuredAggregate
  /** Re-issues every member's token, so the window outlasts the room's authorization lease. */
  refreshAuth: () => Promise<void>
  browserAccounts?: Parameters<typeof verifyEncounterCutoverWorkload>[0]['browserAccounts']
  evidenceDirectory?: string
}) {
  const { gm, players } = aggregate.watches
  // The save window completed the Run and dropped its Scene bindings, so token moves are plain
  // Scene commits.
  const home = aggregate.positions[0]!
  const away = { x: home.x + 100, y: home.y }
  const tokenId = aggregate.tokenIds[0]!
  const { stepsPerMinute, minutes } = encounterCutoverWorkloadDefinition.outOfCombat
  const steps = stepsPerMinute * minutes
  const intervalMs = 60_000 / stepsPerMinute
  const members = [gm, ...players]
  let browser: Awaited<
    ReturnType<
      (typeof import('../../web/tests/live-backend/v15WorkloadBrowser'))['openV15WorkloadBrowser']
    >
  > | null = null
  try {
    if (browserAccounts) {
      const { openV15WorkloadBrowser } =
        await import('../../web/tests/live-backend/v15WorkloadBrowser')
      browser = await openV15WorkloadBrowser({
        ...browserAccounts,
        evidenceDirectory,
        map: workloadMap,
        tokenPosition: home
      })
    }
    const commandMs: number[] = []
    await refreshAuth()
    const metersBefore = await readMeters(control, [aggregate])
    await gm.client.mutation(openMeasurementWindow, {})
    const startedAt = performance.now()
    for (let step = 0; step < steps; step++) {
      if (step === Math.floor(steps / 2)) await refreshAuth()
      const stepStartedAt = performance.now()
      const mover = members[step % members.length]!
      const outbound = step % 2 === 0
      const commit = await mover.client.executeSceneCommand({
        type: 'MOVE_SCENE_TOKEN',
        sceneId: aggregate.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: mover.scene.version,
        expectedEncounterVersion: null,
        correlationId: null,
        movementKind: 'VOLUNTARY',
        tokenId,
        path: outbound ? [home, away] : [away, home]
      })
      commandMs.push(performance.now() - stepStartedAt)
      const committedAt = Date.now()
      if (browser) {
        await browser.observeDurable(commit.version, committedAt)
        // Back at its home, where the browser drags it.
        if (!outbound) await browser.preview()
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, intervalMs - (performance.now() - stepStartedAt)))
      )
    }
    const durationMs = performance.now() - startedAt
    const metersAfter = await readMeters(control, [aggregate])
    await gm.client.mutation(closeMeasurementWindow, {})
    await Promise.all(
      members.map((member) =>
        member.until(
          () => (member.scene.version >= gm.scene.version ? true : null),
          'the final Scene version'
        )
      )
    )
    const barrier = await control.barrier(gm.campaignId)
    const { header, token } = await readAuthoritativeSceneToken(gm.client, {
      sceneId: aggregate.sceneId,
      tokenId
    })
    assert.equal(header.version, gm.scene.version)
    assert.deepEqual(token.position, steps % 2 === 0 ? home : away)
    return {
      steps,
      stepsPerMinute,
      minutes,
      intervalMs,
      durationMs,
      commandMs: latencySummary(commandMs),
      meters: { before: metersBefore, after: metersAfter },
      barrier,
      browser:
        browser?.summary({
          previewSamples: Math.floor(steps / 2),
          durableSamples: steps
        }) ?? null
    }
  } finally {
    await browser?.close()
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
    userId: string
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
  owner.setAuth(token, gm.fetchToken)
  peer.setAuth(token, gm.fetchToken)
  for (const player of players) player.client.setAuth(await player.fetchToken(), player.fetchToken)
  const playerClients = players.map(({ client }) => client)
  try {
    for (const client of [owner, ...playerClients])
      await client.mutation(api.account.setAutoRollDice, {
        autoRollDice: true
      })
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
      control: await RoomControl.open(owner),
      ownerUserId: gm.userId,
      campaignId,
      initiativePolicyDefinitionId,
      blueprintId: blueprint.id,
      playerUserIds: players.map(({ userId }) => userId),
      aggregate: 'PRIMARY'
    })
    // The GM's actor moves past the next actor, whose reaction the first player controls.
    const [moverId, reactorId] = aggregate.actorIds
    const [origin, reactorPosition] = aggregate.positions
    const moverBefore = aggregate.run.actors.find((actor) => actor.id === moverId)
    const reactorPlayer = playerClients[0]
    if (!moverId || !reactorId || !origin || !reactorPosition || !moverBefore || !reactorPlayer)
      throw new Error('V14.4 reaction fixture is incomplete.')
    const rivals = [peer, reactorPlayer] as const
    // The room holds the live Run ahead of Convex, so every check reads the GM's view of its frames.
    const { gmWatch } = aggregate
    await gmWatch.synchronizedScene()
    const held = () => ({
      session: gmWatch.held,
      sceneVersion: gmWatch.scene.version
    })
    const rootCommand = {
      type: 'MOVE_SCENE_TOKEN' as const,
      sceneId: aggregate.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: gmWatch.scene.version,
      expectedEncounterVersion: aggregate.run.version,
      correlationId: null,
      movementKind: 'VOLUNTARY' as const,
      tokenId: aggregate.tokenIds[0]!,
      path: [origin, { x: reactorPosition.x + 100, y: reactorPosition.y }, origin]
    }
    const root = await owner.executeSceneCommand(rootCommand)
    const rootOccurrence = root.result?.occurrence
    if (rootOccurrence?.status !== 'PENDING')
      throw new Error(
        `The root move raised no reaction: ${JSON.stringify(root.result).slice(0, 1500)}`
      )
    const steps: { winner: 'GM' | 'PLAYER'; loser: string }[] = []
    type HeldPending = NonNullable<HeldEncounterSession['state']['pending']>
    // Races both rivals on one decision and returns the continuation the room holds next, if any.
    const respond = async (current: HeldPending): Promise<HeldPending | null> => {
      const resolution =
        current.kind === 'MOVEMENT_REACTION' && current.choice.options[0]
          ? {
              kind: 'OPTION' as const,
              optionId: current.choice.options[0].optionId
            }
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
      steps.push({
        winner: winnerIndex === 0 ? 'GM' : 'PLAYER',
        loser: String(loser.reason)
      })
      console.log(`V14.4 response step: ${JSON.stringify({ kind: current.kind, ...steps.at(-1) })}`)
      // The winner's retry replays its receipt or is refused as settled; the loser's is refused.
      // Neither changes what the room holds.
      await gmWatch.session(winner.value.projection.version)
      const settled = held()
      const [winnerRetry, loserRetry] = await Promise.allSettled([
        rivals[winnerIndex]!.mutation(executeEncounterCommand, contenders[winnerIndex]!),
        rivals[1 - winnerIndex]!.mutation(executeEncounterCommand, contenders[1 - winnerIndex]!)
      ])
      if (winnerRetry?.status === 'fulfilled') assert.deepEqual(winnerRetry.value, winner.value)
      assert.equal(loserRetry?.status, 'rejected', 'A stale loser must stay refused on retry.')
      console.log(
        `V14.4 retries: ${JSON.stringify({ winner: winnerRetry?.status === 'fulfilled' ? 'REPLAYED' : 'REFUSED', loser: 'REFUSED' })}`
      )
      assert.deepEqual(held(), settled)
      if (winner.value.occurrence?.status !== 'PENDING') return null
      const next = settled.session?.state.pending
      if (!next) throw new Error('V14.4 reaction continuation is missing from the GM view.')
      return next
    }
    let pending: HeldPending | null = await gmWatch.pending(
      (candidate) => candidate.occurrenceId === rootOccurrence.occurrenceId,
      'the root move reaction decision'
    )
    while (pending) pending = await respond(pending)
    const final = held()
    assert.equal(final.session?.state.pending ?? null, null)
    const run = encounterGmProjectionDtoSchema.parse(final.session?.state.encounter)
    const reactor = run.actors.find((actor) => actor.id === reactorId)
    const mover = run.actors.find((actor) => actor.id === moverId)
    if (!reactor || !mover) throw new Error('V14.4 reaction actors are unavailable.')
    // The reaction is spent once and hits once: one hit point, or two on a critical hit.
    assert.equal(encounterRuleUsageUsed(reactor, SRD_REACTION_ALLOWANCE_DEFINITION_ID), 1)
    const damage = moverBefore.currentHitPoints - mover.currentHitPoints
    assert.ok(damage === 1 || damage === 2, `V14.4 reaction dealt ${damage} damage.`)
    // The root move's exact retry gets the room's stored receipt back, marked `replayed`, without a
    // second publication.
    const replay = await owner.executeSceneCommand(rootCommand, root.expectedSessionSequence)
    if (!root.result) throw new Error('V14.4 root move committed without a result.')
    assert.deepEqual(replay, { ...root, result: { ...root.result, replayed: true } })
    assert.deepEqual(held(), final)
    const result = {
      proof: 'V14.4 real-backend reaction response race',
      status: 'PASS',
      steps
    }
    console.log(JSON.stringify(result))
    return result
  } finally {
    for (const client of [owner, peer, ...playerClients]) client.closeRooms()
  }
}
