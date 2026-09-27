import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import { liveSessionEncounterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  LiveSessionMovementStage,
  LiveSessionMovementStageInput
} from '@artificer-toolkit/schema/api/liveSessionMovementStage'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  LiveSessionCharacterRulesInput,
  LiveSessionCharacterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type {
  SceneGeometryBeginResult,
  SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { readNativeLiveMovementInputs } from '../../../session-worker/src/nativeEncounterMovementInputs'
import {
  createSpatialPreparationFixture,
  grantFixtureActorControl
} from '../../tests/fixtures/spatialPreparation'
import { readBundleAndSeparateCaptures } from '../../tests/fixtures/captureBundleParity'
import { readRunProjection, readRunState } from '../encounters/documents'
import { readCurrentEntities } from '../scenes/currentEntities'
import { readLiveScene } from '../scenes/liveDocuments'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

const secret = 'private-movement-capture-test-secret-at-least-32-bytes'
const environment = workerEnvironment(secret)
const capturePath = '/live-sessions/encounter-rules'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const stage = makeFunctionReference<
  'mutation',
  LiveSessionMovementStageInput,
  LiveSessionMovementStage
>('liveSessions/encounterMovement:stage')
const nativeBegin = makeFunctionReference<
  'mutation',
  SceneGeometryExecuteInput,
  SceneGeometryBeginResult
>('scenes/geometryStaging:begin')
const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')
const characterCapture = makeFunctionReference<
  'query',
  LiveSessionCharacterRulesInput,
  LiveSessionCharacterRulesResponse
>('liveSessions/characterRulesCapture:capture')

async function setup() {
  const { base, input, saveId, tokenId } = await createSpatialPreparationFixture()
  const epoch = crypto.randomUUID()
  const actorIds = base.run.actors.slice(0, 2).map((actor) => actor.id)
  if (actorIds.length !== 2) throw new Error('Missing fixture Encounter actors.')
  await base.t.run(async (ctx) => {
    await insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: base.campaign.createdAt
    })
    for (const [index, actorId] of actorIds.entries())
      await ctx.db.insert('encounterActorTokenBindings', {
        encounterId: base.run.id,
        actorId,
        sceneId: base.sceneId,
        tokenId: base.tokens[index]!.id.toLowerCase()
      })
  })
  const presentation = { expectedPresentationVersion: 0 }

  const command = { ...input, commandId: crypto.randomUUID() }
  const ownerStage: LiveSessionMovementStageInput = {
    campaignId: base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: base.other.userId,
    expectedRole: 'OWNER',
    command,
    presentation,
    characterRevisions: [],
    tokenOrdinals: base.tokens.map((token, baseOrdinal) => ({
      tokenId: token.id.toLowerCase(),
      baseOrdinal
    })),
    maintenanceDefinitionIds: [],
    cachedSystem: null
  }
  const ownerCapture: LiveSessionEncounterRulesInput = {
    campaignId: base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: base.other.userId,
    expectedRole: 'OWNER',
    encounterId: base.run.id,
    expectedVersion: input.expectedEncounterVersion,
    movement: { encounterId: base.run.id, baseTokenOrdinal: 0, subject: { kind: 'SAVE', saveId } },
    request: { kind: 'MOVEMENT_INPUTS' }
  }
  return {
    ...base,
    definitionSaveId: base.saveId,
    epoch,
    actorIds,
    tokenId,
    command,
    presentation,
    ownerStage,
    ownerCapture
  }
}

