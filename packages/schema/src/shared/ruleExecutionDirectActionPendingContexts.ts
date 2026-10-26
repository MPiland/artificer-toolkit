import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'
import { z, lazySchema } from '../zod.js'
import {
  type ActiveRuleEffectRecord,
  activeRuleEffectRecordSchema
} from '../projections/activeRuleEffectPersistence.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import {
  d20AddedDiceDtoSchema,
  d20RolledAddedDiceDtoSchema,
  type D20AddedDieDto
} from './d20AddedDice.js'
import type { D20MinimumRollDto } from './d20MinimumRoll.js'
import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  compareDamageSaveApplications,
  concentrationCheckTriggerDtoSchema,
  concentrationDamageApplicationDtoSchema,
  concentrationDamageSourceLabelsDtoSchema,
  damageSaveApplicationDtoSchema
} from './ruleExecutionConcentration.js'

import { MAX_ENCOUNTER_ACTORS, authoredIdentifierSchema } from './authoredLimits.js'
import { rangeDtoSchema } from './range.js'
import {
  canonicalConcentrationContributorsDtoSchema,
  frozenCheckD20DtoSchema,
  receiptD20ContributorSchema,
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20ModeAdjustmentDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema
} from './ruleExecutionEvidence.js'
import { encounterOnHitAuditDtoSchema } from './ruleExecutionOnHitChoice.js'
import { encounterReactionOutcomeAuditDtoSchema } from './ruleExecutionReactionChoice.js'
import { pendingD20FaceSchema } from './ruleExecutionSpatial.js'
import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema,
  ruleExecutionPortNameSchema as portNameSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  rollModeKeepFaceCount,
  rollModeKeepSchema,
  rollModeKeptFace,
  systemCoreCodeSchema,
  type RollModeKeep
} from './systemCoreCode.js'

/** The exact Legendary Resistance source a failed save is offered, pinned when it is offered. */
export const encounterLegendaryResistancePinDtoSchema = lazySchema(() =>
  z.strictObject({
    targetActorId: uuidSchema,
    ownerFeatureId: authoredIdentifierSchema,
    chargeId: authoredIdentifierSchema,
    featureCost: positiveIntegerSchema,
    poolBefore: nonNegativeIntegerSchema,
    poolRemaining: nonNegativeIntegerSchema,
    definitionId: uuidSchema,
    definitionVersion: positiveIntegerSchema,
    definitionChecksum: checksumSchema,
    choiceGraphDefinitionId: uuidSchema,
    choiceGraphDefinitionVersion: positiveIntegerSchema,
    choiceGraphDefinitionChecksum: checksumSchema,
    useOutput: portNameSchema,
    useOptionId: checksumSchema,
    selectionChecksum: checksumSchema
  })
)

export type EncounterLegendaryResistancePinDto = z.infer<
  typeof encounterLegendaryResistancePinDtoSchema
>

/** The pin's selection checksum and use option identity are derived, never free-standing. */
export function validateEncounterLegendaryResistancePin(
  pin: EncounterLegendaryResistancePinDto,
  context: z.core.$RefinementCtx,
  path: readonly (string | number)[]
) {
  if (
    checksumRuleDocument({
      targetActorId: pin.targetActorId,
      ownerFeatureId: pin.ownerFeatureId,
      chargeId: pin.chargeId,
      featureCost: pin.featureCost,
      definitionId: pin.definitionId,
      definitionVersion: pin.definitionVersion,
      definitionChecksum: pin.definitionChecksum,
      choiceGraphDefinitionId: pin.choiceGraphDefinitionId,
      choiceGraphDefinitionVersion: pin.choiceGraphDefinitionVersion,
      choiceGraphDefinitionChecksum: pin.choiceGraphDefinitionChecksum
    }) !== pin.selectionChecksum
  )
    context.addIssue({
      code: 'custom',
      path: [...path, 'selectionChecksum'],
      message: 'Legendary Resistance selection checksum is invalid.'
    })
  if (
    checksumRuleDocument({ kind: 'USE', selectionChecksum: pin.selectionChecksum }) !==
    pin.useOptionId
  )
    context.addIssue({
      code: 'custom',
      path: [...path, 'useOptionId'],
      message: 'Legendary Resistance use option identity is invalid.'
    })
}

