import {
  createActiveRuleEffectRepository,
  createEncounterRepository,
  createReusableDefinitionRepository,
  createSpatialRuleEffectRepository,
  createVttSceneRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord,
  type EncounterSpatialRuleEffectRecord
} from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  effectiveSpatialGeometry,
  spatialGeometryIntersectsTokenFootprint,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'

import type {
  CharacterRuleActionPositionalCandidateFact,
  CharacterRuleActionPositionalFacts
} from '../rules/characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import { resolveEncounterRuleCapabilityStates } from './encounterRuleCapabilityState.js'
import { resolveEncounterCombatPerception } from './encounterCombatPerception.js'
import type { LockedCombatPerceptionEffect } from './encounterCombatPerceptionContributions.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type { LockedEncounterActionSceneContext } from './encounterActionSceneContext.js'

const MAX_POSITIONAL_CANDIDATES = 256

function mechanicalToken(token: SceneToken, actorId: string) {
  return {
    actorId,
    height: token.height,
    position: { x: token.position.x, y: token.position.y },
    rotationDegrees: token.rotationDegrees,
    tokenId: token.id,
    width: token.width
  }
}

function sameMechanicalToken(
  expected: LockedEncounterActionSceneContext['sourceToken'],
  actual: SceneToken,
  actorId: string | undefined
): boolean {
  return (
    actual.id === expected.tokenId &&
    actorId === expected.actorId &&
    actual.width === expected.width &&
    actual.height === expected.height &&
    actual.rotationDegrees === expected.rotationDegrees &&
    actual.position.x === expected.position.x &&
    actual.position.y === expected.position.y
  )
}

function activeEffectOwner(encounterId: string, actor: EncounterActorRecord) {
  if (actor.kind === 'CHARACTER') {
    if (!actor.sourceId)
      throw new EncounterValidationError('Encounter Character perception source is incomplete.')
    return { kind: 'CHARACTER' as const, characterId: actor.sourceId }
  }
  return {
    kind: 'ENCOUNTER_ACTOR' as const,
    encounterId,
    targetActorId: actor.id
  }
}

function combatPerceptionEffect(input: {
  id: string
  version: number
  createdOrdinal: number
  definitionChecksum: string
  definition: LockedCombatPerceptionEffect['definition']
}): LockedCombatPerceptionEffect {
  return input
}

function spatialEffect(effect: EncounterSpatialRuleEffectRecord): LockedCombatPerceptionEffect {
  return combatPerceptionEffect(effect)
}

function characterSenses(input: {
  actor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
}) {
  if (input.actor.kind !== 'CHARACTER' || !input.actor.sourceId) return []
  const locked = input.targets.lockedCharacters.get(input.actor.sourceId)
  if (!locked || locked.actor.id !== input.actor.id)
    throw new EncounterConflictError('Encounter Character positional source is stale.')
  return locked.mechanics.pinnedSenseDefinitions
}

function actorById(encounter: EncounterRecord, actorId: string): EncounterActorRecord {
  const actor = encounter.actors.find((candidate) => candidate.id === actorId)
  if (!actor) throw new EncounterConflictError('Action positional actor is stale.')
  return actor
}

/**
 * Locks and projects only the positional facts a System action policy can
 * consume. It intentionally owns no action execution and never returns a
 * raw Scene, labels, controller assignments, fog, or vision configuration.
 */
