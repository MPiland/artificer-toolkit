import {
  createActiveRuleEffectRepository,
  type ActiveRuleEffectRecord,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord,
  type EncounterSpatialRuleEffectRecord
} from '@artificer-toolkit/db'
import {
  effectiveSpatialGeometry,
  spatialGeometryIntersectsTokenFootprint,
  type CampaignSceneState,
  type SceneGrid
} from '@artificer-toolkit/shared/vtt'

import type { LockedEncounterActiveEffectCharacter } from './encounterActiveEffectTargetState.js'
import { resolveEncounterCombatPerception } from './encounterCombatPerception.js'
import type { LockedCombatPerceptionEffect } from './encounterCombatPerceptionContributions.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type { EncounterMovementReactionContact } from './encounterMovementReactionContacts.js'
import type { EncounterMovementReactionSource } from './encounterMovementReactionSources.js'

function combatPerceptionEffect(
  effect: ActiveRuleEffectRecord | EncounterSpatialRuleEffectRecord
): LockedCombatPerceptionEffect {
  return {
    id: effect.id,
    version: effect.version,
    createdOrdinal: effect.createdOrdinal,
    definitionChecksum: effect.definitionChecksum,
    definition: effect.definition
  }
}

function activeEffectOwner(encounterId: string, actor: EncounterActorRecord) {
  if (actor.kind === 'CHARACTER') {
    if (!actor.sourceId) {
      throw new EncounterValidationError('Encounter Character perception source is incomplete.')
    }
    return { kind: 'CHARACTER' as const, characterId: actor.sourceId }
  }
  return {
    kind: 'ENCOUNTER_ACTOR' as const,
    encounterId,
    targetActorId: actor.id
  }
}

/**
 * Locks the exact active/spatial contribution sources once and returns the
 * factual perception resolver shared by fresh and resumed reaction choices.
 */
export async function lockEncounterMovementReactionPerceptionResolver(input: {
  trx: DBLike
  encounter: EncounterRecord
  movingTokenId: string
  scene: CampaignSceneState
  sceneGrid: SceneGrid
  actorIdByTokenId: ReadonlyMap<string, string>
  lockedCharacters: ReadonlyMap<string, LockedEncounterActiveEffectCharacter>
  spatialScope: { list(): Promise<readonly EncounterSpatialRuleEffectRecord[]> }
}): Promise<
  (contact: EncounterMovementReactionContact<EncounterMovementReactionSource>) => Promise<boolean>
> {
  const activeEffects = createActiveRuleEffectRepository(input.trx)
  const activeEffectsByActorId = new Map<string, readonly LockedCombatPerceptionEffect[]>()
  const actors = [...input.encounter.actors].sort((left, right) => {
    const leftKey = left.kind === 'CHARACTER' ? (left.sourceId ?? left.id) : left.id
    const rightKey = right.kind === 'CHARACTER' ? (right.sourceId ?? right.id) : right.id
    return leftKey.localeCompare(rightKey)
  })
  for (const actor of actors) {
    activeEffectsByActorId.set(
      actor.id,
      (await activeEffects.lockByOwner(activeEffectOwner(input.encounter.id, actor))).map(
        combatPerceptionEffect
      )
    )
  }
  const lockedSpatialEffects = await input.spatialScope.list()

  return async (contact) => {
    const requirement = contact.source.source.binding.perceptionRequirement
    if (requirement === null) return true
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
    const observerActor = input.encounter.actors.find(
      (actor) => actor.id === contact.candidate.reactorActorId
    )
    if (!observerToken || !movingToken || !observerActor) {
      throw new EncounterConflictError('Movement reaction perception facts are stale.')
    }
    const subjectToken = {
      ...movingToken,
      position: contact.candidate.contact
    }
    const pinnedSenseDefinitions =
      observerActor.kind === 'CHARACTER' && observerActor.sourceId
        ? (input.lockedCharacters.get(observerActor.sourceId)?.mechanics.pinnedSenseDefinitions ??
          [])
        : []
    const localAreaEffects = lockedSpatialEffects
      .filter((effect) => {
        const geometry = effectiveSpatialGeometry(
          {
            anchorKind: effect.placement.anchorKind,
            geometry: effect.placement.geometry,
            sourceTokenId: effect.placement.sourceTokenId
          },
          input.scene.tokens
        )
        return (
          geometry !== null &&
          (spatialGeometryIntersectsTokenFootprint({
            geometry,
            token: observerToken
          }) ||
            spatialGeometryIntersectsTokenFootprint({
              geometry,
              token: subjectToken
            }))
        )
      })
      .map(combatPerceptionEffect)
    return resolveEncounterCombatPerception({
      requirement,
      observerActorId: observerActor.id,
      scene: input.scene,
      sceneGrid: input.sceneGrid,
      observerToken,
      subjectToken,
      pinnedSenseDefinitions,
      observerEffects: activeEffectsByActorId.get(observerActor.id) ?? [],
      subjectEffects: activeEffectsByActorId.get(contact.candidate.movingActorId) ?? [],
      localAreaEffects,
      sharedSurface: true,
      invisibleChannels: [],
      suppressedChannels: []
    }).satisfied
  }
}
