import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { rollVisibilityDtoSchema } from './rolls.js'
import { movementReactionChoiceSelectionDtoSchema } from '../shared/reaction.js'
import { serverRuleExecutionCorrelationIdDtoSchema } from '../shared/ruleExecutionProtocol.js'
import { sizeCodeSchema } from '../shared/enums.js'
import { spatialPointDtoSchema } from '../shared/spatialFacts.js'
import { encounterAcknowledgedRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))
const speedFactorActionFactorDtoSchema = lazySchema(() =>
  z.enum(['MELEE_HEAVY', 'MELEE_LIGHT_OR_FINESSE', 'MELEE_TWO_HANDED', 'RANGED_LOADING'])
)
export const initiativeDeclarationSelectionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.enum(['CHARACTER_ACTION', 'CHARACTER_SPELL_CAST', 'CREATURE_FEATURE_ACTION']),
      optionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
    }),
    z
      .strictObject({
        kind: z.literal('GM_ADJUDICATED'),
        optionId: z.literal('GM_ADJUDICATED'),
        actorSize: sizeCodeSchema,
        actionFactors: z.array(speedFactorActionFactorDtoSchema).check(z.maxLength(4)),
        spellLevel: z.nullable(z.number().check(z.int()).check(z.gte(0)).check(z.lte(99)))
      })
      .check(
        z.superRefine((value, context) => {
          if (new Set(value.actionFactors).size !== value.actionFactors.length) {
            context.addIssue({
              code: 'custom',
              path: ['actionFactors'],
              message: 'GM-adjudicated action factors must be unique.'
            })
          }
        })
      )
  ])
)
export type InitiativeDeclarationSelectionDto = z.infer<
  typeof initiativeDeclarationSelectionDtoSchema
>

export const commandBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: uuidSchema,
    commandId: uuidSchema,
    expectedVersion: versionSchema
  })
)

const optionalCombatActionIntentSelectionValueDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ENTITY'),
      entityId: postgresUuidSchema
    }),
    z.strictObject({
      kind: z.literal('POSITION'),
      position: spatialPointDtoSchema
    })
  ])
)
const optionalCombatActionIntentSelectionDtoSchema = lazySchema(() =>
  z.strictObject({
    fieldId: checksumSchema,
    value: optionalCombatActionIntentSelectionValueDtoSchema
  })
)

export const optionalCombatActionIntentDtoSchema = lazySchema(() =>
  z
    .strictObject({
      optionId: checksumSchema,
      definitionId: postgresUuidSchema,
      selectionContract: checksumSchema,
      selections: z.array(optionalCombatActionIntentSelectionDtoSchema).check(z.maxLength(4))
    })
    .check(
      z.superRefine((intent, context) => {
        for (let index = 1; index < intent.selections.length; index += 1) {
          if (intent.selections[index - 1]!.fieldId >= intent.selections[index]!.fieldId) {
            context.addIssue({
              code: 'custom',
              path: ['selections', index, 'fieldId'],
              message: 'Optional combat intent selection field IDs must be unique and ascending.'
            })
          }
        }
      })
    )
)
export type OptionalCombatActionIntentDto = z.infer<typeof optionalCombatActionIntentDtoSchema>

/** The submitter's explicit consent to stow this exact shield for a two-handed attack. */
export const encounterAcceptedWieldConflictDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('STOW_SHIELD'),
    shieldItemInstanceId: uuidSchema
  })
)
export type EncounterAcceptedWieldConflictDto = z.infer<
  typeof encounterAcceptedWieldConflictDtoSchema
>

export const resolveEncounterActionInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('RESOLVE_ACTION'),
    actorId: uuidSchema,
    actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
    targetActorId: uuidSchema,
    optionalCombatIntent: z.optional(z.nullable(optionalCombatActionIntentDtoSchema)),
    acceptedWieldConflict: z._default(
      z.optional(z.nullable(encounterAcceptedWieldConflictDtoSchema)),
      null
    ),
    /**
     * The GM's Public/Private choice for rolls of GM-controlled creatures this action makes (Q14).
     * Used only when the Campaign owner submits it; otherwise the owner's stored preference applies.
     */
    visibility: z.optional(rollVisibilityDtoSchema),
    /** Assisted-mode warnings the submitter chose to override ("Do it anyway"). */
    acknowledgedWarnings: z._default(z.optional(encounterAcknowledgedRuleWarningsDtoSchema), []),
    /**
     * Required only by action policies that consume exact Scene position. The
     * server locks and validates this dependency before it constructs facts.
     */
    sceneContext: z._default(
      z.optional(
        z.nullable(
          z.strictObject({
            sceneId: uuidSchema,
            expectedSceneVersion: versionSchema,
            sourceTokenId: uuidSchema,
            targetTokenId: uuidSchema
          })
        )
      ),
      null
    )
  })
)

/**
 * The current actor takes one of its System's basic actions (Q11). `allyActorId` names the ally an
 * ally-advantage action helps and is null for every other action.
 */
