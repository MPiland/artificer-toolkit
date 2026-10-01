import { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import { encounterActorTokenBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import type { sceneStoredLiveEntitySchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { readRunState } from './documents.js'
import type { EncounterPersistenceTransaction } from './ports.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import { readSpatialPreparation } from './sceneGeometryDocuments.js'
import { normalizeSceneGeometryEntity } from './sceneGeometryValues.js'
import { parseSceneLiveEntity } from './sceneLiveState.js'

/** Ordinals are lookup hints only. A supplied save must come from this transaction, before any writes. */
export async function readSpatialSceneGeometry<
  SaveContext extends { save: SceneStoredGeometrySave; header: SceneLiveStateHeader }
>(
  ctx: EncounterPersistenceTransaction,
  saveId: string,
  hints: NonNullable<ReturnType<typeof sceneGeometryFinishInputSchema.parse>['tokenOrdinals']>,
  callbacks: {
    readGeometrySave(saveId: string): Promise<SaveContext>
    readLiveToken(
      sceneId: string,
      tokenId: string
    ): Promise<ReturnType<typeof sceneStoredLiveEntitySchema.parse> | null>
    readDefinitionToken(
      saveId: string,
      ordinal: number
    ): Promise<ReturnType<typeof sceneStoredDefinitionEntitySchema.parse> | null>
  },
  currentSave?: SaveContext
) {
  const saveContext = currentSave ?? (await callbacks.readGeometrySave(saveId))
  const { save, header } = saveContext
  if (save.id !== saveId.toLowerCase()) throw new Error('Spatial Scene save identity differs.')
  const preparation = readSpatialPreparation(save)
  if (
    !save.sessionVision ||
    save.input.type !== 'MOVE_SCENE_TOKEN' ||
    save.input.expectedEncounterVersion === null ||
    header.version !== save.snapshotVersion
  )
    throw new Error('Spatial Scene snapshot is unavailable.')
  const runs = preparation
    ? [
        await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', preparation.encounterId))
          .unique()
      ]
    : await ctx.db
        .query('encounterRuns')
        .withIndex('by_campaignId_status', (q) =>
          q.eq('campaignId', header.campaignId).eq('status', 'ACTIVE')
        )
        .take(2)
  if (runs.length !== 1 || !runs[0])
    throw new Error('Spatial Encounter is unavailable or ambiguous.')
  const state = readRunState(runs[0])
  if (
    state.status !== 'ACTIVE' ||
    state.campaignId !== header.campaignId ||
    state.campaignId !== save.sessionVision.campaignId ||
    state.gameSystemId !== save.sessionVision.systemId ||
    state.version !== save.input.expectedEncounterVersion
  )
    throw new Error('Spatial Encounter scope is stale.')
  const rows = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', state.id))
    .take(MAX_ENCOUNTER_ACTORS + 1)
  if (rows.length > MAX_ENCOUNTER_ACTORS)
    throw new Error('Stored Encounter token bindings exceed the actor limit.')
  const actorIdByTokenId = new Map<string, string>()
  const actorIds = new Set<string>()
  for (const row of rows) {
    const { _id, _creationTime, ...stored } = row
    const binding = encounterActorTokenBindingSchema.parse(stored)
    if (
      binding.encounterId !== state.id ||
      binding.sceneId !== header.id ||
      !state.actorIds.includes(binding.actorId) ||
      actorIds.has(binding.actorId) ||
      actorIdByTokenId.has(binding.tokenId)
    )
      throw new Error('Stored Encounter token binding is inconsistent.')
    actorIds.add(binding.actorId)
    actorIdByTokenId.set(binding.tokenId, binding.actorId)
  }
  const scope = await createSpatialRuleEffectStore(ctx).scope({
    encounterId: state.id,
    sceneId: header.id
  })
  if (!scope) throw new Error('Spatial Encounter binding is unavailable.')
  const required = new Set([save.input.tokenId, ...actorIdByTokenId.keys()])
  for (const effect of await scope.list())
    if (effect.placement.sourceTokenId) required.add(effect.placement.sourceTokenId)
  const ordinals = new Map(hints.map((hint) => [hint.tokenId, hint.baseOrdinal]))
  if (ordinals.size !== hints.length)
    throw new Error('Spatial token hints contain duplicate identities.')
  const sceneTokens: SceneToken[] = []
  for (const tokenId of required) {
    if (!ordinals.has(tokenId)) throw new Error('Spatial token source hint is missing.')
    const liveRow = await callbacks.readLiveToken(header.id, tokenId)
    if (liveRow) {
      const live = parseSceneLiveEntity(liveRow, header.version)
      if (live.value?.collection !== 'tokens')
        throw new Error('Spatial token is no longer present.')
      sceneTokens.push(live.value.entity)
      continue
    }
    const ordinal = ordinals.get(tokenId)
    if (ordinal === undefined || ordinal === null || ordinal >= header.counts.tokens)
      throw new Error('Spatial token source ordinal is unavailable.')
    const row = await callbacks.readDefinitionToken(header.definitionSaveId, ordinal)
    if (!row) throw new Error('Spatial token source is unavailable.')
    const base = sceneStoredDefinitionEntitySchema.parse(row)
    if (
      base.saveId !== header.definitionSaveId ||
      base.ordinal !== ordinal ||
      base.value.collection !== 'tokens' ||
      base.entityId !== base.value.entity.id ||
      base.entityId.toLowerCase() !== tokenId ||
      base.checksum !== checksumCanonicalJson(base.value)
    )
      throw new Error('Stored spatial token source is inconsistent.')
    const value = normalizeSceneGeometryEntity(base.value)
    if (value.collection !== 'tokens') throw new Error('Spatial token source is unavailable.')
    sceneTokens.push(value.entity)
  }
  return { sceneTokens, actorIdByTokenId, encounter: state, saveContext }
}
