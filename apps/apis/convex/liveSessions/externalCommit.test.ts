import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryCommandResult,
  SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
  SceneGeometryCommandInputDto,
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { createUniformSceneFogLayer } from '@artificer-toolkit/shared/vtt'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import { LiveCaptureCache } from '../../../session-worker/src/nativeCaptureCache'
import {
  commitExternalSceneCommit,
  prepareExternalSceneCommit,
  type ExternalSceneCommand,
  type ExternalSceneContext
} from '../../../session-worker/src/nativeExternalSceneCommit'
import { createNativeLiveRulesRuntime } from '../../../session-worker/src/nativeRulesRuntime'
import { hydrateNativeTransientScene } from '../../../session-worker/src/nativeSceneClient'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import {
  insertActiveLiveAuthority,
  nextExternalAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const workerSecret = 'external-commit-worker-test-secret-at-least-32-bytes'
const environment = workerEnvironment(workerSecret)
const nativeExecute = makeFunctionReference<
  'action',
  SceneGeometryExecuteInput,
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
const executeGeometry = makeFunctionReference<
  'action',
  { input: SceneGeometryCommandInputDto },
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')

type Caller = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>['owner']['caller']
type Base = Pick<Awaited<ReturnType<typeof setupAutomaticSceneMovement>>['base'], 't' | 'campaign'>

// Two reactors in reach of the move each offer an Assisted Use/Decline choice.
const twoChoices = {
  policies: ['CHOICE', 'CHOICE'] as const,
  reactorPositions: [150, 150] as const,
  path: [
    { x: 150, y: 50 },
    { x: 450, y: 50 }
  ]
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** Routes the room's private calls into convex-test as `member`, recording each command's calls. */
const calls: string[] = []
function routeRoom(member: { caller: Caller }) {
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  stubLiveSessionFetch((pathname, init) => {
    // A rules capture is named by its request kind.
    calls.push(
      pathname === '/live-sessions/encounter-rules'
        ? `${pathname}:${(JSON.parse(String(init?.body)) as { request: { kind: string } }).request.kind}`
        : pathname
    )
    return member.caller.fetch(pathname, init)
  })
}

async function activateRoom(base: Base) {
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: base.campaign.createdAt
    })
  )
  return epoch
}

/** The room's shared Scene cache, read through the same capture and hydration as the room. */
async function roomContext(actor: {
  campaignId: string
  expectedUserId: string
  expectedRole: 'OWNER' | 'PLAYER'
}): Promise<ExternalSceneContext> {
  const capture = await callLiveSessionRoute(environment, 'fixture-access-token', 'capture', {
    campaignId: actor.campaignId,
    expectedUserId: actor.expectedUserId,
    expectedRole: actor.expectedRole,
    mode: 'FULL',
    observedCharacterRevisions: [],
    recipientUserIds: []
  })
  const hydrated = await hydrateNativeTransientScene(environment, 'fixture-access-token', capture)
  if (!hydrated.scene || !capture.presentation) throw new Error('Expected a presented Scene.')
  return {
    scene: hydrated.scene,
    baseOrdinals: hydrated.baseOrdinals,
    characterRevisions: hydrated.characterRevisions,
    presentation: { expectedPresentationVersion: capture.presentation.version }
  }
}

async function persisted(base: Base) {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    return { sequence: row?.persistedSequence, checksum: row?.persistedStateChecksum }
  })
}

async function runRoomCommit(input: {
  base: Base
  member: { caller: Caller; userId: string }
  role: 'OWNER' | 'PLAYER'
  epoch: string
  command: ExternalSceneCommand
  /** The room's System-level capture cache, kept across its commands. */
  captureCache?: LiveCaptureCache
}) {
  const actor = {
    campaignId: input.base.campaign.id,
    authorityEpoch: input.epoch,
    expectedUserId: input.member.userId,
    expectedRole: input.role
  }
  const context = await roomContext(actor)
  calls.length = 0
  const prepared = await prepareExternalSceneCommit({
    environment,
    accessToken: 'fixture-access-token',
    actor,
    command: input.command,
    context,
    runtime: await createNativeLiveRulesRuntime(process.env.RULES_CONTINUATION_SECRET!),
    random: () => 0,
    captures: (input.captureCache ?? new LiveCaptureCache()).reads()
  })
  const authority = await input.base.t.run((ctx) =>
    nextExternalAuthority(ctx, input.base.campaign.id)
  )
  return {
    prepared,
    authority,
    commit: () =>
      commitExternalSceneCommit({
        environment,
        accessToken: 'fixture-access-token',
        actor,
        prepared,
        authority
      })
  }
}

