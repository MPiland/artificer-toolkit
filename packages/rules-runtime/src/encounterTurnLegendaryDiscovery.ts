import {
  discoverEncounterLegendaryActionCandidates,
  type EncounterLegendaryActionCandidate
} from './encounterLegendaryActionDiscovery.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { snapshotFeatureDefinitions } from './encounterActorState.js'
import { defeatedEncounterActorIds, type DeadCharacterIds } from './encounterActorDefeat.js'
import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import { compileEncounterFeatureActionPlan } from './encounterActionMechanicsPreparation.js'
import { buildCompiledActionTargetPolicy } from './encounterActionEntryPointCompiler.js'
import { evaluateEncounterActionTargetPolicy } from './encounterActionTargetPolicy.js'
import { discoverEncounterFeatureActionCapabilities } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { reconcileEncounterActorRuleOutput } from './encounterActorRuleOutput.js'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import { legendaryActionChoiceGroupDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { z } from 'zod'
import type { EncounterMovementReactionRuleStateCharacterSource } from './encounterMovementReactionSources.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

type LegendaryActionChoiceGroupDto = z.infer<typeof legendaryActionChoiceGroupDtoSchema>

/**
 * The option for one candidate: the action it runs, planned exactly as the action runs, and the
 * actors it may target. Null when the System cannot execute its authored shape inside a turn yet
 * (an area, or an action that starts an active effect).
 */
function optionForCandidate(
  candidate: EncounterLegendaryActionCandidate,
  actorIds: readonly string[]
): LegendaryActionChoiceGroupDto['options'][number] | null {
  const resource = candidate.action.featureResourceUse
  const adapter = characterRuleActionSystemAdapterRegistry.get(candidate.gameSystemId)
  if (!resource || !adapter) throw new Error('The Legendary Action source cannot be executed.')
  let plan: ReturnType<typeof compileEncounterFeatureActionPlan>
  try {
    plan = compileEncounterFeatureActionPlan(adapter, candidate.action)
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return null
    throw error
  }
  const published = plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
  if (adapter.activeEffectPlans?.({ action: candidate.action, published }).length) return null
  const targetPolicy = buildCompiledActionTargetPolicy(candidate.action)
  const owner = { id: candidate.ownerActorId, disposition: 'NEUTRAL' as const }
  if (
    evaluateEncounterActionTargetPolicy({
      actor: owner,
      target: owner,
      targetPolicy,
      sceneContext: null
    }) === null
  )
    return null
  const targetActorIds =
    targetPolicy.range.rangeKind === 'SELF'
      ? [candidate.ownerActorId]
      : actorIds.filter((actorId) => actorId !== candidate.ownerActorId).sort()
  if (targetActorIds.length === 0) return null
  const optionWithoutId = {
    ownerActorId: candidate.ownerActorId,
    ownerFeatureId: candidate.ownerFeatureId,
    actionId: candidate.actionId,
    label: candidate.action.label,
    targetActorIds,
    actionSourceChecksum: checksumRuleDocument(plan),
    chargeId: resource.chargeId,
    featureCost: candidate.featureCost,
    poolBefore: candidate.poolBefore,
    poolRemaining: candidate.poolRemaining,
    lifecycle: {
      definitionId: candidate.lifecycle.definitionId,
      definitionVersion: candidate.lifecycle.definitionVersion,
      definitionChecksum: candidate.lifecycle.definitionChecksum,
      eligibilityGraphDefinitionId: candidate.lifecycle.eligibilityGraphDefinitionId,
      eligibilityGraphDefinitionVersion: candidate.lifecycle.eligibilityGraphDefinitionVersion,
      eligibilityGraphDefinitionChecksum: candidate.lifecycle.eligibilityGraphDefinitionChecksum,
      eligibleOutput: candidate.lifecycle.eligibleOutput
    },
    eligibilityEvidenceChecksum: checksumRuleDocument(candidate.eligibilityEvidence)
  }
  return { ...optionWithoutId, optionId: checksumRuleDocument(optionWithoutId) }
}
/** Discovers current eligible Legendary Action choices without staging or mutating a turn. */
export async function discoverTurnLegendaryWindows(input: {
  state: EncounterRunState
  occurrenceId: string
  outgoingActorId: string
  actors: readonly EncounterRunActorState[]
  deadCharacterIds: DeadCharacterIds
  movementTargets?: ReadonlyMap<string, MovementTarget>
  loadTargets(actorIds: readonly string[]): Promise<ReadonlyMap<string, MovementTarget>>
  loadSystem(): Promise<SystemAuthoredDto>
  definitions: CurrentReusableDefinitionSource
  createRuntime(): Promise<RulesRuntimeService>
}): Promise<
  readonly {
    choice: LegendaryActionChoiceGroupDto
    candidatesByOptionId: ReadonlyMap<string, EncounterLegendaryActionCandidate>
  }[]
> {
  // A defeated creature takes no Legendary Actions and is no one's target (D63).
  const defeatedActorIds = defeatedEncounterActorIds(input.actors, input.deadCharacterIds)
  const actors = input.actors.filter(
    (actor) => actor.kind === 'CREATURE' && !defeatedActorIds.has(actor.id)
  )
  if (actors.length === 0) return []
  // A Legendary Action candidate requires a fixed, unscaled Feature charge pool.
  if (
    actors.every((actor) => {
      const features = snapshotFeatureDefinitions(actor)
      return (
        Boolean(actor.systemId) &&
        features.length > 0 &&
        features.every(
          (feature) =>
            feature.charges?.limitKind !== 'FIXED_AMOUNT' || feature.charges.scalingKind !== 'NONE'
        )
      )
    })
  )
    return []
  const targets = new Map(
    await input.loadTargets(
      actors.filter((actor) => !input.movementTargets?.has(actor.id)).map((actor) => actor.id)
    )
  )
  for (const actor of actors) {
    const staged = input.movementTargets?.get(actor.id)
    if (staged) targets.set(actor.id, staged)
  }
  const lockedCharacters = new Map<string, EncounterMovementReactionRuleStateCharacterSource>()
  const system = await input.loadSystem()
  if (system.id !== input.state.gameSystemId)
    throw new Error('The selected Game System is unavailable.')
  const abilityDefinitions =
    'abilities' in system && Array.isArray(system.abilities)
      ? system.abilities.map(({ id, code }) => ({ id, code }))
      : []
  const facts = buildEncounterActorRuleFacts({ actors })
  const actorRules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: input.state.gameSystemId, facts }),
    facts
  )
  const candidates = await discoverEncounterLegendaryActionCandidates({
    encounter: { ...input.state, actors },
    outgoingActorId: input.outgoingActorId,
    occurrenceId: input.occurrenceId,
    actorRules,
    encounterFeatureCapabilities: actors.flatMap((actor) =>
      actor.kind === 'CREATURE'
        ? discoverEncounterFeatureActionCapabilities({
            actor,
            conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
            abilityDefinitions
          })
        : []
    ),
    lockedCharacters,
    activeEffectsByActorId: new Map(
      [...targets].map(([actorId, target]) => [actorId, target.activeEffects])
    ),
    definitions: {
      requireCurrent: async (definitionId) => {
        const definition = await input.definitions.requireCurrent(definitionId)
        if (definition.gameSystemId !== input.state.gameSystemId)
          throw new Error('Legendary Action definition is unavailable.')
        return definition
      }
    },
    runtime: await input.createRuntime()
  })
  const ownerActorIds = [...new Set(candidates.map((candidate) => candidate.ownerActorId))]
  return ownerActorIds.flatMap((ownerActorId) => {
    const candidatesByOptionId = new Map<string, EncounterLegendaryActionCandidate>()
    // An option the System cannot execute yet is left out; it never fails the whole window.
    const options = candidates
      .filter((candidate) => candidate.ownerActorId === ownerActorId)
      .flatMap((candidate) => {
        const option = optionForCandidate(
          candidate,
          input.state.actorIds.filter((actorId) => !defeatedActorIds.has(actorId))
        )
        if (!option) return []
        if (candidatesByOptionId.has(option.optionId))
          throw new Error('Legendary Action choice identity is ambiguous.')
        candidatesByOptionId.set(option.optionId, candidate)
        return [option]
      })
    return options.length === 0
      ? []
      : [
          {
            choice: legendaryActionChoiceGroupDtoSchema.parse({ ownerActorId, options }),
            candidatesByOptionId
          }
        ]
  })
}
