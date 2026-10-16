import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { postgresUuidSchema } from './postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS, MAX_ENCOUNTER_REACTION_OPTIONS } from './authoredLimits.js'
import { ruleExecutionReceiptD20FaceSchema } from './ruleExecutionPrimitives.js'

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
    }),
    /** A dying Character's turn-start death save, with the saves it has made so far. */
    z.strictObject({
      kind: z.literal('DEATH_SAVE'),
      successes: z.number().check(z.int()).check(z.gte(0)).check(z.lte(2)),
      failures: z.number().check(z.int()).check(z.gte(0)).check(z.lte(2))
    }),
    /**
     * The check a basic action asks its roller to make, such as First Aid's Wisdom (Medicine).
     * `dc` is null for a check against hidden per-observer scores, such as Hide.
     */
    z.strictObject({
      kind: z.literal('BASIC_ACTION_CHECK'),
      actionLabel: triggerLabelSchema,
      checkLabel: triggerLabelSchema,
      dc: z.nullable(z.number().check(z.int()).check(z.positive()))
    })
  ])
)
export type EncounterRuleRollTriggerDto = z.infer<typeof encounterRuleRollTriggerDtoSchema>

/** The d20 a save or check asks its roller for, with the mode and reasons that roller is shown. */
const d20EvidenceRequestDtoSchema = lazySchema(() =>
  z
    .strictObject({
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
        .check(z.maxLength(32)),
      /**
       * The d20 already rolled when the server needs one more to settle the true mode
       * (ATTACK-10.1): the roller enters one more d20, or asks the app to roll it.
       */
      heldD20: z.optional(
        z.strictObject({
          faces: z.tuple([ruleExecutionReceiptD20FaceSchema]),
          caption: z.nullable(
            z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
          )
        })
      )
    })
    .check(
      z.superRefine((request, context) => {
        if (request.heldD20 && request.rollMode !== 'NORMAL')
          context.addIssue({
            code: 'custom',
            path: ['rollMode'],
            message: 'A held d20 is a single die, so the request rolls Normal.'
          })
      })
    )
)

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
        request: d20EvidenceRequestDtoSchema,
        allowedResponses: z.tuple([z.literal('ENTER_DICE'), z.literal('SYSTEM_ROLL')])
      }),
      z
        .strictObject({
          kind: z.literal('AREA_SAVES'),
          occurrenceId: uuidSchema,
          occurrenceVersion: versionSchema,
          encounterVersion: versionSchema,
          /** Null for a caster the players cannot see, unless the viewer is the GM or controls it. */
          casterActorId: z.nullable(uuidSchema),
          /** Seals who the area still catches; the GM's removal command carries it to prove it read the current set. Null for everyone but the GM. */
          caughtChecksum: z.nullable(z.string().check(z.regex(/^[a-f0-9]{64}$/))),
          /**
           * The caught creatures the viewer sees before the area resolves: every one for the GM, those
           * the caster perceives, by label only for a viewer who controls the caster, and none for anyone else.
           */
          caught: z
            .array(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)))
            .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
          /**
           * The rolls this viewer may answer: all of them for the GM, otherwise those of the creatures
           * the viewer controls. A creature rolls its own save; the caster rolls each attack ray aimed
           * at a creature, so a creature several rays are aimed at appears once for each.
           */
          saves: z
            .array(
              z.strictObject({
                /** Whoever rolls it. */
                actorId: uuidSchema,
                /** The creature the roll is made against: the one the area caught or the ray is aimed at. */
                targetActorId: uuidSchema,
                request: d20EvidenceRequestDtoSchema
              })
            )
            .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
          /**
           * The Legendary Resistance choices this viewer may answer, after a creature's failed save:
           * the GM's for every creature, otherwise the viewer's own creatures'. Nobody else, the caster
           * included, is told a choice exists.
           */
          legendaryResistance: z
            .array(
              z.strictObject({
                actorId: uuidSchema,
                /** The option that uses the Legendary Resistance; declining needs no option. */
                optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/))
              })
            )
            .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
          allowedResponses: z.tuple([
            z.literal('ENTER_DICE'),
            z.literal('SYSTEM_ROLL'),
            z.literal('AREA_LEGENDARY_RESISTANCE')
          ])
        })
        .check(
          z.superRefine((summary, context) => {
            if (
              summary.saves.length === 0 &&
              summary.legendaryResistance.length === 0 &&
              summary.caught.length === 0
            )
              context.addIssue({
                code: 'custom',
                path: ['saves'],
                message:
                  'An area summary shows the viewer at least one save, choice or caught creature.'
              })
          })
        ),
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
        kind: z.literal('REACTION_CHOICE'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        targetActorId: uuidSchema,
        options: z
          .array(
            z.strictObject({
              optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
              actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(MAX_ENCOUNTER_REACTION_OPTIONS)),
        allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
      }),
      z.strictObject({
        kind: z.literal('ON_HIT_CHOICE'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        attackerActorId: uuidSchema,
        options: z
          .array(
            z.strictObject({
              optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
              riderId: uuidSchema,
              slotLevel: z.number().check(z.int()).check(z.positive())
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1)),
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
