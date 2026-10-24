import { z, lazySchema } from '../zod.js'
import { encounterAttackActionTransitionDtoSchema } from '../projections/encounterAttackAction.js'
import {
  deathSavesAfterDamage,
  deathSavesAfterDeath,
  deathSavesAfterHealing,
  isCharacterDead
} from './characterDeathSaves.js'
import { replayDeathStateReceipt } from './ruleExecutionDeathStateReplay.js'
import {
  temporaryHitPointsAfterGrant,
  temporaryHitPointsAfterLoss,
  temporaryHitPointsAfterRelease
} from './temporaryHitPoints.js'
import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  compareConcentrationDamageApplications,
  concentrationCheckTriggerDtoSchema,
  concentrationDamageApplicationDtoSchema,
  concentrationMaintainedDamageApplicationDtoSchema,
  type DamageSaveApplicationDto
} from './ruleExecutionConcentration.js'

import {
  canonicalD20ContributorKey,
  compareCanonicalD20Contributors
} from '@artificer-toolkit/shared/rules/contributors'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'
import { d20RolledAddedDiceDtoSchema, type D20RolledAddedDieDto } from './d20AddedDice.js'
import { d20CheckTotal, d20MinimumRollDtoSchema, type D20MinimumRollDto } from './d20MinimumRoll.js'

import { MAX_ENCOUNTER_ACTORS, authoredIdentifierSchema } from './authoredLimits.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from './spatial.js'
import {
  characterMechanicsApplicationDtoSchema,
  characterMechanicsResourceReceiptDtoSchema,
  characterMechanicsTargetTransitionDtoSchema,
  encounterActorActiveEffectCreateReceiptDtoSchema,
  encounterFeatureResourceReceiptDtoSchema,
  maintainedEffectTransitionDtoSchema,
  resolveDispositionDamage,
  sourceApplicationsChangeState,
  sourceApplicationsDtoSchema,
  stateEffectCreateReceiptDtoSchema,
  targetOutcomeTransitionDtoSchema,
  validateMaintainedEffectCreation,
  validateStateEffectTransitions
} from './ruleExecutionMechanics.js'
import {
  canonicalConcentrationContributorsDtoSchema,
  receiptD20ContributorSchema,
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema
} from './ruleExecutionEvidence.js'
import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'
// A cycle: the reaction receipt reuses this module's spend receipts; both sides are lazy schemas.
import { encounterActorReactionReceiptDtoSchema } from './ruleExecutionReactionChoice.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionCapabilityKeySchema as capabilityKeySchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionContractVersionSchema as contractVersionSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema,
  ruleExecutionPortNameSchema as portNameSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionReceiptD20FaceSchema as receiptD20FaceSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  meleeRetaliationEvidenceDtoSchema,
  validateMeleeRetaliation
} from './ruleExecutionEffectEvidence.js'
import { damageAddedDiceDtoSchema } from './d20AddedDice.js'
import {
  rollModeKeepFaceCount,
  rollModeKeepSchema,
  rollModeKeptFace,
  systemCoreCodeSchema,
  type RollModeKeep
} from './systemCoreCode.js'

/** What losing a Concentration slot removes: the maintained state, its dependents and Character owner versions. */
const concentrationCleanupDtoSchema = lazySchema(() =>
  z.strictObject({
    maintainedStateId: uuidSchema,
    removedDependentEffectIds: z
      .array(uuidSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2)),
    removedZoneIds: z.array(uuidSchema).check(z.maxLength(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)),
    characterOwnerTransitions: z
      .array(
        z.strictObject({
          characterId: uuidSchema,
          beforeStreamVersion: aggregateVersionSchema,
          afterStreamVersion: aggregateVersionSchema
        })
      )
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2))
  })
)

export const concentrationEndReasonSchema = lazySchema(() =>
  z.enum(['INCAPACITATED', 'DEFEATED', 'SPELLCASTING_LOCKED', 'CHOSEN'])
)

/** Why a Concentration ended: involuntarily (D95) or by its holder's choice (SPELLS-5.11). */
export type ConcentrationEndReason = z.infer<typeof concentrationEndReasonSchema>

/**
 * A Concentration slot that ended because its holder can't act, is defeated or can't cast spells
 * (D95), or because the holder ended it by choice (SPELLS-5.11); no check is rolled.
 */
export const concentrationEndDtoSchema = lazySchema(() =>
  z.strictObject({
    ownerActorId: uuidSchema,
    maintainedStateId: uuidSchema,
    reason: concentrationEndReasonSchema,
    cleanup: concentrationCleanupDtoSchema
  })
)

export const concentrationEndApplicationOutputDtoSchema = lazySchema(() =>
  z
    .extend(concentrationEndDtoSchema, {
      kind: z.literal('CONCENTRATION_END'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      parentOccurrenceId: uuidSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.cleanup.maintainedStateId !== value.maintainedStateId)
          context.addIssue({
            code: 'custom',
            path: ['cleanup', 'maintainedStateId'],
            message: 'Concentration end cleanup must target the ended maintained state.'
          })
      })
    )
)

/** The fields of a settled check roll, shared by checks with one DC and checks with none. */
const ruleCheckRollFields = () => ({
  requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
  /** The mode the faces were rolled with; `derivedRollMode` is the rules-derived one. */
  rollMode: systemCoreCodeSchema,
  keep: rollModeKeepSchema,
  derivedRollMode: systemCoreCodeSchema,
  rawFaces: z
    .array(integerSchema.check(z.gte(1)).check(z.lte(20)))
    .check(z.minLength(1))
    .check(z.maxLength(2)),
  selectedNatural: integerSchema.check(z.gte(1)).check(z.lte(20)),
  modifier: integerSchema,
  total: integerSchema,
  contributors: canonicalConcentrationContributorsDtoSchema,
  contributorChecksum: checksumSchema,
  /** The added dice (D156) with their rolled faces; `total` includes their signed sum. */
  addedDice: z.optional(d20RolledAddedDiceDtoSchema),
  /**
   * The floor the roller's effects put on the d20; `selectedNatural` stays the face kept and
   * `total` counts the higher of it and the floor.
   */
  minimumRoll: z.optional(d20MinimumRollDtoSchema)
})

const checkRollMatchesRollMode = (
  value: {
    keep: RollModeKeep
    rawFaces: number[]
    selectedNatural: number
    modifier: number
    total: number
    addedDice?: D20RolledAddedDieDto[]
    minimumRoll?: D20MinimumRollDto
  },
  context: { addIssue: (issue: { code: 'custom'; path: string[]; message: string }) => void }
) => {
  if (
    value.rawFaces.length !== rollModeKeepFaceCount(value.keep) ||
    value.selectedNatural !== rollModeKeptFace(value.keep, value.rawFaces) ||
    value.total !== d20CheckTotal(value)
  )
    context.addIssue({
      code: 'custom',
      path: ['rawFaces'],
      message: 'Check d20 evidence does not match its pinned roll mode.'
    })
}

/** The settled d20 of a pinned check (a Concentration save, a basic action's check). */
export const ruleCheckD20EvidenceDtoSchema = lazySchema(() =>
  z
    .strictObject({ ...ruleCheckRollFields(), dc: positiveIntegerSchema })
    .check(z.superRefine(checkRollMatchesRollMode))
)

/** The settled d20 of a check compared with per-actor scores, so it names no single DC. */
export const ruleCheckRollEvidenceDtoSchema = lazySchema(() =>
  z.strictObject(ruleCheckRollFields()).check(z.superRefine(checkRollMatchesRollMode))
)

