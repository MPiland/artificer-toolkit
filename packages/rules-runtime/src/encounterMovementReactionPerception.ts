import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { ReusableDefinitionRootRecord } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CombatPerceptionEnvironment } from '@artificer-toolkit/shared/rules'
import {
  effectiveSpatialGeometry,
  spatialGeometryIntersectsTokenFootprint,
  type CampaignSceneState,
  type SceneGrid
} from '@artificer-toolkit/shared/vtt'

import { createActorSensePinner } from './actorSenses.js'
import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import { resolveEncounterCombatPerception } from './encounterCombatPerception.js'
import type { LockedCombatPerceptionEffect } from './encounterCombatPerceptionContributions.js'
import type { EncounterMovementReactionContact } from './encounterMovementReactionContacts.js'
import type { EncounterMovementReactionSource } from './encounterMovementReactionSources.js'
import type { MovementTarget } from './encounterMovementTargets.js'

type PerceptionScene = Pick<
  CampaignSceneState,
  'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights' | 'tokens'
>

/** Evaluates movement reaction perception from already-authorized Encounter and Scene facts. */
export async function createEncounterMovementReactionPerception(
  input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    targets: ReadonlyMap<string, MovementTarget>
    movingTokenId: string
    actorIdByTokenId: ReadonlyMap<string, string>
    sceneId: string
    sceneVersion: number
    sceneGrid: SceneGrid
    loadSystem: () => Promise<SystemAuthoredDto>
    loadDefinition: (
      id: string
    ) => Promise<Pick<
      ReusableDefinitionRootRecord,
      'definitionFamilyKey' | 'gameSystemId' | 'current'
    > | null>
    loadSpatialEffects: (sceneId: string) => Promise<readonly EncounterSpatialRuleEffectRecord[]>
  } & (
    | { scene: PerceptionScene; resolveEnvironment?: never }
    | {
        scene: Pick<CampaignSceneState, 'tokens'>
        resolveEnvironment: (input: {
          observerToken: Pick<CampaignSceneState['tokens'][number], 'position' | 'width' | 'height'>
          subjectToken: Pick<CampaignSceneState['tokens'][number], 'position' | 'width' | 'height'>
        }) => CombatPerceptionEnvironment
      }
  )
): Promise<
  (contact: EncounterMovementReactionContact<EncounterMovementReactionSource>) => Promise<boolean>
> {
  const spatialEffects = await input.loadSpatialEffects(input.sceneId)
  const effectsByActorId = new Map<string, readonly LockedCombatPerceptionEffect[]>()
  const pinsByActorId = new Map<string, readonly PinnedSenseDefinition[]>()
  const pinSenses = createActorSensePinner({
    gameSystemId: input.state.gameSystemId,
    loadSystem: input.loadSystem,
    loadDefinition: async (id) => (await input.loadDefinition(id))?.current ?? null
  })
  for (const actor of input.actors) {
    const target = input.targets.get(actor.id)
    if (!target || target.actor.id !== actor.id)
      throw new Error('Encounter actor perception target is unavailable.')
    effectsByActorId.set(actor.id, target.activeEffects)
    const pins = await pinSenses(target.perceptionSenses)
    if (pins.length) pinsByActorId.set(actor.id, pins.map(({ pin }) => pin))
  }
  if (effectsByActorId.size !== input.actors.length)
    throw new Error('Encounter perception effects are incomplete.')

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
    const observerActor = input.actors.find(
      (actor) => actor.id === contact.candidate.reactorActorId
    )
    if (!observerToken || !movingToken || !observerActor)
      throw new Error('Movement reaction perception facts are stale.')
    const observerEffects = effectsByActorId.get(observerActor.id)
    const subjectEffects = effectsByActorId.get(contact.candidate.movingActorId)
    if (!observerEffects || !subjectEffects)
      throw new Error('Movement reaction perception effects are unavailable.')
    const subjectToken = { ...movingToken, position: contact.candidate.contact }
    const localAreaEffects = spatialEffects.filter((effect) => {
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
        (spatialGeometryIntersectsTokenFootprint({ geometry, token: observerToken }) ||
          spatialGeometryIntersectsTokenFootprint({ geometry, token: subjectToken }))
      )
    })
    return resolveEncounterCombatPerception({
      requirement,
      observerActorId: observerActor.id,
      sceneGrid: input.sceneGrid,
      ...(input.resolveEnvironment
        ? { environment: input.resolveEnvironment({ observerToken, subjectToken }) }
        : {
            scene: input.scene,
            observerToken,
            subjectToken,
            sharedSurface: true,
            invisibleChannels: [],
            suppressedChannels: []
          }),
      baselineCapabilities:
        characterRuleActionSystemAdapterRegistry
          .get(input.state.gameSystemId)
          ?.combatPerceptionBaselineCapabilities?.({ observerActorId: observerActor.id }) ?? [],
      pinnedSenseDefinitions: pinsByActorId.get(observerActor.id) ?? [],
      observerEffects,
      subjectEffects,
      localAreaEffects
    }).satisfied
  }
}
