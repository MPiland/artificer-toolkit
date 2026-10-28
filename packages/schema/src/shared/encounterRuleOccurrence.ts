import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { characterResourcePoolIdentitySchema } from './characterResourceIdentity.js'
import { postgresUuidSchema } from './postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS, MAX_ENCOUNTER_REACTION_OPTIONS } from './authoredLimits.js'
import { ruleExecutionReceiptD20FaceSchema } from './ruleExecutionPrimitives.js'
import type { DamageSaveSource } from './ruleExecutionConcentration.js'
import { MAX_D20_ADDED_DICE, d20AddedDiceDtoSchema, rolledDieShape } from './d20AddedDice.js'
import { MAX_FORCED_MOVEMENT_DESTINATIONS, spatialPointDtoSchema } from './spatialFacts.js'
import {
  offeredRollModeSchema,
  rollModeKeepSchema,
  systemCoreCodeSchema
} from './systemCoreCode.js'

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
        key: z.literal('factorIds'),
        label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
        minimumSelections: z.number().check(z.int()).check(z.gte(0)).check(z.lte(32)),
        maximumSelections: z.number().check(z.int()).check(z.gte(0)).check(z.lte(32)),
        options: z.array(initiativeDeclarationAdjudicationOptionSchema).check(z.maxLength(32))
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

/** A damage chain save's trigger (D167): the damage that prompted it and the save's DC. */
const damageSaveRollTriggerDtoSchema = <Source extends DamageSaveSource>(kind: Source) =>
  z.strictObject({
    kind: z.literal(kind),
    damage: z.strictObject({
      amount: z.number().check(z.int()).check(z.positive()),
      typeLabel: z.nullable(triggerLabelSchema)
    }),
    sourceLabel: z.nullable(triggerLabelSchema),
    dc: z.number().check(z.int()).check(z.positive())
  })