it('runs a bound move, its answer and a GM skip through the room pipeline, advancing the sequence each time (D26, D27)', async () => {
  const value = await setupAutomaticSceneMovement(twoChoices)
  const epoch = await activateRoom(value.base)
  routeRoom(value.owner)
  const captureCache = new LiveCaptureCache()
  const move = { ...value.rootInput, commandId: crypto.randomUUID() }
  const moved = await runRoomCommit({
    base: value.base,
    member: value.owner,
    role: 'OWNER',
    epoch,
    command: move,
    captureCache
  })
  const first = await moved.commit()
  const coldCalls = [...calls]
  expect(first.encounter).toBeNull()
  expect(first.scene).toMatchObject({
    version: moved.prepared.expectedScene.version,
    delta: moved.prepared.expectedScene.delta,
    occurrence: { status: 'PENDING', pending: { kind: 'MOVEMENT_REACTION' } }
  })
  expect(await persisted(value.base)).toEqual({
    sequence: 1,
    checksum: moved.authority.stateChecksum
  })
  // A replay of the published save does not advance the authority again.
  await expect(moved.commit()).resolves.toMatchObject({ scene: { replayed: true } })
  expect(await persisted(value.base)).toMatchObject({ sequence: 1 })

  const choice = first.scene.occurrence?.pending
  if (choice?.kind !== 'MOVEMENT_REACTION') throw new Error('Expected a reaction choice.')
  const answer: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'DECLINE' }
  }
  const answered = await runRoomCommit({
    base: value.base,
    member: value.owner,
    role: 'OWNER',
    epoch,
    command: answer,
    captureCache
  })
  const second = await answered.commit()
  // Measured Convex round trips through the room: the first command also reads each System
  // definition, which the room cache then serves; a warm command takes six.
  const warm = [
    '/live-sessions/encounter-movement-begin',
    '/live-sessions/encounter-movement-observe',
    '/live-sessions/encounter-bundle',
    '/live-sessions/encounter-rules:SCENE_SPATIAL_EFFECTS',
    '/live-sessions/encounter-movement-prepare',
    '/live-sessions/encounter-movement'
  ]
  expect(coldCalls).toEqual([
    ...warm.slice(0, 4),
    ...Array(4).fill('/live-sessions/encounter-rules:DEFINITION'),
    ...warm.slice(4)
  ])
  expect(calls).toEqual(warm)
  // A decision answer advances the room's sequence and returns its Encounter result.
  expect(await persisted(value.base)).toMatchObject({ sequence: 2 })
  expect(second.encounter?.occurrence).toMatchObject({ occurrenceId: choice.occurrenceId })

  const next = second.encounter?.occurrence?.pending
  if (next?.kind !== 'MOVEMENT_REACTION') throw new Error('Expected the second reaction choice.')
  const skip: VoidRuleOccurrenceInputDto = {
    type: 'VOID_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: next.encounterVersion,
    occurrenceId: next.occurrenceId,
    expectedOccurrenceVersion: next.occurrenceVersion
  }
  const skipped = await runRoomCommit({
    base: value.base,
    member: value.owner,
    role: 'OWNER',
    epoch,
    command: skip
  })
  const third: { encounter: EncounterCommandResultDto | null } = await skipped.commit()
  expect(await persisted(value.base)).toMatchObject({ sequence: 3 })
  // The void declined the choice: the move finished and the void is on the timeline.
  expect(third.encounter?.occurrence).toMatchObject({ status: 'COMPLETE' })
  const chat = await value.base.t.run((ctx) =>
    ctx.db
      .query('campaignConversationEntries')
      .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
        q
          .eq('campaignId', value.base.campaign.id)
          .eq('authorUserId', value.owner.userId)
          .eq('clientNonce', skip.commandId)
      )
      .unique()
  )
  const payload = await value.base.t.run((ctx) =>
    ctx.db
      .query('campaignConversationEntryPayloads')
      .withIndex('by_entryId', (q) => q.eq('entryId', chat!.id))
      .unique()
  )
  expect(payload).toMatchObject({ kind: 'CHAT', body: MOVEMENT_DECISION_SKIPPED_MESSAGE })
}, 120_000)

