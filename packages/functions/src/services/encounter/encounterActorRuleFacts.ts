import type { EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import {
  encounterActorRuleInputSchema,
  type EncounterActorRuleInput
} from '@artificer-toolkit/schema/api/encounterActorRules'
import { abilityCodeSchema } from '@artificer-toolkit/schema/shared/enums'

import { featureChargeUsed, snapshotFeatureDefinitions } from './encounterActorState.js'

function snapshotAbilityScores(actor: EncounterActorRecord): Record<string, number> {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    return {}
  }
  const payload = actor.snapshot.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return {}
  const abilityScores = payload.abilityScores
  if (typeof abilityScores !== 'object' || abilityScores === null || Array.isArray(abilityScores)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(abilityScores).filter(
      (entry): entry is [string, number] =>
        abilityCodeSchema.safeParse(entry[0]).success &&
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1])
    )
  )
}

export function buildEncounterActorRuleFacts(encounter: EncounterRecord): EncounterActorRuleInput {
  return encounterActorRuleInputSchema.parse({
    contractVersion: 1,
    actors: encounter.actors
      .filter((actor) => actor.kind !== 'CHARACTER')
      .map((actor) => ({
        actorId: actor.id,
        abilityScores: snapshotAbilityScores(actor),
        featureResources: snapshotFeatureDefinitions(actor).map((feature) => ({
          featureId: feature.id,
          charge: feature.charges ?? null,
          used: featureChargeUsed(actor, feature.id)
        }))
      }))
  })
}
