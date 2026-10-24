import type {
  ActionAreaSceneRequestDto,
  ActionSceneRequestDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  SceneLiveEntity,
  SceneLiveStateHeader
} from '@artificer-toolkit/schema/api/sceneLiveState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterActorTokenBindingSchema,
  encounterSceneBindingSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import type {
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encounterActionOriginActorId,
  parseRepeatPathActionId
} from '@artificer-toolkit/rules-runtime/encounterRepeatPathAction'
import { readRunActors } from './documents.js'
import { readActiveEffectsByActorId } from './effectStore.js'
import type { EncounterReadContext } from './store.js'
import { parseSceneLiveEntity } from './sceneLiveState.js'
import { normalizeSceneGeometryEntity } from './sceneGeometryValues.js'

/** The Scene rows an action's geometry reads; Convex and the room each read their own storage. */
export interface EncounterActionSceneReaders {
  readScene(sceneId: string): Promise<{
    header: SceneLiveStateHeader
    live: ReturnType<typeof sceneStoredLiveStateSchema.parse> | null
  }>
  readLiveToken(
    sceneId: string,
    tokenId: string
  ): Promise<ReturnType<typeof sceneStoredLiveEntitySchema.parse> | null>
  readDefinitionToken(
    saveId: string,
    tokenId: string
  ): Promise<ReturnType<typeof sceneStoredDefinitionEntitySchema.parse> | null>
}

/**
 * Opens the Scene an action reads at the version the caller saw, and returns the one reader of a
 * bound creature's token geometry. The caller owns commit freshness.
 */
async function openActionScene(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  request: { sceneId: string; expectedSceneVersion: number },
  callbacks: EncounterActionSceneReaders
) {
  const { header, live } = await callbacks.readScene(request.sceneId)
  const bindingRow = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!bindingRow) throw new Error('Action Scene context is stale.')
  const { _id, _creationTime, ...storedBinding } = bindingRow
  const binding = encounterSceneBindingSchema.parse(storedBinding)
  if (
    header.id !== request.sceneId ||
    header.version !== request.expectedSceneVersion ||
    header.campaignId !== state.campaignId ||
    binding.encounterId !== state.id ||
    binding.campaignId !== state.campaignId ||
    binding.sceneId !== header.id
  )
    throw new Error('Action Scene context is stale.')

  async function readToken(tokenId: string, actorId: string) {
    const actorBindingRow = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_tokenId', (q) =>
        q.eq('encounterId', state.id).eq('tokenId', tokenId)
      )
      .unique()
    if (!actorBindingRow) throw new Error('Action Scene token context is stale.')
    const { _id, _creationTime, ...storedActorBinding } = actorBindingRow
    const actorBinding = encounterActorTokenBindingSchema.parse(storedActorBinding)
    const actorRow = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', state.id).eq('actorId', actorId)
      )
      .unique()
    if (
      actorBinding.actorId !== actorId ||
      actorBinding.sceneId !== header.id ||
      actorBinding.encounterId !== state.id ||
      actorBinding.tokenId !== tokenId ||
      actorRow?._id !== actorBindingRow._id
    )
      throw new Error('Action Scene token context is stale.')
    const overrideRow = await callbacks.readLiveToken(header.id, tokenId)
    let value: Extract<SceneLiveEntity, { collection: 'tokens' }>
    if (overrideRow) {
      const override = parseSceneLiveEntity(overrideRow, header.version)
      if (
        override.value?.collection !== 'tokens' ||
        override.ordinal === null ||
        override.ordinal >= (live?.nextOrdinals.tokens ?? header.counts.tokens)
      )
        throw new Error('Action Scene token is unavailable.')
      value = override.value
    } else {
      const row = await callbacks.readDefinitionToken(header.definitionSaveId, tokenId)
      if (!row) throw new Error('Action Scene token is unavailable.')
      const base = sceneStoredDefinitionEntitySchema.parse(row)
      if (
        base.saveId !== header.definitionSaveId ||
        base.value.collection !== 'tokens' ||
        base.entityId.toLowerCase() !== tokenId ||
        base.value.entity.id !== base.entityId ||
        base.ordinal >= header.counts.tokens ||
        base.checksum !== checksumCanonicalJson(base.value)
      )
        throw new Error('Stored action Scene token is inconsistent.')
      value = base.value
    }
    const normalized = normalizeSceneGeometryEntity(value)
    if (normalized.collection !== 'tokens') throw new Error('Action Scene token is unavailable.')
    const token = normalized.entity
    return {
      actorId,
      tokenId: token.id,
      position: token.position,
      width: token.width,
      height: token.height,
      rotationDegrees: token.rotationDegrees
    }
  }
  return { header, readToken }
}

