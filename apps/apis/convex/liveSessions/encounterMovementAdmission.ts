import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionMovementCaptureScope } from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import { encounterActorTokenBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { isEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import type { QueryCtx } from '../_generated/server'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { requireUnusedEvidenceCommandId } from '@artificer-toolkit/encounter-persistence/timelineEntries'
import { requireIdentity } from '../lib/identity'
import { assertGeometryReceiving, readGeometrySave } from '../scenes/geometryDocuments'
import { normalizeSceneGeometryEntity } from '../scenes/geometryValues'
import { parseLiveEntity } from '../scenes/liveDocuments'
import { assertMovementResolutionCurrent } from '../scenes/movementResolutionDocuments'
import { readSessionVisionScope } from '../scenes/sessionVisionDocuments'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { requireEncounterActorControl } from '@artificer-toolkit/encounter-persistence/actorController'
import { encounterReadTransaction } from '../encounters/encounterPorts'

/** Authorize raw movement reads against the staged Scene command and current Encounter. */
export async function readLiveMovementAdmission(
  ctx: QueryCtx,
  input: Pick<
    LiveSessionEncounterRulesInput,
    'campaignId' | 'authorityEpoch' | 'expectedUserId' | 'expectedRole'
  > & { movement: LiveSessionMovementCaptureScope }
) {
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  const current = await readGeometrySave(ctx, input.movement.saveId)
  const { save, header, campaign, membership, presented } = current
  if (
    current.userId !== userId ||
    membership.role !== input.expectedRole ||
    campaign.id !== input.campaignId ||
    campaign.status !== 'ACTIVE'
  )
    throw new Error('Live Session movement scope mismatch.')
  assertGeometryReceiving(save, header.version, userId)
  if (
    save.input.type !== 'MOVE_SCENE_TOKEN' ||
    save.input.expectedEncounterVersion === null ||
    !save.sessionVision ||
    !presented ||
    save.sessionVision.campaignId !== campaign.id ||
    save.sessionVision.systemId !== campaign.gameSystemId ||
    save.sessionVision.sceneId !== header.id ||
    save.input.expectedSceneVersion !== save.snapshotVersion
  )
    throw new Error('Live Session movement Scene snapshot is unavailable.')
  const tokenId = save.input.tokenId
  await readSessionVisionScope(ctx, save.sessionVision, {
    header,
    campaign,
    userId,
    ...presented
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.movement.encounterId))
    .unique()
  if (!run) throw new Error('Spatial Encounter is unavailable.')
  const state = readRunState(run)
  if (
    state.id !== input.movement.encounterId ||
    state.status !== 'ACTIVE' ||
    state.campaignId !== campaign.id ||
    state.gameSystemId !== campaign.gameSystemId ||
    state.version !== save.input.expectedEncounterVersion
  )
    throw new Error('Spatial Encounter scope is stale.')
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!binding || binding.sceneId !== header.id || binding.campaignId !== campaign.id)
    throw new Error('Spatial Encounter Scene binding is stale.')
  const tokenBindingRow = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_tokenId', (q) =>
      q.eq('encounterId', state.id).eq('tokenId', tokenId)
    )
    .unique()
  if (!tokenBindingRow) throw new Error('Spatial moving actor is unavailable.')
  const { _id, _creationTime, ...storedBinding } = tokenBindingRow
  const tokenBinding = encounterActorTokenBindingSchema.parse(storedBinding)
  const actorBindingRow = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) =>
      q.eq('encounterId', state.id).eq('actorId', tokenBinding.actorId)
    )
    .unique()
  if (
    tokenBinding.sceneId !== header.id ||
    !state.actorIds.includes(tokenBinding.actorId) ||
    actorBindingRow?._id !== tokenBindingRow._id
  )
    throw new Error('Stored Encounter token binding is inconsistent.')

  const resolution = save.movementResolution
    ? await assertMovementResolutionCurrent(ctx, save)
    : null
  if (
    resolution &&
    (resolution.state.id !== state.id || resolution.root.tokenId !== save.input.tokenId)
  )
    throw new Error('Movement response Encounter scope is stale.')
  if (!resolution) {
    const pending = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) =>
        q.eq('encounterId', state.id).eq('state', 'PENDING')
      )
      .take(1)
    if (pending.length) throw new Error('Encounter has a pending rule occurrence.')
    const existing = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_campaignId_rootCommandId', (q) =>
        q.eq('campaignId', campaign.id).eq('rootCommandId', save.commandId)
      )
      .unique()
    if (existing) throw new Error('Spatial occurrence replay must use the published command.')
    await requireUnusedEvidenceCommandId(ctx, campaign.id, save.commandId)
  }

  const liveRow = await ctx.db
    .query('sceneLiveEntities')
    .withIndex('by_sceneId_collection_entityId', (q) =>
      q.eq('sceneId', header.id).eq('collection', 'tokens').eq('entityId', tokenId)
    )
    .unique()
  const live = liveRow ? parseLiveEntity(liveRow, header.version) : null
  if (live && live.version > save.input.expectedSceneVersion)
    throw new Error('Scene target changed before this command completed.')
  let token: SceneToken | null = null
  if (live) {
    if (live.value?.collection !== 'tokens') throw new Error('Spatial token is no longer present.')
    token = live.value.entity
  } else {
    const ordinal = input.movement.baseTokenOrdinal
    if (ordinal === null || ordinal >= header.counts.tokens)
      throw new Error('Spatial token source ordinal is unavailable.')
    const row = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q
          .eq('saveId', header.definitionSaveId)
          .eq('value.collection', 'tokens')
          .eq('ordinal', ordinal)
      )
      .unique()
    if (!row) throw new Error('Spatial token source is unavailable.')
    const { _id, _creationTime, ...stored } = row
    const base = sceneStoredDefinitionEntitySchema.parse(stored)
    if (
      base.saveId !== header.definitionSaveId ||
      base.ordinal !== ordinal ||
      base.value.collection !== 'tokens' ||
      base.entityId !== base.value.entity.id ||
      base.entityId.toLowerCase() !== save.input.tokenId ||
      base.checksum !== checksumCanonicalJson(base.value)
    )
      throw new Error('Stored spatial token source is inconsistent.')
    const value = normalizeSceneGeometryEntity(base.value)
    if (value.collection !== 'tokens') throw new Error('Spatial token source is unavailable.')
    token = value.entity
  }
  if (!token || token.locked)
    throw new Error('Members may only move an unlocked token they control.')
  if (!resolution) {
    const mover = await readRunActor(ctx, state, tokenBinding.actorId)
    await requireEncounterActorControl(encounterReadTransaction(ctx), {
      campaign,
      membership,
      actor: mover
    })
    // A defeated creature doesn't move itself (D63); the GM may still reposition its token.
    if (membership.role !== 'OWNER' && isEncounterActorDefeated(mover))
      rejectDomain('ACTOR_DEFEATED')
  }
  if (
    checksumCanonicalJson(token.position) !==
    checksumCanonicalJson(resolution ? resolution.root.currentPosition : save.input.path[0])
  )
    throw new Error('Movement token position is stale.')
  return { ...current, state, appRoll: resolution?.appRoll ?? null }
}
