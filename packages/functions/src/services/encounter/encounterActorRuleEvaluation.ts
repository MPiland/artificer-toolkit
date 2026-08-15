import type { DBLike, EncounterRecord } from '@artificer-toolkit/db'
import {
  ENCOUNTER_ACTOR_MODEL_KEY,
  type EncounterActorRuleInput,
  encounterActorRuleOutputSchema,
  type EncounterActorRuleOutput,
  type EncounterActorRuleResult,
  type EncounterActorFeatureResourceResult
} from '@artificer-toolkit/schema/api/encounterActorRules'

import { evaluateRuleRevision } from '../rules/ruleRevisionRuntime.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { featureChargeUsed, snapshotFeatureDefinitions } from './encounterActorState.js'
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
  zenEvaluationMs: number
}

function structuralFacts(facts: EncounterActorRuleInput): unknown {
  return facts.actors.map((actor) => ({
    ...actor,
    featureResources: actor.featureResources.map((resource) => ({ ...resource, used: 0 }))
  }))
}

export function refreshEncounterActorRuleSnapshot(
  snapshot: EncounterActorRuleSnapshot,
  encounter: EncounterRecord
): EncounterActorRuleSnapshot | null {
  if (encounter.rulePackRevisionId !== snapshot.revisionId) return null
  const facts = buildEncounterActorRuleFacts(encounter)
  if (JSON.stringify(structuralFacts(facts)) !== JSON.stringify(structuralFacts(snapshot.facts))) {
    return null
  }
  const previousByActorId = new Map(snapshot.output.actors.map((actor) => [actor.actorId, actor]))
  const output = encounterActorRuleOutputSchema.parse({
    actors: encounter.actors
      .filter((actor) => actor.kind !== 'CHARACTER')
      .map((actor) => {
        const previous = previousByActorId.get(actor.id)
        if (!previous) throw new EncounterValidationError(`Encounter actor "${actor.id}" changed.`)
        return {
          actorId: actor.id,
          initiativeModifier: previous.initiativeModifier,
          featureResources: snapshotFeatureDefinitions(actor).map((feature) => {
            const resource = previous.featureResources.find(
              (candidate) => candidate.featureId === feature.id
            )
            if (!resource) {
              throw new EncounterValidationError(
                `Encounter feature "${feature.id}" changed before projection.`
              )
            }
            const rawUsed = featureChargeUsed(actor, feature.id)
            const used = resource.maximum === null ? 0 : Math.min(rawUsed, resource.maximum)
            return {
              ...resource,
              rawUsed,
              used,
              remaining: resource.maximum === null ? null : resource.maximum - used
            }
          })
        }
      })
  })
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
    const facts = buildEncounterActorRuleFacts(input.encounter)
    const evaluated = await evaluateRuleRevision({
      db: input.db,
      revisionId,
      modelKey: ENCOUNTER_ACTOR_MODEL_KEY,
      contractKey: ENCOUNTER_ACTOR_MODEL_KEY,
      normalizedFacts: facts
    })
    return {
      snapshot: {
        encounterVersion: input.encounter.version,
        revisionId,
        facts,
        output: encounterActorRuleOutputSchema.parse(evaluated.result)
      },
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

export async function evaluateEncounterActorRules(input: {
  db: DBLike
  encounter: EncounterRecord
  revisionId?: string | null
}): Promise<EncounterActorRuleOutput> {
  return (await evaluateEncounterActorRuleSnapshot(input)).snapshot.output
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
