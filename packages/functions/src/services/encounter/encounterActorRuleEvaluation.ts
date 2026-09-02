import type { DBLike, EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import {
  ENCOUNTER_ACTOR_MODEL_KEY,
  type EncounterActorRuleInput,
  encounterActorRuleOutputSchema,
  type EncounterActorRuleOutput,
  type EncounterActorRuleResult,
  type EncounterActorFeatureResourceResult
} from '@artificer-toolkit/schema/api/encounterActorRules'
import { reconcileBoundedUsageTrack } from '@artificer-toolkit/shared/rules'

import { evaluateRuleRevision } from '../rules/ruleRevisionRuntime.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import {
  featureChargeUsed,
  snapshotFeatureDefinitions,
  withFeatureChargeUsed
} from './encounterActorState.js'
import { EncounterValidationError } from './encounterErrors.js'
import { encounterSystemIds, resolveActiveRulePackForSystems } from './encounterRuleIdentity.js'

export interface EncounterActorRuleSnapshot {
  encounterVersion: number
  revisionId: string
  facts: EncounterActorRuleInput
  output: EncounterActorRuleOutput
}

export interface EncounterActorRuleEvaluationResult {
  snapshot: EncounterActorRuleSnapshot
  reconciledEncounter: EncounterRecord
  actorUpdates: readonly EncounterActorRecord[]
  zenEvaluationMs: number
}

