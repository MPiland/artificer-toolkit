import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { postgresUuidSchema } from './postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'

const uuidSchema = lazySchema(() =>
  z.pipe(
    postgresUuidSchema,
    z.transform((value) => value.toLowerCase())
  )
)
const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const initiativeDeclarationOptionSummarySchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum([
      'CHARACTER_ACTION',
      'CHARACTER_SPELL_CAST',
      'CREATURE_FEATURE_ACTION',
      'GM_ADJUDICATED'
    ]),
    optionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
    selectionContract: z.string().check(z.regex(/^[a-f0-9]{64}$/))
  })
)

const initiativeDeclarationAdjudicationOptionSchema = lazySchema(() =>
  z.strictObject({
    value: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
  })
)

/**
 * Frozen server-owned fields for the narrow GM declaration response. This is a
 * closed control union, not a general authoring form contract.
 */
export const initiativeDeclarationAdjudicationFieldDtoSchema = lazySchema(() =>
  z
    .discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('SELECT'),
        key: z.literal('actorSize'),
        label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
        required: z.literal(true),
        options: z
          .array(initiativeDeclarationAdjudicationOptionSchema)
          .check(z.minLength(1))
          .check(z.maxLength(16))
      }),
      z.strictObject({
        kind: z.literal('MULTI_SELECT'),
        key: z.literal('actionFactors'),
        label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
        minimumSelections: z.number().check(z.int()).check(z.gte(0)).check(z.lte(4)),
        maximumSelections: z.number().check(z.int()).check(z.gte(0)).check(z.lte(4)),
        options: z.array(initiativeDeclarationAdjudicationOptionSchema).check(z.maxLength(4))
      }),
      z.strictObject({
        kind: z.literal('NULLABLE_INTEGER'),
        key: z.literal('spellLevel'),
        label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
        minimum: z.number().check(z.int()).check(z.gte(0)).check(z.lte(99)),
        maximum: z.number().check(z.int()).check(z.gte(0)).check(z.lte(99))
      })
    ])
    .check(
      z.superRefine((field, context) => {
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
            code: 'custom',
            path: ['maximum'],
            message: 'Declaration field bounds must be ordered.'
          })
        }
      })
    )
)
export type InitiativeDeclarationAdjudicationFieldDto = z.infer<
  typeof initiativeDeclarationAdjudicationFieldDtoSchema
>

const triggerLabelSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
)

/** Why a rule asks for a roll, named for the person answering it. */
export const encounterRuleRollTriggerDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CONCENTRATION'),
      damage: z.strictObject({
        amount: z.number().check(z.int()).check(z.positive()),
        typeLabel: z.nullable(triggerLabelSchema)
      }),
      sourceLabel: z.nullable(triggerLabelSchema),
      dc: z.number().check(z.int()).check(z.positive())
    })
  ])
)
export type EncounterRuleRollTriggerDto = z.infer<typeof encounterRuleRollTriggerDtoSchema>

