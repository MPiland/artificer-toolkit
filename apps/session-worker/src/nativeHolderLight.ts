import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterHolderLight } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  resolveSceneDaylightAt,
  resolveSceneIlluminationAt,
  SceneBarrierIndex
} from '@artificer-toolkit/shared/vtt'
import { readNativeLivePerceptionScene } from './nativeTurnEffectPerception.js'

/**
 * The light on the holder's square on the live Scene the action locked (null for an action without
 * Scene positions): whether the square is bright, and whether the Scene's daylight reaches it. The
 * read refuses a Scene that moved since the action was composed.
 */
export async function readNativeLiveHolderLight(
  campaignId: string,
  holder: MovementTarget,
  sceneContext: { sceneId: string; sceneVersion: number } | null,
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
): Promise<EncounterHolderLight | null> {
  if (!sceneContext) return null
  const loaded = await readNativeLivePerceptionScene({
    campaignId,
    observerActorId: holder.actor.id,
    subjectActorId: holder.actor.id,
    capture
  })
  if (!loaded || loaded.id !== sceneContext.sceneId || loaded.version !== sceneContext.sceneVersion)
    throw new Error('Encounter action facts are stale.')
  const token = loaded.scene.tokens.find(({ id }) => id === loaded.observerTokenId)
  if (!token) throw new Error('Encounter action facts are stale.')
  return measureHolderLight(loaded.scene, token.position)
}

/** The light on one square of an already-read Scene: bright or not, and daylit or not. */
export function measureHolderLight(
  scene: Parameters<typeof resolveSceneDaylightAt>[0],
  position: Parameters<typeof resolveSceneDaylightAt>[1]
): EncounterHolderLight {
  const barrierIndex = new SceneBarrierIndex(scene.barriers)
  return {
    brightLight:
      resolveSceneIlluminationAt(scene, position, barrierIndex).illumination === 'BRIGHT',
    daylight: resolveSceneDaylightAt(scene, position, barrierIndex)
  }
}
