import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import {
  liveSessionCharacterRulesResponseSchema,
  type LiveSessionCharacterRulesInput
} from './liveSessionCharacterRules.js'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterRulesRequestSchema,
  liveSessionEncounterRulesResponseSchema,
  type LiveSessionEncounterRulesInput
} from './liveSessionEncounterRules.js'

/** Maintenance slots a bundle reads for every Run actor (a System's Concentration slot). */
export const MAX_BUNDLED_MAINTENANCE_DEFINITIONS = 1

const admissionKinds = new Set([
  'ACTION_COMMAND',
  'ACTION_RESPONSE',
  'TURN_COMMAND',
  'CONCENTRATION_RESPONSE',
  'MOVEMENT_INPUTS'
])

/** Whether a capture is a command admission, the first read of a capture bundle. */
export function isLiveSessionCaptureBundleAdmission(request: { kind: string }): boolean {
  return admissionKinds.has(request.kind)
}

/**
 * One private capture of a room Encounter command's volatile inputs. `request` is the command's
 * admission capture; the bundle adds the reads its planner makes next under the same scope.
 */
export const liveSessionEncounterCaptureBundleInputSchema = z
  .extend(liveSessionEncounterRulesInputSchema, {
    maintenanceDefinitionIds: z
      .array(postgresUuidSchema)
      .check(z.maxLength(MAX_BUNDLED_MAINTENANCE_DEFINITIONS))
  })
  .check(
    z.refine(
      (input) => isLiveSessionCaptureBundleAdmission(input.request),
      'A capture bundle starts with a command admission.'
    )
  )

/**
 * Each part is exactly the response its own capture returns, with its own read checksum and
 * revisions. A bundle stops before the first part that would fail; the planner then reads that part
 * separately and meets the same refusal.
 */
export const liveSessionEncounterCaptureBundleSchema = z.strictObject({
  encounter: z
    .array(
      z.strictObject({
        request: liveSessionEncounterRulesRequestSchema,
        response: liveSessionEncounterRulesResponseSchema
      })
    )
    .check(z.maxLength(3 + MAX_ENCOUNTER_ACTORS * (1 + MAX_BUNDLED_MAINTENANCE_DEFINITIONS))),
  characters: z
    .array(
      z.strictObject({
        actorId: postgresUuidSchema,
        response: liveSessionCharacterRulesResponseSchema
      })
    )
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
})

export type LiveSessionEncounterCaptureBundleInput = z.infer<
  typeof liveSessionEncounterCaptureBundleInputSchema
>
export type LiveSessionEncounterCaptureBundle = z.infer<
  typeof liveSessionEncounterCaptureBundleSchema
>

/** The Character capture scope an Encounter capture scope admits for one Character actor. */
export function liveSessionCharacterRulesScope(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  actor: { id: string; sourceId: string }
): Omit<LiveSessionCharacterRulesInput, 'request'> {
  return {
    campaignId: scope.campaignId,
    authorityEpoch: scope.authorityEpoch,
    expectedUserId: scope.expectedUserId,
    expectedRole: scope.expectedRole,
    ...(scope.concentrationResponse ? { concentrationResponse: scope.concentrationResponse } : {}),
    ...(scope.turnCommand ? { turnCommand: scope.turnCommand } : {}),
    ...(scope.action ? { action: scope.action } : {}),
    ...(scope.movement ? { movement: { ...scope.movement, actorId: actor.id } } : {}),
    characterId: actor.sourceId
  }
}
