import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import {
  type EncounterPerceptionRoller,
  resolveEncounterAttackPerception,
  resolveEncounterBelievedAttackPerception,
  resolveEncounterObserversSeeing,
  resolveEncounterPointSight
} from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { SceneGrid, ScenePoint } from '@artificer-toolkit/shared/vtt'

import {
  readNativeLiveDefinition,
  readNativeLivePerceptionScene,
  readNativeLiveSpatialEffects
} from './nativeTurnEffectPerception.js'

/**
 * Whether an attacker and its target see each other, from the live Scene (when the action has one),
 * the actors' pinned conditions and Senses, and the Scene's spatial effects (`actual`), and the
 * sight the attacker's roller believes before the server applies it (`believed`). Fog and viewer
 * projection are never inputs.
 */
export async function readNativeLiveAttackPerception(input: {
  state: EncounterRunState
  system: SystemAuthoredDto
  attacker: MovementTarget
  target: MovementTarget
  roller: EncounterPerceptionRoller
  /** The action's locked Scene; null for an action without Scene positions. */
  sceneContext: { sceneId: string; sceneVersion: number; grid: SceneGrid } | null
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const { state, capture, sceneContext } = input
  if (input.system.id !== state.gameSystemId)
    throw new Error('Attack perception System binding mismatch.')
  const loaded = sceneContext
    ? await readNativeLivePerceptionScene({
        campaignId: state.campaignId,
        observerActorId: input.target.actor.id,
        subjectActorId: input.attacker.actor.id,
        capture
      })
    : null
  if (
    sceneContext &&
    (!loaded || loaded.id !== sceneContext.sceneId || loaded.version !== sceneContext.sceneVersion)
  )
    throw new Error('Encounter action facts are stale.')
  const targetToken = loaded?.scene.tokens.find((token) => token.id === loaded.observerTokenId)
  const attackerToken = loaded?.scene.tokens.find((token) => token.id === loaded.subjectTokenId)
  if (loaded && (!targetToken || !attackerToken))
    throw new Error('Encounter action facts are stale.')
  const loaders = {
    gameSystemId: state.gameSystemId,
    loadDefinition: (definitionId: string) =>
      readNativeLiveDefinition({ gameSystemId: state.gameSystemId, definitionId, capture }),
    loadSystem: async () => input.system
  }
  const [actual, believed] = await Promise.all([
    resolveEncounterAttackPerception({
      ...loaders,
      attacker: input.attacker,
      target: input.target,
      placement:
        loaded && sceneContext && targetToken && attackerToken
          ? {
              scene: loaded.scene,
              sceneGrid: sceneContext.grid,
              attackerToken,
              targetToken,
              spatialEffects: await readNativeLiveSpatialEffects({
                encounterId: state.id,
                sceneId: loaded.id,
                sceneVersion: loaded.version,
                capture
              })
            }
          : null
    }),
    resolveEncounterBelievedAttackPerception({
      ...loaders,
      attacker: input.attacker,
      target: input.target,
      roller: input.roller
    })
  ])
  return { actual, believed }
}

/**
 * The observers that see the subject now, by the same perception rules and live Scene reads as
 * `readNativeLiveAttackPerception`: each observer's own placement on the action's locked Scene.
 */
export async function readNativeLiveObserversSeeing(input: {
  state: EncounterRunState
  system: SystemAuthoredDto
  subject: MovementTarget
  observers: readonly MovementTarget[]
  sceneContext: { sceneId: string; sceneVersion: number; grid: SceneGrid }
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const { state, capture, sceneContext } = input
  if (input.system.id !== state.gameSystemId)
    throw new Error('Attack perception System binding mismatch.')
  const spatialEffects = await readNativeLiveSpatialEffects({
    encounterId: state.id,
    sceneId: sceneContext.sceneId,
    sceneVersion: sceneContext.sceneVersion,
    capture
  })
  const observers = await Promise.all(
    input.observers.map(async (observer) => {
      const loaded = await readNativeLivePerceptionScene({
        campaignId: state.campaignId,
        observerActorId: observer.actor.id,
        subjectActorId: input.subject.actor.id,
        capture
      })
      if (
        !loaded ||
        loaded.id !== sceneContext.sceneId ||
        loaded.version !== sceneContext.sceneVersion
      )
        throw new Error('Encounter action facts are stale.')
      const observerToken = loaded.scene.tokens.find((token) => token.id === loaded.observerTokenId)
      const subjectToken = loaded.scene.tokens.find((token) => token.id === loaded.subjectTokenId)
      if (!observerToken || !subjectToken) throw new Error('Encounter action facts are stale.')
      return {
        observer,
        placement: {
          scene: loaded.scene,
          sceneGrid: sceneContext.grid,
          observerToken,
          subjectToken,
          spatialEffects
        }
      }
    })
  )
  return resolveEncounterObserversSeeing({
    gameSystemId: state.gameSystemId,
    loadDefinition: (definitionId) =>
      readNativeLiveDefinition({ gameSystemId: state.gameSystemId, definitionId, capture }),
    loadSystem: async () => input.system,
    subject: input.subject,
    observers
  })
}

/**
 * Whether an observer sees a point of the action's locked Scene (an area's origin), by the same
 * perception rules and live Scene reads as `readNativeLiveAttackPerception`. A stale Scene is the
 * same refusal as there.
 */
export async function readNativeLivePointSight(input: {
  state: EncounterRunState
  system: SystemAuthoredDto
  observer: MovementTarget
  point: ScenePoint
  sceneContext: { sceneId: string; sceneVersion: number; grid: SceneGrid }
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const { state, capture, sceneContext } = input
  if (input.system.id !== state.gameSystemId)
    throw new Error('Attack perception System binding mismatch.')
  const loaded = await readNativeLivePerceptionScene({
    campaignId: state.campaignId,
    observerActorId: input.observer.actor.id,
    subjectActorId: input.observer.actor.id,
    capture
  })
  if (!loaded || loaded.id !== sceneContext.sceneId || loaded.version !== sceneContext.sceneVersion)
    throw new Error('Encounter action facts are stale.')
  const observerToken = loaded.scene.tokens.find((token) => token.id === loaded.observerTokenId)
  if (!observerToken) throw new Error('Encounter action facts are stale.')
  return resolveEncounterPointSight({
    gameSystemId: state.gameSystemId,
    loadDefinition: (definitionId) =>
      readNativeLiveDefinition({ gameSystemId: state.gameSystemId, definitionId, capture }),
    loadSystem: async () => input.system,
    observer: input.observer,
    point: input.point,
    placement: {
      scene: loaded.scene,
      sceneGrid: sceneContext.grid,
      observerToken,
      spatialEffects: await readNativeLiveSpatialEffects({
        encounterId: state.id,
        sceneId: loaded.id,
        sceneVersion: loaded.version,
        capture
      })
    }
  })
}

/**
 * What a saver sees of an area's origin, shaped as the perception a save's sight-gated contributors
 * read: the saver's own `targetSeesAttacker`. The believed sight is the saver's own facts on the
 * neutral environment, as for a creature source.
 */
export async function readNativeLivePointPerception(
  input: Parameters<typeof readNativeLivePointSight>[0]
) {
  const { state, capture } = input
  const [actual, believed] = await Promise.all([
    readNativeLivePointSight(input),
    resolveEncounterPointSight({
      gameSystemId: state.gameSystemId,
      loadDefinition: (definitionId) =>
        readNativeLiveDefinition({ gameSystemId: state.gameSystemId, definitionId, capture }),
      loadSystem: async () => input.system,
      observer: input.observer,
      point: input.point,
      placement: null
    })
  ])
  const perceptionOf = (sight: Awaited<typeof actual>) => ({
    targetSeesAttacker: sight,
    attackerSeesTarget: 'SEES' as const,
    targetSenseLabels: [],
    attackerSenseLabels: []
  })
  return { actual: perceptionOf(actual), believed: perceptionOf(believed) }
}