/** Why a rule asks for a roll, named for the person answering it. */
export const encounterRuleRollTriggerDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    damageSaveRollTriggerDtoSchema('CONCENTRATION'),
    /** A damaged holder's active effect repeats its save (D167); `dc` is the effect's frozen DC. */
    damageSaveRollTriggerDtoSchema('EFFECT_REPEAT_SAVE'),
    /** One damage source dealt at least the massive-damage share of the holder's maximum hit points. */
    damageSaveRollTriggerDtoSchema('MASSIVE_DAMAGE'),
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
      rollMode: systemCoreCodeSchema,
      /** Which of the rolled faces the d20 counts; the System derives it from `rollMode`. */
      keep: rollModeKeepSchema,
      /** The roll modes the roller may answer with: the System's `rollMode` vocabulary. */
      rollModes: z.array(offeredRollModeSchema).check(z.minLength(1)),
      /**
       * Why the rules derived `rollMode`: the labels of the contributors that produced it (for
       * example "Flanking" or a feature, item or condition name). Empty for Normal or when the
       * sources have no label.
       */
      derivedRollModeReasons: z
        .array(z.string().check(z.minLength(1)).check(z.maxLength(160)))
        .check(z.maxLength(32)),
      /**
       * The conditions that make this saving throw fail without counting the roll (D94), each
       * with its label. The d20 is still rolled; the save fails whatever it shows. Absent when no
       * condition does.
       */
      autoFail: z.optional(
        z
          .array(
            z.strictObject({
              conditionId: uuidSchema,
              label: z.string().check(z.minLength(1)).check(z.maxLength(160))
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(32))
      ),
      /**
       * Dice the roller rolls with the d20 and adds or subtracts after the mode keeps one d20
       * (D156), such as "+1d4 Bless". Absent when the test has none.
       */
      addedDice: z.optional(d20AddedDiceDtoSchema),
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
        if (request.heldD20 && request.keep !== 'FIRST')
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
      /**
       * A contest defender's roll: it picks one of the checks the contest sealed for it and rolls it
       * in the same answer (D152), such as Strength (Athletics) or Dexterity (Acrobatics) against a
       * Grapple.
       */
      z.strictObject({
        kind: z.literal('CONTEST_CHECK'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        rollerActorId: uuidSchema,
        actionLabel: triggerLabelSchema,
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        /** The roll modes the defender may answer with: the System's `rollMode` vocabulary. */
        rollModes: z.array(offeredRollModeSchema).check(z.minLength(1)),
        checks: z
          .array(
            z.strictObject({
              checkDefinitionId: uuidSchema,
              label: triggerLabelSchema,
              rollMode: systemCoreCodeSchema,
              keep: rollModeKeepSchema,
              derivedRollModeReasons: z
                .array(z.string().check(z.minLength(1)).check(z.maxLength(160)))
                .check(z.maxLength(32))
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        allowedResponses: z.tuple([z.literal('CONTEST_CHECK')])
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
            z.discriminatedUnion('kind', [
              z.strictObject({
                kind: z.literal('SPELL_SLOT'),
                optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
                riderId: uuidSchema,
                slotLevel: z.number().check(z.int()).check(z.positive())
              }),
              z.strictObject({
                kind: z.literal('RESOURCE_POOL'),
                optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
                riderId: uuidSchema,
                poolId: characterResourcePoolIdentitySchema,
                cost: z.number().check(z.int()).check(z.positive())
              })
            ])
          )
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1)),
        allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
      }),
      /** A d20 the roller has seen, with the dice it holds for after the roll: it may add one or let them go. */
      z.strictObject({
        kind: z.literal('D20_WINDOW'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        rollerActorId: uuidSchema,
        trigger: encounterRuleRollTriggerDtoSchema,
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        /** The kept face and the total the roll stands at before any die is added. */
        d20: z.strictObject({
          selectedNatural: z.number().check(z.int()),
          total: z.number().check(z.int())
        }),
        options: z
          .array(
            z.strictObject({
              optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
              label: triggerLabelSchema,
              ...rolledDieShape()
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(MAX_D20_ADDED_DICE)),
        allowedResponses: z.tuple([z.literal('D20_WINDOW_DECLINE'), z.literal('D20_WINDOW_USE')])
      }),
      /** An attack or spell a ward stopped, whose attacker may turn it on another creature or let it be lost. */
      z.strictObject({
        kind: z.literal('ATTACK_RETARGET_CHOICE'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        attackerActorId: uuidSchema,
        options: z
          .array(
            z.strictObject({
              optionId: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
              targetActorId: uuidSchema
            })
          )
          .check(z.minLength(1))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        allowedResponses: z.tuple([z.literal('DECLINE'), z.literal('OPTION')])
      }),
      /** A push whose source chooses the square it leaves one creature on, from the legal ones (D157). */
      z.strictObject({
        kind: z.literal('FORCED_MOVEMENT_DESTINATION'),
        occurrenceId: uuidSchema,
        occurrenceVersion: versionSchema,
        encounterVersion: versionSchema,
        sourceActorId: uuidSchema,
        targetActorId: uuidSchema,
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        positions: z
          .array(spatialPointDtoSchema)
          .check(z.minLength(2))
          .check(z.maxLength(MAX_FORCED_MOVEMENT_DESTINATIONS)),
        allowedResponses: z.tuple([z.literal('FORCED_MOVEMENT')])
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
              ruleKind: z.enum(['OVERRUN', 'TUMBLE', 'CLIMB_ONTO_LARGER_CREATURE']),
              economy: z.enum(['ACTION', 'BONUS_ACTION']),
              initiatorCheckLabel: z.string().check(z.minLength(1)).check(z.maxLength(240))
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
type ContestCheckPendingDto = Extract<
  PendingEncounterRuleOccurrenceSummaryDto,
  { kind: 'CONTEST_CHECK' }
>

/** The one d20 a contest defender rolls for the check it picked, in that check's mode (D152). */
export function contestCheckD20Request(
  pending: ContestCheckPendingDto,
  check: ContestCheckPendingDto['checks'][number]
): z.infer<typeof d20EvidenceRequestDtoSchema> {
  return {
    requestId: pending.requestId,
    min: 1,
    max: 20,
    rollMode: check.rollMode,
    keep: check.keep,
    rollModes: pending.rollModes,
    derivedRollModeReasons: check.derivedRollModeReasons
  }
}