/**
 * A failed save held for its creature's Legendary Resistance choice: the failed TEST execution and its
 * d20, the exact TEST policy a later sealed OUTCOME continues from, and the pin of the resistance offered.
 */
export const encounterLegendaryResistanceOfferDtoSchema = lazySchema(() =>
  z.strictObject({
    originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
    originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema),
    d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema),
    originalExecutionChecksum: checksumSchema,
    targetStateChecksum: checksumSchema,
    resistance: encounterLegendaryResistancePinDtoSchema
  })
)
export type EncounterLegendaryResistanceOfferDto = z.infer<
  typeof encounterLegendaryResistanceOfferDtoSchema
>

/** Server-only interstitial control evidence retained when a failed TEST uses Legendary Resistance. */
const directActionLegendaryResistanceOutcomeAuditDtoSchema = lazySchema(() =>
  z.strictObject({
    choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
    selection: z.enum(['DECLINE', 'USE']),
    originalExecutionChecksum: checksumSchema,
    targetStateChecksum: checksumSchema,
    resistance: encounterLegendaryResistancePinDtoSchema,
    d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)
  })
)

/** Server-sealed direct-action phase identity. Legacy pending actions retain null. */
export const directActionTwoPhaseDtoSchema = lazySchema(() =>
  z
    .discriminatedUnion('phase', [
      z.strictObject({
        phase: z.literal('TEST'),
        compilerSourceChecksum: checksumSchema,
        testTemplateChecksum: checksumSchema,
        boundFactsChecksum: checksumSchema
      }),
      z.strictObject({
        phase: z.literal('OUTCOME'),
        compilerSourceChecksum: checksumSchema,
        testTemplateChecksum: checksumSchema,
        outcomeTemplateChecksum: checksumSchema,
        boundFactsChecksum: checksumSchema,
        testExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        testExecutionChecksum: checksumSchema,
        /**
         * The one exact nested save request allowed inside a direct-action OUTCOME.
         * Dice evidence remains ungoverned by this d20 policy.
         */
        nestedOutcomeD20: z._default(
          z.nullable(z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)),
          null
        ),
        /** Server-sealed evidence for the nested OUTCOME d20, retained through terminal replay. */
        nestedOutcomeD20Evidence: z._default(
          z.nullable(z.lazy(() => serverRuleExecutionNestedD20EvidenceDtoSchema)),
          null
        ),
        /** Null unless an interstitial Legendary Resistance choice preceded this OUTCOME. */
        legendaryResistance: z._default(
          z.nullable(directActionLegendaryResistanceOutcomeAuditDtoSchema),
          null
        ),
        /** Null unless an interstitial reaction choice preceded this OUTCOME. */
        reaction: z._default(z.nullable(encounterReactionOutcomeAuditDtoSchema), null),
        /** Null unless the attacker decided an optional on-hit rider before this OUTCOME. */
        onHit: z._default(z.nullable(encounterOnHitAuditDtoSchema), null),
        /** Server-sealed d20 evidence from the completed TEST phase. */
        testRollEvidence: z
          .strictObject({
            requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
            rollMode: systemCoreCodeSchema,
            keep: rollModeKeepSchema,
            derivedRollMode: systemCoreCodeSchema,
            rawFaces: z.array(pendingD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2)),
            selectedNatural: pendingD20FaceSchema,
            /** Set when the server settled the TEST d20 in a mode other than the one rolled (ATTACK-10.1). */
            modeAdjustment: z.optional(serverRuleExecutionD20ModeAdjustmentDtoSchema),
            /** The TEST's added dice with their faces (D156); absent when it rolled none. */
            addedDice: z.optional(d20RolledAddedDiceDtoSchema)
          })
          .check(
            z.superRefine((value, context) => {
              if (
                value.rawFaces.length !== rollModeKeepFaceCount(value.keep) ||
                value.selectedNatural !== rollModeKeptFace(value.keep, value.rawFaces)
              )
                context.addIssue({
                  code: 'custom',
                  message: 'TEST roll evidence does not match its pinned roll mode.'
                })
            })
          )
      })
    ])
    .check(
      z.superRefine((value, context) => {
        if (value.phase !== 'OUTCOME') return
        const policy = value.nestedOutcomeD20
        const evidence = value.nestedOutcomeD20Evidence
        if (policy === null && evidence !== null) {
          context.addIssue({
            code: 'custom',
            path: ['nestedOutcomeD20Evidence'],
            message: 'Nested OUTCOME d20 evidence requires a sealed policy.'
          })
          return
        }
        if (
          policy !== null &&
          evidence !== null &&
          (evidence.requestNodeId !== policy.requestNodeId ||
            evidence.rollMode !== policy.rollMode ||
            evidence.keep !== policy.keep ||
            evidence.contributorChecksum !== policy.contributorChecksum ||
            evidence.modifier !== policy.modifier ||
            evidence.defenseOrDc !== policy.dc)
        )
          context.addIssue({
            code: 'custom',
            path: ['nestedOutcomeD20Evidence'],
            message: 'Nested OUTCOME d20 evidence does not match its sealed policy.'
          })
      })
    )
)

export const encounterCharacterRuleActionPendingContextDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENCOUNTER_CHARACTER_RULE_ACTION'),
    schemaVersion: z.literal(1),
    actionId: identifierSchema,
    /** Exact frozen Scene dependency when this action was positional. */
    sceneContext: z._default(
      z.optional(
        z.nullable(
          z.strictObject({
            sceneId: uuidSchema,
            sceneVersion: nonNegativeIntegerSchema,
            sourceTokenId: uuidSchema,
            targetTokenId: uuidSchema
          })
        )
      ),
      null
    ),
    /** Server-derived bounded positional currentness for a paused action. */
    positionalDependencyChecksum: z._default(z.optional(z.nullable(checksumSchema)), null),
    sourceActorId: uuidSchema,
    targetActorId: uuidSchema,
    sourceCharacterId: uuidSchema,
    targetCharacterId: uuidSchema,
    sourceCharacterStreamVersion: integerSchema.check(z.gte(0)),
    targetCharacterStreamVersion: integerSchema.check(z.gte(0)),
    sourceProjectionChecksum: checksumSchema,
    targetProjectionChecksum: checksumSchema,
    sourceMechanicalContextChecksum: checksumSchema,
    targetMechanicalContextChecksum: checksumSchema,
    publishedDefinitionId: uuidSchema,
    publishedDefinitionChecksum: checksumSchema,
    /**
     * Exact authored attack/range facts retained for post-action rules such
     * as Cleaving. Legacy paused actions deliberately retain null.
     */
    postActionTriggerFacts: z._default(
      z.optional(
        z.nullable(
          z.strictObject({
            attackKind: z.enum(['MELEE', 'RANGED', 'OTHER']),
            range: rangeDtoSchema
          })
        )
      ),
      null
    ),
    actionEconomy: z._default(
      z.nullable(
        z.strictObject({
          definitionId: uuidSchema,
          definitionVersion: positiveIntegerSchema,
          definitionChecksum: checksumSchema,
          maximum: positiveIntegerSchema,
          beforeUsed: nonNegativeIntegerSchema
        })
      ),
      null
    ),
    /** Sealed TEST/OUTCOME identity for a v3 Character action; legacy actions retain null. */
    twoPhase: z._default(z.optional(z.nullable(directActionTwoPhaseDtoSchema)), null),
    targetStateChecksum: checksumSchema,
    d20: z.nullable(
      z.strictObject({
        rollMode: systemCoreCodeSchema,
        keep: rollModeKeepSchema,
        contributors: z
          .array(receiptD20ContributorSchema)
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
        contributorChecksum: checksumSchema,
        modifier: integerSchema,
        defenseOrDc: integerSchema
      })
    )
  })
)

