import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { z, lazySchema } from '../zod.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import {
  characterSpellSlotConsumptionReceiptDtoSchema,
  encounterActionEconomyTransitionDtoSchema,
  sourceSpendReceiptShape,
  validateSourceSpendReceipts,
  type CharacterSpellSlotConsumptionReceiptDto,
  type SourceSpendReceipts
} from './ruleExecutionEncounterApplications.js'
import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto
} from './ruleExecutionEvidence.js'
import { characterActiveEffectCreateReceiptDtoSchema } from './ruleExecutionMechanics.js'
import {
  serverCompletedRuleExecutionDtoSchema,
  type ServerCompletedRuleExecutionDto
} from './ruleExecutionProtocol.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

const actionIdentitySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

const reactionPinShape = () => ({
  reactorActorId: uuidSchema,
  characterId: uuidSchema,
  characterStreamVersion: aggregateVersionSchema,
  actionId: actionIdentitySchema,
  effectId: uuidSchema,
  allowanceDefinitionId: uuidSchema,
  allowanceBeforeUsed: nonNegativeIntegerSchema,
  allowanceMaximum: positiveIntegerSchema,
  choiceDefinitionId: uuidSchema,
  choiceDefinitionChecksum: checksumSchema,
  useOptionId: checksumSchema,
  selectionChecksum: checksumSchema
})

/**
 * The exact reaction a hit attack offers its target, pinned when it is offered. The selection checksum
 * covers the identity of what would be used; the Character version and allowance counts are volatile and
 * are re-read when the offer is answered.
 */
export const encounterReactionPinDtoSchema = lazySchema(() =>
  z.strictObject({
    trigger: z.enum(['ATTACKED_SELF', 'DAMAGE_TAKEN']),
    ...reactionPinShape()
  })
)
export type EncounterReactionPinDto = z.infer<typeof encounterReactionPinDtoSchema>

/** The exact reaction a cast offers a creature that could counter it; sealed like an attack reaction. */
export const encounterCastReactionPinDtoSchema = lazySchema(() =>
  z.strictObject({ trigger: z.literal('SPELL_CAST'), ...reactionPinShape() })
)
export type EncounterCastReactionPinDto = z.infer<typeof encounterCastReactionPinDtoSchema>

/** What identifies the reaction offered, independent of the volatile Character version and allowance. */
export function encounterReactionSelectionIdentity(
  pin: Pick<
    EncounterReactionPinDto,
    | 'reactorActorId'
    | 'characterId'
    | 'actionId'
    | 'effectId'
    | 'allowanceDefinitionId'
    | 'choiceDefinitionId'
    | 'choiceDefinitionChecksum'
  > & { trigger: string }
) {
  return {
    trigger: pin.trigger,
    reactorActorId: pin.reactorActorId,
    characterId: pin.characterId,
    actionId: pin.actionId,
    effectId: pin.effectId,
    allowanceDefinitionId: pin.allowanceDefinitionId,
    choiceDefinitionId: pin.choiceDefinitionId,
    choiceDefinitionChecksum: pin.choiceDefinitionChecksum
  }
}

export function encounterReactionUseOptionId(selectionChecksum: string): string {
  return checksumRuleDocument({ kind: 'USE', selectionChecksum })
}

/** The pin's selection checksum and use option identity are derived, never free-standing. */
export function validateEncounterReactionPin(
  pin: EncounterReactionPinDto | EncounterCastReactionPinDto,
  context: z.core.$RefinementCtx,
  path: readonly (string | number)[]
) {
  if (checksumRuleDocument(encounterReactionSelectionIdentity(pin)) !== pin.selectionChecksum)
    context.addIssue({
      code: 'custom',
      path: [...path, 'selectionChecksum'],
      message: 'Reaction selection checksum is invalid.'
    })
  if (encounterReactionUseOptionId(pin.selectionChecksum) !== pin.useOptionId)
    context.addIssue({
      code: 'custom',
      path: [...path, 'useOptionId'],
      message: 'Reaction use option identity is invalid.'
    })
}

/**
 * A hit attack held for the target's reaction decision: the TEST execution and its d20, the exact TEST
 * policy a later sealed OUTCOME continues from, and the reactions offered. The reactions are a menu for
 * one reactor, who has one reaction a round: choosing an option uses that reaction, and declining
 * declines them all.
 */