export const concentrationCheckApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('DAMAGE_SAVE_CHECK'),
      source: z.literal('CONCENTRATION'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      parentOccurrenceId: uuidSchema,
      concentrationDefinition: z.strictObject({
        id: uuidSchema,
        checksum: checksumSchema
      }),
      savingThrowAbilityDefinitionId: uuidSchema,
      systemVocabularySnapshot: z.strictObject({
        id: uuidSchema,
        version: integerSchema.check(z.gte(1)),
        checksum: checksumSchema
      }),
      /** The pinned Character stream; null for a Creature or custom actor holder. */
      targetCharacter: z.nullable(
        z.strictObject({
          streamVersion: aggregateVersionSchema,
          baseProjectionChecksum: checksumSchema,
          campaignOverlayChecksum: checksumSchema,
          mechanicalContextChecksum: checksumSchema
        })
      ),
      application: concentrationMaintainedDamageApplicationDtoSchema,
      /** The context's display trigger, so every settled check can be logged without its context. */
      trigger: concentrationCheckTriggerDtoSchema,
      outcome: z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE']),
      d20: ruleCheckD20EvidenceDtoSchema,
      contextChecksum: checksumSchema,
      cleanup: z.nullable(concentrationCleanupDtoSchema),
      nextOccurrenceId: z.nullable(uuidSchema),
      skipped: z
        .array(
          z.extend(concentrationMaintainedDamageApplicationDtoSchema, {
            reason: z.literal('MAINTAINED_STATE_ENDED')
          })
        )
        .check(z.maxLength(MAX_CONCENTRATION_DAMAGE_APPLICATIONS - 1))
    })
    .check(
      z.superRefine((value, context) => {
        if ((value.outcome === 'SAVE_FAILURE') !== (value.cleanup !== null))
          context.addIssue({
            code: 'custom',
            path: ['cleanup'],
            message: 'Concentration cleanup must occur exactly on a failed save.'
          })
        if (value.trigger.dc !== value.d20.dc)
          context.addIssue({
            code: 'custom',
            path: ['trigger', 'dc'],
            message: 'The Concentration trigger must name the checked DC.'
          })
        if (
          value.cleanup?.maintainedStateId !== undefined &&
          value.cleanup.maintainedStateId !== value.application.maintainedStateId
        )
          context.addIssue({
            code: 'custom',
            path: ['cleanup', 'maintainedStateId'],
            message: 'Concentration cleanup must target the checked maintained state.'
          })
        let prior = value.application
        for (const [index, skipped] of value.skipped.entries()) {
          if (compareConcentrationDamageApplications(skipped, prior) <= 0)
            context.addIssue({
              code: 'custom',
              path: ['skipped', index],
              message: 'Skipped concentration checks must use canonical application order.'
            })
          if (skipped.maintainedStateId !== value.application.maintainedStateId)
            context.addIssue({
              code: 'custom',
              path: ['skipped', index, 'maintainedStateId'],
              message: 'Only checks for the ended maintained state may be skipped.'
            })
          prior = skipped
        }
      })
    )
)

/**
 * A damaged holder's effect repeat save, settled (D167). A made save ends the effect; the receipt
 * keeps the ids the release touched so undo and the log need not re-read the removed row.
 */
export const effectRepeatSaveApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('DAMAGE_SAVE_CHECK'),
      source: z.literal('EFFECT_REPEAT_SAVE'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      parentOccurrenceId: uuidSchema,
      activeEffect: z.strictObject({
        id: uuidSchema,
        version: integerSchema.check(z.gte(0)),
        lifecycleChecksum: checksumSchema
      }),
      savingThrowAbilityDefinitionId: uuidSchema,
      systemVocabularySnapshot: z.strictObject({
        id: uuidSchema,
        version: integerSchema.check(z.gte(1)),
        checksum: checksumSchema
      }),
      /** The pinned Character stream; null for a Creature or custom actor holder. */
      targetCharacter: z.nullable(
        z.strictObject({
          streamVersion: aggregateVersionSchema,
          baseProjectionChecksum: checksumSchema,
          campaignOverlayChecksum: checksumSchema,
          mechanicalContextChecksum: checksumSchema
        })
      ),
      application: concentrationDamageApplicationDtoSchema,
      trigger: concentrationCheckTriggerDtoSchema,
      outcome: z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE']),
      d20: ruleCheckD20EvidenceDtoSchema,
      contextChecksum: checksumSchema,
      /** The effect a made save ended; null on a failed save, which changes nothing. */
      released: z.nullable(
        z.strictObject({
          activeEffectId: uuidSchema,
          removedConditionIds: z
            .array(uuidSchema)
            .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
        })
      ),
      nextOccurrenceId: z.nullable(uuidSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if ((value.outcome === 'SAVE_SUCCESS') !== (value.released !== null))
          context.addIssue({
            code: 'custom',
            path: ['released'],
            message: 'An effect is released exactly on a made repeat save.'
          })
        if (value.released && value.released.activeEffectId !== value.activeEffect.id)
          context.addIssue({
            code: 'custom',
            path: ['released', 'activeEffectId'],
            message: 'The release must end the checked effect.'
          })
        if (value.trigger.dc !== value.d20.dc)
          context.addIssue({
            code: 'custom',
            path: ['trigger', 'dc'],
            message: 'The repeat-save trigger must name the checked DC.'
          })
      })
    )
)

export const damageSaveCheckApplicationOutputDtoSchema = lazySchema(() =>
  z.discriminatedUnion('source', [
    concentrationCheckApplicationOutputDtoSchema,
    effectRepeatSaveApplicationOutputDtoSchema
  ])
)

type DamageSaveCheckApplicationOutput = z.infer<typeof damageSaveCheckApplicationOutputDtoSchema>

/** The chain item a settled check answered: its damage bound to the state or effect it checked. */
export function damageSaveCheckBoundApplication(
  output: DamageSaveCheckApplicationOutput
): DamageSaveApplicationDto {
  return output.source === 'CONCENTRATION'
    ? output.application
    : { ...output.application, activeEffectId: output.activeEffect.id }
}

/**
 * Whether a settled check changed Run state, so its commit advances the Run version once (D23): a
 * lost Concentration, or an effect a made repeat save ended.
 */
export function damageSaveCheckMutatesRun(output: DamageSaveCheckApplicationOutput) {
  return output.outcome === (output.source === 'CONCENTRATION' ? 'SAVE_FAILURE' : 'SAVE_SUCCESS')
}

/**
 * One committed Character equipment change: Disarm, a shield stowed for an accepted attack, or an
 * item the target dropped (Heat Metal).
 */
export const characterItemUseStateTransitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('CHARACTER_ITEM_USE_STATE'),
      characterId: uuidSchema,
      itemInstanceId: uuidSchema,
      fromState: z.literal('EQUIPPED'),
      toState: z.literal('CARRIED'),
      beforeStreamVersion: aggregateVersionSchema,
      afterStreamVersion: aggregateVersionSchema,
      beforeStateChecksum: checksumSchema,
      afterStateChecksum: checksumSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.afterStreamVersion !== value.beforeStreamVersion + 1 ||
          value.beforeStateChecksum === value.afterStateChecksum
        )
          context.addIssue({
            code: 'custom',
            message: 'Character item state transition is invalid.'
          })
      })
    )
)
export type CharacterItemUseStateTransitionDto = z.infer<
  typeof characterItemUseStateTransitionDtoSchema
>

/**
 * Which way an attack moved its weapon between carried and a hand (D107): `DRAW` into the hand
 * `slot`, or `THROW` out of it. The checksums either side are those of the equipment before and
 * after the move, whichever way it went.
 */
const itemHandMovementSchema = lazySchema(() => z.enum(['DRAW', 'THROW']))

/**
 * A Character's weapon an attack moved between carried and a hand (D107): the Character version
 * that changed its equipment, with the equipment checksums either side. Undo moves it back.
 */
export const characterItemDrawTransitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('CHARACTER_ITEM_DRAW'),
      movement: z._default(itemHandMovementSchema, 'DRAW'),
      characterId: uuidSchema,
      itemInstanceId: uuidSchema,
      slot: z.enum(['MAIN_HAND', 'OFF_HAND']),
      beforeStreamVersion: aggregateVersionSchema,
      afterStreamVersion: aggregateVersionSchema,
      beforeStateChecksum: checksumSchema,
      afterStateChecksum: checksumSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.afterStreamVersion !== value.beforeStreamVersion + 1 ||
          value.beforeStateChecksum === value.afterStateChecksum
        )
          context.addIssue({ code: 'custom', message: 'Character item hand move is invalid.' })
      })
    )
)