/**
 * The actor whose token an action's range is measured from. Only a CONJURED repeat is measured
 * from another creature's token: the one its stored carrier conjured. Every other action, and a
 * request that names none, measures from its actor.
 */
export async function readEncounterActionOriginActorId(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  command: Pick<ActionSceneRequestDto, 'actorId' | 'actionId'>
) {
  if (!command.actionId || !parseRepeatPathActionId(command.actorId, command.actionId))
    return command.actorId
  const actors = await readRunActors(ctx, state)
  return encounterActionOriginActorId({
    actorId: command.actorId,
    actionId: command.actionId,
    actors,
    effectsByHolder: await readActiveEffectsByActorId(ctx, state.id, actors)
  })
}

/** Reads exact stored geometry without rules evaluation; the caller owns commit freshness. */
export async function readEncounterActionSceneInputs(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  command: ActionSceneRequestDto,
  callbacks: EncounterActionSceneReaders
) {
  const request = command.sceneContext
  if (!request) return null
  const { header, readToken } = await openActionScene(ctx, state, request, callbacks)
  const sourceActorId = await readEncounterActionOriginActorId(ctx, state, command)
  const [sourceToken, targetToken] = await Promise.all([
    readToken(request.sourceTokenId, sourceActorId),
    readToken(request.targetTokenId, command.targetActorId)
  ])
  return {
    sceneId: header.id,
    sceneVersion: header.version,
    sourceToken,
    targetToken,
    sceneGrid: header.grid
  }
}

/** The caster's token and every creature token bound to the Encounter, for a point-area action. */
export async function readEncounterActionAreaSceneInputs(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  command: ActionAreaSceneRequestDto,
  callbacks: EncounterActionSceneReaders
) {
  const { header, readToken } = await openActionScene(ctx, state, command, callbacks)
  const tokens = await readBoundTokens(ctx, state, readToken)
  const sourceToken = tokens.find((token) => token.actorId === command.actorId)
  if (!sourceToken) throw new Error('Action Scene token context is stale.')
  return {
    sceneId: header.id,
    sceneVersion: header.version,
    sceneGrid: header.grid,
    sourceToken,
    tokens
  }
}

/** Every creature token bound to the Encounter, read through the Scene's checked token reader. */
async function readBoundTokens(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  readToken: Awaited<ReturnType<typeof openActionScene>>['readToken']
) {
  const rows = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', state.id))
    .take(MAX_ENCOUNTER_ACTORS + 1)
  if (rows.length > MAX_ENCOUNTER_ACTORS) throw new Error('Action Scene token context is stale.')
  return Promise.all(rows.map((row) => readToken(row.tokenId, row.actorId)))
}

/**
 * The current grid and every creature token bound to the Encounter on the Scene it is bound to;
 * null when the Encounter has no Scene or `readScene` cannot read it.
 */
export async function readEncounterBoundSceneTokens(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  callbacks: Omit<EncounterActionSceneReaders, 'readScene'> & {
    readScene(
      sceneId: string
    ): Promise<Awaited<ReturnType<EncounterActionSceneReaders['readScene']>> | null>
  }
) {
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!binding) return null
  const scene = await callbacks.readScene(binding.sceneId)
  if (!scene) return null
  const { header, readToken } = await openActionScene(
    ctx,
    state,
    { sceneId: binding.sceneId, expectedSceneVersion: scene.header.version },
    { ...callbacks, readScene: async () => scene }
  )
  return { grid: header.grid, tokens: await readBoundTokens(ctx, state, readToken) }
}