function structuralFacts(facts: EncounterActorRuleInput): unknown {
  return facts.actors.map((actor) => ({
    ...actor,
    featureResources: actor.featureResources.map((resource) => ({
      ...resource,
      used: 0
    }))
  }))
}

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
    const expectedSavingThrowIds = Object.keys(factActor.abilityScores).sort()
    const actualSavingThrowIds = (outputActor.savingThrowDefinitions ?? []).map(
      (savingThrow) => savingThrow.abilityDefinitionId
    )
    if (JSON.stringify(actualSavingThrowIds) !== JSON.stringify(expectedSavingThrowIds)) {
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

function reconcileEncounterActorRuleOutput(
  output: EncounterActorRuleOutput,
  facts: EncounterActorRuleInput,
  previousSnapshot?: EncounterActorRuleSnapshot
): EncounterActorRuleOutput {
  requireExactActorResourceIdentity(facts, output)
  return encounterActorRuleOutputSchema.parse({
    actors: output.actors.map((actor, actorIndex) => {
      const actorFacts = facts.actors[actorIndex]!
      const previousActor = previousSnapshot?.output.actors[actorIndex]
      return {
        ...actor,
        savingThrowDefinitions: actor.savingThrowDefinitions ?? [],
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

function bindEncounterActorRuleOutputToFacts(
  output: EncounterActorRuleOutput,
  facts: EncounterActorRuleInput
): EncounterActorRuleOutput {
  requireExactActorResourceIdentity(facts, output)
  return encounterActorRuleOutputSchema.parse({
    actors: output.actors.map((actor, actorIndex) => ({
      ...actor,
      savingThrowDefinitions: actor.savingThrowDefinitions ?? [],
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

function applyReconciledActorUsage(
  encounter: EncounterRecord,
  output: EncounterActorRuleOutput
): { encounter: EncounterRecord; actorUpdates: readonly EncounterActorRecord[] } {
  const rulesByActorId = new Map(output.actors.map((actor) => [actor.actorId, actor]))
  const actorUpdates: EncounterActorRecord[] = []
  const actors = encounter.actors.map((actor) => {
    if (actor.kind === 'CHARACTER') return actor
    const rules = rulesByActorId.get(actor.id)
    if (!rules) throw new EncounterValidationError(`Encounter actor "${actor.id}" changed.`)
    let resources = actor.resources
    for (const resource of rules.featureResources) {
      if (resource.maximum === null) continue
      const current = featureChargeUsed({ ...actor, resources }, resource.featureId)
      if (current !== resource.used) {
        resources = withFeatureChargeUsed(
          { ...actor, resources },
          resource.featureId,
          resource.used
        )
      }
    }
    if (resources === actor.resources) return actor
    const updated = { ...actor, resources }
    actorUpdates.push(updated)
    return updated
  })
  return { encounter: { ...encounter, actors }, actorUpdates }
}

export function refreshEncounterActorRuleSnapshot(
  snapshot: EncounterActorRuleSnapshot,
  encounter: EncounterRecord,
  revisionId = encounter.rulePackRevisionId
): EncounterActorRuleSnapshot | null {
  if (revisionId !== snapshot.revisionId) return null
  const facts = buildEncounterActorRuleFacts(encounter)
  if (JSON.stringify(structuralFacts(facts)) !== JSON.stringify(structuralFacts(snapshot.facts))) {
    return null
  }
  const previousByActorId = new Map(snapshot.output.actors.map((actor) => [actor.actorId, actor]))
  let requiresPersistence = false
  const output = encounterActorRuleOutputSchema.parse({
    actors: encounter.actors
      .filter((actor) => actor.kind !== 'CHARACTER')
      .map((actor) => {
        const previous = previousByActorId.get(actor.id)
        if (!previous) throw new EncounterValidationError(`Encounter actor "${actor.id}" changed.`)
        return {
          actorId: actor.id,
          initiativeModifier: previous.initiativeModifier,
          savingThrowDefinitions: previous.savingThrowDefinitions ?? [],
          targetProtection: previous.targetProtection,
          featureResources: snapshotFeatureDefinitions(actor).map((feature) => {
            const resource = previous.featureResources.find(
              (candidate) => candidate.featureId === feature.id
            )
            if (!resource) {
              throw new EncounterValidationError(
                `Encounter feature "${feature.id}" changed before projection.`
              )
            }
            const used = featureChargeUsed(actor, feature.id)
            const reconciled = reconcileFeatureResource(resource, used)
            if (reconciled.used !== used) requiresPersistence = true
            return { ...reconciled, rawUsed: used }
          })
        }
      })
  })
  if (requiresPersistence) return null
  return {
    encounterVersion: encounter.version,
    revisionId: snapshot.revisionId,
    facts,
    output
  }
}

export async function evaluateEncounterActorRuleSnapshot(input: {
  db: DBLike
  encounter: EncounterRecord
  revisionId?: string | null
  previousSnapshot?: EncounterActorRuleSnapshot
  effectiveScalarValuesByActorId?: ReadonlyMap<string, Readonly<Record<string, number>>>
}): Promise<EncounterActorRuleEvaluationResult> {
  let revisionId = input.revisionId ?? input.encounter.rulePackRevisionId
  if (!revisionId && input.encounter.status === 'PREPARED') {
    revisionId = (
      await resolveActiveRulePackForSystems(input.db, encounterSystemIds(input.encounter))
    ).revision.id
  }
  if (!revisionId)
    throw new EncounterValidationError('This Encounter does not have a pinned rule revision.')
  try {
    const sourceFacts = buildEncounterActorRuleFacts(
      input.encounter,
      input.effectiveScalarValuesByActorId
    )
    const evaluated = await evaluateRuleRevision({
      db: input.db,
      revisionId,
      modelKey: ENCOUNTER_ACTOR_MODEL_KEY,
      contractKey: ENCOUNTER_ACTOR_MODEL_KEY,
      normalizedFacts: sourceFacts
    })
    const reconciledOutput = reconcileEncounterActorRuleOutput(
      encounterActorRuleOutputSchema.parse(evaluated.result),
      sourceFacts,
      input.previousSnapshot
    )
    const reconciled = applyReconciledActorUsage(input.encounter, reconciledOutput)
    const facts = buildEncounterActorRuleFacts(
      reconciled.encounter,
      input.effectiveScalarValuesByActorId
    )
    const output = bindEncounterActorRuleOutputToFacts(reconciledOutput, facts)
    return {
      snapshot: {
        encounterVersion: input.encounter.version,
        revisionId,
        facts,
        output
      },
      reconciledEncounter: reconciled.encounter,
      actorUpdates: reconciled.actorUpdates,
      zenEvaluationMs: evaluated.evaluationDurationMs
    }
  } catch (error) {
    if (error instanceof EncounterValidationError) throw error
    const detail = error instanceof Error ? ` ${error.message.slice(0, 300)}` : ''
    throw new EncounterValidationError(
      `The pinned rule revision could not resolve Encounter actor state.${detail}`
    )
  }
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
