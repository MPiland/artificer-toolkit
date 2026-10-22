import { z, lazySchema } from '../zod.js'
import { MAX_D20_ADDED_DICE, rolledDieShape } from './d20AddedDice.js'
import { ruleCheckRollEvidenceDtoSchema } from './ruleExecutionEncounterApplications.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

/** One die the roller holds for after the roll: spent by ending the effect that holds it. */
export const d20WindowOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    optionId: checksumSchema,
    effectId: uuidSchema,
    grantId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
    ...rolledDieShape()
  })
)

/**
 * The id of the option that spends one held die. It names the roll it was offered for, so an answer
 * to an earlier roll's window never selects a die of a later one.
 */
export function d20WindowUseOptionId(input: {
  executionChecksum: string
  effectId: string
  grantId: string
}): string {
  return checksumRuleDocument({ kind: 'D20_WINDOW_USE', ...input })
}

/** A d20 the roller rolled and a later pause settles: its kernel result, facts and evidence. */
export const d20RolledCheckDtoSchema = lazySchema(() =>
  z.strictObject({
    execution: serverCompletedRuleExecutionDtoSchema,
    initialFactsChecksum: checksumSchema,
    d20: ruleCheckRollEvidenceDtoSchema
  })
)

/** What a d20 window pauses on: the rolled d20 it settles and the held dice offered after it. */
export const d20WindowPausePayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    /** The d20 the roller rolled; the window settles it. */
    rolled: d20RolledCheckDtoSchema,
    /** The recorded app roll the d20 settled with, whose card exists; null for an entered die. */
    appRollId: z.nullable(uuidSchema),
    offer: z.strictObject({
      /** Seals the options to the roll they follow. */
      executionChecksum: checksumSchema,
      options: z
        .array(d20WindowOptionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_D20_ADDED_DICE))
    })
  })
)

export type D20WindowPausePayloadDto = z.infer<typeof d20WindowPausePayloadDtoSchema>
export type D20WindowOptionDto = z.infer<typeof d20WindowOptionDtoSchema>