/** A Creature's loadout weapon an attack moved between carried and a hand (D107). */
export const encounterActorItemDrawTransitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_ACTOR_ITEM_DRAW'),
      movement: z._default(itemHandMovementSchema, 'DRAW'),
      actorId: uuidSchema,
      loadoutEntryId: uuidSchema,
      equipmentId: uuidSchema,
      slot: z.enum(['MAIN_HAND', 'OFF_HAND']),
      beforeStateChecksum: checksumSchema,
      afterStateChecksum: checksumSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.beforeStateChecksum === value.afterStateChecksum)
          context.addIssue({ code: 'custom', message: 'Creature item hand move is invalid.' })
      })
    )
)

/** The weapon the source's attack drew into a hand or threw out of it: a Character's equipment, or a Creature's loadout. */
export const sourceItemDrawDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    characterItemDrawTransitionDtoSchema,
    encounterActorItemDrawTransitionDtoSchema
  ])
)
export type SourceItemDrawDto = z.infer<typeof sourceItemDrawDtoSchema>

/** One single-use item used up by an Assisted action: the holder's quantity falls by one. */
export type CharacterItemConsumptionReceiptDto = {
  characterId: string
  itemInstanceId: string
  beforeUsed: number
  afterUsed: number
  beforeQuantity: number
  afterQuantity: number
}
export const characterItemConsumptionFieldsSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuidSchema,
    itemInstanceId: uuidSchema,
    beforeUsed: nonNegativeIntegerSchema,
    afterUsed: positiveIntegerSchema,
    beforeQuantity: positiveIntegerSchema,
    afterQuantity: nonNegativeIntegerSchema
  })
)
/** An item consumption uses one or more pieces: its used count rises as its quantity falls. */
export function characterItemConsumptionPiecesMatch(value: {
  beforeUsed: number
  afterUsed: number
  beforeQuantity: number
  afterQuantity: number
}) {
  return (
    value.afterUsed > value.beforeUsed &&
    value.afterUsed - value.beforeUsed === value.beforeQuantity - value.afterQuantity
  )
}
// Named so the receipt unions that embed it stay under the compiler's declaration size limit.
export const characterItemConsumptionReceiptDtoSchema: z.ZodMiniType<CharacterItemConsumptionReceiptDto> =
  lazySchema(() =>
    characterItemConsumptionFieldsSchema.check(
      z.superRefine((value, context) => {
        if (!characterItemConsumptionPiecesMatch(value))
          context.addIssue({
            code: 'custom',
            message: 'An item consumption uses as many pieces as its quantity falls.'
          })
      })
    )
  )

/** One worn item an outcome corroded: its penalty rises, and it is used up when destroyed. */
export type CharacterItemDegradationReceiptDto = {
  characterId: string
  itemInstanceId: string
  beforePenalty: number
  afterPenalty: number
  beforeUsed: number
  afterUsed: number
}
export const characterItemDegradationReceiptDtoSchema: z.ZodMiniType<CharacterItemDegradationReceiptDto> =
  lazySchema(() =>
    z
      .strictObject({
        characterId: uuidSchema,
        itemInstanceId: uuidSchema,
        beforePenalty: nonNegativeIntegerSchema,
        afterPenalty: positiveIntegerSchema,
        beforeUsed: nonNegativeIntegerSchema,
        afterUsed: nonNegativeIntegerSchema
      })
      .check(
        z.superRefine((value, context) => {
          if (value.afterPenalty <= value.beforePenalty)
            context.addIssue({ code: 'custom', message: 'Corrosion raises the penalty.' })
          if (value.afterUsed !== value.beforeUsed && value.afterUsed !== value.beforeUsed + 1)
            context.addIssue({
              code: 'custom',
              message: 'Corrosion destroys at most one item.'
            })
        })
      )
  )

/** One spell slot (or the pact slot) a cast spent: the slot's used count rises by one. */
export type CharacterSpellSlotConsumptionReceiptDto = {
  characterId: string
  /** The spell cast and its cast candidate; both null when the slot paid for an optional on-hit rider. */
  spellId: string | null
  candidateId: string | null
  slotKey: string
  beforeUsed: number
  afterUsed: number
}
export const characterSpellSlotConsumptionFieldsSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuidSchema,
    spellId: z.nullable(uuidSchema),
    candidateId: z.nullable(
      z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
    ),
    slotKey: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
    beforeUsed: nonNegativeIntegerSchema,
    afterUsed: positiveIntegerSchema
  })
)
// Named so the receipt unions that embed it stay under the compiler's declaration size limit.
export const characterSpellSlotConsumptionReceiptDtoSchema: z.ZodMiniType<CharacterSpellSlotConsumptionReceiptDto> =
  lazySchema(() =>
    characterSpellSlotConsumptionFieldsSchema.check(
      z.superRefine((value, context) => {
        if (value.afterUsed !== value.beforeUsed + 1)
          context.addIssue({
            code: 'custom',
            message: 'A spell slot consumption spends exactly one slot.'
          })
        if ((value.spellId === null) !== (value.candidateId === null))
          context.addIssue({
            code: 'custom',
            path: ['candidateId'],
            message: 'A spell slot consumption names its spell and cast candidate together.'
          })
      })
    )
  )

/** One action-economy allowance use. An overridden ("Do it anyway") use may exceed the maximum. */
export const encounterActionEconomyTransitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      definitionId: uuidSchema,
      definitionVersion: positiveIntegerSchema,
      definitionChecksum: checksumSchema,
      maximum: positiveIntegerSchema,
      beforeUsed: nonNegativeIntegerSchema,
      afterUsed: positiveIntegerSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.afterUsed !== value.beforeUsed + 1)
          context.addIssue({
            code: 'custom',
            path: ['afterUsed'],
            message: 'An action-economy transition uses exactly one allowance.'
          })
      })
    )
)

/** One committed Creature loadout change: Disarm, or an item the target dropped (Heat Metal). */
export const encounterActorItemUseStateTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENCOUNTER_ACTOR_ITEM_USE_STATE'),
    actorId: uuidSchema,
    loadoutEntryId: uuidSchema,
    equipmentId: uuidSchema,
    fromState: z.enum(['MAIN_HAND', 'OFF_HAND']),
    toState: z.literal('CARRIED'),
    beforeStateChecksum: checksumSchema,
    afterStateChecksum: checksumSchema
  })
)
export type EncounterActorItemUseStateTransitionDto = z.infer<
  typeof encounterActorItemUseStateTransitionDtoSchema
>

export const encounterActorMechanicsBatchApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_ACTOR_MECHANICS_BATCH'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      /** The area action this target's settlement belongs to, when it is one creature of an area. */
      parentOccurrenceId: z.optional(uuidSchema),
      sourceActorId: uuidSchema,
      sourceCharacterId: z.optional(z.nullable(uuidSchema)),
      targetActorId: uuidSchema,
      sourceCharacterStreamVersion: z.nullable(aggregateVersionSchema),
      resourceConsumption: z.nullable(characterMechanicsResourceReceiptDtoSchema),
      spellCastConsumption: z._default(
        z.nullable(characterSpellSlotConsumptionReceiptDtoSchema),
        null
      ),
      featureResourceConsumption: z._default(
        z.nullable(encounterFeatureResourceReceiptDtoSchema),
        null
      ),
      targetFeatureResourceConsumption: z._default(
        z.nullable(encounterFeatureResourceReceiptDtoSchema),
        null
      ),
      sourceItemUseStateTransition: z._default(
        z.nullable(characterItemUseStateTransitionDtoSchema),
        null
      ),
      /** The carried weapon the source's attack drew into a hand; undo puts it back. */
      sourceItemDraw: z._default(z.nullable(sourceItemDrawDtoSchema), null),
      /** The weapon that hit the source's holder and corroded; undo restores it. */
      sourceItemDegradation: z._default(z.nullable(characterItemDegradationReceiptDtoSchema), null),
      sourceItemConsumption: z._default(z.nullable(characterItemConsumptionReceiptDtoSchema), null),
      /** The item the target dropped with this outcome (Heat Metal); undo puts it back in hand. */
      targetItemUseStateTransition: z._default(
        z.nullable(encounterActorItemUseStateTransitionDtoSchema),
        null
      ),
      actionEconomyTransition: z.nullable(encounterActionEconomyTransitionDtoSchema),
      /** Present when the attack opened or filled the actor's Attack action; undo restores `before`. */
      attackActionTransition: z.optional(encounterAttackActionTransitionDtoSchema),
      legendaryResistance: z._default(
        z.nullable(
          z.strictObject({
            selectedIndex: z.union([z.literal(0), z.literal(1)]),
            use: z.boolean(),
            ownerFeatureId: authoredIdentifierSchema,
            chargeId: authoredIdentifierSchema,
            featureCost: positiveIntegerSchema,
            lifecycle: z.strictObject({
              definitionId: uuidSchema,
              definitionVersion: positiveIntegerSchema,
              definitionChecksum: checksumSchema,
              choiceGraphDefinitionId: uuidSchema,
              choiceGraphDefinitionVersion: positiveIntegerSchema,
              choiceGraphDefinitionChecksum: checksumSchema,
              useOutput: portNameSchema,
              interruptedStage: z.literal('AFTER_FAILED_SAVE_BEFORE_OUTCOME'),
              replacement: z.literal('SAVE_SUCCESS')
            }),
            /** The choice-graph completion is nested evidence, never the action receipt root. */
            execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
            originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
            originalExecutionChecksum: checksumSchema,
            originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema)
          })
        ),
        null
      ),
      /** The target creature's reaction decision on this attack (Parry); its spend belongs to the target. */
      reaction: z._default(z.nullable(encounterActorReactionReceiptDtoSchema), null),
      d20: z.nullable(serverRuleExecutionD20EvidenceDtoSchema),
      nestedD20: z._default(z.nullable(serverRuleExecutionNestedD20EvidenceDtoSchema), null),
      /** The action's recurring effect and, beside it, a failure-margin rider's effect. */
      activeEffectTransitions: z._default(
        z.array(encounterActorActiveEffectCreateReceiptDtoSchema).check(z.maxLength(2)),
        []
      ),
      maintenanceTransition: z.optional(z.nullable(maintainedEffectTransitionDtoSchema)),
      /** Timed grants the target's own passive damage triggers created on it from this hit; undo deletes them. */
      grantEffectTransitions: z._default(
        z.array(encounterActorActiveEffectCreateReceiptDtoSchema).check(z.maxLength(4)),
        []
      ),
      stateEffectTransitions: z._default(
        z.array(stateEffectCreateReceiptDtoSchema).check(z.maxLength(1)),
        []
      ),
      targetTransition: characterMechanicsTargetTransitionDtoSchema,
      applications: z
        .array(characterMechanicsApplicationDtoSchema)
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      /** The source's own conditions released by effects its action ended; empty when none. */
      sourceApplications: sourceApplicationsDtoSchema,
      /** The dice active grants added to, or took from, its damage, in node-prefix order (D156). */
      damageAddedDice: z.optional(damageAddedDiceDtoSchema),
      /** The zones its target holds that this melee hit set off against the attacker (D153). */
      meleeRetaliation: z.optional(meleeRetaliationEvidenceDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        validateMeleeRetaliation(value, context)
        validateStateEffectTransitions({
          applications: value.applications,
          transitions: value.stateEffectTransitions,
          expectedOwnerKind: 'ENCOUNTER_ACTOR',
          expectedTargetActorId: value.targetActorId,
          context
        })
        validateMaintainedEffectCreation({
          occurrenceId: value.parentOccurrenceId ?? value.occurrenceId,
          sourceActorId: value.sourceActorId,
          activeEffectTransitions: value.activeEffectTransitions,
          maintenanceTransition: value.maintenanceTransition,
          context
        })
        let current = value.targetTransition.before.currentHitPoints
        let temporary = value.targetTransition.before.temporaryHitPoints
        let temporarySource = value.targetTransition.before.temporaryHitPointsSourceEffectId ?? null
        let maximum = value.targetTransition.before.maximumHitPoints
        let deathSaves = value.targetTransition.before.deathSaves
        const conditions = new Set(value.targetTransition.before.conditionIds)
        const scalarValues = {
          ...value.targetTransition.before.scalarValues
        }
        for (const [index, application] of value.applications.entries()) {
          if (application.ordinal !== index)
            context.addIssue({
              code: 'custom',
              path: ['applications', index, 'ordinal'],
              message: 'Encounter actor mechanics application ordinals must be contiguous.'
            })
          if (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE') {
            const present = conditions.has(application.conditionId)
            const validTransition =
              application.kind === 'CONDITION_APPLY'
                ? application.afterPresent && application.applied === !present
                : application.applied
                  ? present && !application.afterPresent
                  : application.afterPresent === present
            if (application.beforePresent !== present || !validTransition)
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Condition receipt presence is invalid.'
              })
            if (application.afterPresent) conditions.add(application.conditionId)
            else conditions.delete(application.conditionId)
            continue
          }
          if (application.kind === 'HIT_POINT_MAXIMUM_REDUCTION') {
            const afterMaximum = Math.max(
              0,
              application.beforeMaximumHitPoints - application.reductionAmount
            )
            if (
              application.beforeMaximumHitPoints !== maximum ||
              application.afterMaximumHitPoints !== afterMaximum ||
              application.appliedAmount !== application.beforeMaximumHitPoints - afterMaximum ||
              application.requestedAmount !== application.reductionAmount ||
              application.resolvedAmount !== application.reductionAmount ||
              application.maximumHitPoints !== maximum ||
              application.beforeCurrentHitPoints !== current ||
              application.afterCurrentHitPoints !== Math.min(current, afterMaximum) ||
              application.beforeTemporaryHitPoints !== temporary ||
              application.afterTemporaryHitPoints !== temporary
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Hit point maximum reduction receipt arithmetic is invalid.'
              })
            current = application.afterCurrentHitPoints
            maximum = application.afterMaximumHitPoints
            if (maximum === 0 && deathSaves !== null) deathSaves = deathSavesAfterDeath()
            continue
          }
          if (application.kind === 'SCALAR_REDUCTION') {
            const beforeValue = scalarValues[application.valueDefinitionId]
            const afterValue = Math.max(
              application.floor,
              beforeValue - application.reductionAmount
            )
            if (
              !Number.isSafeInteger(beforeValue) ||
              beforeValue < 0 ||
              application.stacking !== 'ADDITIVE' ||
              application.floor !== 0 ||
              application.afterValue !== afterValue ||
              application.beforeValue !== beforeValue ||
              application.targetDied !== (afterValue === application.floor)
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Scalar reduction receipt arithmetic is invalid.'
              })
            scalarValues[application.valueDefinitionId] = afterValue
            if (application.targetDied) {
              current = 0
              if (deathSaves !== null) deathSaves = deathSavesAfterDeath()
            }
            continue
          }
          if (application.kind === 'KILL') {
            if (
              application.beforeCurrentHitPoints !== current ||
              application.beforeTemporaryHitPoints !== temporary
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Kill receipt hit-point chain is invalid.'
              })
            current = 0
            temporary = 0
            temporarySource = null
            if (deathSaves !== null) deathSaves = deathSavesAfterDeath()
            continue
          }
          if (application.kind === 'KILL_NEGATED' || application.kind === 'DEPART') continue
          if (application.kind === 'STABILIZE' || application.kind === 'REVIVE') {
            const replay = replayDeathStateReceipt(application, { current, maximum, deathSaves })
            if (replay.issue)
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: replay.issue
              })
            ;({ current, deathSaves } = replay)
            continue
          }
          if (application.kind === 'TEMPORARY_HIT_POINTS_RELEASE') {
            const released = temporaryHitPointsAfterRelease(
              { amount: temporary, sourceEffectId: temporarySource },
              application.sourceActiveEffectId
            )
            if (
              application.beforeTemporaryHitPoints !== temporary ||
              application.afterTemporaryHitPoints !== released.amount ||
              application.applied !== (temporarySource === application.sourceActiveEffectId)
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Temporary hit-point release receipt is invalid.'
              })
            temporary = released.amount
            temporarySource = released.sourceEffectId
            continue
          }
          if (
            application.beforeCurrentHitPoints > application.maximumHitPoints ||
            application.afterCurrentHitPoints > application.maximumHitPoints ||
            application.beforeCurrentHitPoints !== current ||
            application.beforeTemporaryHitPoints !== temporary ||
            application.maximumHitPoints !== maximum
          )
            context.addIssue({
              code: 'custom',
              path: ['applications', index],
              message: 'Encounter actor hit-point application chain is invalid.'
            })
          if (application.kind === 'HEAL') {
            // A dead Character ignores healing (D96).
            const applied =
              deathSaves !== null && isCharacterDead(deathSaves)
                ? 0
                : Math.min(
                    application.resolvedAmount,
                    application.maximumHitPoints - application.beforeCurrentHitPoints
                  )
            if (deathSaves !== null)
              deathSaves = deathSavesAfterHealing({ deathSaves, appliedAmount: applied })
            if (
              application.resolvedAmount !== application.requestedAmount ||
              application.afterTemporaryHitPoints !== application.beforeTemporaryHitPoints ||
              application.appliedAmount !== applied ||
              application.afterCurrentHitPoints !== application.beforeCurrentHitPoints + applied
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Heal receipt arithmetic is invalid.'
              })
          } else if (application.kind === 'TEMPORARY_HIT_POINTS') {
            const granted = temporaryHitPointsAfterGrant(
              { amount: application.beforeTemporaryHitPoints, sourceEffectId: temporarySource },
              {
                amount: application.resolvedAmount,
                sourceEffectId: application.sourceActiveEffectId ?? null
              }
            )
            const afterTemporary = granted.amount
            temporarySource = granted.sourceEffectId
            if (
              application.resolvedAmount !== application.requestedAmount ||
              application.afterCurrentHitPoints !== application.beforeCurrentHitPoints ||
              application.appliedAmount !== afterTemporary - application.beforeTemporaryHitPoints ||
              application.afterTemporaryHitPoints !== afterTemporary
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Temporary hit-point receipt arithmetic is invalid.'
              })
          } else if (application.kind === 'DAMAGE') {
            const resolved = resolveDispositionDamage(
              application.damageDisposition,
              application.requestedAmount
            )
            const temporaryLost = Math.min(application.beforeTemporaryHitPoints, resolved)
            temporarySource = temporaryHitPointsAfterLoss(
              { amount: application.beforeTemporaryHitPoints, sourceEffectId: temporarySource },
              temporaryLost
            ).sourceEffectId
            const currentLost = Math.min(
              application.beforeCurrentHitPoints,
              resolved - temporaryLost
            )
            const intercepted = application.interceptedBy !== undefined
            // An interception leaves a lethal blow's target at a total above 0 (Death Ward).
            const expectedAfter = intercepted
              ? application.afterCurrentHitPoints
              : application.beforeCurrentHitPoints - currentLost
            if (
              intercepted &&
              (application.beforeCurrentHitPoints - currentLost !== 0 ||
                application.beforeCurrentHitPoints < 1 ||
                application.afterCurrentHitPoints < 1 ||
                application.afterCurrentHitPoints > application.maximumHitPoints)
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Damage interception receipt is invalid.'
              })
            if (
              application.resolvedAmount !== resolved ||
              application.appliedAmount !==
                temporaryLost + application.beforeCurrentHitPoints - expectedAfter ||
              application.afterCurrentHitPoints !== expectedAfter ||
              application.afterTemporaryHitPoints !==
                application.beforeTemporaryHitPoints - temporaryLost
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Damage receipt arithmetic is invalid.'
              })
            if (deathSaves !== null && !intercepted)
              deathSaves = deathSavesAfterDamage({
                deathSaves,
                currentHitPoints: application.beforeCurrentHitPoints,
                maximumHitPoints: application.maximumHitPoints,
                dealt: resolved - temporaryLost,
                critical: application.critical
              })
          }
          current = application.afterCurrentHitPoints
          temporary = application.afterTemporaryHitPoints
        }
        const after = value.targetTransition.after
        if (
          after.currentHitPoints !== current ||
          after.temporaryHitPoints !== temporary ||
          (after.temporaryHitPointsSourceEffectId ?? null) !== temporarySource ||
          after.maximumHitPoints !== maximum ||
          JSON.stringify(after.deathSaves) !== JSON.stringify(deathSaves) ||
          after.conditionIds.length !== conditions.size ||
          after.conditionIds.some((conditionId, index) => [...conditions][index] !== conditionId) ||
          JSON.stringify(after.scalarValues) !== JSON.stringify(scalarValues)
        )
          context.addIssue({
            code: 'custom',
            path: ['targetTransition', 'after'],
            message: 'Encounter actor target transition is invalid.'
          })
        const resource = value.resourceConsumption
        const featureResource = value.featureResourceConsumption
        const targetFeatureResource = value.targetFeatureResourceConsumption
        if (
          resource &&
          (resource.afterUsed !== resource.beforeUsed + resource.cost ||
            resource.beforeRemaining < resource.cost ||
            resource.afterRemaining !== resource.beforeRemaining - resource.cost)
        )
          context.addIssue({
            code: 'custom',
            path: ['resourceConsumption'],
            message: 'Resource receipt is invalid.'
          })
        const maintenance = value.maintenanceTransition ?? null
        if (maintenance && value.sourceCharacterId === undefined)
          context.addIssue({
            code: 'custom',
            path: ['sourceCharacterId'],
            message: 'Maintained replacement requires immutable source Character identity.'
          })
        if (resource && value.sourceCharacterId === null)
          context.addIssue({
            code: 'custom',
            path: ['sourceCharacterId'],
            message: 'Character resource consumption requires a Character source.'
          })
        if (
          value.targetItemUseStateTransition &&
          value.targetItemUseStateTransition.actorId !== value.targetActorId
        )
          context.addIssue({
            code: 'custom',
            path: ['targetItemUseStateTransition'],
            message: 'Target item state transition must match the target.'
          })
        const stow = value.sourceItemUseStateTransition
        if (
          stow &&
          (value.sourceCharacterId == null ||
            stow.characterId !== value.sourceCharacterId ||
            stow.afterStreamVersion !== value.sourceCharacterStreamVersion)
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceItemUseStateTransition'],
            message: 'Source item state transition must match the source Character version.'
          })
        const draw = value.sourceItemDraw
        if (
          draw &&
          (draw.kind === 'CHARACTER_ITEM_DRAW'
            ? value.sourceCharacterId == null ||
              draw.characterId !== value.sourceCharacterId ||
              draw.afterStreamVersion !== value.sourceCharacterStreamVersion
            : draw.actorId !== value.sourceActorId)
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceItemDraw'],
            message: 'Source item draw must match the source and its version.'
          })
        const degradation = value.sourceItemDegradation
        if (
          degradation &&
          (value.sourceCharacterId == null || degradation.characterId !== value.sourceCharacterId)
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceItemDegradation'],
            message: 'Item degradation must match the source Character.'
          })
        const consumption = value.sourceItemConsumption
        if (
          consumption &&
          (value.sourceCharacterId == null || consumption.characterId !== value.sourceCharacterId)
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceItemConsumption'],
            message: 'Item consumption must match the source Character.'
          })
        const spell = value.spellCastConsumption
        if (
          spell &&
          (value.sourceCharacterId == null || spell.characterId !== value.sourceCharacterId)
        )
          context.addIssue({
            code: 'custom',
            path: ['spellCastConsumption'],
            message: 'Spell slot consumption must match the source Character.'
          })
        const sourceMaintenanceMutation =
          value.sourceCharacterId != null &&
          (maintenance?.characterOwnerTransitions.some(
            (transition) => transition.characterId === value.sourceCharacterId
          ) ??
            false)
        if (
          (value.sourceCharacterStreamVersion === null) !==
          !(
            resource !== null ||
            stow !== null ||
            draw?.kind === 'CHARACTER_ITEM_DRAW' ||
            degradation !== null ||
            consumption !== null ||
            spell !== null ||
            sourceMaintenanceMutation ||
            sourceApplicationsChangeState(value.sourceApplications, value.sourceCharacterId ?? null)
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceCharacterStreamVersion'],
            message: 'Source Character stream version presence is invalid.'
          })
        if (
          featureResource &&
          (featureResource.ownerActorId !== value.sourceActorId ||
            featureResource.afterUsed !== featureResource.beforeUsed + featureResource.cost ||
            featureResource.beforeRemaining < featureResource.cost ||
            featureResource.afterRemaining !==
              featureResource.beforeRemaining - featureResource.cost)
        )
          context.addIssue({
            code: 'custom',
            path: ['featureResourceConsumption'],
            message: 'Encounter feature resource receipt is invalid.'
          })
        if (resource !== null && featureResource !== null)
          context.addIssue({
            code: 'custom',
            path: ['featureResourceConsumption'],
            message: 'Character and Encounter feature resource receipts are mutually exclusive.'
          })
        if (
          targetFeatureResource &&
          (targetFeatureResource.ownerActorId !== value.targetActorId ||
            targetFeatureResource.afterUsed !==
              targetFeatureResource.beforeUsed + targetFeatureResource.cost ||
            targetFeatureResource.beforeRemaining < targetFeatureResource.cost ||
            targetFeatureResource.afterRemaining !==
              targetFeatureResource.beforeRemaining - targetFeatureResource.cost)
        )
          context.addIssue({
            code: 'custom',
            path: ['targetFeatureResourceConsumption'],
            message: 'Target Encounter feature resource receipt is invalid.'
          })
        if (value.reaction && value.reaction.reaction.reactorActorId !== value.targetActorId)
          context.addIssue({
            code: 'custom',
            path: ['reaction'],
            message: 'A reaction belongs to the attacked creature.'
          })
        const legendaryResistance = value.legendaryResistance
        if (legendaryResistance) {
          const expectedUse = legendaryResistance.selectedIndex === 1
          if (
            legendaryResistance.use !== expectedUse ||
            legendaryResistance.originalExecution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
            checksumRuleDocument(legendaryResistance.originalExecution) !==
              legendaryResistance.originalExecutionChecksum
          )
            context.addIssue({
              code: 'custom',
              path: ['legendaryResistance'],
              message: 'Legendary Resistance action evidence is invalid.'
            })
          const consumptionMatches =
            targetFeatureResource !== null &&
            targetFeatureResource.ownerActorId === value.targetActorId &&
            targetFeatureResource.ownerFeatureId === legendaryResistance.ownerFeatureId &&
            targetFeatureResource.chargeId === legendaryResistance.chargeId &&
            targetFeatureResource.cost === legendaryResistance.featureCost
          if (
            (legendaryResistance.use && !consumptionMatches) ||
            (!legendaryResistance.use && targetFeatureResource !== null)
          )
            context.addIssue({
              code: 'custom',
              path: ['targetFeatureResourceConsumption'],
              message: 'Legendary Resistance charge consumption does not match the selected choice.'
            })
        } else if (targetFeatureResource !== null)
          context.addIssue({
            code: 'custom',
            path: ['targetFeatureResourceConsumption'],
            message: 'Target Feature resource consumption requires Legendary Resistance evidence.'
          })
        const contributorKeys = new Set<string>()
        for (const contributor of value.d20?.contributors ?? []) {
          const key = canonicalD20ContributorKey(contributor)
          if (contributorKeys.has(key))
            context.addIssue({
              code: 'custom',
              path: ['d20', 'contributors'],
              message: 'd20 contributors must be unique.'
            })
          contributorKeys.add(key)
        }
      })
    )
)

