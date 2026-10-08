import { v5 as uuidv5 } from 'uuid'

import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CombatPerceptionRequirementDto } from '@artificer-toolkit/schema/shared/combatPerception'
import {
  resolveCombatPerceptionWithContributions,
  type CombatPerceptionCapabilityInstance,
  type CombatPerceptionChannel,
  type CombatPerceptionEnvironment,
  type CombatPerceptionContributionResult
} from '@artificer-toolkit/shared/rules'
import {
  lengthMeasurementInSceneUnits,
  resolveSceneCombatPerceptionEnvironment,
  type CampaignSceneState,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'

import {
  deriveCombatPerceptionContributionPartitions,
  type LockedCombatPerceptionEffect
} from './encounterCombatPerceptionContributions.js'
import type { CombatPerceptionContributionSource } from '@artificer-toolkit/shared/rules'

const PINNED_SENSE_INSTANCE_NAMESPACE = 'e526f4c9-a37d-46a8-8f85-73568add6b56'

type PerceptionSceneState = Pick<
  CampaignSceneState,
  'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights'
>
type PerceptionSceneToken = Pick<SceneToken, 'height' | 'position' | 'width'>

function pinnedSenseInstanceId(observerActorId: string, pin: PinnedSenseDefinition): string {
  return uuidv5(
    `${observerActorId}:${pin.senseDefinitionId}:${pin.definitionChecksum}`,
    PINNED_SENSE_INSTANCE_NAMESPACE
  )
}

function combatPerceptionCapabilitiesFromPinnedSenses(input: {
  observerActorId: string
  sceneGrid: SceneGrid
  pinnedSenseDefinitions: readonly PinnedSenseDefinition[]
}): readonly CombatPerceptionCapabilityInstance[] {
  return [...input.pinnedSenseDefinitions]
    .sort((left, right) => left.senseDefinitionId.localeCompare(right.senseDefinitionId))
    .flatMap((pin) => {
      const instanceId = pinnedSenseInstanceId(input.observerActorId, pin)
      const range = lengthMeasurementInSceneUnits(pin.range, input.sceneGrid)
      return pin.document.capabilities.map((capability, capabilityOrdinal) => ({
        instanceId,
        definitionId: pin.senseDefinitionId,
        checksum: pin.definitionChecksum,
        capabilityOrdinal,
        range,
        capability
      }))
    })
}

/**
 * Evaluates one exact System-authored perception requirement from locked Scene,
 * actor capability, and active-effect facts. It performs no repository reads and
 * emits no recipient projection; the owning Encounter transaction supplies only
 * already-authorized, current inputs.
 */
export function resolveEncounterCombatPerception(
  input: {
    requirement: CombatPerceptionRequirementDto
    observerActorId: string
    sceneGrid: SceneGrid
    /** Exact System-policy baseline capabilities for this observer. */
    baselineCapabilities?: readonly CombatPerceptionCapabilityInstance[]
    pinnedSenseDefinitions: readonly PinnedSenseDefinition[]
    observerEffects: readonly LockedCombatPerceptionEffect[]
    subjectEffects: readonly LockedCombatPerceptionEffect[]
    localAreaEffects: readonly LockedCombatPerceptionEffect[]
    observerConditionContributions?: readonly CombatPerceptionContributionSource[]
    subjectConditionContributions?: readonly CombatPerceptionContributionSource[]
  } & (
    | {
        scene: PerceptionSceneState
        observerToken: PerceptionSceneToken
        subjectToken: PerceptionSceneToken
        sharedSurface: boolean
        invisibleChannels: readonly CombatPerceptionChannel[]
        suppressedChannels: readonly CombatPerceptionChannel[]
        environment?: never
      }
    | { environment: CombatPerceptionEnvironment }
  )
): CombatPerceptionContributionResult {
  const capabilities = [
    ...(input.baselineCapabilities ?? []),
    ...combatPerceptionCapabilitiesFromPinnedSenses({
      observerActorId: input.observerActorId,
      sceneGrid: input.sceneGrid,
      pinnedSenseDefinitions: input.pinnedSenseDefinitions
    })
  ]
  const environment =
    input.environment ??
    resolveSceneCombatPerceptionEnvironment({
      scene: { ...input.scene, grid: input.sceneGrid },
      observer: input.observerToken,
      subject: input.subjectToken,
      sharedSurface: input.sharedSurface,
      invisibleChannels: input.invisibleChannels,
      suppressedChannels: input.suppressedChannels
    })
  const contributions = deriveCombatPerceptionContributionPartitions({
    sceneGrid: input.sceneGrid,
    observerEffects: input.observerEffects,
    subjectEffects: input.subjectEffects,
    localAreaEffects: input.localAreaEffects
  })
  return resolveCombatPerceptionWithContributions({
    requirement: input.requirement,
    environment,
    capabilities,
    observerContributions: [
      ...contributions.observerContributions,
      ...(input.observerConditionContributions ?? [])
    ],
    subjectContributions: [
      ...contributions.subjectContributions,
      ...(input.subjectConditionContributions ?? [])
    ],
    localAreaContributions: contributions.localAreaContributions
  })
}