export type EncounterReactionOfferDto = {
  originalExecution: ServerCompletedRuleExecutionDto
  originalD20: ServerRuleExecutionD20EvidenceDto
  d20: ServerRuleExecutionD20PolicyDto
  originalExecutionChecksum: string
  targetStateChecksum: string
  reactions: EncounterReactionPinDto[]
}

// Explicitly typed so the pending-context declarations stay within the compiler's size limit (TS7056).
export const encounterReactionOfferDtoSchema: z.ZodMiniType<EncounterReactionOfferDto> = lazySchema(
  () =>
    z.strictObject({
      originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema),
      d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema),
      originalExecutionChecksum: checksumSchema,
      targetStateChecksum: checksumSchema,
      reactions: z.array(encounterReactionPinDtoSchema).check(z.minLength(1)).check(z.maxLength(8))
    })
)
/**
 * A cast held before it executes for one creature's chance to counter it. The reactions are that
 * reactor's menu (one reaction a round); the reactors that already declined are recorded so that a
 * replay of the cast offers the next reactor rather than the same one.
 */
export type EncounterCastReactionOfferDto = {
  reactions: EncounterCastReactionPinDto[]
  declinedReactorActorIds: string[]
}

export const encounterCastReactionOfferDtoSchema: z.ZodMiniType<EncounterCastReactionOfferDto> =
  lazySchema(() =>
    z.strictObject({
      reactions: z
        .array(encounterCastReactionPinDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(8)),
      declinedReactorActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    })
  )

/**
 * What a countered cast sealed: the reactor's settled choice, the reaction's own execution (whose trace
 * cancels the triggering event), the level of the cast it countered, and what the reactor spent.
 */
export type EncounterCounteredCastReceiptDto = {
  reaction: EncounterCastReactionPinDto
  choiceExecution: ServerCompletedRuleExecutionDto
  counterExecution: ServerCompletedRuleExecutionDto
  triggerLevel: number
  spellCastConsumption: CharacterSpellSlotConsumptionReceiptDto | null
  /** The reactor's Character version once its slot was spent; null exactly when none was. */
  characterStreamVersion: number | null
  actionEconomyTransition: z.infer<typeof encounterActionEconomyTransitionDtoSchema>
}

// Named so the output union that embeds it stays under the compiler's declaration size limit (TS7056).
export const encounterCounteredCastReceiptDtoSchema: z.ZodMiniType<EncounterCounteredCastReceiptDto> =
  lazySchema(() =>
    z
      .strictObject({
        reaction: encounterCastReactionPinDtoSchema,
        choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        counterExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        triggerLevel: nonNegativeIntegerSchema,
        spellCastConsumption: z.nullable(characterSpellSlotConsumptionReceiptDtoSchema),
        characterStreamVersion: z.nullable(aggregateVersionSchema),
        actionEconomyTransition: encounterActionEconomyTransitionDtoSchema
      })
      .check(
        z.superRefine((value, context) => {
          validateEncounterReactionPin(value.reaction, context, ['reaction'])
          if (
            (value.spellCastConsumption === null) !== (value.characterStreamVersion === null) ||
            (value.spellCastConsumption &&
              value.spellCastConsumption.characterId !== value.reaction.characterId)
          )
            context.addIssue({
              code: 'custom',
              path: ['spellCastConsumption'],
              message: 'The reactor slot receipt must match its Character and stream version.'
            })
        })
      )
  )

/**
 * The root of a cast a reaction countered: the caster still spends its slot and action, nothing the
 * spell would have done is applied, and the counter's receipt records the reactor's own spend.
 */
const encounterCounteredCastApplicationOutputImplSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_COUNTERED_CAST'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      sourceActorId: uuidSchema,
      sourceCharacterId: z.nullable(uuidSchema),
      ...sourceSpendReceiptShape(),
      counter: encounterCounteredCastReceiptDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        validateSourceSpendReceipts(value, context)
        if (value.counter.reaction.reactorActorId === value.sourceActorId)
          context.addIssue({
            code: 'custom',
            path: ['counter', 'reaction', 'reactorActorId'],
            message: 'A cast is countered by another creature.'
          })
      })
    )
)

export type EncounterCounteredCastApplicationOutputDto = SourceSpendReceipts & {
  kind: 'ENCOUNTER_COUNTERED_CAST'
  schemaVersion: 1
  occurrenceId: string
  sourceActorId: string
  sourceCharacterId: string | null
  counter: EncounterCounteredCastReceiptDto
}

