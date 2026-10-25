import {
  encounterActorRuleOutputSchema,
  type EncounterActorFeatureResourceResult,
  type EncounterActorRuleInput,
  type EncounterActorRuleOutput,
  type EncounterActorRuleResult
} from '@artificer-toolkit/schema/api/encounterActorRules'
import { reconcileBoundedUsageTrack } from '@artificer-toolkit/shared/rules'

import { EncounterValidationError } from './encounterErrors.js'

function reconcileFeatureResource(
  resource: EncounterActorFeatureResourceResult,
  rawUsed: number,
  previousMaximum = resource.maximum
): EncounterActorFeatureResourceResult {
  if (resource.maximum === null || resource.reconciliationPolicy === null) {
    if (resource.maximum !== null || resource.reconciliationPolicy !== null) {
      throw new EncounterValidationError(
        'Encounter feature resource reconciliation policy is incomplete.'
      )
    }
    return { ...resource, rawUsed, used: 0, remaining: null }
  }
  const reconciliation = reconcileBoundedUsageTrack({
    previousMaximum: previousMaximum ?? resource.maximum,
    nextMaximum: resource.maximum,
    previousUsed: rawUsed,
    policy: resource.reconciliationPolicy
  })
  return {
    ...resource,
    rawUsed,
    used: reconciliation.used,
    remaining: reconciliation.remaining
  }
}

function requireExactActorResourceIdentity(
  facts: EncounterActorRuleInput,
  output: EncounterActorRuleOutput
): void {
  if (facts.actors.length !== output.actors.length) {
    throw new EncounterValidationError('Encounter actor rule output does not match input actors.')
  }
  facts.actors.forEach((factActor, actorIndex) => {
    const outputActor = output.actors[actorIndex]
    if (!outputActor || outputActor.actorId !== factActor.actorId) {
      throw new EncounterValidationError(
        'Encounter actor rule output actor order does not match input facts.'
      )
    }
    if (
      JSON.stringify(outputActor.targetProtection) !== JSON.stringify(factActor.targetProtection)
    ) {
      throw new EncounterValidationError(
        `Encounter actor "${factActor.actorId}" target protections do not match input facts.`
      )
    }
    // A System without saving throws reports none; one with them reports one per ability score.
    const expectedSavingThrowIds = Object.keys(factActor.abilityScores).sort()
    const actualSavingThrowIds = outputActor.savingThrowDefinitions?.map(
      (savingThrow) => savingThrow.abilityDefinitionId
    )
    if (
      actualSavingThrowIds &&
      JSON.stringify(actualSavingThrowIds) !== JSON.stringify(expectedSavingThrowIds)
    ) {
      throw new EncounterValidationError(
        `Encounter actor "${factActor.actorId}" saving throws do not match input facts.`
      )
    }
    if (factActor.featureResources.length !== outputActor.featureResources.length) {
      throw new EncounterValidationError(
        `Encounter actor "${factActor.actorId}" rule resources do not match input facts.`
      )
    }
    factActor.featureResources.forEach((factResource, resourceIndex) => {
      const outputResource = outputActor.featureResources[resourceIndex]
      if (!outputResource || outputResource.featureId !== factResource.featureId) {
        throw new EncounterValidationError(
          `Encounter actor "${factActor.actorId}" rule resource order does not match input facts.`
        )
      }
    })
  })
}

export function reconcileEncounterActorRuleOutput(
  output: EncounterActorRuleOutput,
  facts: EncounterActorRuleInput,
  previous?: { output: EncounterActorRuleOutput }
): EncounterActorRuleOutput {
  requireExactActorResourceIdentity(facts, output)
  return encounterActorRuleOutputSchema.parse({
    actors: output.actors.map((actor, actorIndex) => {
      const actorFacts = facts.actors[actorIndex]!
      const previousActor = previous?.output.actors[actorIndex]
      return {
        ...actor,
        featureResources: actor.featureResources.map((resource, resourceIndex) => {
          const fact = actorFacts.featureResources[resourceIndex]!
          if (resource.rawUsed !== fact.used) {
            throw new EncounterValidationError(
              `Encounter feature "${resource.featureId}" output usage does not match input facts.`
            )
          }
          const previousMaximum = previousActor?.featureResources[resourceIndex]?.maximum
          const reconciled = reconcileFeatureResource(
            resource,
            fact.used,
            previousMaximum ?? resource.maximum
          )
          return { ...reconciled, rawUsed: fact.used }
        })
      }
    })
  })
}

export function bindEncounterActorRuleOutputToFacts(
  output: EncounterActorRuleOutput,
  facts: EncounterActorRuleInput
): EncounterActorRuleOutput {
  requireExactActorResourceIdentity(facts, output)
  return encounterActorRuleOutputSchema.parse({
    actors: output.actors.map((actor, actorIndex) => ({
      ...actor,
      featureResources: actor.featureResources.map((resource, resourceIndex) => {
        const used = facts.actors[actorIndex]!.featureResources[resourceIndex]!.used
        if (resource.maximum !== null && used > resource.maximum) {
          throw new EncounterValidationError(
            `Encounter feature "${resource.featureId}" reconciliation did not bound aggregate usage.`
          )
        }
        return {
          ...resource,
          rawUsed: used,
          used: resource.maximum === null ? 0 : used,
          remaining: resource.maximum === null ? null : resource.maximum - used
        }
      })
    }))
  })
}

export function requireEncounterActorRuleResult(
  output: EncounterActorRuleOutput,
  actorId: string
): EncounterActorRuleResult {
  const actor = output.actors.find((candidate) => candidate.actorId === actorId)
  if (!actor) {
    throw new EncounterValidationError(`Encounter actor "${actorId}" has no rule result.`)
  }
  return actor
}

export function findEncounterFeatureResource(
  output: EncounterActorRuleOutput,
  actorId: string,
  featureId: string
): EncounterActorFeatureResourceResult | null {
  return (
    requireEncounterActorRuleResult(output, actorId).featureResources.find(
      (candidate) => candidate.featureId === featureId
    ) ?? null
  )
}
