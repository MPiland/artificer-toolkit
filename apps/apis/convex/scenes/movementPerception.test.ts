import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import type {
  EncounterActorTokenBindingCommandInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneGeometryFinishInputSchema,
  sceneGeometryBeginResultSchema,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  SceneMovementPerceptionCapture,
  sceneSpatialPrepareInputSchema
} from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  resolveSceneCombatPerceptionEnvironment,
  isScenePointExplored
} from '@artificer-toolkit/shared/vtt'
import type { SceneFogChunksPage } from '@artificer-toolkit/schema/api/sceneFog'
import { completeSceneGeometry } from './geometryActions'
import { prepareSceneMovement } from './movementPerceptionAction'
import { readGeometrySave } from './geometryDocuments'
import { api, internal } from '../_generated/api'
import { setupCreatureReactionRun, reactionRecords } from '../../tests/fixtures/movementReaction'
import { readSessionVisionScope } from './sessionVisionDocuments'
import { advanceLiveState, readLiveScene } from './liveDocuments'

type Request = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
const captureReference = makeFunctionReference<'mutation', Request, SceneMovementPerceptionCapture>(
  'scenes/movementPerception:capture'
)
const prepareReference = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneSpatialPreparation
>('scenes/spatialPreparation:prepare')
const actionReference = makeFunctionReference<'action', Request, SceneSpatialPreparation>(
  'scenes/movementPerceptionAction:prepare'
)
const bindActorToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  EncounterCommandResultDto
>('encounters/actorTokenBindings:execute')
const pendingReference = makeFunctionReference<'query', { encounterId: string }, unknown>(
  'encounters/pendingReads:pendingRuleOccurrence'
)
const finishReference = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneGeometryCommandResult
>('scenes/geometryCommands:finish')
const observeReference = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')