const contestedActionRollDtoSchema = lazySchema(() =>
  z
    .strictObject({
      actorId: uuidSchema,
      requestNodeId: localNodeIdSchema,
      rollMode: systemCoreCodeSchema,
      keep: rollModeKeepSchema,
      rawFaces: z.array(receiptD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2)),
      selectedNatural: receiptD20FaceSchema,
      contributors: z
        .array(receiptD20ContributorSchema)
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      contributorChecksum: checksumSchema,
      modifier: integerSchema,
      total: integerSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.rawFaces.length !== rollModeKeepFaceCount(value.keep) ||
          value.selectedNatural !== rollModeKeptFace(value.keep, value.rawFaces)
        )
          context.addIssue({
            code: 'custom',
            message: 'Contested-action d20 faces do not match the sealed roll mode.'
          })
        if (value.total !== value.selectedNatural + value.modifier)
          context.addIssue({
            code: 'custom',
            path: ['total'],
            message: 'Contested-action d20 total is invalid.'
          })
        if (
          value.contributors.some(
            (contributor, index) =>
              index > 0 &&
              compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['contributors'],
            message: 'Contested-action contributors must be strictly sorted and unique.'
          })
        if (checksumRuleDocument(value.contributors) !== value.contributorChecksum)
          context.addIssue({
            code: 'custom',
            path: ['contributorChecksum'],
            message: 'Contested-action contributor checksum is invalid.'
          })
      })
    )
)

