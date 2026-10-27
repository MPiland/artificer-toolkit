import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import {
  resolveEncounterCover,
  type EncounterCoverFacts
} from '@artificer-toolkit/rules-runtime/encounterCover'
import type { SceneGrid, ScenePoint } from '@artificer-toolkit/shared/vtt'
import { readNativeLivePerceptionScene } from './nativeTurnEffectPerception.js'

/**
 * The target's cover on the live Scene the action locked, under the System's cover rules: from the
 * source's space, or from the point an area starts at. Null for an action without Scene positions.
 * The capture refuses a Scene whose version moved since the action was composed.
 */
export async function readNativeLiveCover(input: {
  state: EncounterRunState
  system: SystemAuthoredDto
  sourceActorId: string
  targetActorId: string
  /** The point an area starts at; absent for an attack made from the source's own space. */
  originPoint?: ScenePoint
  /** A single-target action is refused when the cover blocks targeting; an area drops the creature instead. */
  refuseBlocked?: boolean
  sceneContext: { sceneId: string; sceneVersion: number; grid: SceneGrid } | null
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const { sceneContext } = input
  if (!sceneContext) return null
  const loaded = await readNativeLivePerceptionScene({
    campaignId: input.state.campaignId,
    observerActorId: input.targetActorId,
    subjectActorId: input.sourceActorId,
    capture: input.capture
  })
  if (!loaded || loaded.id !== sceneContext.sceneId || loaded.version !== sceneContext.sceneVersion)
    throw new Error('Encounter action facts are stale.')
  const sourceToken = loaded.scene.tokens.find(({ id }) => id === loaded.subjectTokenId)
  if (!sourceToken) throw new Error('Encounter action facts are stale.')
  return refuseBlockedCover(
    resolveEncounterCover({
      system: input.system,
      scene: loaded.scene,
      origin: input.originPoint
        ? { kind: 'POINT', point: input.originPoint }
        : { kind: 'TOKEN', token: sourceToken },
      targetTokenId: loaded.observerTokenId,
      automatic: input.state.automaticCover
    }),
    input.refuseBlocked ?? false
  )
}

/** Refuses a target the cover blocks as a domain rejection, so the table is told why. */
export function refuseBlockedCover(cover: EncounterCoverFacts | null, refuse: boolean) {
  if (refuse && cover?.tier?.blocksTargeting)
    rejectDomain('TARGET_UNAVAILABLE', `The target has ${cover.tier.label.toLowerCase()}.`)
  return cover
}