/**
 * Character-authored direct action against a mutable Creature or Custom
 * Encounter actor. Character targets retain the established Character lane.
 */
export const encounterActorRuleActionPendingContextDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENCOUNTER_ACTOR_RULE_ACTION'),
    schemaVersion: z.literal(1),
    actionId: identifierSchema,
    /** Exact frozen Scene dependency when this action was positional. */
    sceneContext: z._default(
      z.optional(
        z.nullable(
          z.strictObject({
            sceneId: uuidSchema,
            sceneVersion: nonNegativeIntegerSchema,
            sourceTokenId: uuidSchema,
            targetTokenId: uuidSchema
          })
        )
      ),
      null
    ),
    /** Server-derived bounded positional currentness for a paused action. */
    positionalDependencyChecksum: z._default(z.optional(z.nullable(checksumSchema)), null),
    sourceActorId: uuidSchema,
    targetActorId: uuidSchema,
    sourceCharacterId: uuidSchema,
    sourceCharacterStreamVersion: integerSchema.check(z.gte(0)),
    sourceProjectionChecksum: checksumSchema,
    sourceMechanicalContextChecksum: checksumSchema,
    targetCurrentnessChecksum: checksumSchema,
    publishedDefinitionId: uuidSchema,
    publishedDefinitionChecksum: checksumSchema,
    actionEconomy: z._default(
      z.nullable(
        z.strictObject({
          definitionId: uuidSchema,
          definitionVersion: positiveIntegerSchema,
          definitionChecksum: checksumSchema,
          maximum: positiveIntegerSchema,
          beforeUsed: nonNegativeIntegerSchema
        })
      ),
      null
    ),
    twoPhase: z._default(z.optional(z.nullable(directActionTwoPhaseDtoSchema)), null),
    phase: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('ACTION_EVIDENCE'),
        d20: z.nullable(
          z.strictObject({
            rollMode: systemCoreCodeSchema,
            keep: rollModeKeepSchema,
            contributors: z
              .array(receiptD20ContributorSchema)
              .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
            contributorChecksum: checksumSchema,
            modifier: integerSchema,
            defenseOrDc: integerSchema
          })
        )
      }),
      z.extend(encounterLegendaryResistanceOfferDtoSchema, {
        kind: z.literal('LEGENDARY_RESISTANCE_CHOICE')
      })
    ])
  })
)

/**
 * Sealed Character spell-cast source.  It deliberately does not reuse the
 * Character-action arm: spell provenance and CAST_SPELL economy must survive
 * an Assisted pause without becoming optional action fields.
 */
export const encounterActorSpellCastPendingContextDtoSchema = lazySchema(() =>
  z.extend(encounterActorRuleActionPendingContextDtoSchema, {
    kind: z.literal('ENCOUNTER_ACTOR_SPELL_CAST'),
    spell: z.strictObject({
      spellId: uuidSchema,
      versionId: uuidSchema,
      version: positiveIntegerSchema,
      checksum: checksumSchema,
      sourceKind: z.enum([
        'BACKGROUND',
        'CLASS',
        'FEAT',
        'FEATURE',
        'ITEM',
        'OPTION',
        'RACE',
        'SUBCLASS'
      ]),
      sourceInstanceId: uuidSchema,
      castLevel: integerSchema.check(z.gte(0)).check(z.lte(9)),
      castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
      slotKey: z.nullable(
        z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
      ),
      resourceOwnerKey: z.nullable(
        z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
      ),
      effectId: uuidSchema
    })
  })
)

/**
 * Immutable Creature Feature action. This is intentionally distinct from
 * ENCOUNTER_ACTOR_RULE_ACTION so existing Character occurrences retain
 * their byte-compatible source/currentness contract.
 */
export const encounterCreatureRuleActionPendingContextDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENCOUNTER_CREATURE_RULE_ACTION'),
    schemaVersion: z.literal(1),
    actionId: identifierSchema,
    sceneContext: z._default(
      z.optional(
        z.nullable(
          z.strictObject({
            sceneId: uuidSchema,
            sceneVersion: nonNegativeIntegerSchema,
            sourceTokenId: uuidSchema,
            targetTokenId: uuidSchema
          })
        )
      ),
      null
    ),
    positionalDependencyChecksum: z._default(z.optional(z.nullable(checksumSchema)), null),
    sourceActorId: uuidSchema,
    targetActorId: uuidSchema,
    creatureSourceId: uuidSchema,
    sourceRevision: positiveIntegerSchema,
    sourceVersionId: uuidSchema,
    sourceChecksum: checksumSchema,
    ownerFeatureId: uuidSchema,
    featureOptionId: z.nullable(uuidSchema),
    effectId: uuidSchema,
    authoredEffectChecksum: checksumSchema,
    compiledEffectChecksum: checksumSchema,
    targetCurrentnessChecksum: checksumSchema,
    publishedDefinitionId: uuidSchema,
    publishedDefinitionChecksum: checksumSchema,
    actionEconomy: z._default(
      z.nullable(
        z.strictObject({
          definitionId: uuidSchema,
          definitionVersion: positiveIntegerSchema,
          definitionChecksum: checksumSchema,
          maximum: positiveIntegerSchema,
          beforeUsed: nonNegativeIntegerSchema
        })
      ),
      null
    ),
    twoPhase: z._default(z.optional(z.nullable(directActionTwoPhaseDtoSchema)), null),
    phase: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('ACTION_EVIDENCE'),
        d20: z.nullable(
          z.strictObject({
            rollMode: systemCoreCodeSchema,
            keep: rollModeKeepSchema,
            contributors: z
              .array(receiptD20ContributorSchema)
              .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
            contributorChecksum: checksumSchema,
            modifier: integerSchema,
            defenseOrDc: integerSchema
          })
        )
      }),
      z.extend(encounterLegendaryResistanceOfferDtoSchema, {
        kind: z.literal('LEGENDARY_RESISTANCE_CHOICE')
      })
    ])
  })
)

/**
 * A held creature's pending Escape check (D105). The activation is already spent; the d20 settles
 * the check against the fixed `check.dc`, and success ends the holding effect. `actorId` rolls;
 * `heldActorId` is the held creature a rescuer within reach frees, absent when `actorId` escapes.
 */
export const encounterEscapeCheckPendingContextDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENCOUNTER_ESCAPE_CHECK'),
    schemaVersion: z.literal(1),
    commandId: uuidSchema,
    commandFingerprint: checksumSchema,
    actionLabel: identifierSchema,
    actorId: uuidSchema,
    heldActorId: z.optional(uuidSchema),
    activeEffectId: uuidSchema,
    /** The relationship escape module or the zone holding a condition the escape derives from. */
    escapeSourceId: uuidSchema,
    check: z.strictObject({
      checkDefinitionId: uuidSchema,
      dc: positiveIntegerSchema,
      label: identifierSchema
    }),
    d20: frozenCheckD20DtoSchema,
    /** The one-roll grants this check used up (a Help); their rows are gone, so the pending read names them from these. */
    consumedGrants: z
      .array(activeRuleEffectRecordSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
  })
)

// Explicitly typed so the settlement that embeds it stays within the compiler's size limit (TS7056).
export type EncounterConcealmentCheckPendingContextDto = {
  kind: 'ENCOUNTER_CONCEALMENT_CHECK'
  schemaVersion: 1
  commandId: z.infer<typeof uuidSchema>
  commandFingerprint: z.infer<typeof checksumSchema>
  definition: {
    id: z.infer<typeof uuidSchema>
    version: z.infer<typeof positiveIntegerSchema>
    checksum: z.infer<typeof checksumSchema>
  }
  actionLabel: z.infer<typeof identifierSchema>
  actionId: string
  actorId: z.infer<typeof uuidSchema>
  check: { checkDefinitionId: z.infer<typeof uuidSchema>; label: z.infer<typeof identifierSchema> }
  d20: {
    rollMode: string
    keep: RollModeKeep
    contributors: z.infer<typeof canonicalConcentrationContributorsDtoSchema>
    contributorChecksum: z.infer<typeof checksumSchema>
    modifier: z.infer<typeof integerSchema>
    addedDice?: D20AddedDieDto[]
    minimumRoll?: D20MinimumRollDto
  }
  resolution:
    | {
        kind: 'CONCEAL'
        observers: {
          actorId: z.infer<typeof uuidSchema>
          passiveScore: z.infer<typeof integerSchema>
        }[]
      }
    | {
        kind: 'DETECT'
        concealments: {
          effectId: z.infer<typeof uuidSchema>
          holderActorId: z.infer<typeof uuidSchema>
          concealmentTotal: z.infer<typeof integerSchema>
        }[]
      }
  consumedGrants: ActiveRuleEffectRecord[]
}