export const contestedActionApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('CONTESTED_ACTION'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      sourceActorId: uuidSchema,
      targetActorId: uuidSchema,
      sealedContextChecksum: checksumSchema,
      /** The sealed optional-combat policy; null for a basic-action or escape contest (D152 amendment). */
      policy: z.nullable(
        z.strictObject({
          definitionId: uuidSchema,
          definitionVersion: positiveIntegerSchema,
          definitionChecksum: checksumSchema,
          moduleKey: capabilityKeySchema,
          moduleContractVersion: contractVersionSchema
        })
      ),
      contestGraph: z.strictObject({
        definitionId: uuidSchema,
        checksum: checksumSchema,
        identityChecksum: checksumSchema
      }),
      sourceRoll: contestedActionRollDtoSchema,
      targetRoll: contestedActionRollDtoSchema,
      outcome: z.enum(['SOURCE_WIN', 'TARGET_WIN_OR_TIE']),
      stateTransition: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('NONE') }),
        characterItemUseStateTransitionDtoSchema,
        encounterActorItemUseStateTransitionDtoSchema,
        targetOutcomeTransitionDtoSchema,
        /** The relationship effect the win created and the conditions it newly applied to the target. */
        z.strictObject({
          kind: z.literal('ACTOR_RELATIONSHIP'),
          createdEffect: encounterActorActiveEffectCreateReceiptDtoSchema,
          appliedConditionIds: z
            .array(uuidSchema)
            .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
        }),
        /** The held source's won escape: the holding effect ended and the conditions only it held. */
        z.strictObject({
          kind: z.literal('RELATIONSHIP_ENDED'),
          endedEffectId: uuidSchema,
          removedConditionIds: z
            .array(uuidSchema)
            .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
        })
      ]),
      actionEconomyTransition: z.nullable(encounterActionEconomyTransitionDtoSchema),
      /** The Attack action a contest that replaces one attack (Grapple, Shove) fills; absent otherwise. */
      attackActionTransition: z.optional(encounterAttackActionTransitionDtoSchema),
      /** The source's own conditions released by effects its attack roll ended; empty when none. */
      sourceApplications: sourceApplicationsDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.sourceActorId === value.targetActorId)
          context.addIssue({
            code: 'custom',
            path: ['targetActorId'],
            message: 'Contested-action participants must be distinct.'
          })
        if (
          value.sourceRoll.actorId !== value.sourceActorId ||
          value.targetRoll.actorId !== value.targetActorId ||
          value.sourceRoll.requestNodeId === value.targetRoll.requestNodeId
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceRoll'],
            message: 'Contested-action roll participants or request nodes are invalid.'
          })
        const sourceWon = value.sourceRoll.total > value.targetRoll.total
        if ((value.outcome === 'SOURCE_WIN') !== sourceWon)
          context.addIssue({
            code: 'custom',
            path: ['outcome'],
            message: 'Contested-action outcome does not match roll totals.'
          })
        if (value.outcome === 'SOURCE_WIN' && value.stateTransition.kind === 'NONE')
          context.addIssue({
            code: 'custom',
            path: ['stateTransition'],
            message: 'A contested-action source win requires one state transition.'
          })
        if (value.outcome === 'TARGET_WIN_OR_TIE' && value.stateTransition.kind !== 'NONE')
          context.addIssue({
            code: 'custom',
            path: ['stateTransition'],
            message: 'A contested-action target win or tie cannot mutate item state.'
          })
        if (
          value.stateTransition.kind === 'ENCOUNTER_ACTOR_ITEM_USE_STATE' &&
          (value.stateTransition.actorId !== value.targetActorId ||
            value.stateTransition.beforeStateChecksum === value.stateTransition.afterStateChecksum)
        )
          context.addIssue({
            code: 'custom',
            path: ['stateTransition'],
            message: 'Encounter-actor contested-action item state transition is invalid.'
          })
        if (
          value.stateTransition.kind === 'ACTOR_RELATIONSHIP' &&
          value.stateTransition.createdEffect.targetActorId !== value.targetActorId
        )
          context.addIssue({
            code: 'custom',
            path: ['stateTransition', 'createdEffect'],
            message: 'A contested relationship effect belongs to the contest target.'
          })
        if (
          value.actionEconomyTransition &&
          value.actionEconomyTransition.beforeUsed >= value.actionEconomyTransition.maximum
        )
          context.addIssue({
            code: 'custom',
            path: ['actionEconomyTransition'],
            message: 'Contested-action economy transition is invalid.'
          })
      })
    )
)

