// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  LiveSessionMovementCommitInput,
  LiveSessionMovementPrepareInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { readCurrentEntities } from '../scenes/currentEntities'
import { readLiveScene } from '../scenes/liveDocuments'
import { prepareNativeLiveMovement } from '../../../session-worker/src/nativeEncounterMovement'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

const workerSecret = 'private-movement-response-worker-secret-at-least-32-bytes'
const authSecret = 'private-movement-response-continuation-secret-at-least-32-bytes'
const environment = workerEnvironment(workerSecret)
type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)
const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('publishes a sealed movement response through the private DO path without replaying its crossed prefix', async () => {
  vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 450, y: 50 }
    ]
  })
  const effect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 275, y: 50 },
    5
  )
  const records = () =>
    value.base.t.run(async (ctx) => ({
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
      commands: await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', value.base.campaign.id))
        .collect(),
      scene: await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', value.sceneId))
        .unique(),
      liveState: await ctx.db
        .query('sceneLiveStates')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', value.sceneId))
        .unique(),
      sceneCommands: await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', value.sceneId))
        .collect()
    }))
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  const initialPreparation = await value.owner.caller.mutation(prepare, value.request)
  expect(initialPreparation.outcome.kind).toBe('PENDING')
  if (initialPreparation.outcome.kind !== 'PENDING')
    throw new Error('Expected movement choice pause.')
  const prefix = initialPreparation.outcome.pendingSnapshot.applicationContext
  if (
    prefix.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    prefix.appliedSpatialPrefix?.status !== 'BATCH_COMPLETE'
  )
    throw new Error('Expected a crossed spatial prefix before the choice.')
  const crossedEffects = prefix.appliedSpatialPrefix.executions.filter(
    (entry) => 'candidate' in entry
  )
  expect(crossedEffects.map((entry) => entry.candidate.candidate.effectId)).toContain(effect.id)
  const initial = await value.owner.caller.mutation(finish, value.request)
  const choice = initial.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected a published movement choice.')
  expect((await records()).effects.map((entry) => entry.id)).not.toContain(effect.id)
  await expect(value.owner.caller.mutation(finish, value.request)).resolves.toMatchObject({
    replayed: true
  })

  const epoch = crypto.randomUUID()
  await value.base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: value.base.campaign.id,
      sessionId: value.base.run.sessionId,
      epoch,
      createdAt: value.base.campaign.createdAt
    })
  )
  const baseline = await records()
  const appliedEffect = crossedEffects.find(
    (entry) => entry.candidate.candidate.effectId === effect.id
  )
  const baselineMover = baseline.actors.find((actor) => actor.id === value.base.mover.id)
  if (!appliedEffect || !baselineMover) throw new Error('Crossed movement effect is unavailable.')
  expect(
    encounterRunActorStateSchema.parse(JSON.parse(baselineMover.stateJson)).currentHitPoints
  ).toBe(appliedEffect.targetTransition.after.currentHitPoints)
  const command: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
  }
  const common = {
    campaignId: value.base.campaign.id,
    sessionId: value.base.run.sessionId,
    authorityEpoch: epoch,
    expectedUserId: value.owner.userId,
    expectedRole: 'OWNER' as const
  }
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  stubLiveSessionFetch((pathname, init) => {
    if (
      ![
        '/live-sessions/encounter-rules',
        '/live-sessions/encounter-movement-begin',
        '/live-sessions/encounter-movement-prepare',
        '/live-sessions/encounter-movement'
      ].includes(pathname)
    )
      throw new Error(`Unexpected private movement response request: ${pathname}`)
    if (
      new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token' ||
      new Headers(init?.headers).get('x-artificer-live-session-secret') !== workerSecret
    )
      throw new Error('Private movement response credentials are missing.')
    return value.owner.caller.fetch(pathname, init)
  })
  const staged = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterMovementBegin',
    {
      ...common,
      command
    }
  )
  if (staged.kind !== 'READY') throw new Error('Expected private response geometry staging.')
  expect(await records()).toEqual(baseline)
  const loadScene = () =>
    value.owner.caller.run(async (ctx): Promise<CampaignSceneState> => {
      const { header } = await readLiveScene(ctx, value.sceneId, 'MEMBER')
      const tokens: CampaignSceneState['tokens'] = []
      let next: { phase: 'BASE' | 'APPENDED'; afterOrdinal: number | null } | null = {
        phase: 'BASE',
        afterOrdinal: null
      }
      while (next) {
        const page = await readCurrentEntities(
          ctx,
          {
            sceneId: header.id,
            expectedVersion: header.version,
            definitionSaveId: header.definitionSaveId,
            collection: 'tokens',
            numItems: 8,
            ...next
          },
          'MEMBER'
        )
        tokens.push(
          ...page.page.flatMap((entry) =>
            entry.value.collection === 'tokens' ? [entry.value.entity] : []
          )
        )
        next = page.next
      }
      if (tokens.length !== header.currentCounts.tokens)
        throw new Error('Incomplete movement Scene.')
      return {
        ...header,
        annotations: [],
        barriers: [],
        darknessZones: [],
        doorStates: {},
        fogLayers: [],
        lights: [],
        measurements: [],
        tokens
      }
    })
  const scene = await loadScene()
  const scope: Omit<LiveSessionEncounterRulesInput, 'request' | 'concentrationResponse'> & {
    movement: NonNullable<LiveSessionEncounterRulesInput['movement']>
  } = {
    ...common,
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    movement: { encounterId: value.base.run.id, saveId: staged.saveId, baseTokenOrdinal: 1 }
  }
  let captureScope = scope
  const runtime = createPlatformRulesRuntime({
    continuationIntegrityKey: await deriveRulesContinuationKey(
      process.env.RULES_CONTINUATION_SECRET
    ),
    definitions: {
      async requireCurrent(definitionId: string) {
        const response = await value.owner.caller.query(capture, {
          ...captureScope,
          request: { kind: 'DEFINITION', definitionId }
        })
        if (response.kind !== 'DEFINITION' || !response.definition)
          throw new Error('Movement definition unavailable.')
        return serverPublishedRuleDefinitionDtoSchema.parse({
          id: response.definition.id,
          gameSystemId: response.definition.gameSystemId,
          definitionFamilyKey: response.definition.definitionFamilyKey,
          checksum: response.definition.checksum,
          definition: response.definition.document
        })
      }
    }
  })
  const occurrenceId = choice.occurrenceId
  const occurredAt = '2026-09-24T00:00:00.000Z'
  const planned = await prepareNativeLiveMovement({
    environment,
    accessToken: 'fixture-access-token',
    scope,
    scene,
    occurrenceId,
    occurredAt,
    runtime,
    random: (maximum) => {
      expect(maximum).toBeGreaterThan(0)
      return 0
    }
  })
  expect(planned.outcome.kind).toBe('PENDING')
  expect(planned.settlementInputs.some((entry) => entry.kind === 'REACTION')).toBe(true)
  expect(planned.settlementInputs.some((entry) => entry.kind === 'SPATIAL')).toBe(false)
  expect(await records()).toEqual(baseline)
  await expect(
    callLiveSessionRoute(environment, 'fixture-access-token', 'encounterMovementBegin', {
      ...common,
      command: { ...command, resolution: { kind: 'DECLINE' } }
    })
  ).rejects.toMatchObject({ status: 409 })
  expect(await records()).toEqual(baseline)
  const preparation: SceneSpatialPreparation = {
    encounterId: value.base.run.id,
    expectedEncounterVersion: choice.encounterVersion,
    occurrenceId,
    occurredAt,
    outcome: planned.outcome
  }
  const stageInput: LiveSessionMovementPrepareInput = {
    ...common,
    movement: scope.movement,
    preparation,
    revisions: planned.revisions(),
    maintenanceOwners: planned.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    )
  }
  await expect(
    callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterMovementPrepare',
      stageInput
    )
  ).resolves.toEqual(preparation)
  expect(await records()).toEqual(baseline)
  await value.owner.caller.mutation(observe, { saveId: staged.saveId, characterRevisions: [] })
  const commitInput: LiveSessionMovementCommitInput = {
    ...stageInput,
    finish: { ...value.request, saveId: staged.saveId },
    rules: planned.rules,
    settlements: planned.settlementInputs
  }
  await expect(
    callLiveSessionRoute(environment, 'fixture-access-token', 'encounterMovementCommit', {
      ...commitInput,
      settlements: [...commitInput.settlements, ...commitInput.settlements]
    })
  ).rejects.toMatchObject({ status: 409 })
  expect(await records()).toEqual(baseline)
  const committed = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterMovementCommit',
    commitInput
  )
  const after = await records()
  expect(committed.replayed).toBe(false)
  expect(committed.delta).toBeNull()
  expect(committed.version).toBe(baseline.liveState?.version ?? 0)
  expect(after.run?.version).toBe(baseline.run!.version + 1)
  expect(after.scene).toEqual(baseline.scene)
  expect(after.liveState).toEqual(baseline.liveState)
  expect(after.effects).toEqual(baseline.effects)
  expect(after.receipts.length).toBeGreaterThan(baseline.receipts.length)
  expect(after.commands.length).toBeGreaterThan(baseline.commands.length)
  expect(after.sceneCommands).toHaveLength(baseline.sceneCommands.length + 1)
  expect(
    await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterMovementCommit',
      commitInput
    )
  ).toEqual({
    ...committed,
    replayed: true
  })
  expect(
    await callLiveSessionRoute(environment, 'fixture-access-token', 'encounterMovementBegin', {
      ...common,
      command
    })
  ).toMatchObject({ kind: 'REPLAY' })
  expect(await records()).toEqual(after)
  const secondChoice = committed.occurrence?.pending
  if (!secondChoice || secondChoice.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected the next issued movement choice.')
  const secondCommand: ResolveRuleOccurrenceInputDto = {
    ...command,
    commandId: crypto.randomUUID(),
    expectedVersion: secondChoice.encounterVersion,
    occurrenceId: secondChoice.occurrenceId,
    expectedOccurrenceVersion: secondChoice.occurrenceVersion,
    resolution: { kind: 'DECLINE' }
  }
  const secondStaged = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterMovementBegin',
    {
      ...common,
      command: secondCommand
    }
  )
  if (secondStaged.kind !== 'READY') throw new Error('Expected second response staging.')
  const secondScope = {
    ...scope,
    expectedVersion: secondChoice.encounterVersion,
    movement: { ...scope.movement, saveId: secondStaged.saveId }
  }
  captureScope = secondScope
  const secondPlanned = await prepareNativeLiveMovement({
    environment,
    accessToken: 'fixture-access-token',
    scope: secondScope,
    scene: await loadScene(),
    occurrenceId: secondChoice.occurrenceId,
    occurredAt,
    runtime,
    random: (maximum) => {
      expect(maximum).toBeGreaterThan(0)
      return 0
    }
  })
  expect(secondPlanned.outcome.kind).toBe('TERMINAL')
  expect(secondPlanned.settlementInputs.some((entry) => entry.kind === 'SPATIAL')).toBe(false)
  expect(await records()).toEqual(after)
  const secondPreparation: SceneSpatialPreparation = {
    encounterId: value.base.run.id,
    expectedEncounterVersion: secondChoice.encounterVersion,
    occurrenceId: secondChoice.occurrenceId,
    occurredAt,
    outcome: secondPlanned.outcome
  }
  const secondStageInput: LiveSessionMovementPrepareInput = {
    ...common,
    movement: secondScope.movement,
    preparation: secondPreparation,
    revisions: secondPlanned.revisions(),
    maintenanceOwners: secondPlanned.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    )
  }
  await expect(
    callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterMovementPrepare',
      secondStageInput
    )
  ).resolves.toEqual(secondPreparation)
  await value.owner.caller.mutation(observe, {
    saveId: secondStaged.saveId,
    characterRevisions: []
  })
  const secondCommitInput: LiveSessionMovementCommitInput = {
    ...secondStageInput,
    finish: { ...value.request, saveId: secondStaged.saveId },
    rules: secondPlanned.rules,
    settlements: secondPlanned.settlementInputs
  }
  const terminal = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterMovementCommit',
    secondCommitInput
  )
  const terminalRecords = await records()
  expect(terminal.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(terminal.delta).toMatchObject({ kind: 'TOKEN_MOVED', tokenId: value.moverTokenId })
  expect(terminalRecords.effects).toEqual(after.effects)
  const moverHitPoints = (actors: typeof after.actors) => {
    const mover = actors.find((actor) => actor.id === value.base.mover.id)
    if (!mover) throw new Error('Movement target actor is unavailable.')
    return encounterRunActorStateSchema.parse(JSON.parse(mover.stateJson)).currentHitPoints
  }
  expect(moverHitPoints(terminalRecords.actors)).toBe(moverHitPoints(after.actors))
  expect(terminalRecords.scene).toEqual(after.scene)
  expect(terminalRecords.liveState?.version).toBe((after.liveState?.version ?? 0) + 1)
  expect(
    await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterMovementCommit',
      secondCommitInput
    )
  ).toEqual({ ...terminal, replayed: true })
  expect(await records()).toEqual(terminalRecords)
}, 120_000)
