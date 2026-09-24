import { z } from '../zod.js'
import { directActionTwoPhaseDtoSchema } from './ruleExecutionDirectActionPendingContexts.js'
import { serverRuleExecutionD20PolicyDtoSchema } from './ruleExecutionEvidence.js'
import { ruleExecutionChecksumSchema, ruleExecutionUuidSchema } from './ruleExecutionPrimitives.js'
import { serverOptionalCombatContestPendingContextDtoSchema } from './ruleExecutionOptionalCombatPending.js'

/** Native action ownership; the command JSON is parsed by its owning command schema on every read. */
export const encounterActionPendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_ACTION'),
    schemaVersion: z.literal(1),
    commandJson: z.string(),
    commandFingerprint: ruleExecutionChecksumSchema,
    initiatorUserId: ruleExecutionUuidSchema,
    currentnessChecksum: ruleExecutionChecksumSchema,
    d20Policy: z.nullable(serverRuleExecutionD20PolicyDtoSchema),
    twoPhase: z.nullable(directActionTwoPhaseDtoSchema),
    /** Disarm keeps the original action owner while each contest participant responds. */
    contest: z.optional(z.lazy(() => serverOptionalCombatContestPendingContextDtoSchema))
  })
  .check(
    z.superRefine((value, context) => {
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
