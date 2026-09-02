import { z } from 'zod'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'

import { postgresUuidSchema } from './postgresUuid.js'

const uuidSchema = postgresUuidSchema.transform((value) => value.toLowerCase())
const versionSchema = z.number().int().nonnegative()
const initiativeDeclarationOptionSummarySchema = z.strictObject({
  kind: z.enum([
    'CHARACTER_ACTION',
    'CHARACTER_SPELL_CAST',
    'CREATURE_FEATURE_ACTION',
    'GM_ADJUDICATED'
  ]),
  optionId: z.string().trim().min(1).max(1_000),
  label: z.string().trim().min(1).max(500),
  selectionContract: z.string().regex(/^[a-f0-9]{64}$/)
})

const initiativeDeclarationAdjudicationOptionSchema = z.strictObject({
  value: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160)
})

/**
 * Frozen server-owned fields for the narrow GM declaration response. This is a
 * closed control union, not a general authoring form contract.
 */
export const initiativeDeclarationAdjudicationFieldDtoSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('SELECT'),
      key: z.literal('actorSize'),
      label: z.string().trim().min(1).max(160),
      required: z.literal(true),
      options: z.array(initiativeDeclarationAdjudicationOptionSchema).min(1).max(16)
    }),
    z.strictObject({
      kind: z.literal('MULTI_SELECT'),
      key: z.literal('actionFactors'),
      label: z.string().trim().min(1).max(160),
      minimumSelections: z.number().int().min(0).max(4),
      maximumSelections: z.number().int().min(0).max(4),
      options: z.array(initiativeDeclarationAdjudicationOptionSchema).max(4)
    }),
    z.strictObject({
      kind: z.literal('NULLABLE_INTEGER'),
      key: z.literal('spellLevel'),
      label: z.string().trim().min(1).max(160),
      minimum: z.number().int().min(0).max(99),
      maximum: z.number().int().min(0).max(99)
    })
  ])
  .superRefine((field, context) => {
    const minimum =
      field.kind === 'MULTI_SELECT'
        ? field.minimumSelections
        : field.kind === 'NULLABLE_INTEGER'
          ? field.minimum
          : null
    const maximum =
      field.kind === 'MULTI_SELECT'
        ? field.maximumSelections
        : field.kind === 'NULLABLE_INTEGER'
          ? field.maximum
          : null
    if (minimum !== null && maximum !== null && minimum > maximum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximum'],
        message: 'Declaration field bounds must be ordered.'
      })
    }
  })
export type InitiativeDeclarationAdjudicationFieldDto = z.infer<
  typeof initiativeDeclarationAdjudicationFieldDtoSchema
>

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
      kind: z.literal('ACTION_OUTCOME_EVIDENCE'),
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
      kind: z.literal('OPTIONAL_COMBAT_CLEAVING'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      sourceActorId: uuidSchema,
      options: z
        .array(
          z.strictObject({
            optionId: z.string().regex(/^[a-f0-9]{64}$/),
            targetActorId: uuidSchema
          })
        )
        .min(1)
        .max(RULE_GRAPH_LIMITS.NODES - 1),
      allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
    }),
    z.strictObject({
      kind: z.literal('MOVEMENT_PASSAGE_CHOICE'),
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      encounterVersion: versionSchema,
      sourceActorId: uuidSchema,
      options: z
        .array(
          z.strictObject({
            optionId: z.string().regex(/^[a-f0-9]{64}$/),
            ruleKind: z.enum(['OVERRUN', 'TUMBLE']),
            economy: z.enum(['ACTION', 'BONUS_ACTION'])
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
      primaryOptions: z
        .array(initiativeDeclarationOptionSummarySchema)
        .min(1)
        .max(RULE_GRAPH_LIMITS.NODES),
      bonusOptions: z.array(initiativeDeclarationOptionSummarySchema).max(RULE_GRAPH_LIMITS.NODES),
      adjudicationFields: z.array(initiativeDeclarationAdjudicationFieldDtoSchema).max(3),
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
    if (
      (value.kind === 'INITIATIVE_EVIDENCE' || value.kind === 'ACTION_OUTCOME_EVIDENCE') &&
      value.request.min > value.request.max
    )
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
