import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { EncounterProjectionActorInput } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  assertEncounterFeatureActionCapabilityCurrent,
  type EncounterFeatureActionCapabilityDescriptor
} from './encounterFeatureActionCapabilityDiscovery.js'
import { findEncounterFeatureResource } from './encounterActorRuleOutput.js'
import {
  featureChargeUsed,
  snapshotFeatureDefinitions,
  withFeatureChargeUsed
} from './encounterActorState.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type {
  EncounterMovementReactionEncounter,
  EncounterMovementReactionRuleStateCharacterSource
} from './encounterMovementReactionSources.js'
import {
  evaluateLegendaryActionEligibility,
  requireLegendaryActionCapabilityDefinitionIds
} from './legendaryActionEligibilityService.js'
import type { LegendaryActionEligibilitySource } from './legendaryActionEligibilityService.js'
import { resolveEncounterRuleCapabilityStates } from './encounterRuleCapabilityState.js'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

type EncounterLegendaryActionActor = EncounterProjectionActorInput

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

interface StagedLegendaryActionRefresh {
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

interface EncounterLegendaryActionRefreshPlan<
  TActor extends EncounterLegendaryActionActor = EncounterLegendaryActionActor
> {
  refreshes: readonly StagedLegendaryActionRefresh[]
  refreshedActor: TActor | null
}

function requireCurrentIntegrity(current: ReusableDefinitionCurrentDto): void {
  if (checksumRuleDocument(current.document) !== current.checksum)
    throw new EncounterConflictError('Legendary Action lifecycle definition checksum is invalid.')
}

function requireCreatureSnapshot(actor: EncounterLegendaryActionActor): {
  systemId: string
  features: readonly FeatureDto[]
} {
  if (actor.kind !== 'CREATURE' || !actor.systemId)
    throw new EncounterValidationError('Legendary Actions require an immutable Creature owner.')
  const features = snapshotFeatureDefinitions(actor)
  if (features.length === 0)
    throw new EncounterValidationError(
      'Legendary Action Creature snapshot has no normalized Features.'
    )
  return { systemId: actor.systemId, features }
}

function actorCurrentnessChecksum(actor: EncounterLegendaryActionActor): string {
  return checksumRuleDocument({
    id: actor.id,
    sourceId: actor.sourceId,
    sourceRevision: actor.kind === 'CHARACTER' ? null : actor.sourceRevision,
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
  const matching: EncounterLegendaryActionCandidate['lifecycle'][] = []
  for (const definitionId of input.feature.ruleDefinitionIds ?? []) {
    const current = await input.definitions.requireCurrent(definitionId)
    requireCurrentIntegrity(current)
    if (current.id !== definitionId || current.gameSystemId !== input.gameSystemId)
      throw new EncounterConflictError(
        'Legendary Action lifecycle definition System identity is stale.'
      )
    if (current.definitionFamilyKey !== 'dnd5e-encounter-lifecycle') continue
    const lifecycle = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(
      current.document
    )
    if (!lifecycle.success || lifecycle.data.kind !== 'LEGENDARY_ACTION') continue
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
    )
      throw new EncounterConflictError('Legendary Action eligibility graph pin is stale.')
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
  if (matching.length !== 1)
    throw new EncounterValidationError('Feature has ambiguous Legendary Action lifecycle bindings.')
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
  )
    return null
  return resourceUse.cost
}

export async function stageEncounterLegendaryActionRefreshes<
  TActor extends EncounterLegendaryActionActor
>(input: {
  actorId: string
  encounter: Pick<EncounterMovementReactionEncounter, 'gameSystemId'> & {
    actors: readonly TActor[]
  }
  actorRules: EncounterActorRuleOutput
  definitions: CurrentReusableDefinitionSource
}): Promise<EncounterLegendaryActionRefreshPlan<TActor>> {
  const owner = input.encounter.actors.find((actor) => actor.id === input.actorId)
  if (!owner || owner.kind !== 'CREATURE') return { refreshes: [], refreshedActor: null }
  if (snapshotFeatureDefinitions(owner).length === 0) return { refreshes: [], refreshedActor: null }
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
    if (lifecycle.refreshStage !== 'START_OF_TURN' || lifecycle.resourceRecovery !== 'FULL')
      continue
    const charge =
      feature.charges?.limitKind === 'FIXED_AMOUNT' && feature.charges.scalingKind === 'NONE'
        ? feature.charges
        : null
    if (!charge || !Number.isSafeInteger(charge.amount) || charge.amount < 1)
      throw new EncounterValidationError('Legendary Action refresh requires a fixed unscaled pool.')
    const resource = findEncounterFeatureResource(input.actorRules, owner.id, feature.id)
    if (
      !resource ||
      resource.maximum !== charge.amount ||
      resource.used < 0 ||
      resource.used > charge.amount
    )
      throw new EncounterConflictError('Legendary Action pool state is stale.')
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
    refreshed = { ...refreshed, resources: withFeatureChargeUsed(refreshed, feature.id, 0) }
  }
  return { refreshes, refreshedActor: refreshes.length > 0 ? refreshed : null }
}

export async function applyStagedLegendaryActionRefreshes<
  TActor extends EncounterLegendaryActionActor
>(input: {
  encounter: Pick<EncounterMovementReactionEncounter, 'gameSystemId'> & {
    actors: readonly TActor[]
  }
  definitions: CurrentReusableDefinitionSource
  refreshes: readonly StagedLegendaryActionRefresh[]
}): Promise<readonly TActor[]> {
  if (input.refreshes.length === 0) return []
  const actorIds = [...new Set(input.refreshes.map((refresh) => refresh.actorId))].sort()
  const actors: TActor[] = []
  for (const actorId of actorIds) {
    const expected = input.refreshes
      .filter((refresh) => refresh.actorId === actorId)
      .sort((left, right) => left.ordinal - right.ordinal)
    const owner = input.encounter.actors.find((actor) => actor.id === actorId)
    if (!owner || owner.kind !== 'CREATURE')
      throw new EncounterConflictError('Legendary Action refresh owner is unavailable.')
    if (
      expected.some(
        (refresh) => refresh.actorCurrentnessChecksum !== actorCurrentnessChecksum(owner)
      )
    )
      throw new EncounterConflictError('Legendary Action refresh owner is stale.')
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
      )
        throw new EncounterConflictError('Legendary Action refresh plan is stale.')
      refreshed = {
        ...refreshed,
        resources: withFeatureChargeUsed(refreshed, feature.id, refresh.afterUsed)
      }
    }
    actors.push(refreshed)
  }
  return actors
}

