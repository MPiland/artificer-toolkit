import { z, lazySchema } from '../zod.js'
import { directActionTwoPhaseDtoSchema } from './ruleExecutionDirectActionPendingContexts.js'
import {
  serverRuleExecutionD20BeliefDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema
} from './ruleExecutionEvidence.js'
import {
  ruleExecutionChecksumSchema,
  ruleExecutionReceiptD20FaceSchema,
  ruleExecutionUuidSchema
} from './ruleExecutionPrimitives.js'
import { serverOptionalCombatContestPendingContextDtoSchema } from './ruleExecutionOptionalCombatPending.js'

// Explicitly typed so the pending-context declaration stays within the compiler's size limit (TS7056).
export type EncounterActionHeldD20Dto = {
  rolledMode: 'NORMAL'
  faces: [number]
  playerCaption: string | null
  gmReason: string | null
}

const heldD20Schema: z.ZodMiniType<EncounterActionHeldD20Dto> = lazySchema(() =>
  z.strictObject({
    rolledMode: z.literal('NORMAL'),
    faces: z.tuple([ruleExecutionReceiptD20FaceSchema]),
    playerCaption: z.nullable(
      z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
    ),
    gmReason: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)))
  })
)

/** Native action ownership; the command JSON is parsed by its owning command schema on every read. */
export const encounterActionPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_ACTION'),
      schemaVersion: z.literal(1),
      commandJson: z.string(),
      commandFingerprint: ruleExecutionChecksumSchema,
      initiatorUserId: ruleExecutionUuidSchema,
      /**
       * The actor whose roll the pending request is. Its controllers (and the GM) see and answer it;
       * the initiator answers only for actors they control (ADR 0034 decision 3).
       */
      rollerActorId: ruleExecutionUuidSchema,
      currentnessChecksum: ruleExecutionChecksumSchema,
      d20Policy: z.nullable(serverRuleExecutionD20PolicyDtoSchema),
      twoPhase: z.nullable(directActionTwoPhaseDtoSchema),
      /** Disarm keeps the original action owner while each contest participant responds. */
      contest: z.optional(z.lazy(() => serverOptionalCombatContestPendingContextDtoSchema)),
      /** The mode the roller's own facts imply, shown at the roll prompt (ATTACK-10.1). */
      d20Belief: z.optional(serverRuleExecutionD20BeliefDtoSchema),
      /** The d20 a roller already entered while the server waits for one more to settle the true mode. */
      heldD20: z.optional(heldD20Schema)
    })
    .check(
      z.superRefine((value, context) => {
        if (value.heldD20 && value.d20Policy === null)
          context.addIssue({
            code: 'custom',
            path: ['heldD20'],
            message: 'A held d20 needs the d20 policy it completes.'
          })
        if (
          value.contest &&
          (value.contest.actionKind !== 'DISARM' ||
            value.d20Policy !== null ||
            value.twoPhase !== null)
        )
          context.addIssue({
            code: 'custom',
            path: ['contest'],
            message: 'Direct Disarm contest evidence cannot also retain ordinary action phases.'
          })
      })
    )
)
