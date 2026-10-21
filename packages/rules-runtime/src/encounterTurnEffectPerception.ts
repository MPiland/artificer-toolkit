import { heldConditionIds } from './encounterInnateConditions.js'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { CombatPerceptionRequirementDto } from '@artificer-toolkit/schema/shared/combatPerception'
import type { ReusableDefinitionRootRecord } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { PinnedConditionRuleStateDefinitionDto } from '@artificer-toolkit/schema/shared/ruleState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  effectiveSpatialGeometry,
  spatialGeometryOverlapsTokenFootprint,
  type CampaignSceneState,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'

import { createActorSensePinner } from './actorSenses.js'
import { characterRuleActionSystemAdapterRegistry } from './platformEncounterPolicy.js'
import { resolveEncounterCombatPerception } from './encounterCombatPerception.js'
import { deriveConditionCombatPerceptionContributions } from './encounterCombatPerceptionContributions.js'
import { buildMovementTarget, type MovementTarget } from './encounterMovementTargets.js'
import { resolveRuleCapabilityState } from './ruleCapabilityStateService.js'
import { resolveEncounterSceneGrid } from './sceneGridPolicy.js'

type PerceptionScene = Pick<
  CampaignSceneState,
  'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights' | 'tokens'
>

type LoadPerceptionDefinition = (
  id: string
) => Promise<Pick<
  ReusableDefinitionRootRecord,
  'definitionFamilyKey' | 'gameSystemId' | 'current'
> | null>

/** Where an observer and a subject stand; without it the neutral Scene-free environment applies. */
export type EncounterActorPairPlacement = {
  scene: PerceptionScene
  sceneGrid: SceneGrid
  observerToken: SceneToken
  subjectToken: SceneToken
  /** Every spatial effect of the Scene; only those touching either footprint apply. */
  spatialEffects: readonly EncounterSpatialRuleEffectRecord[]
}

/** What perception reads of an actor: its effects, and for an observer its Senses. */
export type EncounterPerceptionActor = Pick<
  MovementTarget,
  'actor' | 'activeEffects' | 'perceptionSenses'
>

/** A gridless footing that only converts typed ranges; nothing is measured on it. */
const NEUTRAL_PERCEPTION_GRID: SceneGrid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }

/**
 * Resolves one perception requirement between two Encounter actors from already-authorized reads:
 * the observer's pinned Senses, both actors' pinned conditions and active effects, and the Scene
 * placement when there is one. Without a placement the explicit neutral environment applies, so
 * conditions and Senses still decide (D94).
 */
export async function resolveEncounterActorPairPerception(input: {
  gameSystemId: string
  requirement: CombatPerceptionRequirementDto
  observer: EncounterPerceptionActor
  subject: EncounterPerceptionActor
  observerConditionDefinitions: readonly PinnedConditionRuleStateDefinitionDto[]
  subjectConditionDefinitions: readonly PinnedConditionRuleStateDefinitionDto[]
  placement: EncounterActorPairPlacement | null
  loadDefinition: LoadPerceptionDefinition
  loadSystem: () => Promise<SystemAuthoredDto>
}) {
  const adapter = characterRuleActionSystemAdapterRegistry.find(input.gameSystemId)
  const observerActorId = input.observer.actor.id
  const { placement } = input
  const sceneGrid = placement?.sceneGrid ?? NEUTRAL_PERCEPTION_GRID
  const pins = (
    await createActorSensePinner({
      gameSystemId: input.gameSystemId,
      loadSystem: input.loadSystem,
      loadDefinition: async (id) => (await input.loadDefinition(id))?.current ?? null
    })(input.observer.perceptionSenses)
  ).map(({ pin }) => pin)
  const localAreaEffects = placement
    ? placement.spatialEffects.filter((effect) => {
        const geometry = effectiveSpatialGeometry(effect.placement, placement.scene.tokens)
        return (
          geometry !== null &&
          (spatialGeometryOverlapsTokenFootprint({ geometry, token: placement.observerToken }) ||
            spatialGeometryOverlapsTokenFootprint({ geometry, token: placement.subjectToken }))
        )
      })
    : []
  return resolveEncounterCombatPerception({
    gameSystemId: input.gameSystemId,
    requirement: input.requirement,
    observerActorId,
    sceneGrid,
    ...(placement
      ? {
          scene: placement.scene,
          observerToken: placement.observerToken,
          subjectToken: placement.subjectToken,
          sharedSurface: true,
          invisibleChannels: [],
          suppressedChannels: []
        }
      : {
          environment: {
            distance: 0,
            lineOfEffect: true,
            sharedSurface: true,
            illumination: 'BRIGHT' as const,
            obscurement: 'NONE' as const,
            invisibleChannels: [],
            suppressedChannels: []
          }
        }),
    baselineCapabilities:
      adapter?.combatPerceptionBaselineCapabilities?.({ observerActorId }) ?? [],
    pinnedSenseDefinitions: pins,
    observerEffects: input.observer.activeEffects,
    subjectEffects: input.subject.activeEffects,
    localAreaEffects,
    observerConditionContributions: deriveConditionCombatPerceptionContributions({
      conditionDefinitions: input.observerConditionDefinitions,
      relation: 'OBSERVER',
      sceneGrid
    }),
    subjectConditionContributions: deriveConditionCombatPerceptionContributions({
      conditionDefinitions: input.subjectConditionDefinitions,
      relation: 'SUBJECT',
      sceneGrid
    })
  })
}