export async function discoverEncounterLegendaryActionCandidates(input: {
  encounter: EncounterMovementReactionEncounter & {
    actors: readonly EncounterLegendaryActionActor[]
  }
  outgoingActorId: string
  occurrenceId: string
  actorRules: EncounterActorRuleOutput
  encounterFeatureCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  lockedCharacters: ReadonlyMap<string, EncounterMovementReactionRuleStateCharacterSource>
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  definitions: CurrentReusableDefinitionSource
  runtime: RulesRuntimeService
  windowUsed?: boolean
}): Promise<readonly EncounterLegendaryActionCandidate[]> {
  const capabilitiesByActorId = new Map<string, EncounterFeatureActionCapabilityDescriptor[]>()
  for (const capability of input.encounterFeatureCapabilities) {
    const entries = capabilitiesByActorId.get(capability.encounterActorId) ?? []
    entries.push(capability)
    capabilitiesByActorId.set(capability.encounterActorId, entries)
  }
  const candidateInputs: Omit<EncounterLegendaryActionCandidate, 'eligibilityEvidence'>[] = []
  for (const actor of [...input.encounter.actors].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const capabilities = capabilitiesByActorId.get(actor.id) ?? []
    if (capabilities.length === 0) continue
    const snapshot = requireCreatureSnapshot(actor)
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
      )
        throw new EncounterConflictError(
          'Legendary Action capability does not match its Encounter owner.'
        )
      const ownerFeature = featuresById.get(capability.ownerFeatureId)
      if (!ownerFeature)
        throw new EncounterConflictError('Legendary Action owner Feature is stale.')
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
      )
        continue
      candidateInputs.push({
        ownerActorId: actor.id,
        ownerFeatureId: ownerFeature.id,
        actionId: capability.actionId,
        gameSystemId: snapshot.systemId,
        action: capability,
        featureCost: cost,
        poolBefore: resource.remaining,
        poolRemaining: resource.remaining - cost,
        lifecycle
      })
    }
  }
  if (candidateInputs.length === 0) return []
  const ownerActorIds = new Set(candidateInputs.map((candidate) => candidate.ownerActorId))
  const capabilityStates = await resolveEncounterRuleCapabilityStates({
    encounter: {
      ...input.encounter,
      actors: input.encounter.actors.filter((actor) => ownerActorIds.has(actor.id))
    },
    lockedCharacters: input.lockedCharacters,
    activeEffectsByActorId: input.activeEffectsByActorId,
    definitions: input.definitions,
    capabilityDefinitionIds: requireLegendaryActionCapabilityDefinitionIds(
      input.encounter.gameSystemId
    )
  })
  const evaluated = await evaluateLegendaryActionEligibility({
    runtime: input.runtime,
    definitions: input.definitions,
    occurrenceId: input.occurrenceId,
    candidates: candidateInputs.map((candidate) => {
      const capabilityState = capabilityStates.get(candidate.ownerActorId)
      if (!capabilityState)
        throw new EncounterConflictError('Legendary Action owner capability state is unavailable.')
      return {
        source: candidate,
        facts: {
          capabilityState: capabilityState.capabilityState,
          outgoingActorId: input.outgoingActorId,
          poolRemaining: candidate.poolBefore,
          windowUsed: input.windowUsed ?? false
        }
      }
    })
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
