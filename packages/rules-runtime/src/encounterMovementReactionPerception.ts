import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { ReusableDefinitionRootRecord } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CampaignSceneState, SceneGrid } from '@artificer-toolkit/shared/vtt'

import type { EncounterMovementReactionContact } from './encounterMovementReactionContacts.js'
import type { EncounterMovementReactionSource } from './encounterMovementReactionSources.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { resolveEncounterActorPairPerception } from './encounterTurnEffectPerception.js'

type PerceptionScene = Pick<
  CampaignSceneState,
  'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights' | 'tokens'
>

/**
 * Evaluates movement reaction perception from already-authorized Encounter and Scene facts: the
 * reactor's Senses and conditions and the mover's conditions, at the mover's contact point.
 */
export async function createEncounterMovementReactionPerception(input: {
  state: EncounterRunState
  targets: ReadonlyMap<string, MovementTarget>
  movingTokenId: string
  actorIdByTokenId: ReadonlyMap<string, string>
  sceneId: string
  sceneVersion: number
  sceneGrid: SceneGrid
  scene: PerceptionScene
  loadSystem: () => Promise<SystemAuthoredDto>
  loadDefinition: (
    id: string
  ) => Promise<Pick<
    ReusableDefinitionRootRecord,
    'definitionFamilyKey' | 'gameSystemId' | 'current'
  > | null>
  loadSpatialEffects: (sceneId: string) => Promise<readonly EncounterSpatialRuleEffectRecord[]>
}): Promise<
  (contact: EncounterMovementReactionContact<EncounterMovementReactionSource>) => Promise<boolean>
> {
  const spatialEffects = await input.loadSpatialEffects(input.sceneId)

  return async (contact) => {
    const requirement = contact.source.source.binding.perceptionRequirement
    if (requirement === null) return true
    if (
      contact.source.reactorActorId !== contact.candidate.reactorActorId ||
      contact.source.reactorTokenId !== contact.candidate.reactorTokenId
    )
      throw new Error('Movement reaction perception binding is stale.')
    const observerToken = input.scene.tokens.find(
      (token) =>
        token.id === contact.candidate.reactorTokenId &&
        input.actorIdByTokenId.get(token.id) === contact.candidate.reactorActorId
    )
    const movingToken = input.scene.tokens.find(
      (token) =>
        token.id === input.movingTokenId &&
        input.actorIdByTokenId.get(token.id) === contact.candidate.movingActorId
    )
    const observer = input.targets.get(contact.candidate.reactorActorId)
    const subject = input.targets.get(contact.candidate.movingActorId)
    if (!observerToken || !movingToken || !observer || !subject)
      throw new Error('Movement reaction perception facts are stale.')
    return (
      await resolveEncounterActorPairPerception({
        gameSystemId: input.state.gameSystemId,
        requirement,
        observer,
        subject,
        observerConditionDefinitions: observer.conditionDefinitions,
        subjectConditionDefinitions: subject.conditionDefinitions,
        placement: {
          scene: input.scene,
          sceneGrid: input.sceneGrid,
          observerToken,
          subjectToken: { ...movingToken, position: contact.candidate.contact },
          spatialEffects
        },
        loadDefinition: input.loadDefinition,
        loadSystem: input.loadSystem
      })
    ).satisfied
  }
}
