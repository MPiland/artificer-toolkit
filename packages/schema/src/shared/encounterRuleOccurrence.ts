import { z } from 'zod'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'

import { postgresUuidSchema } from './postgresUuid.js'

const uuidSchema = postgresUuidSchema.transform((value) => value.toLowerCase())
const versionSchema = z.number().int().nonnegative()

export const pendingEncounterRuleOccurrenceSummaryDtoSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('D20_EVIDENCE'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      request: z.strictObject({
        requestId: z.string().trim().min(1).max(256),
        min: z.literal(1),
        max: z.literal(20),
        rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])
      }),
      allowedResponses: z.tuple([z.literal('ENTER_DICE'), z.literal('SYSTEM_ROLL')])
    }),
    z.strictObject({
      kind: z.literal('MOVEMENT_REACTION'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      choice: z.strictObject({
        pathDistance: z.number().finite().nonnegative(),
        reactorActorId: uuidSchema,
        reactorTokenId: uuidSchema,
        options: z
          .array(
            z.strictObject({
              optionId: z.string().regex(/^[a-f0-9]{64}$/),
              actionId: z.string().trim().min(1).max(240),
              actionSourceKind: z.enum(['CHARACTER_ACTION', 'ENCOUNTER_FEATURE'])
            })
          )
          .min(1)
          .max(RULE_GRAPH_LIMITS.NODES - 1)
      }),
      allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
    }),
    z.strictObject({
      kind: z.literal('LEGENDARY_RESISTANCE_CHOICE'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      targetActorId: uuidSchema,
      options: z.tuple([z.strictObject({ optionId: z.string().regex(/^[a-f0-9]{64}$/) })]),
      allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
    }),
    z.strictObject({
      kind: z.literal('LEGENDARY_ACTION_CHOICE'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      ownerActorId: uuidSchema,
      options: z
        .array(
          z.strictObject({
            optionId: z.string().regex(/^[a-f0-9]{64}$/),
            actionId: z.string().trim().min(1).max(240),
            ownerFeatureId: uuidSchema,
            targetActorId: uuidSchema
          })
        )
        .min(1)
        .max(RULE_GRAPH_LIMITS.NODES - 1),
      allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
    }),
    z.strictObject({
      kind: z.literal('INITIATIVE_EVIDENCE'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      request: z.strictObject({
        requestId: z.string().trim().min(1).max(256),
        min: z.number().int(),
        max: z.number().int()
      }),
      allowedResponses: z.tuple([z.literal('ENTER_INTEGER'), z.literal('SYSTEM_ROLL')])
    }),
    z.strictObject({
      kind: z.literal('INITIATIVE_DECLARATION'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      actorId: uuidSchema,
      requestId: z.string().trim().min(1).max(256),
      primaryOptionIds: z
        .array(z.string().trim().min(1).max(1_000))
        .min(1)
        .max(RULE_GRAPH_LIMITS.NODES),
      bonusOptionIds: z.array(z.string().trim().min(1).max(1_000)).max(RULE_GRAPH_LIMITS.NODES),
      allowedResponses: z.tuple([z.literal('INITIATIVE_DECLARATION')])
    }),
    z.strictObject({
      kind: z.literal('RECHARGE_EVIDENCE'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      request: z.strictObject({
        requestId: z.string().trim().min(1).max(256),
        min: z.literal(1),
        max: z.literal(6)
      }),
      allowedResponses: z.tuple([z.literal('ENTER_INTEGER'), z.literal('SYSTEM_ROLL')])
    }),
    z.strictObject({
      kind: z.literal('INITIATIVE_ORDER'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      requestId: z.string().trim().min(1).max(256),
      entityKind: z.enum(['ACTOR', 'SIDE']),
      optionIds: z.array(uuidSchema).min(2).max(RULE_GRAPH_LIMITS.NODES),
      allowedResponses: z.tuple([z.literal('INITIATIVE_ENTITY')])
    })
  ])
  .superRefine((value, context) => {
    if (value.kind === 'INITIATIVE_EVIDENCE' && value.request.min > value.request.max)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['request', 'max'],
        message: 'An initiative evidence request maximum must be at least its minimum.'
      })
  })

export const encounterRuleOccurrenceSummaryDtoSchema = z
  .strictObject({
    occurrenceId: uuidSchema,
    occurrenceVersion: versionSchema,
    status: z.enum(['PENDING', 'COMPLETE']),
    outcome: z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE']).nullable(),
    pending: pendingEncounterRuleOccurrenceSummaryDtoSchema.nullable()
  })
  .superRefine((value, context) => {
    if (value.status === 'COMPLETE' && value.pending !== null)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pending'],
        message: 'A completed occurrence summary cannot expose a pending decision.'
      })
    if (
      value.pending !== null &&
      (value.pending.occurrenceId !== value.occurrenceId ||
        value.pending.occurrenceVersion !== value.occurrenceVersion)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pending'],
        message:
          'A pending occurrence summary must retain the outer occurrence identity and version.'
      })
  })

export type PendingEncounterRuleOccurrenceSummaryDto = z.infer<
  typeof pendingEncounterRuleOccurrenceSummaryDtoSchema
>
export type EncounterRuleOccurrenceSummaryDto = z.infer<
  typeof encounterRuleOccurrenceSummaryDtoSchema
>
