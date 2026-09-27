import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'
import {
  liveSessionCharacterInputsResponseSchema,
  type LiveSessionCharacterRulesInput
} from './liveSessionCharacterRules.js'
import {
  liveSessionEncounterInputsResponseSchema,
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
  'CLEAVING_RESPONSE',
  'DISARM',
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
export const liveSessionEncounterCaptureBundleInputSchema = lazySchema(() =>
  z
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
)

/**
 * Each part is exactly the response its own capture returns, with its own read checksum and
 * revisions, except that the Run's System travels once: the Run `inputs` and each Character's
 * INPUTS omit it (their read checksums still cover it) and the receiver restores `system`. A bundle
 * stops before the first part that would fail; the planner then reads that part separately and
 * meets the same refusal.
 */
export const liveSessionEncounterCaptureBundleSchema = lazySchema(() =>
  z
    .strictObject({
      /** Every part except the Run INPUTS, in read order. */
      encounter: z
        .array(
          z.strictObject({
            request: liveSessionEncounterRulesRequestSchema,
            response: liveSessionEncounterRulesResponseSchema
          })
        )
        .check(z.maxLength(2 + MAX_ENCOUNTER_ACTORS * (1 + MAX_BUNDLED_MAINTENANCE_DEFINITIONS))),
      /** The Run's System; null only when the bundle stopped before the Run INPUTS. */
      system: z.nullable(systemAuthoredDtoSchema),
      inputs: z.nullable(z.omit(liveSessionEncounterInputsResponseSchema, { system: true })),
      characters: z
        .array(
          z.strictObject({
            actorId: postgresUuidSchema,
            response: z.omit(liveSessionCharacterInputsResponseSchema, { system: true })
          })
        )
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    })
    .check(
      z.refine(
        (bundle) =>
          (bundle.system === null) === (bundle.inputs === null) &&
          (bundle.system !== null || bundle.characters.length === 0),
        'A bundle carries its System exactly when it carries Run inputs.'
      )
    )
)

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