it('stages owner movement privately and captures its bound raw inputs', async () => {
  const base = await setup()
  await expect(
    base.other.caller.mutation(nativeBegin, {
      input: base.command,
      presentation: base.presentation
    })
  ).rejects.toThrow()
  const staged = await base.other.caller.mutation(stage, base.ownerStage)
  if (staged.kind !== 'STAGED') throw new Error('Expected a receiving geometry save.')
  const scope: LiveSessionEncounterRulesInput = {
    ...base.ownerCapture,
    movement: { ...base.ownerCapture.movement!, subject: { kind: 'SAVE', saveId: staged.saveId } }
  }
  const movement = await base.other.caller.query(capture, scope)
  expect(movement).toMatchObject({
    kind: 'MOVEMENT_INPUTS',
    subject: {
      kind: 'SAVE',
      save: { id: staged.saveId, actorUserId: base.other.userId, status: 'RECEIVING' }
    },
    header: { id: base.sceneId, version: 0 },
    bindings: expect.arrayContaining([
      { actorId: base.actorIds[0], tokenId: base.tokenId },
      { actorId: base.actorIds[1], tokenId: base.tokens[1]!.id.toLowerCase() }
    ])
  })
  if (movement.kind !== 'MOVEMENT_INPUTS') throw new Error('Expected movement inputs.')
  expect(movement.bindings).toHaveLength(2)
  for (const request of [
    { kind: 'INPUTS' as const },
    { kind: 'ACTOR' as const, actorId: base.actorIds[0]! },
    { kind: 'EFFECTS' as const, actorId: base.actorIds[0]!, afterEffectId: null },
    {
      kind: 'SCENE_PERCEPTION' as const,
      observerActorId: base.actorIds[0]!,
      subjectActorId: base.actorIds[1]!
    }
  ])
    await expect(base.other.caller.query(capture, { ...scope, request })).resolves.toMatchObject({
      kind: request.kind
    })
})

it('prepares Worker movement from current private captures and rejects stale room geometry', async () => {
  const base = await setup()
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    const state = { ...readRunState(row), automationMode: 'ASSISTED' as const }
    const projection = { ...readRunProjection(row), automationMode: 'ASSISTED' as const }
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
  })
  const staged = await base.other.caller.mutation(stage, base.ownerStage)
  if (staged.kind !== 'STAGED') throw new Error('Expected a receiving geometry save.')
  const scene = await base.other.caller.run(async (ctx): Promise<CampaignSceneState> => {
    const { header } = await readLiveScene(ctx, base.sceneId, 'MEMBER')
    const page = await readCurrentEntities(
      ctx,
      {
        sceneId: header.id,
        expectedVersion: header.version,
        definitionSaveId: header.definitionSaveId,
        collection: 'tokens',
        numItems: 8,
        phase: 'BASE',
        afterOrdinal: null
      },
      'MEMBER'
    )
    const tokens = page.page.flatMap((entry) =>
      entry.value.collection === 'tokens' ? [entry.value.entity] : []
    )
    if (tokens.length !== header.currentCounts.tokens)
      throw new Error('Fixture Scene tokens are incomplete.')
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
  const requests: string[] = []
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  stubLiveSessionFetch((pathname, init) => {
    if (pathname !== capturePath)
      throw new Error(`Unexpected private movement request: ${pathname}`)
    if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
      throw new Error('Missing private movement bearer token.')
    if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== secret)
      throw new Error('Missing private movement secret.')
    if (typeof init?.body !== 'string') throw new Error('Missing private movement body.')
    const request = liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body)).request
    requests.push(request.kind)
    return base.other.caller.fetch(pathname, init)
  })
  const scope = {
    ...base.ownerCapture,
    movement: { ...base.ownerCapture.movement!, subject: { kind: 'SAVE', saveId: staged.saveId } }
  }
  const runtime = createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(7),
    definitions: {
      async requireCurrent() {
        throw new Error('Fixture movement has no executable reaction graph.')
      }
    }
  })
  const prepare = (roomScene: CampaignSceneState) =>
    readNativeLiveMovementInputs({
      environment,
      accessToken: 'fixture-access-token',
      scope,
      scene: roomScene,
      occurrenceId: crypto.randomUUID(),
      runtime
    })
  const result = await prepare(scene)
  expect(result.targets.size).toBe(base.actorIds.length)
  expect(result.facts?.encounter.actors).toHaveLength(base.actorIds.length)
  expect(result.facts?.activeEffectsByActorId.size).toBe(base.actorIds.length)
  expect(result.actorIdByTokenId.size).toBe(base.actorIds.length)
  await Promise.all([result.capture({ kind: 'INPUTS' }), result.capture({ kind: 'INPUTS' })])
  expect(requests.filter((kind) => kind === 'INPUTS')).toHaveLength(1)
  await expect(prepare({ ...scene, version: scene.version + 1 })).rejects.toThrow(
    'Movement capture binding mismatch.'
  )
  await expect(prepare({ ...scene, tokens: scene.tokens.slice(0, 1) })).rejects.toThrow(
    'Movement Scene geometry is incomplete.'
  )
})

