import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterCharacterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { recordZoneSightings } from '@artificer-toolkit/encounter-persistence/zoneSightings'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { resolveEncounterPointSight } from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import { passiveSkillDefinitionId } from '@artificer-toolkit/rules-runtime/encounterConcealment'
import { actorContestFacts } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  zoneSightingCandidates,
  zoneSightPoint
} from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { rollModeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import {
  nativeLiveDefinitions,
  readNativeLiveSpatialEffects
} from './nativeEncounterMovementInputs.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { roomLiveCaptureReads } from './roomLiveCaptureReads.js'
import { readRoomSceneState } from './roomSceneRead.js'

/**
 * The concealed zones each Character on the Scene first notices (MOVE-3.5): a Character that
 * neither knows of a zone nor already has a sighting of it notices it when it sees the zone and its
 * passive score (the System's zone spot passive) meets the spot DC. Characters only; Search only, or
 * a System without a zone spot passive, notices nothing.
 */
export async function planZoneSightings(input: {
  state: EncounterRunState
  system: SystemAuthoredDto
  targets: ReadonlyMap<string, MovementTarget>
  actorIdByTokenId: ReadonlyMap<string, string>
  spatialEffects: readonly EncounterSpatialRuleEffectRecord[]
  definitions: ReturnType<typeof nativeLiveDefinitions>
  scene: CampaignSceneStateDto
}) {
  const { state, system, targets, spatialEffects, definitions, scene } = input
  const passiveId = system.zoneSpotPassiveDefinitionId
  const skillId = passiveId ? passiveSkillDefinitionId(system, passiveId) : null
  if (state.zoneNoticing === 'SEARCH_ONLY' || !skillId) return []
  const observers = scene.tokens.flatMap((token) => {
    const target = targets.get(input.actorIdByTokenId.get(token.id) ?? '')
    return target?.actor.kind === 'CHARACTER' ? [{ target, token }] : []
  })
  const passiveScores = new Map<string, number | null>()
  const passiveScoreOf = (actorId: string) => {
    if (!passiveScores.has(actorId)) {
      const facts = actorContestFacts({
        actorId,
        checkKind: 'SKILL',
        checkDefinitionId: skillId,
        gameSystemId: state.gameSystemId,
        system,
        targets
      })
      passiveScores.set(
        actorId,
        facts.modifier === null
          ? null
          : rollModeCapabilityRegistry.passiveScore({
              gameSystemId: state.gameSystemId,
              skillModifier: facts.modifier,
              rollMode: facts.rollMode
            })
      )
    }
    return passiveScores.get(actorId) ?? null
  }
  const sightings: { spatialEffectId: string; actorId: string }[] = []
  for (const zone of spatialEffects) {
    const { concealment } = zone.spatialState
    if (
      !concealment ||
      zone.placement.anchorKind !== 'FIXED' ||
      zone.placement.geometry.frame !== 'SCENE_ABSOLUTE'
    )
      continue
    const candidates = new Set(
      zoneSightingCandidates(
        zone.spatialState,
        observers.map(({ target }) => target.actor.id)
      )
    )
    for (const { target, token } of observers) {
      const actorId = target.actor.id
      const score = candidates.has(actorId) ? passiveScoreOf(actorId) : null
      if (score === null || score < concealment.spotDc.value) continue
      const sight = await resolveEncounterPointSight({
        gameSystemId: state.gameSystemId,
        loadDefinition: async (id) => {
          const current = await definitions.requireCurrent(id)
          return {
            definitionFamilyKey: current.definitionFamilyKey,
            gameSystemId: current.gameSystemId,
            current
          }
        },
        loadSystem: async () => system,
        observer: target,
        point: zoneSightPoint(zone.placement.geometry.shape),
        placement: { scene, sceneGrid: scene.grid, observerToken: token, spatialEffects }
      })
      if (sight === 'SEES') sightings.push({ spatialEffectId: zone.id, actorId })
    }
  }
  return sightings
}

/**
 * Notices concealed zones after a committed command that can put one in a Character's sight
 * without a move: the Run starting, a zone placed or given a spot DC, a token bound, an action.
 * Reads the Run's targets only while some Character on the bound Scene could still notice a zone,
 * and records what it notices; returns whether it recorded any.
 */
export async function recordRoomZoneSightings(input: {
  ctx: EncounterCharacterWriteTransaction
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  campaignId: string
  epoch: string
  userId: string
  observed: LiveSessionRulesRevisions
  encounterId: string
  random(maximum: number): number
}): Promise<boolean> {
  const { ctx, store, transaction, inputs, campaignId, epoch, userId, observed } = input
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  const state = run && readRunState(run)
  if (!run || !state || state.status !== 'ACTIVE' || state.zoneNoticing === 'SEARCH_ONLY')
    return false
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  const zones = binding
    ? await (
        await createSpatialRuleEffectStore(ctx).scope({
          encounterId: state.id,
          sceneId: binding.sceneId
        })
      )?.list()
    : null
  const characterActorIds = (await readRunActors(ctx, state)).flatMap((actor) =>
    actor.kind === 'CHARACTER' ? [actor.id] : []
  )
  if (
    !binding ||
    !zones?.some((zone) => zoneSightingCandidates(zone.spatialState, characterActorIds).length)
  )
    return false
  const { membership } = await ctx.ports.requireCampaignAuthority(campaignId, userId)
  const scope = {
    campaignId,
    authorityEpoch: epoch,
    expectedUserId: userId,
    expectedRole: membership.role,
    encounterId: state.id,
    expectedVersion: run.version
  }
  const captures = roomLiveCaptureReads({ ctx, store, transaction, inputs, observed })
  const capture = (request: LiveSessionEncounterRulesRequest) =>
    captures.encounterRules(liveSessionEncounterRulesInputSchema.parse({ ...scope, request }))
  const inputsResponse = await capture({ kind: 'INPUTS' })
  if (inputsResponse.kind !== 'INPUTS') throw new Error('Encounter inputs are unavailable.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const prepared = await Promise.all(
    actors.map((actor) =>
      prepareNativeLiveMovementTarget({
        scope,
        state,
        actor,
        activeEffectsByActorId,
        captures,
        random: input.random
      })
    )
  )
  const tokenBindings = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', state.id))
    .collect()
  const { scene } = await readRoomSceneState(transaction, binding.sceneId)
  const sightings = await planZoneSightings({
    state,
    system: inputsResponse.system,
    targets: new Map(prepared.map(({ target }) => [target.actor.id, target])),
    actorIdByTokenId: new Map(tokenBindings.map((row) => [row.tokenId, row.actorId])),
    spatialEffects: await readNativeLiveSpatialEffects(capture, scene, state.id),
    definitions: nativeLiveDefinitions(capture, state),
    scene
  })
  return recordZoneSightings(ctx, { encounterId: state.id, sceneId: binding.sceneId, sightings })
}