async function setup(withVision = false, returnsToOrigin = false) {
  const base = await setupCreatureReactionRun('SEE')
  const now = new Date().toISOString()
  const sceneId = crypto.randomUUID()
  const definitionSaveId = crypto.randomUUID()
  const saveId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const grid = {
    kind: 'SQUARE' as const,
    origin: { x: 0, y: 0 },
    cellSize: 100,
    distancePerCell: 5,
    diagonalPolicy: 'EQUAL' as const,
    unit: 'FEET' as const
  }
  const tokens: SceneDefinitionDto['tokens'] = [50, 150].map((x, index) => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: withVision && index === 1 ? [base.owner.userId] : [],
    width: 100,
    height: 100,
    hidden: false,
    label: index === 0 ? 'Reactor' : 'Mover',
    locked: false,
    position: { x, y: 50 },
    rotationDegrees: 0,
    vision:
      withVision && index === 1
        ? { enabled: true, brightRange: 5, dimRange: 5, angleDegrees: 360, directionDegrees: 0 }
        : null
  }))
  const settings = {
    campaignId: base.campaign.id,
    name: 'Reaction Scene',
    ambientIllumination: 'BRIGHT' as const,
    fogMode: 'PER_PLAYER' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid,
    map: {
      assetId: crypto.randomUUID(),
      width: 1000,
      height: 1000,
      tileManifestAssetId: null
    }
  }
  const counts = {
    annotations: 0,
    barriers: 0,
    darknessZones: 0,
    lights: 0,
    tokens: 2
  }
  await base.t.run(async (ctx) => {
    const materializationCommandId = crypto.randomUUID()
    const definitionId = crypto.randomUUID()
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        ...settings,
        id: sceneId,
        definitionId,
        definitionVersion: 1,
        definitionSaveId,
        version: 0,
        materializationCommandId,
        materializationCommandFingerprint: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: definitionSaveId,
        commandId: materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.owner.userId,
        definitionId,
        expectedVersion: null,
        settings,
        counts,
        received: counts,
        status: 'PUBLISHED',
        liveSceneId: sceneId,
        entitiesRemoved: false,
        createdAt: now,
        expiresAt: Date.now() + 60_000
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId: definitionSaveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: base.campaign.id,
        sessionId: base.run.sessionId,
        sceneId,
        version: 0,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: base.run.id,
      campaignId: base.campaign.id,
      sceneId,
      commandId,
      commandFingerprint: checksumCanonicalJson({ sceneId }),
      createdAt: now
    })
  })
  let version = base.run.version
  for (const [index, actor] of [base.reactor, base.mover].entries()) {
    const result = await base.owner.caller.mutation(bindActorToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id,
        expectedEncounterVersion: version,
        actorId: actor.id,
        sceneId,
        tokenId: tokens[index]!.id
      }
    })
    version = result.projection.version
  }
  const input = {
    sceneId,
    commandId,
    expectedSceneVersion: 0,
    type: 'MOVE_SCENE_TOKEN' as const,
    expectedEncounterVersion: version,
    correlationId: null,
    tokenId: tokens[1]!.id,
    movementKind: 'VOLUNTARY' as const,
    path: [
      { x: 150, y: 50 },
      { x: withVision ? 750 : 350, y: 50 },
      ...(returnsToOrigin ? [{ x: 150, y: 50 }] : [])
    ]
  }
  await base.owner.caller.run(async (ctx) => {
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.sessionId))
      .unique()
    if (!session) throw new Error('Fixture Session missing.')
    const scope = {
      campaignId: base.campaign.id,
      systemId: base.campaign.gameSystemId,
      sceneId,
      expectedSceneVersion: 0,
      sessionId: base.run.sessionId,
      expectedSessionVersion: session.version,
      expectedPresentationVersion: 0
    }
    const { freshness } = await readSessionVisionScope(ctx, scope)
    await ctx.db.insert(
      'sceneGeometrySaves',
      sceneStoredGeometrySaveSchema.parse({
        id: saveId,
        sceneId,
        commandId,
        actorUserId: base.owner.userId,
        input,
        inputChecksum: checksumCanonicalJson(input),
        snapshotVersion: 0,
        sessionVision: { ...scope, freshness },
        status: 'RECEIVING',
        expiresAt: Date.now() + 60_000,
        fogSaves: []
      })
    )
  })
  return {
    base,
    input,
    tokens,
    request: {
      saveId,
      baseOrdinal: 1,
      tokenOrdinals: tokens.map((token, baseOrdinal) => ({ tokenId: token.id, baseOrdinal }))
    }
  }
}