/**
 * A concealment check's pending d20 (Hide, Search). The Action is already spent. The roller's total
 * is compared with per-observer scores the roller never sees, so the context carries no DC: it
 * freezes the observers and their passive scores (Hide) or the concealments in reach (Search).
 */
export const encounterConcealmentCheckPendingContextDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENCOUNTER_CONCEALMENT_CHECK'),
    schemaVersion: z.literal(1),
    commandId: uuidSchema,
    commandFingerprint: checksumSchema,
    definition: z.strictObject({
      id: uuidSchema,
      version: positiveIntegerSchema,
      checksum: checksumSchema
    }),
    actionLabel: identifierSchema,
    /** The basic action id, so the settling roll re-reads the action's effect plan. */
    actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
    actorId: uuidSchema,
    check: z.strictObject({
      checkDefinitionId: uuidSchema,
      label: identifierSchema
    }),
    d20: frozenCheckD20DtoSchema,
    resolution: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('CONCEAL'),
        observers: z
          .array(z.strictObject({ actorId: uuidSchema, passiveScore: integerSchema }))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      }),
      z.strictObject({
        kind: z.literal('DETECT'),
        concealments: z
          .array(
            z.strictObject({
              effectId: uuidSchema,
              holderActorId: uuidSchema,
              concealmentTotal: integerSchema
            })
          )
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      })
    ]),
    /** The one-roll grants this check used up (a Help); their rows are gone, so the pending read names them from these. */
    consumedGrants: z
      .array(activeRuleEffectRecordSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
  })
)

/** The pins every damage-triggered save shares: its parent, the damage and the holder's pinned stream. */
const damageSaveCheckCommonFields = () => ({
  schemaVersion: z.literal(1),
  parentOccurrenceId: uuidSchema,
  parentCommandFingerprint: checksumSchema,
  finalizedDamageEnvelopeChecksum: checksumSchema,
  application: concentrationDamageApplicationDtoSchema,
  /** Display names for the whole envelope, so each later check can name its own trigger. */
  sourceLabels: concentrationDamageSourceLabelsDtoSchema,
  trigger: concentrationCheckTriggerDtoSchema,
  /** The pinned Character stream; null for a Creature or custom actor holder. */
  targetCharacter: z.nullable(
    z.strictObject({
      streamVersion: integerSchema.check(z.gte(0)),
      baseProjectionChecksum: checksumSchema,
      campaignOverlayChecksum: checksumSchema,
      mechanicalContextChecksum: checksumSchema
    })
  ),
  systemVocabularySnapshot: z.strictObject({
    id: uuidSchema,
    version: integerSchema.check(z.gte(1)),
    checksum: checksumSchema
  }),
  /**
   * Who dealt the damage, present when the chain can hold effect repeat saves (D167): each later
   * check re-derives its trigger from it. Absent for a chain that holds only Concentration checks.
   */
  repeatSaveDamagerActorId: z.optional(z.nullable(uuidSchema)),
  contextChecksum: checksumSchema,
  remaining: z
    .array(damageSaveApplicationDtoSchema)
    .check(z.maxLength(MAX_CONCENTRATION_DAMAGE_APPLICATIONS - 1))
})

