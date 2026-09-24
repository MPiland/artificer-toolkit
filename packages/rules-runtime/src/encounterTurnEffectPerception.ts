import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { pinnedSenseDefinitionSchema } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import type { ReusableDefinitionRootRecord } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  effectiveSpatialGeometry,
  spatialGeometryIntersectsTokenFootprint,
  type CampaignSceneState
} from '@artificer-toolkit/shared/vtt'

import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import { resolveEncounterCombatPerception } from './encounterCombatPerception.js'
import { deriveConditionCombatPerceptionContributions } from './encounterCombatPerceptionContributions.js'
import { buildMovementTarget, type MovementTarget } from './encounterMovementTargets.js'
import { resolveRuleCapabilityState } from './ruleCapabilityStateService.js'
import { encounterSceneGridPolicyRegistry } from './sceneGridPolicyRegistry.js'

type PerceptionScene = Pick<
  CampaignSceneState,
  'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights' | 'tokens'
>

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
  loadDefinition: (
    id: string
  ) => Promise<Pick<
    ReusableDefinitionRootRecord,
    'definitionFamilyKey' | 'gameSystemId' | 'current'
  > | null>
  loadSystem: () => Promise<SystemAuthoredDto>
  loadSpatialEffects: (sceneId: string) => Promise<readonly EncounterSpatialRuleEffectRecord[]>
}) {
  const adapter = characterRuleActionSystemAdapterRegistry.get(input.state.gameSystemId)
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
  const grid = encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
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
      activeConditionDefinitionIds: target.state.conditions,
      capabilityDefinitionIds: []
    })
  const [observerConditions, subjectConditions] = await Promise.all([
    conditionState(input.target),
    conditionState(subject)
  ])
  const senses = input.target.baseRulePolicyOutput?.senses ?? []
  if (senses.length > 100) throw new Error('Turn effect perception Sense limit exceeded.')
  const pins = []
  if (senses.length) {
    const system = await input.loadSystem()
    const seen = new Set<string>()
    for (const sense of senses) {
      if (
        seen.has(sense.senseDefinitionId) ||
        !system.senses.some((value) => value.id === sense.senseDefinitionId)
      )
        throw new Error('Turn effect perception Sense is not a unique System member.')
      seen.add(sense.senseDefinitionId)
      const root = await input.loadDefinition(sense.senseDefinitionId)
      if (
        !root?.current ||
        root.definitionFamilyKey !== 'sense' ||
        root.gameSystemId !== input.state.gameSystemId
      )
        throw new Error('Turn effect perception Sense is unavailable.')
      const document = senseReusableDefinitionDocumentDtoSchema.parse(root.current.document)
      if (
        document.id !== sense.senseDefinitionId ||
        document.gameSystemId !== input.state.gameSystemId ||
        checksumRuleDocument(document) !== root.current.checksum
      )
        throw new Error('Turn effect perception Sense is stale.')
      pins.push(
        pinnedSenseDefinitionSchema.parse({
          senseDefinitionId: sense.senseDefinitionId,
          definitionVersion: root.current.version,
          definitionContractVersion: root.current.contractVersion,
          definitionChecksum: root.current.checksum,
          document,
          range: sense.range
        })
      )
    }
  }
  const localAreaEffects = (await input.loadSpatialEffects(loadedScene.id)).filter((effect) => {
    const geometry = effectiveSpatialGeometry(effect.placement, scene.tokens)
    return (
      geometry !== null &&
      (spatialGeometryIntersectsTokenFootprint({ geometry, token: observerToken }) ||
        spatialGeometryIntersectsTokenFootprint({ geometry, token: subjectToken }))
    )
  })
  const result = resolveEncounterCombatPerception({
    requirement: dependency.requirement,
    observerActorId: input.target.actor.id,
    scene,
    sceneGrid: grid,
    observerToken,
    subjectToken,
    sharedSurface: true,
    invisibleChannels: [],
    suppressedChannels: [],
    baselineCapabilities:
      adapter?.combatPerceptionBaselineCapabilities?.({ observerActorId: input.target.actor.id }) ??
      [],
    pinnedSenseDefinitions: pins,
    observerEffects: input.target.activeEffects,
    subjectEffects: subject.activeEffects,
    localAreaEffects,
    observerConditionContributions: deriveConditionCombatPerceptionContributions({
      conditionDefinitions: observerConditions.conditionDefinitions,
      relation: 'OBSERVER',
      sceneGrid: grid
    }),
    subjectConditionContributions: deriveConditionCombatPerceptionContributions({
      conditionDefinitions: subjectConditions.conditionDefinitions,
      relation: 'SUBJECT',
      sceneGrid: grid
    })
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
