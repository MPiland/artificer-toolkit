import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import type { ResolveRuleOccurrenceInputDto } from './encounterRuleCommands.js'

const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

/** A new move's staged Scene save supplies the authority and version fences for every raw read. */
export const liveSessionMovementSaveSubjectSchema = lazySchema(() =>
  z.strictObject({ kind: z.literal('SAVE'), saveId: postgresUuidSchema })
)

/**
 * A movement decision's answer reads under its issued occurrence, admitted for the responder at
 * these versions, with or without a staged save (D64). `appRoll` names the app roll a SYSTEM_ROLL
 * answer settles with; null for any other answer.
 */
export const liveSessionMovementDecisionSubjectSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('DECISION'),
    occurrenceId: postgresUuidSchema,
    occurrenceVersion: versionSchema,
    encounterVersion: versionSchema,
    appRoll: z.nullable(
      z.strictObject({
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        rollId: postgresUuidSchema
      })
    )
  })
)

/** What admits a movement plan's raw reads: a staged move, or a decision's answer. */
export const liveSessionMovementCaptureScopeSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    baseTokenOrdinal: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
    subject: z.discriminatedUnion('kind', [
      liveSessionMovementSaveSubjectSchema,
      liveSessionMovementDecisionSubjectSchema
    ])
  })
)

/** A movement commit always names the staged save it publishes. */
export const liveSessionMovementSaveScopeSchema = lazySchema(() =>
  z.extend(liveSessionMovementCaptureScopeSchema, { subject: liveSessionMovementSaveSubjectSchema })
)

/** The DECISION subject an answer reads under: its issued decision, versions and app roll. */
export function movementDecisionSubject(
  answer: ResolveRuleOccurrenceInputDto
): LiveSessionMovementDecisionSubject {
  const { resolution } = answer
  return {
    kind: 'DECISION',
    occurrenceId: answer.occurrenceId.toLowerCase(),
    occurrenceVersion: answer.expectedOccurrenceVersion,
    encounterVersion: answer.expectedVersion,
    appRoll:
      resolution.kind === 'SYSTEM_ROLL'
        ? { requestId: resolution.requestId, rollId: resolution.rollId.toLowerCase() }
        : null
  }
}

export type LiveSessionMovementCaptureScope = z.infer<typeof liveSessionMovementCaptureScopeSchema>
export type LiveSessionMovementDecisionSubject = z.infer<
  typeof liveSessionMovementDecisionSubjectSchema
>