it('publishes the same bound move and Scene through the room as the native path (parity)', async () => {
  // Distinct reactor positions make the first contact geometric, not an identity tie-break.
  const fixture = { ...twoChoices, reactorPositions: [150, 300] as const }
  const room = await setupAutomaticSceneMovement(fixture)
  const native = await setupAutomaticSceneMovement(fixture)
  const epoch = await activateRoom(room.base)
  routeRoom(room.owner)
  const roomResult = (
    await (
      await runRoomCommit({
        base: room.base,
        member: room.owner,
        role: 'OWNER',
        epoch,
        command: { ...room.rootInput, commandId: crypto.randomUUID() }
      })
    ).commit()
  ).scene
  const nativeResult = await native.owner.caller.action(nativeExecute, {
    input: { ...native.rootInput, commandId: crypto.randomUUID() },
    presentation: { expectedPresentationVersion: 0 }
  })
  // Identities differ per fixture; the published move, its version and the decision it opens match.
  const shape = (result: SceneGeometryCommandResult, tokenIds: readonly string[]) => {
    const pending = result.occurrence?.pending
    return {
      version: result.version,
      position: result.delta?.kind === 'TOKEN_MOVED' ? result.delta.position : null,
      status: result.occurrence?.status,
      kind: pending?.kind,
      options:
        pending?.kind === 'MOVEMENT_REACTION'
          ? pending.choice.options.map((option) => ({
              // The action ID starts with the fixture's own actor ID.
              action: option.actionId.slice(option.actionId.indexOf(':')),
              reactor: tokenIds.indexOf(pending.choice.reactorTokenId)
            }))
          : null
    }
  }
  expect(
    shape(
      roomResult,
      room.tokens.map((token) => token.id)
    )
  ).toEqual(
    shape(
      nativeResult,
      native.tokens.map((token) => token.id)
    )
  )
}, 120_000)

it('resolves an unsettled commit as ABANDONED or COMMITTED, and a late commit then fails', async () => {
  const value = await setupAutomaticSceneMovement(twoChoices)
  const epoch = await activateRoom(value.base)
  routeRoom(value.owner)
  const resolve = (input: Awaited<ReturnType<typeof runRoomCommit>>) =>
    callLiveSessionRoute(environment, null, 'externalCommitResolve', {
      campaignId: value.base.campaign.id,
      epoch,
      saveId: input.prepared.saveId,
      expectedSequence: input.authority.sequence - 1,
      expectedStateChecksum: input.authority.expectedStateChecksum,
      nextStateChecksum: input.authority.stateChecksum
    })
  const abandoned = await runRoomCommit({
    base: value.base,
    member: value.owner,
    role: 'OWNER',
    epoch,
    command: { ...value.rootInput, commandId: crypto.randomUUID() }
  })
  await expect(resolve(abandoned)).resolves.toEqual({ outcome: 'ABANDONED' })
  await expect(resolve(abandoned)).resolves.toEqual({ outcome: 'ABANDONED' })
  await expect(abandoned.commit()).rejects.toMatchObject({ status: 409 })
  expect(await persisted(value.base)).toMatchObject({ sequence: 0 })

  const committed = await runRoomCommit({
    base: value.base,
    member: value.owner,
    role: 'OWNER',
    epoch,
    command: { ...value.rootInput, commandId: crypto.randomUUID() }
  })
  await committed.commit()
  await expect(resolve(committed)).resolves.toEqual({ outcome: 'COMMITTED' })
  // A resolve that matches neither outcome fails closed.
  await expect(
    callLiveSessionRoute(environment, null, 'externalCommitResolve', {
      campaignId: value.base.campaign.id,
      epoch,
      saveId: committed.prepared.saveId,
      expectedSequence: 5,
      expectedStateChecksum: committed.authority.expectedStateChecksum,
      nextStateChecksum: committed.authority.stateChecksum
    })
  ).rejects.toMatchObject({ status: 409 })
}, 120_000)

