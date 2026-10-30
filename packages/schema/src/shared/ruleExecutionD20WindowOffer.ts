import { z, lazySchema } from '../zod.js'
import { MAX_D20_ADDED_DICE, rolledDieShape } from './d20AddedDice.js'
import { ruleCheckRollEvidenceDtoSchema } from './ruleExecutionEncounterApplications.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  serverCompletedRuleExecutionDtoSchema,
  serverRuleExecutionContinuationDtoSchema
} from './ruleExecutionProtocol.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

const heldDieShape = () => ({
  effectId: uuidSchema,
  grantId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
  ...rolledDieShape()
})

/** A die a holder keeps for after its d20: the effect that holds it and the grant that gives it. */
export const d20HeldDieDtoSchema = lazySchema(() => z.strictObject(heldDieShape()))
export type D20HeldDieDto = z.infer<typeof d20HeldDieDtoSchema>

/** One die the roller holds for after the roll: spent by ending the effect that holds it. */
export const d20WindowOptionDtoSchema = lazySchema(() =>
  z.strictObject({ optionId: checksumSchema, ...heldDieShape() })
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

/**
 * A save's d20 the roller rolled before its graph resumed: the paused continuation, which the
 * window's answer resumes with the roll and the die it spends.
 */
export const d20RolledSaveDtoSchema = lazySchema(() =>
  z.strictObject({
    continuation: serverRuleExecutionContinuationDtoSchema,
    initialFactsChecksum: checksumSchema,
    d20: ruleCheckRollEvidenceDtoSchema
  })
)

/** The roll a window follows, as it froze: a completed check, or a save awaiting its graph. */
export const d20WindowRolledDtoSchema = lazySchema(() =>
  z.union([d20RolledCheckDtoSchema, d20RolledSaveDtoSchema])
)
export type D20WindowRolledDto = z.infer<typeof d20WindowRolledDtoSchema>

/** Seals a window's options to the roll it froze: a check's graph result, or a save's paused graph. */
export function d20WindowRolledChecksum(rolled: D20WindowRolledDto): string {
  return checksumRuleDocument('execution' in rolled ? rolled.execution : rolled)
}

/** What a d20 window pauses on: the rolled d20 it settles and the held dice offered after it. */
export const d20WindowPausePayloadDtoSchema = lazySchema(() =>
  z.strictObject({
    /** The d20 the roller rolled; the window settles it. */
    rolled: d20WindowRolledDtoSchema,
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