export const useEncounterBasicActionInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('USE_BASIC_ACTION'),
    actorId: uuidSchema,
    definitionId: postgresUuidSchema,
    allyActorId: z.nullable(uuidSchema),
    /** Assisted-mode warnings the submitter chose to override ("Do it anyway"). */
    acknowledgedWarnings: z._default(z.optional(encounterAcknowledgedRuleWarningsDtoSchema), [])
  })
)

const requestIdSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256))
)

/** A d20 row's roll mode. The rules-derived mode is recommended; the roller may change it. */
export const encounterD20RollModeDtoSchema = lazySchema(() =>
  z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])
)
export type EncounterD20RollModeDto = z.infer<typeof encounterD20RollModeDtoSchema>

export const resolveRuleOccurrenceInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('RESOLVE_RULE_OCCURRENCE'),
    correlationId: z._default(z.optional(serverRuleExecutionCorrelationIdDtoSchema), null),
    occurrenceId: uuidSchema,
    expectedOccurrenceVersion: versionSchema,
    resolution: z.discriminatedUnion('kind', [
      /** Faces the roller entered ("Entered by <name>"): two for advantage or disadvantage. */
      z
        .strictObject({
          kind: z.literal('ENTER_DICE'),
          requestId: requestIdSchema,
          rawFaces: z
            .array(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)))
            .check(z.minLength(1))
            .check(z.maxLength(2)),
          rollMode: encounterD20RollModeDtoSchema
        })
        .check(
          z.superRefine((value, context) => {
            if (value.rawFaces.length !== (value.rollMode === 'NORMAL' ? 1 : 2))
              context.addIssue({
                code: 'custom',
                path: ['rawFaces'],
                message: 'Advantage and disadvantage take two faces; a normal roll takes one.'
              })
          })
        ),
      /**
       * Settles the request with the roller's latest app roll for it ("Rolled by the app"). The
       * server reads the recorded faces; a client never supplies an app roll's values.
       */
      z.strictObject({
        kind: z.literal('SYSTEM_ROLL'),
        requestId: requestIdSchema,
        rollId: uuidSchema
      }),
      z.strictObject({
        kind: z.literal('ENTER_INTEGER'),
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        value: z.number().check(z.int())
      }),
      z.strictObject({
        kind: z.literal('INITIATIVE_ENTITY'),
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        entityId: uuidSchema
      }),
      z.strictObject({
        kind: z.literal('INITIATIVE_DECLARATION'),
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        primary: initiativeDeclarationSelectionDtoSchema,
        bonus: z.nullable(initiativeDeclarationSelectionDtoSchema)
      }),
      ...movementReactionChoiceSelectionDtoSchema._zod.def.options,
      z.strictObject({ kind: z.literal('PASSAGE_DECLINE') }),
      z.strictObject({ kind: z.literal('PASSAGE_OPTION'), optionId: checksumSchema }),
      /** A Legendary Action option and the actor it targets, from the option's targets. */
      z.strictObject({
        kind: z.literal('LEGENDARY_OPTION'),
        optionId: checksumSchema,
        targetActorId: uuidSchema
      })
    ])
  })
)
/**
 * "Roll dice" on one prompt row: the server rolls this request with secure randomness, records the
 * roll and posts it to the table log without settling the request. Rerolls are further attempts.
 */
export const rollRuleEvidenceInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('ROLL_RULE_EVIDENCE'),
    occurrenceId: uuidSchema,
    expectedOccurrenceVersion: versionSchema,
    requestId: requestIdSchema,
    /** The chosen mode for a d20 row; null for any other roll. */
    rollMode: z.nullable(encounterD20RollModeDtoSchema),
    /** The GM's Public/Private choice (Q14); used only when the Campaign owner rolls. */
    visibility: z.optional(rollVisibilityDtoSchema)
  })
)
/** GM escape hatch for a stuck decision; the outcome depends on the pending decision's kind. */
export const voidRuleOccurrenceInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('VOID_RULE_OCCURRENCE'),
    occurrenceId: uuidSchema,
    expectedOccurrenceVersion: versionSchema
  })
)
/** GM-only exact undo of the Run's last committed action and its committed children. */
export const revertLastEncounterActionInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REVERT_LAST_ACTION')
  })
)
export type ResolveEncounterActionInputDto = z.infer<typeof resolveEncounterActionInputDtoSchema>
export type UseEncounterBasicActionInputDto = z.infer<typeof useEncounterBasicActionInputDtoSchema>
export type ResolveRuleOccurrenceInputDto = z.infer<typeof resolveRuleOccurrenceInputDtoSchema>
export type VoidRuleOccurrenceInputDto = z.infer<typeof voidRuleOccurrenceInputDtoSchema>
export type RollRuleEvidenceInputDto = z.infer<typeof rollRuleEvidenceInputDtoSchema>
export type RevertLastEncounterActionInputDto = z.infer<
  typeof revertLastEncounterActionInputDtoSchema
>