it('allows a controlling player to stage and capture movement, while rejecting another token', async () => {
  const base = await setup()
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', base.definitionSaveId).eq('value.collection', 'tokens').eq('ordinal', 0)
      )
      .unique()
    if (!row || row.value.collection !== 'tokens') throw new Error('Missing fixture token.')
    const value = {
      ...row.value,
      entity: { ...row.value.entity, controlledByUserIds: [base.owner.userId] }
    }
    await ctx.db.patch(row._id, { value, checksum: checksumCanonicalJson(value) })
    // A bound token moves for its actor's controllers; grant the player the first actor.
    await grantFixtureActorControl(ctx, {
      encounterId: base.run.id,
      actorId: base.actorIds[0]!,
      controllerUserIds: [base.owner.userId]
    })
  })
  const playerStage: LiveSessionMovementStageInput = {
    ...base.ownerStage,
    expectedUserId: base.owner.userId,
    expectedRole: 'PLAYER'
  }
  const staged = await base.owner.caller.mutation(stage, playerStage)
  if (staged.kind !== 'STAGED') throw new Error('Expected a receiving geometry save.')
  const scope: LiveSessionEncounterRulesInput = {
    ...base.ownerCapture,
    expectedUserId: base.owner.userId,
    expectedRole: 'PLAYER',
    movement: {
      encounterId: base.run.id,
      baseTokenOrdinal: 0,
      subject: { kind: 'SAVE', saveId: staged.saveId }
    }
  }
  await expect(base.owner.caller.query(capture, scope)).resolves.toMatchObject({
    kind: 'MOVEMENT_INPUTS',
    subject: { kind: 'SAVE', save: { actorUserId: base.owner.userId } }
  })
  await expect(
    base.owner.caller.query(capture, {
      ...scope,
      movement: { ...scope.movement!, baseTokenOrdinal: 1 }
    })
  ).rejects.toThrow()
  // A token bound to an actor the player does not control is refused before anything is staged.
  await expect(
    base.owner.caller.mutation(stage, {
      ...playerStage,
      command: {
        ...base.command,
        commandId: crypto.randomUUID(),
        tokenId: base.tokens[1]!.id,
        path: [base.tokens[1]!.position, { x: 10, y: 0 }]
      }
    })
  ).rejects.toThrow('NOT_ACTOR_CONTROLLER')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', base.definitionSaveId).eq('value.collection', 'tokens').eq('ordinal', 0)
      )
      .unique()
    if (!row || row.value.collection !== 'tokens') throw new Error('Missing fixture token.')
    const value = { ...row.value, entity: { ...row.value.entity, locked: true } }
    await ctx.db.patch(row._id, { value, checksum: checksumCanonicalJson(value) })
  })
  await expect(base.owner.caller.query(capture, scope)).rejects.toThrow('unlocked token')
})

it('rejects a staged movement whose path starts away from the token, staging nothing', async () => {
  const base = await setup()
  const saves = () =>
    base.t.run(async (ctx) => (await ctx.db.query('sceneGeometrySaves').collect()).length)
  const before = await saves()
  // The movement capture the stage reads refuses it, and the begun save rolls back with it (D52).
  await expect(
    base.other.caller.mutation(stage, {
      ...base.ownerStage,
      command: {
        ...base.command,
        path: [
          { x: 1, y: 0 },
          { x: 10, y: 0 }
        ]
      }
    })
  ).rejects.toThrow('position is stale')
  expect(await saves()).toBe(before)
})

it('does not let movement scope read a Character through a custom Encounter actor', async () => {
  const base = await setup()
  const { character } = await base.createCharacter()
  const staged = await base.other.caller.mutation(stage, base.ownerStage)
  if (staged.kind !== 'STAGED') throw new Error('Expected a receiving geometry save.')
  await expect(
    base.other.caller.query(characterCapture, {
      campaignId: base.campaign.id,
      authorityEpoch: base.epoch,
      expectedUserId: base.other.userId,
      expectedRole: 'OWNER',
      characterId: character.id,
      movement: {
        ...base.ownerCapture.movement!,
        subject: { kind: 'SAVE', saveId: staged.saveId },
        actorId: base.actorIds[0]!
      },
      request: { kind: 'INPUTS' }
    })
  ).rejects.toThrow('Movement Character source is unavailable.')
})