/** The source's one spend of an action, as the receipts every root that spends it carries. */
export const sourceSpendReceiptShape = () => ({
  sourceCharacterStreamVersion: z.nullable(aggregateVersionSchema),
  /** The source's own conditions released by effects its action ended; empty when none. */
  sourceApplications: sourceApplicationsDtoSchema,
  resourceConsumption: z.nullable(characterMechanicsResourceReceiptDtoSchema),
  featureResourceConsumption: z.nullable(encounterFeatureResourceReceiptDtoSchema),
  sourceItemUseStateTransition: z.nullable(characterItemUseStateTransitionDtoSchema),
  sourceItemDraw: z._default(z.nullable(sourceItemDrawDtoSchema), null),
  /** The weapon the source hit with, corroded by what it struck; undo restores its penalty and use. */
  sourceItemDegradation: z._default(z.nullable(characterItemDegradationReceiptDtoSchema), null),
  sourceItemConsumption: z.nullable(characterItemConsumptionReceiptDtoSchema),
  spellCastConsumption: z.nullable(characterSpellSlotConsumptionReceiptDtoSchema),
  actionEconomyTransition: z.nullable(encounterActionEconomyTransitionDtoSchema),
  attackActionTransition: z.optional(encounterAttackActionTransitionDtoSchema)
})

export type SourceSpendReceipts = Pick<
  z.infer<typeof encounterActorMechanicsBatchApplicationOutputDtoSchema>,
  | 'resourceConsumption'
  | 'featureResourceConsumption'
  | 'sourceItemUseStateTransition'
  | 'sourceItemDraw'
  | 'sourceItemDegradation'
  | 'sourceItemConsumption'
  | 'spellCastConsumption'
  | 'actionEconomyTransition'
  | 'attackActionTransition'
  | 'sourceApplications'
> & { sourceCharacterStreamVersion: number | null }

/** The spend receipts agree with the source they name: its Character, its resources and its stream version. */
export function validateSourceSpendReceipts(
  value: SourceSpendReceipts & { sourceActorId: string; sourceCharacterId: string | null },
  context: z.core.$RefinementCtx
) {
  const resource = value.resourceConsumption
  if (
    resource &&
    (value.sourceCharacterId === null ||
      resource.afterUsed !== resource.beforeUsed + resource.cost ||
      resource.beforeRemaining < resource.cost ||
      resource.afterRemaining !== resource.beforeRemaining - resource.cost)
  )
    context.addIssue({
      code: 'custom',
      path: ['resourceConsumption'],
      message: 'Resource receipt is invalid.'
    })
  const stow = value.sourceItemUseStateTransition
  const draw = value.sourceItemDraw
  const degradation = value.sourceItemDegradation
  const consumption = value.sourceItemConsumption
  const spell = value.spellCastConsumption
  if (
    (stow &&
      (stow.characterId !== value.sourceCharacterId ||
        stow.afterStreamVersion !== value.sourceCharacterStreamVersion)) ||
    (draw?.kind === 'CHARACTER_ITEM_DRAW' &&
      (draw.characterId !== value.sourceCharacterId ||
        draw.afterStreamVersion !== value.sourceCharacterStreamVersion)) ||
    (draw?.kind === 'ENCOUNTER_ACTOR_ITEM_DRAW' && draw.actorId !== value.sourceActorId) ||
    (degradation && degradation.characterId !== value.sourceCharacterId) ||
    (consumption && consumption.characterId !== value.sourceCharacterId) ||
    (spell && spell.characterId !== value.sourceCharacterId)
  )
    context.addIssue({
      code: 'custom',
      path: ['sourceItemUseStateTransition'],
      message: 'Source item receipts must match the source Character.'
    })
  const featureResource = value.featureResourceConsumption
  if (
    featureResource &&
    (resource !== null ||
      featureResource.ownerActorId !== value.sourceActorId ||
      featureResource.afterUsed !== featureResource.beforeUsed + featureResource.cost ||
      featureResource.beforeRemaining < featureResource.cost ||
      featureResource.afterRemaining !== featureResource.beforeRemaining - featureResource.cost)
  )
    context.addIssue({
      code: 'custom',
      path: ['featureResourceConsumption'],
      message: 'Encounter feature resource receipt is invalid.'
    })
  if (
    (value.sourceCharacterStreamVersion === null) !==
    !(
      resource !== null ||
      stow !== null ||
      draw?.kind === 'CHARACTER_ITEM_DRAW' ||
      degradation !== null ||
      consumption !== null ||
      spell !== null ||
      sourceApplicationsChangeState(value.sourceApplications, value.sourceCharacterId)
    )
  )
    context.addIssue({
      code: 'custom',
      path: ['sourceCharacterStreamVersion'],
      message: 'Source Character stream version presence is invalid.'
    })
}

/**
 * The root of a committed point-area action: the caster's one spend, the creatures the area caught and
 * the GM removed, and the child settlement of each kept creature. Each child is a mechanics batch
 * receipt under its own occurrence that names this root as its parent.
 */
const encounterAreaActionApplicationOutputImplSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_AREA_ACTION'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      sourceActorId: uuidSchema,
      sourceCharacterId: z.nullable(uuidSchema),
      caughtChecksum: checksumSchema,
      removedActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      /** The kept creatures' child occurrences, in the order they settled. */
      targetOccurrenceIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      /** The damage each kept creature took as one envelope, which a Concentration check answers against. */
      damage: z
        .array(concentrationDamageApplicationDtoSchema)
        .check(z.maxLength(MAX_CONCENTRATION_DAMAGE_APPLICATIONS)),
      ...sourceSpendReceiptShape(),
      /**
       * The spatial effects this action placed in the Scene, which GM undo deletes: a zone's own and
       * one per band beside its wall (D154). Empty for none.
       */
      placedSpatialEffectIds: z.array(uuidSchema).check(z.maxLength(5)),
      /**
       * The Concentration a zone-only cast opens, which no creature outcome carries (D135). Absent
       * when a creature outcome carries it or the cast maintains nothing.
       */
      maintenanceTransition: z.optional(z.nullable(maintainedEffectTransitionDtoSchema)),
      /**
       * The effect the cast leaves on its source: the timed grant a placed zone gives its placer
       * (D153) or the carrier effect that holds a summon. GM undo deletes it with the cast.
       */
      sourceGrantTransition: z.optional(encounterActorActiveEffectCreateReceiptDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        validateSourceSpendReceipts(value, context)
        if (
          value.sourceGrantTransition &&
          value.sourceGrantTransition.targetActorId !== value.sourceActorId
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceGrantTransition'],
            message: 'An area root grants only its source.'
          })
        if (new Set(value.targetOccurrenceIds).size !== value.targetOccurrenceIds.length)
          context.addIssue({
            code: 'custom',
            path: ['targetOccurrenceIds'],
            message: 'Area target occurrences must be unique.'
          })
        if (new Set(value.placedSpatialEffectIds).size !== value.placedSpatialEffectIds.length)
          context.addIssue({
            code: 'custom',
            path: ['placedSpatialEffectIds'],
            message: 'Placed spatial effects must be unique.'
          })
        if (
          value.maintenanceTransition &&
          value.placedSpatialEffectIds.length === 0 &&
          !value.sourceGrantTransition
        )
          context.addIssue({
            code: 'custom',
            path: ['maintenanceTransition'],
            message:
              'An area root carries a maintained effect only for the zone it placed or the carrier effect it left on its source.'
          })
      })
    )
)

export type EncounterAreaActionApplicationOutputDto = SourceSpendReceipts & {
  kind: 'ENCOUNTER_AREA_ACTION'
  schemaVersion: 1
  occurrenceId: string
  sourceActorId: string
  sourceCharacterId: string | null
  caughtChecksum: string
  removedActorIds: string[]
  targetOccurrenceIds: string[]
  damage: z.infer<typeof concentrationDamageApplicationDtoSchema>[]
  placedSpatialEffectIds: string[]
  maintenanceTransition?: z.infer<typeof maintainedEffectTransitionDtoSchema> | null
  sourceGrantTransition?: z.infer<typeof encounterActorActiveEffectCreateReceiptDtoSchema>
}

/**
 * Named so the application-output union prints this member by name: the union is embedded in several
 * pending contexts, whose inferred declarations are already near the compiler's serialization limit.
 */
export const encounterAreaActionApplicationOutputDtoSchema: z.ZodMiniType<
  EncounterAreaActionApplicationOutputDto,
  { kind: 'ENCOUNTER_AREA_ACTION' },
  z.core.$ZodTypeInternals<
    EncounterAreaActionApplicationOutputDto,
    { kind: 'ENCOUNTER_AREA_ACTION' }
  > & {
    propValues: z.core.util.PropValues
  }
> = encounterAreaActionApplicationOutputImplSchema

export const cleavingDamageApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('CLEAVING_DAMAGE'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      parentOccurrenceId: uuidSchema,
      sourceActorId: uuidSchema,
      targetActorId: z.nullable(uuidSchema),
      selectedOptionId: z.nullable(checksumSchema),
      sealedContextChecksum: checksumSchema,
      outcome: z.enum(['DECLINED', 'APPLIED']),
      damage: z.strictObject({
        sourceNodeId: localNodeIdSchema,
        sourceOperationKey: capabilityKeySchema,
        damageTypeId: uuidSchema,
        requestedAmount: positiveIntegerSchema,
        resolvedAmount: positiveIntegerSchema,
        appliedAmount: nonNegativeIntegerSchema
      }),
      targetTransition: z.nullable(characterMechanicsTargetTransitionDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        const applied = value.outcome === 'APPLIED'
        if (
          (applied &&
            (value.targetActorId === null ||
              value.selectedOptionId === null ||
              value.targetTransition === null)) ||
          (!applied &&
            (value.targetActorId !== null ||
              value.selectedOptionId !== null ||
              value.targetTransition !== null)) ||
          value.damage.requestedAmount !== value.damage.resolvedAmount
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Cleaving settlement evidence is inconsistent.'
          })
        }
      })
    )
)

/**
 * A settled concealment check (Hide, Search). The roll names no DC; what it decided is in
 * `resolution`. The observer ids are GM-only knowledge: only the stored receipt holds them, and no player read serves it.
 */
export const concealmentCheckApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('CONCEALMENT_CHECK'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      commandId: uuidSchema,
      definition: z.strictObject({
        id: uuidSchema,
        version: positiveIntegerSchema,
        checksum: checksumSchema
      }),
      actorId: uuidSchema,
      check: z.strictObject({ checkDefinitionId: uuidSchema }),
      d20: ruleCheckRollEvidenceDtoSchema,
      resolution: z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('CONCEAL'),
          /** The observers the Stealth total beat, sorted; the effect lists exactly these. */
          hiddenFromActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
          /** The concealment effect made; null when no observer was beaten. Undo deletes it. */
          createdEffect: z.nullable(encounterActorActiveEffectCreateReceiptDtoSchema)
        }),
        z.strictObject({
          kind: z.literal('DETECT'),
          /** Each concealment the search total reached; undo restores `beforeObserverActorIds`. */
          found: z
            .array(
              z.strictObject({
                activeEffectId: uuidSchema,
                holderActorId: uuidSchema,
                beforeObserverActorIds: z
                  .array(uuidSchema)
                  .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
                afterObserverActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
                afterVersion: aggregateVersionSchema
              })
            )
            .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
        })
      ])
    })
    .check(
      z.superRefine((value, context) => {
        const { resolution } = value
        if (
          resolution.kind === 'CONCEAL' &&
          (resolution.hiddenFromActorIds.length === 0) !== (resolution.createdEffect === null)
        )
          context.addIssue({
            code: 'custom',
            path: ['resolution', 'createdEffect'],
            message: 'A concealment effect exists exactly when it hides its holder from someone.'
          })
      })
    )
)

/**
 * A held creature's settled Escape check (D105). `ESCAPED` ended the relationship effect and
 * removed `removedConditionIds`; `ALREADY_ENDED` means the effect was gone when a prompted roll
 * settled, so nothing changed.
 */
export const escapeCheckApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ESCAPE_CHECK'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      commandId: uuidSchema,
      actorId: uuidSchema,
      /** The held creature a rescuer freed or tried to free; absent when `actorId` escaped for itself. */
      heldActorId: z.optional(uuidSchema),
      activeEffectId: uuidSchema,
      check: z.strictObject({ checkDefinitionId: uuidSchema, dc: positiveIntegerSchema }),
      d20: ruleCheckD20EvidenceDtoSchema,
      outcome: z.enum(['ESCAPED', 'FAILED', 'ALREADY_ENDED']),
      removedConditionIds: z.array(uuidSchema).check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
    })
    .check(
      z.superRefine((value, context) => {
        if (value.d20.dc !== value.check.dc)
          context.addIssue({
            code: 'custom',
            path: ['d20', 'dc'],
            message: 'The check evidence must be rolled against the check DC.'
          })
        if (value.outcome === 'ESCAPED' && value.d20.total < value.check.dc)
          context.addIssue({
            code: 'custom',
            path: ['outcome'],
            message: 'An escape needs a total that reaches the DC.'
          })
        if (value.outcome === 'FAILED' && value.d20.total >= value.check.dc)
          context.addIssue({
            code: 'custom',
            path: ['outcome'],
            message: 'A check that reaches its DC does not fail.'
          })
        if (value.outcome !== 'ESCAPED' && value.removedConditionIds.length > 0)
          context.addIssue({
            code: 'custom',
            path: ['removedConditionIds'],
            message: 'Only an escape removes conditions.'
          })
      })
    )
)
