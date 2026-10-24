import { makeFunctionReference } from 'convex/server'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterActorTokenBindingCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { setupCreatureReactionRun } from './movementReaction'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom
} from './localRoomWorker'
import { readTestActor } from './storedActors'

const bindActorToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  { projection: { version: number } }
>('encounters/actorTokenBindings:execute')

/** Real native Scene/run setup for automatic movement tests and response tests. */
export async function setupAutomaticSceneMovement(
  input: {
    policies?: readonly ('AUTOMATIC' | 'CHOICE')[]
    path?: SceneDefinitionDto['tokens'][number]['position'][]
    reactorPositions?: readonly [number, number]
  } = {}
) {
  const policies = input.policies ?? ['AUTOMATIC', 'AUTOMATIC']
  const base = await setupCreatureReactionRun(
    null,
    true,
    policies.length > 1,
    policies[0]!,
    policies[1] ?? policies[0]!
  )
  if (!base.additionalReactorActor) throw new Error('Automatic fixture second reactor missing.')
  return {
    ...(await setupReactionMovementScene(
      base,
      [base.reactor, base.mover, base.additionalReactorActor],
      input.reactorPositions ?? [50, 50],
      input.path
    )),
    policies
  }
}

export async function setupReactionMovementScene<
  T extends Pick<
    Awaited<ReturnType<typeof setupCreatureReactionRun>>,
    't' | 'owner' | 'other' | 'campaign' | 'run'
  >
>(
  base: T,
  actors: EncounterGmProjectionDto['actors'],
  reactorPositions: readonly number[],
  path: SceneDefinitionDto['tokens'][number]['position'][] = [
    { x: 150, y: 50 },
    { x: 450, y: 50 }
  ],
  /**
   * A reactor ahead of the mover stands one cell off its path, which the mover may not walk through,
   * unless the test is about the hostile creature in the way.
   */
  reactorsOnPath = false
) {
  const sceneId = crypto.randomUUID()
  const definitionSaveId = crypto.randomUUID()
  const rootCommandId = crypto.randomUUID()
  const now = new Date().toISOString()
  const tokens: SceneDefinitionDto['tokens'] = [
    reactorPositions[0]!,
    150,
    ...reactorPositions.slice(1)
  ].map((x, index) => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: index === 1 ? [base.other.userId] : [],
    width: 100,
    height: 100,
    hidden: false,
    locked: false,
    label: index === 1 ? 'Mover' : `Reactor ${index + 1}`,
    position: { x, y: index !== 1 && x > 150 && !reactorsOnPath ? 150 : 50 },
    rotationDegrees: 0,
    senses: [],
    vision: null
  }))
  const settings = {
    campaignId: base.campaign.id,
    name: 'Automatic reaction Scene',
    ambientIllumination: 'BRIGHT' as const,
    daylight: false,
    fogMode: 'SHARED_PARTY' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid: {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    },
    map: { assetId: crypto.randomUUID(), width: 1000, height: 1000, tileManifestAssetId: null }
  }
  await base.t.run(async (ctx) => {
    const definitionId = crypto.randomUUID()
    const materializationCommandId = crypto.randomUUID()
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership)
      await ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        joinedAt: now,
        accessStartedAt: now,
        leftAt: null
      })
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
        counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: tokens.length },
        received: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: tokens.length
        },
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
      commandId: rootCommandId,
      commandFingerprint: checksumCanonicalJson({ sceneId }),
      createdAt: now
    })
  })
  let version = base.run.version
  for (const [index, actor] of actors.entries()) {
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
  await attachFixtureRoom(base.t, base.campaign.id)
  const rootInput = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId,
    commandId: rootCommandId,
    expectedSceneVersion: 0,
    expectedEncounterVersion: version,
    correlationId: null,
    tokenId: tokens[1]!.id,
    movementKind: 'VOLUNTARY' as const,
    path
  }
  return {
    base,
    owner: base.owner,
    player: base.other,
    sceneId,
    tokens,
    reactorTokenIds: tokens.filter((_, index) => index !== 1).map((token) => token.id),
    moverTokenId: tokens[1]!.id,
    rootInput,
    geometry: {
      sceneTokens: tokens,
      actorIdByTokenId: new Map(tokens.map((token, index) => [token.id, actors[index]!.id]))
    }
  }
}

/**
 * An actor's current hit points as Convex holds them once the real room checkpoints (it needs
 * `useLocalRoomWorker`; the room keeps a Run's actor state until then, D85).
 */
export async function readCheckpointedHitPoints(
  value: Pick<Awaited<ReturnType<typeof setupReactionMovementScene>>, 'base' | 'owner'>,
  actorId: string
) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('id', actorId)
      )
      .unique()
    if (!row) throw new Error('Missing Run actor.')
    const actor = await readTestActor(ctx, row)
    if (!('currentHitPoints' in actor)) throw new Error('Expected a Creature actor.')
    return actor.currentHitPoints
  })
}

/**
 * Assisted play offers every authored reaction to its controller as a Use/Decline choice (it needs
 * `useLocalRoomWorker`). The real room plans and commits a move in one step: the move commits
 * through `executeSceneInRoom`, then each Use/Decline choice is answered Use with the first option
 * as the GM through `executeInRoom`. Stops after `maxUses` Uses or at the first result whose pending
 * request is not a reaction choice, and returns that result's occurrence. `afterDecision` continues
 * from an answer the test already sent instead of committing the root move.
 */
export async function useMovementReactionsInRoom(
  value: Pick<
    Awaited<ReturnType<typeof setupReactionMovementScene>>,
    'base' | 'owner' | 'rootInput'
  >,
  maxUses = 10,
  afterDecision?: { occurrence: Awaited<ReturnType<typeof executeInRoom>>['occurrence'] } | null
) {
  const { owner } = value
  const commit = afterDecision ?? (await executeSceneInRoom(owner.caller, value.rootInput)).result
  let occurrence = commit?.occurrence ?? null
  let responseCommandId: string | null = null
  for (let uses = 0; uses < maxUses; uses++) {
    const pending = occurrence?.pending
    if (pending?.kind !== 'MOVEMENT_REACTION' || !pending.choice.options[0]) break
    responseCommandId = crypto.randomUUID()
    const answered = await executeInRoom(owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: responseCommandId,
        encounterId: value.base.run.id,
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'OPTION', optionId: pending.choice.options[0].optionId }
      }
    })
    occurrence = answered.occurrence
  }
  return { occurrence, responseCommandId }
}

/**
 * A Scene token's position as Convex holds it once the real room checkpoints (it needs
 * `useLocalRoomWorker`). A completed answer to a movement choice carries no token delta.
 */
export async function readCheckpointedTokenPosition(
  value: Pick<Awaited<ReturnType<typeof setupReactionMovementScene>>, 'base' | 'owner' | 'sceneId'>,
  tokenId: string
) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', value.sceneId).eq('collection', 'tokens').eq('entityId', tokenId)
      )
      .unique()
    if (row?.value?.collection !== 'tokens') throw new Error('Missing Scene token.')
    return row.value.entity.position
  })
}