/** Named so the application-output union prints this member by name (TS7056). */
export const encounterCounteredCastApplicationOutputDtoSchema: z.ZodMiniType<
  EncounterCounteredCastApplicationOutputDto,
  { kind: 'ENCOUNTER_COUNTERED_CAST' },
  z.core.$ZodTypeInternals<
    EncounterCounteredCastApplicationOutputDto,
    { kind: 'ENCOUNTER_COUNTERED_CAST' }
  > & {
    propValues: z.core.util.PropValues
  }
> = encounterCounteredCastApplicationOutputImplSchema

/**
 * The defense the reaction changed for the triggering attack, sealed in the evidence: the re-evaluated
 * TEST is bound to the defense after the reaction, never silently rebound.
 */
export const encounterReactionAdjustmentDtoSchema = lazySchema(() =>
  z.strictObject({
    defenseBefore: integerSchema,
    defenseAfter: integerSchema,
    adjustedBoundFactsChecksum: checksumSchema
  })
)

export type EncounterReactionAdjustmentDto = {
  defenseBefore: number
  defenseAfter: number
  adjustedBoundFactsChecksum: string
}

export type EncounterReactionOutcomeAuditDto = {
  choiceExecution: ServerCompletedRuleExecutionDto
  selection: 'DECLINE' | 'USE'
  originalExecutionChecksum: string
  targetStateChecksum: string
  reaction: EncounterReactionPinDto
  d20: ServerRuleExecutionD20PolicyDto
  adjustment: EncounterReactionAdjustmentDto | null
}

/** Server-only interstitial control evidence retained when a hit attack offered a reaction. */
export const encounterReactionOutcomeAuditDtoSchema: z.ZodMiniType<EncounterReactionOutcomeAuditDto> =
  lazySchema(() =>
    z.strictObject({
      choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      selection: z.enum(['DECLINE', 'USE']),
      originalExecutionChecksum: checksumSchema,
      targetStateChecksum: checksumSchema,
      reaction: encounterReactionPinDtoSchema,
      d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema),
      /** Present exactly when the reaction was used. */
      adjustment: z.nullable(encounterReactionAdjustmentDtoSchema)
    })
  )

/** What a settled reaction spent and sealed, recorded with the outcome of the attack it answered. */
export type EncounterActionReactionReceiptDto = {
  selection: 'DECLINE' | 'USE'
  reaction: EncounterReactionPinDto
  choiceExecution: ServerCompletedRuleExecutionDto
  originalExecutionChecksum: string
  adjustment: EncounterReactionAdjustmentDto | null
  spellCastConsumption: CharacterSpellSlotConsumptionReceiptDto | null
  actionEconomyTransition: z.infer<typeof encounterActionEconomyTransitionDtoSchema> | null
  /** The reactor's own effect the reaction created; it is what changed the defense. */
  activeEffectTransitions: z.infer<typeof characterActiveEffectCreateReceiptDtoSchema>[]
}

// Named so the receipt unions that embed it stay under the compiler's declaration size limit (TS7056).
export const encounterActionReactionReceiptDtoSchema: z.ZodMiniType<EncounterActionReactionReceiptDto> =
  lazySchema(() =>
    z
      .strictObject({
        selection: z.enum(['DECLINE', 'USE']),
        reaction: encounterReactionPinDtoSchema,
        choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        originalExecutionChecksum: checksumSchema,
        adjustment: z.nullable(encounterReactionAdjustmentDtoSchema),
        spellCastConsumption: z.nullable(characterSpellSlotConsumptionReceiptDtoSchema),
        actionEconomyTransition: z.nullable(encounterActionEconomyTransitionDtoSchema),
        /** The reactor's own effect the reaction created; it is what changed the defense. */
        activeEffectTransitions: z
          .array(characterActiveEffectCreateReceiptDtoSchema)
          .check(z.maxLength(1))
      })
      .check(
        z.superRefine((value, context) => {
          validateEncounterReactionPin(value.reaction, context, ['reaction'])
          const used = value.selection === 'USE'
          if (
            used !== (value.adjustment !== null) ||
            used !== (value.actionEconomyTransition !== null) ||
            (!used &&
              (value.spellCastConsumption !== null || value.activeEffectTransitions.length > 0))
          )
            context.addIssue({
              code: 'custom',
              message: 'Reaction receipt does not match its selection.'
            })
        })
      )
  )
