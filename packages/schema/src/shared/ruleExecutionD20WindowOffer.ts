import { z, lazySchema } from '../zod.js'
import { MAX_D20_ADDED_DICE, rolledDieShape } from './d20AddedDice.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { ruleCheckRollEvidenceDtoSchema } from './ruleExecutionEncounterApplications.js'
import {
  encounterReactionPinDtoSchema,
  validateEncounterReactionPin
} from './ruleExecutionReactionChoice.js'
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

const reactionDieShape = () => ({
  reaction: encounterReactionPinDtoSchema,
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
  ...rolledDieShape()
})

/**
 * A die another creature rolls against the roll by its reaction (D207): the reaction it uses, pinned
 * when offered, and the die it rolls. Spent by the reaction and its cost at the action's commit.
 */
export const d20WindowReactionDieDtoSchema = lazySchema(() => z.strictObject(reactionDieShape()))
export type D20WindowReactionDieDto = z.infer<typeof d20WindowReactionDieDtoSchema>

/**
 * One die offered after the roll: a die the roller holds, spent by ending the effect that holds it, or
 * a die a reactor rolls against it.
 */
export const d20WindowOptionDtoSchema = lazySchema(() =>
  z.union([
    z.strictObject({ optionId: checksumSchema, ...heldDieShape() }),
    z.strictObject({ optionId: checksumSchema, ...reactionDieShape() })
  ])
)

/** Whether an offered die is a reactor's rather than one the roller holds. */
export const isD20WindowReactionDie = <Die extends D20HeldDieDto | D20WindowReactionDieDto>(
  die: Die
): die is Extract<Die, D20WindowReactionDieDto> => 'reaction' in die

/** The reactor a window waits on, or null when it waits on the roller's own held dice. */
export function d20WindowReactorActorId(window: {
  offer: { options: readonly (D20HeldDieDto | D20WindowReactionDieDto)[] }
}): string | null {
  const [first] = window.offer.options
  return first && isD20WindowReactionDie(first) ? first.reaction.reactorActorId : null
}

/**
 * The id of the option that spends one held die. It names the roll it was offered for, so an answer
 * to an earlier roll's window never selects a die of a later one.
 */
export function d20WindowUseOptionId(input: {
  executionChecksum: string
  effectId: string
  grantId: string
}): string {
  return checksumRuleDocument({ kind: 'ROLL_WINDOW_USE', ...input })
}

/** The id of the option that uses one reaction against the roll, sealed to the roll like a held die's. */
export function d20WindowReactionOptionId(input: {
  executionChecksum: string
  selectionChecksum: string
}): string {
  return checksumRuleDocument({ kind: 'D20_WINDOW_REACTION', ...input })
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
export type D20RolledCheckDto = z.infer<typeof d20RolledCheckDtoSchema>
/** Whether a window's frozen roll is a completed check (rather than a save awaiting its graph). */
export const isD20RolledCheck = (
  rolled: z.infer<typeof d20WindowRolledDtoSchema>
): rolled is D20RolledCheckDto => 'execution' in rolled
export type D20WindowRolledDto = z.infer<typeof d20WindowRolledDtoSchema>

/** Seals a window's options to the roll it froze: a check's graph result, or a save's paused graph. */
export function d20WindowRolledChecksum(rolled: D20WindowRolledDto): string {
  return checksumRuleDocument('execution' in rolled ? rolled.execution : rolled)
}

/**
 * What a d20 window pauses on: the rolled d20 it settles and the dice offered after it. One decider
 * answers each window: the roller on its held dice, then each reactor in turn on its reactions (D207).
 */
export const d20WindowPausePayloadDtoSchema = lazySchema(() =>
  z
    .strictObject({
      /** The d20 the roller rolled, with the dice earlier windows added; the window settles it. */
      rolled: d20WindowRolledDtoSchema,
      /** The recorded app roll the d20 settled with, whose card exists; null for an entered die. */
      appRollId: z.nullable(uuidSchema),
      /** The reactors earlier windows of this roll already asked, who are not asked again. */
      answeredReactorActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      offer: z.strictObject({
        /** Seals the options to the roll they follow. */
        executionChecksum: checksumSchema,
        options: z
          .array(d20WindowOptionDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(MAX_D20_ADDED_DICE))
      })
    })
    .check(
      z.superRefine((value, context) => {
        const reactor = d20WindowReactorActorId(value)
        for (const [index, option] of value.offer.options.entries()) {
          if (!isD20WindowReactionDie(option)) continue
          validateEncounterReactionPin(option.reaction, context, [
            'offer',
            'options',
            index,
            'reaction'
          ])
        }
        if (
          value.offer.options.some((option) =>
            isD20WindowReactionDie(option)
              ? option.reaction.reactorActorId !== reactor
              : reactor !== null
          ) ||
          (reactor !== null && value.answeredReactorActorIds.includes(reactor)) ||
          new Set(value.answeredReactorActorIds).size !== value.answeredReactorActorIds.length
        )
          context.addIssue({
            code: 'custom',
            path: ['offer', 'options'],
            message: 'A d20 window offers one decider its dice, and asks each reactor once.'
          })
      })
    )
)

export type D20WindowPausePayloadDto = z.infer<typeof d20WindowPausePayloadDtoSchema>
export type D20WindowOptionDto = z.infer<typeof d20WindowOptionDtoSchema>