export async function lockEncounterActionPositionalFacts(input: {
  trx: DBLike
  encounter: EncounterRecord
  sceneContext: LockedEncounterActionSceneContext | null
  targets: LockedEncounterActiveEffectTargets
  capabilityDefinitionIds: readonly string[]
}): Promise<CharacterRuleActionPositionalFacts | null> {
  if (!input.sceneContext || input.capabilityDefinitionIds.length === 0) return null
  const capabilityDefinitionIds = [...new Set(input.capabilityDefinitionIds)].sort()
  if (capabilityDefinitionIds.length > 32)
    throw new EncounterValidationError('Action positional capability limit exceeded.')
  const repository = createVttSceneRepository(input.trx)
  const binding = await repository.findEncounterBinding(input.encounter.id)
  if (!binding) throw new EncounterConflictError('Action positional Scene context is stale.')
  const scene = await repository.lockLiveScene(binding.sceneId)
  if (
    !scene ||
    scene.state.id !== input.sceneContext.sceneId ||
    scene.state.version !== input.sceneContext.sceneVersion
  ) {
    throw new EncounterConflictError('Action positional Scene context is stale.')
  }
  const sourceToken = scene.state.tokens.find(
    (token) => token.id === input.sceneContext!.sourceToken.tokenId
  )
  const targetToken = scene.state.tokens.find(
    (token) => token.id === input.sceneContext!.targetToken.tokenId
  )
  const actorIdByTokenId = new Map<string, string>()
  for (const actorTokenBinding of await repository.listActorTokenBindings(input.encounter.id)) {
    if (actorIdByTokenId.has(actorTokenBinding.tokenId))
      throw new EncounterConflictError('Action positional token is stale.')
    actorIdByTokenId.set(actorTokenBinding.tokenId, actorTokenBinding.actorId)
  }
  if (
    !sourceToken ||
    !targetToken ||
    !sameMechanicalToken(
      input.sceneContext.sourceToken,
      sourceToken,
      actorIdByTokenId.get(sourceToken.id)
    ) ||
    !sameMechanicalToken(
      input.sceneContext.targetToken,
      targetToken,
      actorIdByTokenId.get(targetToken.id)
    )
  ) {
    throw new EncounterConflictError('Action positional Scene context is stale.')
  }
  const sourceActor = actorById(input.encounter, input.sceneContext.sourceToken.actorId)
  const targetActor = actorById(input.encounter, input.sceneContext.targetToken.actorId)
  const capabilityStates = await resolveEncounterRuleCapabilityStates({
    encounter: input.encounter,
    lockedCharacters: input.targets.lockedCharacters,
    activeEffectsByActorId: input.targets.activeEffectsByActorId,
    definitions: {
      requireCurrent: (definitionId) =>
        createReusableDefinitionRepository(input.trx).requireCurrent(definitionId)
    },
    capabilityDefinitionIds
  })
  const sourceCapabilityState = capabilityStates.get(sourceActor.id)
  const targetCapabilityState = capabilityStates.get(targetActor.id)
  if (!sourceCapabilityState || !targetCapabilityState)
    throw new EncounterConflictError('Action positional capability state is stale.')

  const spatialScope = await createSpatialRuleEffectRepository(input.trx).lockScope({
    encounterId: input.encounter.id,
    sceneId: scene.state.id
  })
  if (!spatialScope) throw new EncounterConflictError('Action positional spatial scope is stale.')
  const spatialEffects = await spatialScope.list()
  const activeEffects = createActiveRuleEffectRepository(input.trx)
  const activeEffectsByActor = new Map<string, readonly LockedCombatPerceptionEffect[]>()
  for (const actor of [...input.encounter.actors].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    activeEffectsByActor.set(
      actor.id,
      (await activeEffects.lockByOwner(activeEffectOwner(input.encounter.id, actor))).map(
        combatPerceptionEffect
      )
    )
  }
  const relationships = createEncounterRepository(input.trx)

  const canSee = async (
    observer: EncounterActorRecord,
    observerToken: SceneToken
  ): Promise<{
    checksum: string
    satisfied: boolean
  }> => {
    const localAreaEffects = spatialEffects.filter((effect) => {
      const geometry = effectiveSpatialGeometry(
        {
          anchorKind: effect.placement.anchorKind,
          geometry: effect.placement.geometry,
          sourceTokenId: effect.placement.sourceTokenId
        },
        scene.state.tokens
      )
      return (
        geometry !== null &&
        (spatialGeometryIntersectsTokenFootprint({
          geometry,
          token: observerToken
        }) ||
          spatialGeometryIntersectsTokenFootprint({
            geometry,
            token: targetToken
          }))
      )
    })
    const result = resolveEncounterCombatPerception({
      requirement: 'SEE',
      observerActorId: observer.id,
      scene: scene.state,
      sceneGrid: input.sceneContext!.grid,
      observerToken,
      subjectToken: targetToken,
      baselineCapabilities:
        (observer.systemId
          ? characterRuleActionSystemAdapterRegistry
              .get(observer.systemId)
              ?.combatPerceptionBaselineCapabilities?.({
                observerActorId: observer.id
              })
          : undefined) ?? [],
      pinnedSenseDefinitions: characterSenses({
        actor: observer,
        targets: input.targets
      }),
      observerEffects: activeEffectsByActor.get(observer.id) ?? [],
      subjectEffects: activeEffectsByActor.get(targetActor.id) ?? [],
      localAreaEffects: localAreaEffects.map(spatialEffect),
      sharedSurface: true,
      invisibleChannels: [],
      suppressedChannels: []
    })
    return {
      satisfied: result.satisfied,
      checksum: checksumRuleDocument({
        requirement: 'SEE',
        observerActorId: observer.id,
        targetActorId: targetActor.id,
        result
      })
    }
  }
  const sourcePerception = await canSee(sourceActor, sourceToken)
  const sourceTargetRelationship = await relationships.lockActorRelationship({
    encounterId: input.encounter.id,
    firstActorId: sourceActor.id,
    secondActorId: targetActor.id
  })
  if (!sourceTargetRelationship)
    throw new EncounterConflictError('Action positional relationship is stale.')

  const candidates: CharacterRuleActionPositionalCandidateFact[] = []
  for (const token of scene.state.tokens
    .filter((candidate) => {
      const actorId = actorIdByTokenId.get(candidate.id)
      return actorId !== undefined && actorId !== sourceActor.id && actorId !== targetActor.id
    })
    .sort(
      (left, right) =>
        actorIdByTokenId.get(left.id)!.localeCompare(actorIdByTokenId.get(right.id)!) ||
        left.id.localeCompare(right.id)
    )) {
    const actor = actorById(input.encounter, actorIdByTokenId.get(token.id)!)
    const state = capabilityStates.get(actor.id)
    if (!state) throw new EncounterConflictError('Action positional capability state is stale.')
    const [sourceRelationship, targetRelationship, perception] = await Promise.all([
      relationships.lockActorRelationship({
        encounterId: input.encounter.id,
        firstActorId: sourceActor.id,
        secondActorId: actor.id
      }),
      relationships.lockActorRelationship({
        encounterId: input.encounter.id,
        firstActorId: targetActor.id,
        secondActorId: actor.id
      }),
      canSee(actor, token)
    ])
    if (!sourceRelationship || !targetRelationship)
      throw new EncounterConflictError('Action positional relationship is stale.')
    candidates.push({
      actorId: actor.id,
      capabilityState: state.capabilityState,
      capabilityStateChecksum: state.capabilityState.checksum,
      canSeeTarget: perception.satisfied,
      perceptionChecksum: perception.checksum,
      sourceRelationship,
      targetRelationship,
      token: mechanicalToken(token, actor.id)
    })
  }
  if (candidates.length > MAX_POSITIONAL_CANDIDATES)
    throw new EncounterValidationError('Action positional candidate limit exceeded.')
  const dependency = {
    scene: {
      id: scene.state.id,
      version: scene.state.version,
      sourceTokenId: sourceToken.id,
      targetTokenId: targetToken.id
    },
    capabilityDefinitionIds,
    optionalCombatSnapshotChecksum: input.encounter.optionalCombatSnapshotChecksum ?? null,
    source: {
      actorId: sourceActor.id,
      capabilityStateChecksum: sourceCapabilityState.capabilityState.checksum,
      perceptionChecksum: sourcePerception.checksum,
      relationship: sourceTargetRelationship
    },
    target: {
      actorId: targetActor.id,
      capabilityStateChecksum: targetCapabilityState.capabilityState.checksum
    },
    candidates: candidates.map((candidate) => ({
      actorId: candidate.actorId,
      tokenId: candidate.token.tokenId,
      capabilityStateChecksum: candidate.capabilityStateChecksum,
      perceptionChecksum: candidate.perceptionChecksum,
      sourceRelationship: candidate.sourceRelationship,
      targetRelationship: candidate.targetRelationship
    }))
  }
  return {
    automationMode: input.encounter.automationMode,
    candidates,
    dependencyChecksum: checksumRuleDocument(dependency),
    optionalCombatSnapshot: input.encounter.optionalCombatSnapshot ?? null,
    optionalCombatSnapshotChecksum: input.encounter.optionalCombatSnapshotChecksum ?? null,
    sourceCapabilityState: sourceCapabilityState.capabilityState,
    sourceCapabilityStateChecksum: sourceCapabilityState.capabilityState.checksum,
    sourceCanSeeTarget: sourcePerception.satisfied,
    sourcePerceptionChecksum: sourcePerception.checksum,
    sourceTargetRelationship,
    targetCapabilityState: targetCapabilityState.capabilityState,
    targetCapabilityStateChecksum: targetCapabilityState.capabilityState.checksum
  }
}