/** Evaluates current turn-effect perception from already-authorized domain reads. */
export async function resolveEncounterTurnEffectPerception(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  target: MovementTarget
  targets: ReadonlyMap<string, MovementTarget>
  effect: ActiveRuleEffectRecord
  loadScene: (input: { observerActorId: string; subjectActorId: string }) => Promise<{
    id: string
    version: number
    scene: PerceptionScene
    observerTokenId: string
    subjectTokenId: string
  } | null>
  loadTarget: (actorId: string) => Promise<MovementTarget | undefined>
  loadDefinition: LoadPerceptionDefinition
  loadSystem: () => Promise<SystemAuthoredDto>
  loadSpatialEffects: (sceneId: string) => Promise<readonly EncounterSpatialRuleEffectRecord[]>
}) {
  const adapter = characterRuleActionSystemAdapterRegistry.find(input.state.gameSystemId)
  const dependency = adapter?.activeEffectPerceptionRequirement?.({
    definition: input.effect.definition,
    lifecycle: input.effect.lifecycle
  })
  if (!dependency) return null
  const { origin } = input.effect.definition
  const source = input.actors.find((actor) =>
    origin.kind === 'ENCOUNTER'
      ? actor.id === origin.sourceActorId
      : actor.kind === 'CHARACTER' && actor.sourceId === origin.sourceAggregateId
  )
  const unavailable = () => ({
    requirement: dependency.requirement,
    satisfied: false,
    checksum: checksumRuleDocument({
      requirement: dependency.requirement,
      targetActorId: input.target.actor.id,
      sourceActorId: source?.id ?? null,
      reason: 'UNAVAILABLE'
    })
  })
  if (!source) return unavailable()
  const loadedScene = await input.loadScene({
    observerActorId: input.target.actor.id,
    subjectActorId: source.id
  })
  if (!loadedScene) return unavailable()
  const { scene, observerTokenId, subjectTokenId } = loadedScene
  const observerToken = scene.tokens.find((token) => token.id === observerTokenId)
  const subjectToken = scene.tokens.find((token) => token.id === subjectTokenId)
  if (!observerToken || !subjectToken) return unavailable()
  const sourceTarget = input.targets.get(source.id) ?? (await input.loadTarget(source.id))
  if (!sourceTarget) throw new Error('Turn effect perception source is unavailable.')
  const subject = buildMovementTarget({
    actor: source,
    activeEffects: sourceTarget.activeEffects,
    characterFacts: sourceTarget.characterFacts,
    gameSystemId: input.state.gameSystemId,
    campaignId: input.state.campaignId
  })
  const grid = resolveEncounterSceneGrid({
    encounter: input.state,
    sceneGrid: scene.grid
  })
  const conditionState = (target: MovementTarget) =>
    resolveRuleCapabilityState({
      definitions: {
        requireCurrent: async (id) => {
          const root = await input.loadDefinition(id)
          if (!root?.current) throw new Error('Turn effect perception condition is unavailable.')
          return root.current
        }
      },
      gameSystemId: input.state.gameSystemId,
      activeConditionDefinitionIds: heldConditionIds(target),
      capabilityDefinitionIds: []
    })
  const [observerConditions, subjectConditions] = await Promise.all([
    conditionState(input.target),
    conditionState(subject)
  ])
  const result = await resolveEncounterActorPairPerception({
    gameSystemId: input.state.gameSystemId,
    requirement: dependency.requirement,
    observer: input.target,
    subject,
    observerConditionDefinitions: observerConditions.conditionDefinitions,
    subjectConditionDefinitions: subjectConditions.conditionDefinitions,
    placement: {
      scene,
      sceneGrid: grid,
      observerToken,
      subjectToken,
      spatialEffects: await input.loadSpatialEffects(loadedScene.id)
    },
    loadDefinition: input.loadDefinition,
    loadSystem: input.loadSystem
  })
  return {
    requirement: dependency.requirement,
    satisfied: result.satisfied,
    checksum: checksumRuleDocument({
      requirement: dependency.requirement,
      targetActorId: input.target.actor.id,
      sourceActorId: source.id,
      sceneId: loadedScene.id,
      sceneVersion: loadedScene.version,
      result
    })
  }
}
