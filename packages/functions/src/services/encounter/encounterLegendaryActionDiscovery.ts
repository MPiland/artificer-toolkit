import type { EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  assertEncounterFeatureActionCapabilityCurrent,
  type EncounterFeatureActionCapabilityDescriptor
} from '../rules/encounterFeatureActionCapabilityDiscovery.js'
import {
  evaluateLegendaryActionEligibility,
  requireLegendaryActionCapabilityDefinitionIds
} from '../rules/legendaryActionEligibilityRegistry.js'
import type { LegendaryActionEligibilitySource } from '../rules/legendaryActionEligibilityService.js'
import type { CurrentReusableDefinitionSource } from '../rules/ruleCapabilityStateService.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { findEncounterFeatureResource } from './encounterActorRuleEvaluation.js'
import {
  featureChargeUsed,
  snapshotFeatureDefinitions,
  withFeatureChargeUsed
} from './encounterActorState.js'
import type {
  LockedEncounterActiveEffectCharacter,
  LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { resolveEncounterRuleCapabilityStates } from './encounterRuleCapabilityState.js'

export interface EncounterLegendaryActionCandidate extends LegendaryActionEligibilitySource {
  action: EncounterFeatureActionCapabilityDescriptor
  featureCost: number
  poolBefore: number
  poolRemaining: number
  lifecycle: LegendaryActionEligibilitySource['lifecycle'] & {
    resourceRecovery: 'FULL'
    windowStage: 'END_OF_OTHER_ACTOR_TURN'
    refreshStage: 'START_OF_TURN'
    maximumActionsPerWindow: 1
  }
  eligibilityEvidence: Awaited<
    ReturnType<typeof evaluateLegendaryActionEligibility>
  >[number]['evidence']
}

export interface StagedLegendaryActionRefresh {
  ordinal: number
  actorId: string
  actorCurrentnessChecksum: string
  ownerFeatureId: string
  chargeId: string
  lifecycleDefinitionId: string
  lifecycleDefinitionVersion: number
  lifecycleDefinitionChecksum: string
  beforeUsed: number
  afterUsed: number
}

export interface EncounterLegendaryActionRefreshPlan {
  refreshes: readonly StagedLegendaryActionRefresh[]
  refreshedActor: EncounterActorRecord | null
}

function requireCurrentIntegrity(current: ReusableDefinitionCurrentDto): void {
  if (checksumRuleDocument(current.document) !== current.checksum) {
    throw new EncounterConflictError('Legendary Action lifecycle definition checksum is invalid.')
  }
}

function requireCreatureSnapshot(actor: EncounterActorRecord): {
  systemId: string
  features: readonly FeatureDto[]
} {
  if (actor.kind !== 'CREATURE' || !actor.systemId) {
    throw new EncounterValidationError('Legendary Actions require an immutable Creature owner.')
  }
  const features = snapshotFeatureDefinitions(actor)
  if (features.length === 0) {
    throw new EncounterValidationError(
      'Legendary Action Creature snapshot has no normalized Features.'
    )
  }
  return { systemId: actor.systemId, features }
}

function actorCurrentnessChecksum(actor: EncounterActorRecord): string {
  return checksumRuleDocument({
    id: actor.id,
    sourceId: actor.sourceId,
    sourceRevision: actor.sourceRevision,
    systemId: actor.systemId,
    snapshot: actor.snapshot,
    resources: actor.resources
  })
}

async function resolveLifecycle(input: {
  definitions: CurrentReusableDefinitionSource
  feature: FeatureDto
  gameSystemId: string
}): Promise<EncounterLegendaryActionCandidate['lifecycle'] | null> {
  const definitionIds = input.feature.ruleDefinitionIds ?? []
  const matching: EncounterLegendaryActionCandidate['lifecycle'][] = []
  for (const definitionId of definitionIds) {
    const current = await input.definitions.requireCurrent(definitionId)
    requireCurrentIntegrity(current)
    if (current.id !== definitionId || current.gameSystemId !== input.gameSystemId) {
      throw new EncounterConflictError(
        'Legendary Action lifecycle definition System identity is stale.'
      )
    }
    if (current.definitionFamilyKey !== 'dnd5e-encounter-lifecycle') continue
    const lifecycle = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(
      current.document
    )
    if (!lifecycle.success || lifecycle.data.kind !== 'LEGENDARY_ACTION') {
      continue
    }
    const graph = await input.definitions.requireCurrent(
      lifecycle.data.eligibilityGraph.definitionId
    )
    requireCurrentIntegrity(graph)
    if (
      graph.id !== lifecycle.data.eligibilityGraph.definitionId ||
      graph.gameSystemId !== input.gameSystemId ||
      graph.definitionFamilyKey !== 'rules-runtime-graph' ||
      graph.version !== lifecycle.data.eligibilityGraph.definitionVersion ||
      graph.checksum !== lifecycle.data.eligibilityGraph.definitionChecksum ||
      !ruleGraphDefinitionDtoSchema.safeParse(graph.document).success
    ) {
      throw new EncounterConflictError('Legendary Action eligibility graph pin is stale.')
    }
    matching.push({
      definitionId: current.id,
      definitionVersion: current.version,
      definitionChecksum: current.checksum,
      eligibilityGraphDefinitionId: graph.id,
      eligibilityGraphDefinitionVersion: graph.version,
      eligibilityGraphDefinitionChecksum: graph.checksum,
      eligibleOutput: lifecycle.data.eligibilityGraph.eligibleOutput,
      resourceRecovery: lifecycle.data.resourceRecovery,
      windowStage: lifecycle.data.windowStage,
      refreshStage: lifecycle.data.refreshStage,
      maximumActionsPerWindow: lifecycle.data.maximumActionsPerWindow
    })
  }
  if (matching.length === 0) return null
  if (matching.length !== 1) {
    throw new EncounterValidationError('Feature has ambiguous Legendary Action lifecycle bindings.')
  }
  return matching[0]!
}

function capabilityCost(
  capability: EncounterFeatureActionCapabilityDescriptor,
  ownerFeature: FeatureDto
): number | null {
  const resourceUse = capability.featureResourceUse
  const featureCharge =
    ownerFeature.charges?.limitKind === 'FIXED_AMOUNT' &&
    ownerFeature.charges.scalingKind === 'NONE'
      ? ownerFeature.charges
      : null
  if (
    capability.ownerFeatureId !== ownerFeature.id ||
    resourceUse === null ||
    featureCharge === null ||
    featureCharge.id !== resourceUse.chargeId ||
    !Number.isSafeInteger(featureCharge.amount) ||
    featureCharge.amount < 1 ||
    !Number.isSafeInteger(resourceUse.cost) ||
    resourceUse.cost < 1 ||
    resourceUse.cost > featureCharge.amount
  ) {
    return null
  }
  return resourceUse.cost
}

/**
 * Produces only exact owner-start refreshes. The turn coordinator applies the
 * returned actor rows inside its existing occurrence transaction, so a pause
 * or replay cannot consume this plan twice.
 */
export async function stageEncounterLegendaryActionRefreshes(input: {
  actorId: string
  encounter: Pick<EncounterRecord, 'actors' | 'gameSystemId'>
  actorRules: EncounterActorRuleOutput
  definitions: CurrentReusableDefinitionSource
}): Promise<EncounterLegendaryActionRefreshPlan> {
  const owner = input.encounter.actors.find((actor) => actor.id === input.actorId)
  if (!owner || owner.kind !== 'CREATURE') return { refreshes: [], refreshedActor: null }
  const snapshot = requireCreatureSnapshot(owner)
  let refreshed = owner
  const refreshes: StagedLegendaryActionRefresh[] = []
  for (const feature of [...snapshot.features].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const lifecycle = await resolveLifecycle({
      definitions: input.definitions,
      feature,
      gameSystemId: snapshot.systemId
    })
    if (!lifecycle) continue
    if (lifecycle.refreshStage !== 'START_OF_TURN' || lifecycle.resourceRecovery !== 'FULL') {
      continue
    }
    const charge =
      feature.charges?.limitKind === 'FIXED_AMOUNT' && feature.charges.scalingKind === 'NONE'
        ? feature.charges
        : null
    if (!charge || !Number.isSafeInteger(charge.amount) || charge.amount < 1) {
      throw new EncounterValidationError('Legendary Action refresh requires a fixed unscaled pool.')
    }
    const resource = findEncounterFeatureResource(input.actorRules, owner.id, feature.id)
    if (
      !resource ||
      resource.maximum !== charge.amount ||
      resource.used < 0 ||
      resource.used > charge.amount
    ) {
      throw new EncounterConflictError('Legendary Action pool state is stale.')
    }
    if (resource.used === 0) continue
    refreshes.push({
      ordinal: refreshes.length,
      actorId: owner.id,
      actorCurrentnessChecksum: actorCurrentnessChecksum(owner),
      ownerFeatureId: feature.id,
      chargeId: charge.id,
      lifecycleDefinitionId: lifecycle.definitionId,
      lifecycleDefinitionVersion: lifecycle.definitionVersion,
      lifecycleDefinitionChecksum: lifecycle.definitionChecksum,
      beforeUsed: resource.used,
      afterUsed: 0
    })
    refreshed = {
      ...refreshed,
      resources: withFeatureChargeUsed(refreshed, feature.id, 0)
    }
  }
  return { refreshes, refreshedActor: refreshes.length > 0 ? refreshed : null }
}

/** Revalidates and reconstructs a sealed owner-start plan against current persisted resources. */
export async function applyStagedLegendaryActionRefreshes(input: {
  encounter: Pick<EncounterRecord, 'actors' | 'gameSystemId'>
  definitions: CurrentReusableDefinitionSource
  refreshes: readonly StagedLegendaryActionRefresh[]
}): Promise<readonly EncounterActorRecord[]> {
  if (input.refreshes.length === 0) return []
  const actorIds = [...new Set(input.refreshes.map((refresh) => refresh.actorId))].sort()
  const actors: EncounterActorRecord[] = []
  for (const actorId of actorIds) {
    const expected = input.refreshes
      .filter((refresh) => refresh.actorId === actorId)
      .sort((left, right) => left.ordinal - right.ordinal)
    const owner = input.encounter.actors.find((actor) => actor.id === actorId)
    if (!owner || owner.kind !== 'CREATURE') {
      throw new EncounterConflictError('Legendary Action refresh owner is unavailable.')
    }
    if (
      expected.some(
        (refresh) => refresh.actorCurrentnessChecksum !== actorCurrentnessChecksum(owner)
      )
    ) {
      throw new EncounterConflictError('Legendary Action refresh owner is stale.')
    }
    const snapshot = requireCreatureSnapshot(owner)
    let refreshed = owner
    for (const refresh of expected) {
      const feature = snapshot.features.find((candidate) => candidate.id === refresh.ownerFeatureId)
      if (!feature) throw new EncounterConflictError('Legendary Action refresh Feature is stale.')
      const lifecycle = await resolveLifecycle({
        definitions: input.definitions,
        feature,
        gameSystemId: snapshot.systemId
      })
      const charge =
        feature.charges?.limitKind === 'FIXED_AMOUNT' && feature.charges.scalingKind === 'NONE'
          ? feature.charges
          : null
      if (
        !lifecycle ||
        lifecycle.definitionId !== refresh.lifecycleDefinitionId ||
        lifecycle.definitionVersion !== refresh.lifecycleDefinitionVersion ||
        lifecycle.definitionChecksum !== refresh.lifecycleDefinitionChecksum ||
        !charge ||
        charge.id !== refresh.chargeId ||
        refresh.afterUsed !== 0 ||
        featureChargeUsed(refreshed, feature.id) !== refresh.beforeUsed
      ) {
        throw new EncounterConflictError('Legendary Action refresh plan is stale.')
      }
      refreshed = {
        ...refreshed,
        resources: withFeatureChargeUsed(refreshed, feature.id, refresh.afterUsed)
      }
    }
    actors.push(refreshed)
  }
  return actors
}

/**
 * Discovers immutable Feature action capabilities attached to one exact
 * Legendary Action lifecycle definition. This is intentionally a pure
 * candidate/evaluation slice: choice persistence and resource mutation stay
 * in the later turn coordinator.
 */
export async function discoverEncounterLegendaryActionCandidates(input: {
  encounter: Pick<EncounterRecord, 'actors' | 'gameSystemId'>
  outgoingActorId: string
  occurrenceId: string
  actorRules: EncounterActorRuleOutput
  encounterFeatureCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  lockedCharacters: ReadonlyMap<string, LockedEncounterActiveEffectCharacter>
  activeEffectsByActorId: LockedEncounterActiveEffectTargets['activeEffectsByActorId']
  definitions: CurrentReusableDefinitionSource
  runtime: RulesRuntimeService
  windowUsed?: boolean
}): Promise<readonly EncounterLegendaryActionCandidate[]> {
  const capabilityDefinitionIds = requireLegendaryActionCapabilityDefinitionIds(
    input.encounter.gameSystemId
  )
  const capabilityStates = await resolveEncounterRuleCapabilityStates({
    encounter: input.encounter,
    lockedCharacters: input.lockedCharacters,
    activeEffectsByActorId: input.activeEffectsByActorId,
    definitions: input.definitions,
    capabilityDefinitionIds
  })
  const capabilitiesByActorId = new Map<string, EncounterFeatureActionCapabilityDescriptor[]>()
  for (const capability of input.encounterFeatureCapabilities) {
    const entries = capabilitiesByActorId.get(capability.encounterActorId) ?? []
    entries.push(capability)
    capabilitiesByActorId.set(capability.encounterActorId, entries)
  }
  const candidateInputs: {
    candidate: Omit<EncounterLegendaryActionCandidate, 'eligibilityEvidence'>
    facts: Parameters<typeof evaluateLegendaryActionEligibility>[0]['candidates'][number]['facts']
  }[] = []
  for (const actor of [...input.encounter.actors].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const capabilities = capabilitiesByActorId.get(actor.id) ?? []
    if (capabilities.length === 0) continue
    const snapshot = requireCreatureSnapshot(actor)
    const capabilityState = capabilityStates.get(actor.id)
    if (!capabilityState) {
      throw new EncounterConflictError('Legendary Action owner capability state is unavailable.')
    }
    const featuresById = new Map(snapshot.features.map((feature) => [feature.id, feature]))
    for (const capability of [...capabilities].sort((left, right) =>
      left.ownerFeatureId === right.ownerFeatureId
        ? left.actionId.localeCompare(right.actionId)
        : left.ownerFeatureId.localeCompare(right.ownerFeatureId)
    )) {
      assertEncounterFeatureActionCapabilityCurrent({ actor, capability })
      if (
        capability.gameSystemId !== input.encounter.gameSystemId ||
        capability.encounterActorId !== actor.id
      ) {
        throw new EncounterConflictError(
          'Legendary Action capability does not match its Encounter owner.'
        )
      }
      const ownerFeature = featuresById.get(capability.ownerFeatureId)
      if (!ownerFeature) {
        throw new EncounterConflictError('Legendary Action owner Feature is stale.')
      }
      const lifecycle = await resolveLifecycle({
        definitions: input.definitions,
        feature: ownerFeature,
        gameSystemId: snapshot.systemId
      })
      if (!lifecycle) continue
      const cost = capabilityCost(capability, ownerFeature)
      if (cost === null) continue
      const resource = findEncounterFeatureResource(input.actorRules, actor.id, ownerFeature.id)
      if (
        !resource ||
        resource.maximum === null ||
        resource.remaining === null ||
        resource.used < 0 ||
        resource.remaining < cost
      ) {
        continue
      }
      candidateInputs.push({
        candidate: {
          ownerActorId: actor.id,
          ownerFeatureId: ownerFeature.id,
          actionId: capability.actionId,
          gameSystemId: snapshot.systemId,
          action: capability,
          featureCost: cost,
          poolBefore: resource.remaining,
          poolRemaining: resource.remaining - cost,
          lifecycle
        },
        facts: {
          capabilityState: capabilityState.capabilityState,
          outgoingActorId: input.outgoingActorId,
          poolRemaining: resource.remaining,
          windowUsed: input.windowUsed ?? false
        }
      })
    }
  }
  const evaluated = await evaluateLegendaryActionEligibility({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    candidates: candidateInputs.map((entry) => ({
      source: entry.candidate,
      facts: entry.facts
    }))
  })
  return evaluated
    .filter((entry) => entry.policy.eligible)
    .map((entry) => ({ ...entry.source, eligibilityEvidence: entry.evidence }))
    .sort(
      (left, right) =>
        left.ownerActorId.localeCompare(right.ownerActorId) ||
        left.ownerFeatureId.localeCompare(right.ownerFeatureId) ||
        left.actionId.localeCompare(right.actionId)
    )
}
