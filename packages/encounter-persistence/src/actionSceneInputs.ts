import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
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
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterReadContext } from './store.js'
import { parseSceneLiveEntity } from './sceneLiveState.js'
import { normalizeSceneGeometryEntity } from './sceneGeometryValues.js'

/** Reads exact stored geometry without rules evaluation; the caller owns commit freshness. */
export async function readEncounterActionSceneInputs(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  command: Pick<ResolveEncounterActionInputDto, 'actorId' | 'targetActorId' | 'sceneContext'>,
  callbacks: {
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
) {
  const request = command.sceneContext
  if (!request) return null
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
  const [sourceToken, targetToken] = await Promise.all([
    readToken(request.sourceTokenId, command.actorId),
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