describe('native Scene movement perception staging', () => {
  it('captures retained SEE contacts after moving and completes the response through the geometry action', async () => {
    const { base, request, input } = await setup(true)
    const initialCapture = await base.owner.caller.mutation(captureReference, request)
    const begin = await base.owner.caller.run(async (ctx) => {
      const { save, header } = await readGeometrySave(ctx, request.saveId)
      return sceneGeometryBeginResultSchema.parse({
        kind: 'READY',
        saveId: save.id,
        input: save.input,
        header,
        sessionVision: save.sessionVision
      })
    })
    if (begin.kind !== 'READY') throw new Error('Expected initial movement save.')
    const boundary = await base.owner.caller.action((ctx) => completeSceneGeometry(ctx, begin))
    if (!boundary.occurrence?.pending) throw new Error('Expected current movement choice.')
    expect(boundary.delta).toMatchObject({
      kind: 'TOKEN_MOVED',
      position: { x: 300, y: 50 }
    })
    const response = await base.owner.caller.mutation(
      makeFunctionReference<
        'mutation',
        ResolveRuleOccurrenceInputDto,
        ReturnType<typeof sceneGeometryBeginResultSchema.parse> | null
      >('scenes/movementResolutionStaging:begin'),
      {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id,
        expectedVersion: boundary.occurrence.pending.encounterVersion,
        occurrenceId: boundary.occurrence.occurrenceId,
        expectedOccurrenceVersion: boundary.occurrence.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'DECLINE' }
      }
    )
    if (!response || response.kind !== 'READY') throw new Error('Expected movement response save.')
    const responseRequest = { ...request, saveId: response.saveId }
    const capture = await base.owner.caller.mutation(captureReference, responseRequest)
    expect(capture.sceneVersion).toBe(boundary.version)
    expect(capture.requests).toHaveLength(1)
    expect(capture.requests[0]!.subject.position).toEqual({ x: 300, y: 50 })
    expect(capture.requests[0]!.key).not.toBe(initialCapture.requests[0]!.key)
    const before = await reactionRecords(base.t, base.run.id)
    const prepared = await base.owner.caller.action((ctx) =>
      prepareSceneMovement(ctx, responseRequest)
    )
    expect(prepared.perceptionEnvironments).toHaveLength(1)
    expect(prepared.perceptionEnvironments[0]!.key).toBe(capture.requests[0]!.key)
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    const result = await base.owner.caller.action((ctx) => completeSceneGeometry(ctx, response))
    expect(result).toMatchObject({
      occurrence: { status: 'COMPLETE', pending: null },
      delta: {
        kind: 'TOKEN_MOVED',
        tokenId: input.tokenId,
        position: input.path.at(-1)
      },
      fogPatches: [{ ownerUserId: base.owner.userId, mode: 'REPLACE' }]
    })
  }, 30000)

  it.each([false, true])(
    'derives and publishes fog only through the actual pending contact when the path%s returns to origin',
    async (returnsToOrigin) => {
      const { base, request, input } = await setup(true, returnsToOrigin)
      const before = await reactionRecords(base.t, base.run.id)
      const begin = await base.owner.caller.run(async (ctx) => {
        const { save, header } = await readGeometrySave(ctx, request.saveId)
        return sceneGeometryBeginResultSchema.parse({
          kind: 'READY',
          saveId: save.id,
          input: save.input,
          header,
          sessionVision: save.sessionVision
        })
      })
      if (begin.kind !== 'READY') throw new Error('Expected receiving geometry save.')
      const result = await base.owner.caller.action((ctx) => completeSceneGeometry(ctx, begin))
      expect(result).toMatchObject({
        version: 1,
        delta: { kind: 'TOKEN_MOVED', tokenId: input.tokenId, position: { x: 300, y: 50 } },
        occurrence: { status: 'PENDING' },
        fogPatches: [{ ownerUserId: base.owner.userId, mode: 'REPLACE' }]
      })
      const chunks: SceneFogChunksPage['page'] = []
      let page: SceneFogChunksPage
      let offset = 0
      do {
        page = await base.owner.caller.query(internal.scenes.transientFogReads.chunks, {
          sceneId: input.sceneId,
          ownerUserId: base.owner.userId,
          expectedVersion: result.version,
          offset,
          numItems: 8
        })
        chunks.push(...page.page)
        offset = page.nextOffset
      } while (!page.isDone)
      const layer = {
        ownerUserId: base.owner.userId,
        width: page.width,
        height: page.height,
        chunks
      }
      const explored = { map: begin.header.map, fogLayers: [layer] }
      expect(isScenePointExplored(explored, base.owner.userId, { x: 250, y: 75 })).toBe(true)
      expect(isScenePointExplored(explored, base.owner.userId, { x: 650, y: 75 })).toBe(false)
      const after = await reactionRecords(base.t, base.run.id)
      expect(after.run).toEqual(before.run)
      expect(after.actors).toEqual(before.actors)
      expect(await base.owner.caller.mutation(finishReference, request)).toEqual({
        ...result,
        replayed: true
      })
      expect(await reactionRecords(base.t, base.run.id)).toEqual(after)
    },
    30000
  )

  it('publishes the actual boundary and pending receipt atomically, rechecks evidence and replays exactly', async () => {
    const { base, request, input, tokens } = await setup()
    await base.owner.caller.mutation(observeReference, {
      saveId: request.saveId,
      characterRevisions: []
    })
    const capture = await base.owner.caller.mutation(captureReference, request)
    const perceptionEnvironments = capture.requests.map(({ key, observer, subject }) => ({
      key,
      environment: {
        ...resolveSceneCombatPerceptionEnvironment({
          scene: {
            ...capture.header,
            grid: capture.grid,
            barriers: [],
            lights: [],
            darknessZones: [],
            doorStates: {}
          },
          observer,
          subject,
          sharedSurface: true,
          invisibleChannels: [],
          suppressedChannels: []
        }),
        invisibleChannels: [],
        suppressedChannels: []
      }
    }))
    const prepared = await base.owner.caller.action(actionReference, request)
    if (prepared.outcome.kind !== 'PENDING') throw new Error('Expected reaction choice.')
    const beforeMechanics = await reactionRecords(base.t, base.run.id)
    const records = () =>
      base.t.run(async (ctx) => ({
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        commands: await ctx.db.query('sceneLiveCommands').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        states: await ctx.db.query('sceneLiveStates').collect()
      }))
    const before = await records()
    await expect(base.owner.caller.mutation(finishReference, request)).rejects.toThrow(
      'missing or stale'
    )
    expect(await records()).toEqual(before)
    const reactor = beforeMechanics.actors.find((row) => row.id === base.reactor.id)!
    const actor = encounterRunActorStateSchema.parse(JSON.parse(reactor.stateJson))
    const exhausted = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withEncounterRuleUsageUsed(actor, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 1)
    })
    await base.t.run((ctx) =>
      ctx.db.patch(reactor._id, {
        stateJson: JSON.stringify(exhausted),
        stateChecksum: checksumCanonicalJson(exhausted)
      })
    )
    await expect(
      base.owner.caller.mutation(finishReference, { ...request, perceptionEnvironments })
    ).rejects.toThrow('Initial movement evaluation does not match retained preparation.')
    expect(await records()).toEqual(before)
    await base.t.run((ctx) =>
      ctx.db.patch(reactor._id, {
        stateJson: reactor.stateJson,
        stateChecksum: reactor.stateChecksum
      })
    )
    const saveRowId = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', request.saveId))
        .unique()
      if (!row) throw new Error('Missing geometry save.')
      await ctx.db.patch(row._id, {
        fogSaves: [{ saveId: crypto.randomUUID(), ownerUserId: base.owner.userId }]
      })
      return row._id
    })
    await expect(
      base.owner.caller.mutation(finishReference, { ...request, perceptionEnvironments })
    ).rejects.toThrow('Stored geometry fog save is inconsistent.')
    expect(await records()).toEqual(before)
    expect(await reactionRecords(base.t, base.run.id)).toEqual(beforeMechanics)
    await base.t.run((ctx) => ctx.db.patch(saveRowId, { fogSaves: [] }))
    const result = await base.owner.caller.mutation(finishReference, {
      ...request,
      perceptionEnvironments
    })
    expect(result).toMatchObject({
      version: 1,
      replayed: false,
      delta: { kind: 'TOKEN_MOVED', tokenId: tokens[1]!.id, position: { x: 300, y: 50 } },
      occurrence: { occurrenceId: prepared.occurrenceId, occurrenceVersion: 0, status: 'PENDING' }
    })
    expect(await reactionRecords(base.t, base.run.id)).toEqual(beforeMechanics)
    const after = await records()
    expect(after.occurrences).toHaveLength(before.occurrences.length + 1)
    expect(after.receipts).toHaveLength(before.receipts.length + 1)
    const occurrence = after.occurrences.find((row) => row.id === prepared.occurrenceId)!
    expect(
      JSON.parse(occurrence.pendingSnapshotJson!).applicationContext.root.currentSceneVersion
    ).toBe(1)
    expect(after.entities.find((row) => row.entityId === tokens[1]!.id)?.value).toMatchObject({
      entity: { position: { x: 300, y: 50 } }
    })
    expect(await base.owner.caller.mutation(finishReference, request)).toEqual({
      ...result,
      replayed: true
    })
    expect(await records()).toEqual(after)
    const occurrenceRowId = occurrence._id
    const pendingSnapshotJson = occurrence.pendingSnapshotJson
    await base.t.run((ctx) =>
      ctx.db.patch(occurrenceRowId, {
        state: 'COMPLETED',
        version: 1,
        pendingSnapshotJson: null,
        pendingSnapshotChecksum: null,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    )
    await expect(base.owner.caller.mutation(finishReference, request)).resolves.toMatchObject({
      replayed: true,
      occurrence: { occurrenceId: prepared.occurrenceId, occurrenceVersion: 1, status: 'COMPLETE' }
    })
    await base.t.run((ctx) =>
      ctx.db.patch(occurrenceRowId, {
        state: 'PENDING',
        version: 0,
        pendingSnapshotJson,
        pendingSnapshotChecksum: '0'.repeat(64),
        completedAt: null,
        updatedAt: new Date().toISOString()
      })
    )
    await expect(base.owner.caller.mutation(finishReference, request)).rejects.toThrow(
      'replay evidence is inconsistent'
    )
    await base.t.run((ctx) =>
      ctx.db.patch(occurrenceRowId, {
        pendingSnapshotChecksum: checksumCanonicalJson(JSON.parse(pendingSnapshotJson!))
      })
    )
    const receipt = after.receipts.find((row) => row.commandId === input.commandId)!
    expect(JSON.parse(receipt.commandMetadataJson)).toMatchObject({
      encounterVersionTransition: 'UNCHANGED',
      sceneVersionTransition: 'ADVANCED'
    })
    await base.t.run((ctx) => ctx.db.patch(receipt._id, { resultChecksum: '0'.repeat(64) }))
    await expect(base.owner.caller.mutation(finishReference, request)).rejects.toThrow(
      'replay evidence is inconsistent'
    )
  }, 30000)

  it('projects a native pending movement choice only to its current audience', async () => {
    const { base, request, input } = await setup()
    const prepared = await base.owner.caller.action(actionReference, request)
    if (prepared.outcome.kind !== 'PENDING') throw new Error('Expected reaction choice.')
    const snapshot = prepared.outcome.pendingSnapshot
    const query = { encounterId: base.run.id }
    await expect(base.other.caller.query(pendingReference, query)).rejects.toThrow(
      'Campaign not found.'
    )
    await expect(base.t.query(pendingReference, query)).rejects.toThrow('Unauthenticated')
    const now = new Date().toISOString()
    const occurrenceRowId = await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        joinedAt: now,
        accessStartedAt: now,
        leftAt: null
      })
      return ctx.db.insert(
        'encounterRuleOccurrences',
        encounterStoredRuleOccurrenceSchema.parse({
          id: prepared.occurrenceId,
          campaignId: base.campaign.id,
          encounterId: base.run.id,
          rootCommandId: input.commandId,
          state: 'PENDING',
          version: 0,
          expectedEncounterVersion: prepared.expectedEncounterVersion,
          pendingSnapshotJson: JSON.stringify(snapshot),
          pendingSnapshotChecksum: checksumCanonicalJson(snapshot),
          createdAt: now,
          updatedAt: now,
          completedAt: null
        })
      )
    })
    const visible = await base.owner.caller.query(pendingReference, query)
    expect(visible).toMatchObject({
      kind: 'MOVEMENT_REACTION',
      occurrenceId: prepared.occurrenceId,
      occurrenceVersion: 0,
      encounterVersion: prepared.expectedEncounterVersion,
      allowedResponses: ['DECLINE', 'OPTION']
    })
    const wire = JSON.stringify(visible)
    for (const privateField of [
      'pendingSnapshot',
      'graph',
      'facts',
      'nodeOutputs',
      'seal',
      'reactionTimeline',
      'actionSourceCurrentnessChecksum',
      'eligibilityEvidenceChecksum'
    ])
      expect(wire).not.toContain(`"${privateField}"`)
    expect(await base.other.caller.query(pendingReference, query)).toBeNull()
    const before = await reactionRecords(base.t, base.run.id)
    for (const patch of [
      { campaignId: crypto.randomUUID() },
      { expectedEncounterVersion: prepared.expectedEncounterVersion + 1 },
      { rootCommandId: crypto.randomUUID() }
    ]) {
      await base.t.run((ctx) => ctx.db.patch(occurrenceRowId, patch))
      await expect(base.owner.caller.query(pendingReference, query)).rejects.toThrow(
        /Stored Encounter occurrence (state|root) is invalid\./
      )
      await base.t.run((ctx) =>
        ctx.db.patch(occurrenceRowId, {
          campaignId: base.campaign.id,
          expectedEncounterVersion: prepared.expectedEncounterVersion,
          rootCommandId: input.commandId
        })
      )
    }
    expect(await base.owner.caller.query(pendingReference, query)).toEqual(visible)
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    await base.owner.caller.mutation(api.campaigns.ownership.request, {
      campaignId: base.campaign.id,
      recipientUserId: base.other.userId
    })
    const transferred = await base.other.caller.mutation(api.campaigns.ownership.accept, {
      campaignId: base.campaign.id
    })
    expect(await base.other.caller.query(pendingReference, query)).toEqual(visible)
    expect(await base.owner.caller.query(pendingReference, query)).toBeNull()
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    const formerOwner = transferred.memberships.find(
      (member) => member.userId === base.owner.userId
    )
    if (!formerOwner) throw new Error('Missing former-owner membership.')
    await base.owner.caller.mutation(api.campaigns.membershipDeparture.leave, {
      campaignId: base.campaign.id,
      expectedCampaignVersion: transferred.version,
      expectedMembershipAccessStartedAt: formerOwner.accessStartedAt,
      commandId: crypto.randomUUID()
    })
    await expect(base.owner.caller.query(pendingReference, query)).rejects.toThrow(
      'Campaign not found.'
    )
    expect(await base.other.caller.query(pendingReference, query)).toEqual(visible)
    await base.t.run((ctx) =>
      ctx.db.patch(occurrenceRowId, {
        pendingSnapshotChecksum: '0'.repeat(64)
      })
    )
    await expect(base.other.caller.query(pendingReference, query)).rejects.toThrow(
      'Stored Encounter occurrence state is invalid.'
    )
  }, 30000)

  it('hydrates current Scene evidence and freezes the exact reaction choice without settling mechanics', async () => {
    const { base, request } = await setup()
    const before = await reactionRecords(base.t, base.run.id)
    const capture = await base.owner.caller.mutation(captureReference, request)
    expect(capture.requests).toHaveLength(1)
    expect(capture.requests[0]!.subject.position).toEqual({ x: 300, y: 50 })
    const environment = resolveSceneCombatPerceptionEnvironment({
      scene: {
        ...capture.header,
        grid: capture.grid,
        barriers: [],
        lights: [],
        darknessZones: [],
        doorStates: {}
      },
      observer: capture.requests[0]!.observer,
      subject: capture.requests[0]!.subject,
      sharedSurface: true,
      invisibleChannels: [],
      suppressedChannels: []
    })
    await expect(
      base.owner.caller.mutation(prepareReference, {
        ...request,
        perceptionEnvironments: [
          {
            key: '0'.repeat(64),
            environment: { ...environment, invisibleChannels: [], suppressedChannels: [] }
          }
        ]
      })
    ).rejects.toThrow('missing or stale')
    const prepared = await base.owner.caller.action(actionReference, request)
    expect(prepared.outcome.kind).toBe('PENDING')
    if (prepared.outcome.kind !== 'PENDING') throw new Error('Expected reaction choice.')
    expect(prepared.outcome.movementIntent).toMatchObject({ position: { x: 300, y: 50 } })
    expect(prepared.outcome.pendingSnapshot.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_MOVEMENT_REACTION',
      phase: { kind: 'CHOICE' }
    })
    expect(await base.owner.caller.action(actionReference, request)).toEqual(prepared)
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    await base.owner.caller.run(async (ctx) => {
      const { header, live } = await readLiveScene(ctx, capture.sceneId, 'OWNER')
      await ctx.db.insert('sceneLiveStates', advanceLiveState(header, live))
    })
    await expect(base.owner.caller.action(actionReference, request)).rejects.toThrow(
      'Scene changed before geometry publication.'
    )
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
  }, 30000)
})
