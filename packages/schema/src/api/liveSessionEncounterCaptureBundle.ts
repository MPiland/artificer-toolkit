import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'
import type { LiveSessionRulesRevisions } from './liveSessionRulesRevisions.js'
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
 * The SYSTEM and CAMPAIGN revisions a room holds the Run's System at, the same stamps its capture
 * cache keys System-level reads on.
 */
export const liveSessionSystemStampSchema = lazySchema(() =>
  z.strictObject({
    systemId: postgresUuidSchema,
    systemRevision: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    campaignRevision: postgresUuidSchema
  })
)

/**
 * One private capture of a room Encounter command's volatile inputs. `request` is the command's
 * admission capture; the bundle adds the reads its planner makes next under the same scope.
 * `cachedSystem` is the stamp of the Run System the room holds, or null when it holds none.
 */
export const liveSessionEncounterCaptureBundleInputSchema = lazySchema(() =>
  z
    .extend(liveSessionEncounterRulesInputSchema, {
      maintenanceDefinitionIds: z
        .array(postgresUuidSchema)
        .check(z.maxLength(MAX_BUNDLED_MAINTENANCE_DEFINITIONS)),
      cachedSystem: z.nullable(liveSessionSystemStampSchema)
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
 * revisions, except that the Run's System travels at most once: the Run `inputs` and each
 * Character's INPUTS omit it (their read checksums still cover it) and the receiver restores it.
 * `system` is the System itself, or UNCHANGED when it is the one the room holds at the requested
 * `cachedSystem` stamp, which is then exactly the stamp of the Run `inputs` revisions. A bundle
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
      system: z.nullable(
        z.discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('SYSTEM'), system: systemAuthoredDtoSchema }),
          z.strictObject({ kind: z.literal('UNCHANGED'), stamp: liveSessionSystemStampSchema })
        ])
      ),
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
          (bundle.system !== null || bundle.characters.length === 0) &&
          (bundle.system?.kind !== 'UNCHANGED' ||
            (bundle.inputs !== null &&
              sameSystemStamp(
                bundle.system.stamp,
                liveSessionSystemStamp(bundle.inputs.revisions)
              ))),
        'A bundle carries its System, or its unchanged stamp, exactly when it carries Run inputs.'
      )
    )
)

export type LiveSessionSystemStamp = z.infer<typeof liveSessionSystemStampSchema>

/** The Run System stamp of a capture's revisions; null unless both are observed. */
export function liveSessionSystemStamp(
  revisions: LiveSessionRulesRevisions
): LiveSessionSystemStamp | null {
  const system = revisions.find((observation) => observation.scope === 'SYSTEM')
  const campaign = revisions.find((observation) => observation.scope === 'CAMPAIGN')
  return system?.revision && campaign?.revision
    ? {
        systemId: system.id,
        systemRevision: system.revision,
        campaignId: campaign.id,
        campaignRevision: campaign.revision
      }
    : null
}

export function sameSystemStamp(
  left: LiveSessionSystemStamp | null,
  right: LiveSessionSystemStamp | null
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.systemId === right.systemId &&
    left.systemRevision === right.systemRevision &&
    left.campaignId === right.campaignId &&
    left.campaignRevision === right.campaignRevision
  )
}

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