/** The holder's own save a kernel-built damage save rolls: modifier, mode and added dice. */
const damageSaveFactsSchema = () =>
  z.strictObject({
    savingThrowAbilityDefinitionId: uuidSchema,
    modifier: integerSchema,
    rollMode: systemCoreCodeSchema,
    keep: rollModeKeepSchema,
    contributors: canonicalConcentrationContributorsDtoSchema,
    contributorChecksum: checksumSchema,
    /** Dice the holder rolls with the save (D156); absent when it rolls none. */
    addedDice: z.optional(d20AddedDiceDtoSchema)
  })

function remainingInCanonicalOrder(
  value: {
    application: Parameters<typeof compareDamageSaveApplications>[0]
    remaining: readonly Parameters<typeof compareDamageSaveApplications>[0][]
  },
  context: { addIssue(issue: { code: 'custom'; path: (string | number)[]; message: string }): void }
) {
  let prior = value.application
  for (const [index, remaining] of value.remaining.entries()) {
    if (compareDamageSaveApplications(remaining, prior) <= 0)
      context.addIssue({
        code: 'custom',
        path: ['remaining', index],
        message: 'Remaining damage saves must use canonical application order.'
      })
    prior = remaining
  }
}

/** A Concentration check forced by one damage application of a finalized envelope. */
export const encounterConcentrationDamageCheckPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_DAMAGE_SAVE_CHECK'),
      source: z.literal('CONCENTRATION'),
      ...damageSaveCheckCommonFields(),
      maintainedState: z.strictObject({
        id: uuidSchema,
        version: integerSchema.check(z.gte(0)),
        maintenanceDefinitionId: uuidSchema,
        descriptorChecksum: checksumSchema
      }),
      concentrationDefinition: z.strictObject({
        id: uuidSchema,
        checksum: checksumSchema
      }),
      save: damageSaveFactsSchema()
    })
    .check(z.superRefine(remainingInCanonicalOrder))
)

/**
 * A massive-damage save (ATTACK-16): one damage source dealt the holder at least the rule's share of
 * its maximum hit points. The pin binds the check to the exact optional rule definition it read.
 */
export const encounterMassiveDamageSavePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_DAMAGE_SAVE_CHECK'),
      source: z.literal('MASSIVE_DAMAGE'),
      ...damageSaveCheckCommonFields(),
      optionalCombatDefinition: z.strictObject({
        id: uuidSchema,
        version: integerSchema.check(z.gte(1)),
        checksum: checksumSchema
      }),
      /** The holder's maximum hit points the threshold was measured against. */
      maximumHitPoints: integerSchema.check(z.gte(1)),
      save: damageSaveFactsSchema()
    })
    .check(z.superRefine(remainingInCanonicalOrder))
)

/**
 * A repeat save a damaged holder's active effect offers (D167): the effect's own frozen save,
 * rolled by the holder's controllers, whose success ends the effect. The kernel continuation is the
 * only executable payload; the pins here bind it to the exact effect row it was started from.
 */
export const encounterEffectRepeatSavePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_DAMAGE_SAVE_CHECK'),
      source: z.literal('EFFECT_REPEAT_SAVE'),
      ...damageSaveCheckCommonFields(),
      activeEffect: z.strictObject({
        id: uuidSchema,
        version: integerSchema.check(z.gte(0)),
        lifecycleChecksum: checksumSchema
      }),
      /** How the effect's trigger tilts the roll; applied on top of the holder's own influences. */
      rollInfluence: z.nullable(systemCoreCodeSchema),
      /** The pinned frozen save, taken from the paused kernel request. */
      d20Policy: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)
    })
    .check(z.superRefine(remainingInCanonicalOrder))
)

export const encounterDamageSaveCheckPendingContextDtoSchema = lazySchema(() =>
  z.discriminatedUnion('source', [
    encounterConcentrationDamageCheckPendingContextDtoSchema,
    encounterEffectRepeatSavePendingContextDtoSchema,
    encounterMassiveDamageSavePendingContextDtoSchema
  ])
)