it('refuses private staging with a bad secret, identity or epoch, and a non-controller at begin', async () => {
  const value = await setupAutomaticSceneMovement(twoChoices)
  const epoch = await activateRoom(value.base)
  routeRoom(value.owner)
  const actor = {
    campaignId: value.base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: value.owner.userId,
    expectedRole: 'OWNER' as const
  }
  const begun = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterMovementBegin',
    {
      ...actor,
      command: { ...value.rootInput, commandId: crypto.randomUUID() },
      presentation: { expectedPresentationVersion: 0 }
    }
  )
  if (begun.kind !== 'READY') throw new Error('Expected a receiving room save.')
  expect(begun.encounterId).toBe(value.base.run.id)
  const { scene } = await roomContext(actor)
  const post = (path: string, body: unknown, secret: string | null) =>
    value.owner.caller.fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret === null ? {} : { 'x-artificer-live-session-secret': secret })
      },
      body: JSON.stringify(body)
    })
  const observe = { ...actor, saveId: begun.saveId, characterRevisions: [] }
  const stage = {
    ...actor,
    saveId: begun.saveId,
    layer: createUniformSceneFogLayer(scene, { explored: true, ownerUserId: null })
  }
  for (const [path, body] of [
    ['/live-sessions/encounter-movement-observe', observe],
    ['/live-sessions/encounter-movement-stage-fog', stage]
  ] as const) {
    expect((await post(path, body, null)).status).toBe(401)
    expect((await post(path, body, 'wrong-worker-secret-that-is-long-enough')).status).toBe(401)
    expect(
      (await post(path, { ...body, expectedUserId: value.player.userId }, workerSecret)).status
    ).toBe(409)
    expect(
      (await post(path, { ...body, authorityEpoch: crypto.randomUUID() }, workerSecret)).status
    ).toBe(409)
  }

  // The player controls only the mover; a reactor's token follows its actor's controllers.
  routeRoom(value.player)
  await expect(
    callLiveSessionRoute(environment, 'fixture-access-token', 'encounterMovementBegin', {
      ...actor,
      expectedUserId: value.player.userId,
      expectedRole: 'PLAYER',
      command: {
        ...value.rootInput,
        commandId: crypto.randomUUID(),
        tokenId: value.reactorTokenIds[0]!,
        path: [value.tokens[0]!.position, { x: value.tokens[0]!.position.x, y: 450 }]
      },
      presentation: { expectedPresentationVersion: 0 }
    })
  ).rejects.toMatchObject({ status: 422, rejection: { reason: 'NOT_ACTOR_CONTROLLER' } })
}, 120_000)

it('commits an unbound fog-deriving move under live authority and stages its owner layer', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  const token = {
    assetId: null,
    controlledByUserIds: [base.other.userId],
    height: 1,
    hidden: false,
    id: crypto.randomUUID(),
    label: 'Scout',
    locked: false,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    // A short sight line, so the move explores cells its starting view did not.
    vision: { angleDegrees: 360, brightRange: 0, dimRange: 5, directionDegrees: 0, enabled: true },
    width: 1
  }
  await base.owner.caller.action(executeGeometry, {
    input: {
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      sceneId,
      token,
      type: 'UPSERT_SCENE_TOKEN'
    }
  })
  const epoch = await activateRoom(base)
  routeRoom(base.owner)
  const moved = await runRoomCommit({
    base,
    member: base.owner,
    role: 'OWNER',
    epoch,
    command: {
      type: 'MOVE_SCENE_TOKEN',
      commandId: crypto.randomUUID(),
      sceneId,
      tokenId: token.id,
      expectedSceneVersion: 1,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      path: [token.position, { x: 900, y: 100 }]
    }
  })
  const committed = await moved.commit()
  expect(calls).toEqual([
    '/live-sessions/encounter-movement-begin',
    '/live-sessions/encounter-movement-observe',
    '/live-sessions/encounter-movement-stage-fog',
    '/live-sessions/scene-geometry'
  ])
  expect(moved.prepared.fogChanged).toBe(true)
  expect(committed.scene.fogPatches).toEqual([
    expect.objectContaining({ ownerUserId: base.other.userId, mode: 'REPLACE' })
  ])
  expect(committed.scene).toMatchObject({ version: 2, delta: moved.prepared.expectedScene.delta })
  expect(await persisted(base)).toEqual({ sequence: 1, checksum: moved.authority.stateChecksum })
}, 120_000)