it('rejects identity, role, epoch, Encounter, and save ownership mismatches', async () => {
  const base = await setup()
  for (const changed of [
    { expectedUserId: base.owner.userId },
    { expectedRole: 'PLAYER' as const },
    { authorityEpoch: crypto.randomUUID() },
    { campaignId: crypto.randomUUID() }
  ])
    await expect(
      base.other.caller.mutation(stage, { ...base.ownerStage, ...changed })
    ).rejects.toThrow()
  for (const changed of [
    { expectedUserId: base.owner.userId },
    { expectedRole: 'PLAYER' as const },
    { authorityEpoch: crypto.randomUUID() },
    { expectedVersion: base.ownerCapture.expectedVersion + 1 },
    { encounterId: crypto.randomUUID() },
    { movement: { ...base.ownerCapture.movement!, encounterId: crypto.randomUUID() } }
  ])
    await expect(
      base.other.caller.query(capture, { ...base.ownerCapture, ...changed })
    ).rejects.toThrow()
  await expect(
    base.owner.caller.query(capture, {
      ...base.ownerCapture,
      expectedUserId: base.owner.userId,
      expectedRole: 'PLAYER'
    })
  ).rejects.toThrow()
})

it('rejects stale Scene, presentation, and Run snapshots', async () => {
  const base = await setup()
  await expect(
    base.other.caller.mutation(stage, {
      ...base.ownerStage,
      presentation: { expectedPresentationVersion: 1 }
    })
  ).rejects.toThrow()
  await expect(
    base.other.caller.mutation(stage, {
      ...base.ownerStage,
      command: { ...base.command, expectedSceneVersion: 1 }
    })
  ).rejects.toThrow()
  await expect(
    base.other.caller.query(capture, {
      ...base.ownerCapture,
      movement: { ...base.ownerCapture.movement!, baseTokenOrdinal: 1 }
    })
  ).rejects.toThrow()
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    const state = { ...readRunState(row), version: row.version + 1 }
    await ctx.db.patch(row._id, {
      version: state.version,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
  })
  await expect(base.other.caller.query(capture, base.ownerCapture)).rejects.toThrow()
})

it('rejects unbound movement and mixed concentration or turn command scopes', async () => {
  const base = await setup()
  const binding = await base.t.run((ctx) =>
    ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', base.run.id).eq('actorId', base.actorIds[0]!)
      )
      .unique()
  )
  if (!binding) throw new Error('Missing fixture binding.')
  await base.t.run((ctx) => ctx.db.delete(binding._id))
  await expect(base.other.caller.query(capture, base.ownerCapture)).rejects.toThrow()
  await base.t.run((ctx) =>
    ctx.db.insert('encounterActorTokenBindings', {
      encounterId: base.run.id,
      actorId: base.actorIds[0]!,
      sceneId: base.sceneId,
      tokenId: base.tokenId
    })
  )
  const concentrationResponse = {
    type: 'RESOLVE_RULE_OCCURRENCE' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.run.version,
    correlationId: null,
    occurrenceId: crypto.randomUUID(),
    expectedOccurrenceVersion: 0,
    resolution: {
      kind: 'SYSTEM_ROLL' as const,
      requestId: 'movement-scope',
      rollId: crypto.randomUUID()
    }
  }
  await expect(
    base.other.caller.query(capture, { ...base.ownerCapture, concentrationResponse })
  ).rejects.toThrow('cannot be combined')
  await expect(
    base.other.caller.query(capture, {
      ...base.ownerCapture,
      request: {
        kind: 'TURN_COMMAND',
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version
        }
      }
    })
  ).rejects.toThrow('cannot use movement')
})

it('bundles exactly the movement parts the separate captures return, with the System once', async () => {
  const base = await setup()
  const staged = await base.other.caller.mutation(stage, base.ownerStage)
  if (staged.kind !== 'STAGED') throw new Error('Expected a receiving geometry save.')
  const { bundle, separate } = await base.other.caller.run((ctx) =>
    readBundleAndSeparateCaptures(
      ctx,
      {
        ...base.ownerCapture,
        movement: {
          ...base.ownerCapture.movement!,
          subject: { kind: 'SAVE', saveId: staged.saveId }
        }
      },
      base.run.actors
    )
  )
  expect(bundle.encounter[0]).toMatchObject({ kind: 'MOVEMENT_INPUTS' })
  // The admission, the first Scene spatial effect page, each actor and its Concentration slot, and
  // the Run INPUTS.
  expect(bundle.encounter).toHaveLength(3 + 2 * base.run.actors.length)
  expect(bundle.characters).toHaveLength(
    base.run.actors.filter((actor) => actor.kind === 'CHARACTER').length
  )
  expect(bundle).toEqual(separate)
})