export const pendingEncounterRuleOccurrenceSummaryDtoSchema = lazySchema(() =>
  z
    .discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('D20_EVIDENCE'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        /** The actor whose roll this is; its controllers and the GM answer it. */
        rollerActorId: z.nullable(uuidSchema),
        /** What the roll is for, when a rule raised it from an earlier outcome. */
        trigger: z.optional(encounterRuleRollTriggerDtoSchema),
        request: z.strictObject({
          requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
          min: z.literal(1),
          max: z.literal(20),
          rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
          /**
           * Why the rules derived `rollMode`: the labels of the contributors that produced it (for
           * example "Flanking" or a feature, item or condition name). Empty for Normal or when the
           * sources have no label.
           */
          derivedRollModeReasons: z
            .array(z.string().check(z.minLength(1)).check(z.maxLength(160)))
            .check(z.maxLength(32))
        }),
        allowedResponses: z.tuple([z.literal('ENTER_DICE'), z.literal('SYSTEM_ROLL')])
      }),
      z.strictObject({
        kind: z.literal('ACTION_OUTCOME_EVIDENCE'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        rollerActorId: z.nullable(uuidSchema),
        request: z.strictObject({
          requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
          min: z.number().check(z.int()),
          max: z.number().check(z.int())
        }),
        allowedResponses: z.tuple([z.literal('ENTER_INTEGER'), z.literal('SYSTEM_ROLL')])
      }),
      z.strictObject({
        kind: z.literal('MOVEMENT_REACTION'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        choice: z.strictObject({
          pathDistance: z.number().check(z.nonnegative()),
          reactorActorId: uuidSchema,
          reactorTokenId: uuidSchema,
          options: z
            .array(
              z.strictObject({
                optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
                actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
                actionSourceKind: z.enum(['CHARACTER_ACTION', 'ENCOUNTER_FEATURE'])
              })
            )
            .check(z.minLength(1))
            .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1))
        }),
        allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
      }),
      z.strictObject({
        kind: z.literal('LEGENDARY_RESISTANCE_CHOICE'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        targetActorId: uuidSchema,
        options: z.tuple([
          z.strictObject({ optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)) })
        ]),
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
              optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
              actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
              ownerFeatureId: uuidSchema,
              label: triggerLabelSchema,
              featureCost: z.number().check(z.int()).check(z.positive()),
              /** The actors this viewer may pick as the option's target. */
              targetActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1)),
        allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('LEGENDARY_OPTION')])
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
              optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
              targetActorId: uuidSchema
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1)),
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
              optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
              ruleKind: z.enum(['OVERRUN', 'TUMBLE']),
              economy: z.enum(['ACTION', 'BONUS_ACTION'])
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1)),
        allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
      }),
      z.strictObject({
        kind: z.literal('INITIATIVE_EVIDENCE'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        request: z.strictObject({
          requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
          min: z.number().check(z.int()),
          max: z.number().check(z.int())
        }),
        allowedResponses: z.tuple([z.literal('ENTER_INTEGER'), z.literal('SYSTEM_ROLL')])
      }),
      z.strictObject({
        kind: z.literal('INITIATIVE_DECLARATION'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        actorId: uuidSchema,
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        primaryOptions: z
          .array(initiativeDeclarationOptionSummarySchema)
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
        bonusOptions: z
          .array(initiativeDeclarationOptionSummarySchema)
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
        adjudicationFields: z
          .array(initiativeDeclarationAdjudicationFieldDtoSchema)
          .check(z.maxLength(3)),
        allowedResponses: z.tuple([z.literal('INITIATIVE_DECLARATION')])
      }),
      z.strictObject({
        kind: z.literal('RECHARGE_EVIDENCE'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        /** The recharging Creature; its controllers and the GM answer it. */
        rollerActorId: uuidSchema,
        request: z.strictObject({
          requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
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
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        entityKind: z.enum(['ACTOR', 'SIDE']),
        optionIds: z
          .array(uuidSchema)
          .check(z.minLength(2))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        allowedResponses: z.tuple([z.literal('INITIATIVE_ENTITY')])
      })
    ])
    .check(
      z.superRefine((value, context) => {
        if (
          (value.kind === 'INITIATIVE_EVIDENCE' || value.kind === 'ACTION_OUTCOME_EVIDENCE') &&
          value.request.min > value.request.max
        )
          context.addIssue({
            code: 'custom',
            path: ['request', 'max'],
            message: 'An initiative evidence request maximum must be at least its minimum.'
          })
      })
    )
)

export const encounterRuleOccurrenceSummaryDtoSchema = lazySchema(() =>
  z
    .strictObject({
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      status: z.enum(['PENDING', 'COMPLETE', 'VOIDED']),
      outcome: z.nullable(z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE'])),
      pending: z.nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if (value.status !== 'PENDING' && value.pending !== null)
          context.addIssue({
            code: 'custom',
            path: ['pending'],
            message: 'A completed occurrence summary cannot expose a pending decision.'
          })
        if (
          value.pending !== null &&
          (value.pending.occurrenceId !== value.occurrenceId ||
            value.pending.occurrenceVersion !== value.occurrenceVersion)
        )
          context.addIssue({
            code: 'custom',
            path: ['pending'],
            message:
              'A pending occurrence summary must retain the outer occurrence identity and version.'
          })
      })
    )
)

export type PendingEncounterRuleOccurrenceSummaryDto = z.infer<
  typeof pendingEncounterRuleOccurrenceSummaryDtoSchema
>
export type EncounterRuleOccurrenceSummaryDto = z.infer<
  typeof encounterRuleOccurrenceSummaryDtoSchema
>
