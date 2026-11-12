import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { z, lazySchema } from '../zod.js'
import { MAX_ENCOUNTER_REACTION_OPTIONS } from './authoredLimits.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

/** One option of a reaction offer: derived from the attack, the reactor and the action, never free-standing. */
export function reactionOfferOptionId(input: {
  parentCommandId: string
  reactorActorId: string
  actionId: string
}): string {
  return checksumRuleDocument({ kind: 'REACTION_OFFER_USE', ...input })
}

/**
 * The reactions a committed attack offers one creature once it has resolved (D219): a menu of that
 * creature's own actions against the attacker. It retains facts only. The attack's receipt is
 * terminal, so answering changes nothing the attack did: an option records the action to run as the
 * reactor's own command, and a decline records nothing.
 */
export type EncounterReactionOfferPendingContextDto = {
  kind: 'ENCOUNTER_REACTION_OFFER'
  schemaVersion: 1
  /** The committed attack: its root command and the occurrence that command settled. */
  parentCommandId: string
  parentOccurrenceId: string
  reactorActorId: string
  attackerActorId: string
  options: { optionId: string; actionId: string }[]
}

export const encounterReactionOfferPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_REACTION_OFFER'),
      schemaVersion: z.literal(1),
      parentCommandId: uuidSchema,
      parentOccurrenceId: uuidSchema,
      reactorActorId: uuidSchema,
      attackerActorId: uuidSchema,
      options: z
        .array(z.strictObject({ optionId: checksumSchema, actionId: identifierSchema }))
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ENCOUNTER_REACTION_OPTIONS))
    })
    .check(
      z.superRefine((value, context) => {
        if (value.reactorActorId === value.attackerActorId)
          context.addIssue({
            code: 'custom',
            path: ['reactorActorId'],
            message: 'A reaction offer answers another creature’s attack.'
          })
        const optionIds = new Set<string>()
        for (const [index, option] of value.options.entries()) {
          if (
            optionIds.has(option.optionId) ||
            reactionOfferOptionId({
              parentCommandId: value.parentCommandId,
              reactorActorId: value.reactorActorId,
              actionId: option.actionId
            }) !== option.optionId
          )
            context.addIssue({
              code: 'custom',
              path: ['options', index, 'optionId'],
              message: 'A reaction offer names each action once, by its derived option identity.'
            })
          optionIds.add(option.optionId)
        }
      })
    )
)

/**
 * A settled reaction offer. `child` is the proof of the reaction's own action: the one command the
 * reactor may run against the attacker, admitted by this receipt alone. A decline (the reactor's, or
 * the GM's void) records no child.
 */
export const reactionOfferAnswerApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('REACTION_OFFER_ANSWER'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      parentCommandId: uuidSchema,
      parentOccurrenceId: uuidSchema,
      reactorActorId: uuidSchema,
      attackerActorId: uuidSchema,
      selectedOptionId: z.nullable(checksumSchema),
      child: z.nullable(z.strictObject({ commandId: uuidSchema, actionId: identifierSchema }))
    })
    .check(
      z.superRefine((value, context) => {
        const optionId = value.child
          ? reactionOfferOptionId({
              parentCommandId: value.parentCommandId,
              reactorActorId: value.reactorActorId,
              actionId: value.child.actionId
            })
          : null
        if (value.selectedOptionId !== optionId)
          context.addIssue({
            code: 'custom',
            path: ['child'],
            message:
              'A reaction offer records the action of the option chosen, and none when declined.'
          })
      })
    )
)
