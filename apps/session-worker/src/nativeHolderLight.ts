import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterHolderLight } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { placedZoneLights } from '@artificer-toolkit/rules-runtime/actorLight'
import { combatPerceptionCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { resolveSceneLightAt, SceneBarrierIndex } from '@artificer-toolkit/shared/vtt'
import {
  readNativeLivePerceptionScene,
  readNativeLiveSpatialEffects
} from './nativeTurnEffectPerception.js'

/**
 * The light on the holder's square on the live Scene the action locked (null for an action without
 * Scene positions): whether the square is bright, and whether the Scene's daylight reaches it, with
 * the light the Encounter's placed zones shed. The read refuses a Scene that moved since the action
 * was composed.
 */
export async function readNativeLiveHolderLight(
  campaign: { id: string; campaignId: string; gameSystemId: string },
  holder: MovementTarget,
  sceneContext: { sceneId: string; sceneVersion: number } | null,
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
): Promise<EncounterHolderLight | null> {
  if (!sceneContext) return null
  const loaded = await readNativeLivePerceptionScene({
    campaignId: campaign.campaignId,
    observerActorId: holder.actor.id,
    subjectActorId: holder.actor.id,
    capture
  })
  if (!loaded || loaded.id !== sceneContext.sceneId || loaded.version !== sceneContext.sceneVersion)
    throw new Error('Encounter action facts are stale.')
  const token = loaded.scene.tokens.find(({ id }) => id === loaded.observerTokenId)
  if (!token) throw new Error('Encounter action facts are stale.')
  const spatialEffects = await readNativeLiveSpatialEffects({
    encounterId: campaign.id,
    sceneId: loaded.id,
    sceneVersion: loaded.version,
    capture
  })
  return measureHolderLight(
    campaign.gameSystemId,
    { ...loaded.scene, zoneLights: placedZoneLights(spatialEffects, loaded.scene) },
    token.position
  )
}

/** The light on one square of an already-read Scene, by the Campaign System's illumination levels. */
export function measureHolderLight(
  gameSystemId: string,
  scene: Parameters<typeof resolveSceneLightAt>[0],
  position: Parameters<typeof resolveSceneLightAt>[1]
): EncounterHolderLight {
  const { illuminationLevels } = combatPerceptionCapabilityRegistry.require(gameSystemId)
  return resolveSceneLightAt(
    scene,
    position,
    new SceneBarrierIndex(scene.barriers),
    illuminationLevels
  )
}
