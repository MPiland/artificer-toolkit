import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { z, lazySchema } from '../zod.js'
import { MAX_ENCOUNTER_ACTORS, MAX_ENCOUNTER_REACTION_OPTIONS } from './authoredLimits.js'
import {
  spellSlotConsumptionReceiptDtoSchema,
  spellSlotOwnedBySource,
  encounterActionEconomyTransitionDtoSchema,
  ruleCheckD20EvidenceDtoSchema,
  sourceSpendReceiptShape,
  validateSourceSpendReceipts,
  type SpellSlotConsumptionReceiptDto,
  type SourceSpendReceipts
} from './ruleExecutionEncounterApplications.js'
import {
  frozenCheckD20DtoSchema,
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto
} from './ruleExecutionEvidence.js'
import {
  characterActiveEffectCreateReceiptDtoSchema,
  encounterActorActiveEffectCreateReceiptDtoSchema,
  sourceApplicationsChangeState,
  sourceApplicationsDtoSchema
} from './ruleExecutionMechanics.js'
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
  /** The reacting Character; null for a creature, whose reaction is its own authored action. */
  characterId: z.nullable(uuidSchema),
  characterStreamVersion: z.nullable(aggregateVersionSchema),
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

/**
 * The exact reaction a cast offers a creature, sealed like an attack reaction: a counter to the cast
 * (`SPELL_CAST`), or a reaction of a creature the cast names as a target (`TARGETED_SELF`).
 */
export const encounterCastReactionPinDtoSchema = lazySchema(() =>
  z.strictObject({
    trigger: z.enum(['SPELL_CAST', 'TARGETED_SELF']),
    ...reactionPinShape()
  })
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

/**
 * The pin's selection checksum and use option identity are derived, never free-standing, and it names
 * a Character's version exactly when it names a Character.
 */
export function validateEncounterReactionPin(
  pin: EncounterReactionPinDto | EncounterCastReactionPinDto,
  context: z.core.$RefinementCtx,
  path: readonly (string | number)[]
) {
  if ((pin.characterId === null) !== (pin.characterStreamVersion === null))
    context.addIssue({
      code: 'custom',
      path: [...path, 'characterStreamVersion'],
      message: 'Reaction Character version must match its Character.'
    })
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
      reactions: z
        .array(encounterReactionPinDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ENCOUNTER_REACTION_OPTIONS))
    })
)
/**
 * The check a reactor owes to counter a cast above the level it counters at: its ability check against
 * a DC set by the cast's level, frozen before it is rolled. The pending waits on that one d20.
 */
export type EncounterCastReactionCheckDto = {
  choiceExecution: ServerCompletedRuleExecutionDto
  triggerLevel: number
  checkDefinitionId: string
  dc: number
  d20: z.infer<typeof frozenCheckD20DtoSchema>
}

export const encounterCastReactionCheckDtoSchema: z.ZodMiniType<EncounterCastReactionCheckDto> =
  lazySchema(() =>
    z.strictObject({
      choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      triggerLevel: nonNegativeIntegerSchema,
      checkDefinitionId: uuidSchema,
      dc: positiveIntegerSchema,
      d20: frozenCheckD20DtoSchema
    })
  )

/**
 * A cast held before it executes for one creature's chance to counter it. The reactions are that
 * reactor's menu (one reaction a round); the reactors that already declined or failed their check are
 * recorded so that a replay of the cast offers the next reactor rather than the same one. Once the
 * reactor has chosen a counter that owes a check, `reactions` holds that one counter and `check` the
 * roll the pause now waits on.
 *
 * A counter is itself a cast another creature may counter. While counters stand, `chain` holds them in
 * the order they were chosen: `reactions` then offers a counter to the last one, `declinedReactorActorIds`
 * lists who declined at that level, and `castDeclinedReactorActorIds` and `castLevel` keep what the
 * outer level needs when the chain resolves (the declines to the cast itself, and the level of the last
 * counter, which is the cast the reactions now answer).
 *
 * `kind` names what is offered: `COUNTER` offers counters to the cast; `TARGETED_SELF` offers a creature
 * the cast names as a target the reactions it holds for being chosen (Shield against Magic Missile),
 * which lets the cast resolve against the reactor as the reaction leaves it.
 */
export type EncounterCastReactionOfferDto = {
  kind: 'COUNTER' | 'TARGETED_SELF'
  reactions: EncounterCastReactionPinDto[]
  declinedReactorActorIds: string[]
  check?: EncounterCastReactionCheckDto
  chain?: {
    counters: EncounterFailedCounterDto[]
    castDeclinedReactorActorIds: string[]
    castLevel: number
  }
}

export const encounterCastReactionOfferDtoSchema: z.ZodMiniType<EncounterCastReactionOfferDto> =
  lazySchema(() =>
    z
      .strictObject({
        kind: z.enum(['COUNTER', 'TARGETED_SELF']),
        reactions: z
          .array(encounterCastReactionPinDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(MAX_ENCOUNTER_REACTION_OPTIONS)),
        declinedReactorActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        check: z.optional(encounterCastReactionCheckDtoSchema),
        chain: z.optional(
          z.strictObject({
            counters: z
              .array(encounterFailedCounterDtoSchema)
              .check(z.minLength(1))
              .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
            castDeclinedReactorActorIds: z
              .array(uuidSchema)
              .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
            castLevel: nonNegativeIntegerSchema
          })
        )
      })
      .check(
        z.superRefine((value, context) => {
          const trigger = value.kind === 'COUNTER' ? 'SPELL_CAST' : 'TARGETED_SELF'
          if (value.reactions.some((reaction) => reaction.trigger !== trigger))
            context.addIssue({
              code: 'custom',
              path: ['reactions'],
              message: `A ${value.kind} offer holds only ${trigger} reactions.`
            })
        })
      )
  )

/** What a failed counter checked: the reactor's settled d20 against the cast level's DC. */
export type EncounterCounterCheckEvidenceDto = {
  checkDefinitionId: string
  d20: z.infer<typeof ruleCheckD20EvidenceDtoSchema>
}

const encounterCounterCheckEvidenceDtoSchema: z.ZodMiniType<EncounterCounterCheckEvidenceDto> =
  lazySchema(() =>
    z.strictObject({ checkDefinitionId: uuidSchema, d20: ruleCheckD20EvidenceDtoSchema })
  )

/**
 * A counter the reactor used that did not counter the cast: its check failed, or it was itself
 * countered. It is part of the cast's own occurrence: carried by every pending of the cast, it is spent
 * with whatever terminal commit the cast reaches. `againstActorId` is the creature whose cast it was
 * offered against (the caster, or the creature that cast the counter it answers), which is where its
 * range and target are measured from; `check` is null when the counter was not above its level.
 */
export type EncounterFailedCounterDto = {
  reaction: EncounterCastReactionPinDto
  choiceExecution: ServerCompletedRuleExecutionDto
  triggerLevel: number
  againstActorId: string
  check: EncounterCounterCheckEvidenceDto | null
}

const failedCounterShape = () => ({
  reaction: encounterCastReactionPinDtoSchema,
  choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
  triggerLevel: nonNegativeIntegerSchema,
  againstActorId: uuidSchema,
  check: z.nullable(encounterCounterCheckEvidenceDtoSchema)
})

export const encounterFailedCounterDtoSchema: z.ZodMiniType<EncounterFailedCounterDto> = lazySchema(
  () =>
    z.strictObject(failedCounterShape()).check(
      z.superRefine((value, context) => {
        validateEncounterReactionPin(value.reaction, context, ['reaction'])
      })
    )
)

/** What a reactor spent for a counter, countered or failed: its slot and its reaction allowance. */
type CounterSpendDto = {
  reaction: EncounterCastReactionPinDto
  spellCastConsumption: SpellSlotConsumptionReceiptDto | null
  /** The reactor's own conditions released by effects its cast ended; empty when none. */
  applications: z.infer<typeof sourceApplicationsDtoSchema>
  /** The reactor's Character version once its slot was spent or a condition released; null when neither. */
  characterStreamVersion: number | null
  actionEconomyTransition: z.infer<typeof encounterActionEconomyTransitionDtoSchema>
}

const counterSpendShape = () => ({
  spellCastConsumption: z.nullable(spellSlotConsumptionReceiptDtoSchema),
  applications: sourceApplicationsDtoSchema,
  characterStreamVersion: z.nullable(aggregateVersionSchema),
  actionEconomyTransition: encounterActionEconomyTransitionDtoSchema
})

function validateCounterSpend(value: CounterSpendDto, context: z.core.$RefinementCtx) {
  validateEncounterReactionPin(value.reaction, context, ['reaction'])
  if (
    (value.characterStreamVersion === null) !==
      !(
        value.spellCastConsumption?.owner.kind === 'CHARACTER' ||
        sourceApplicationsChangeState(value.applications, value.reaction.characterId)
      ) ||
    (value.spellCastConsumption &&
      !spellSlotOwnedBySource(value.spellCastConsumption, {
        sourceActorId: value.reaction.reactorActorId,
        sourceCharacterId: value.reaction.characterId
      }))
  )
    context.addIssue({
      code: 'custom',
      path: ['spellCastConsumption'],
      message: 'The reactor slot receipt must match its Character and stream version.'
    })
  const economy = value.actionEconomyTransition
  if (
    economy.definitionId !== value.reaction.allowanceDefinitionId ||
    economy.beforeUsed !== value.reaction.allowanceBeforeUsed ||
    economy.maximum !== value.reaction.allowanceMaximum
  )
    context.addIssue({
      code: 'custom',
      path: ['actionEconomyTransition'],
      message: 'The reactor allowance spend must be the one the reaction pinned.'
    })
}

/**
 * What a countered cast sealed: the reactor's settled choice, the reaction's own execution (whose trace
 * cancels the triggering event), the level of the cast it countered, the check that earned the counter
 * when the cast was above the counter's level, and what the reactor spent.
 */
export type EncounterCounteredCastReceiptDto = CounterSpendDto & {
  choiceExecution: ServerCompletedRuleExecutionDto
  counterExecution: ServerCompletedRuleExecutionDto
  triggerLevel: number
  check: EncounterCounterCheckEvidenceDto | null
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
        check: z.nullable(encounterCounterCheckEvidenceDtoSchema),
        ...counterSpendShape()
      })
      .check(z.superRefine(validateCounterSpend))
  )

/** A failed counter once its spend is settled with the cast's terminal commit. */
export type EncounterFailedCounterReceiptDto = EncounterFailedCounterDto & CounterSpendDto

export const encounterFailedCounterReceiptDtoSchema: z.ZodMiniType<EncounterFailedCounterReceiptDto> =
  lazySchema(() =>
    z
      .strictObject({ ...failedCounterShape(), ...counterSpendShape() })
      .check(z.superRefine(validateCounterSpend))
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
 * The save an attacker owes before an attack or harmful spell it aims at a warded creature lands
 * (`INCOMING_ATTACK_GATE`): the holder's gate effect, the ability and DC of the save, and the attacker's
 * frozen d20. The pause waits on that one roll.
 */
export type EncounterIncomingGateOfferDto = {
  effectId: string
  holderActorId: string
  checkDefinitionId: string
  dc: number
  d20: z.infer<typeof frozenCheckD20DtoSchema>
}

export const encounterIncomingGateOfferDtoSchema: z.ZodMiniType<EncounterIncomingGateOfferDto> =
  lazySchema(() =>
    z.strictObject({
      effectId: uuidSchema,
      holderActorId: uuidSchema,
      checkDefinitionId: uuidSchema,
      dc: positiveIntegerSchema,
      d20: frozenCheckD20DtoSchema
    })
  )

/** The save a ward's attacker failed: the ward, the ability and DC of the save, and the d20 it rolled. */
export type EncounterFailedIncomingGateDto = {
  effectId: string
  holderActorId: string
  checkDefinitionId: string
  dc: number
  d20: z.infer<typeof ruleCheckD20EvidenceDtoSchema>
}

export const encounterFailedIncomingGateDtoSchema: z.ZodMiniType<EncounterFailedIncomingGateDto> =
  lazySchema(() =>
    z.strictObject({
      effectId: uuidSchema,
      holderActorId: uuidSchema,
      checkDefinitionId: uuidSchema,
      dc: positiveIntegerSchema,
      d20: ruleCheckD20EvidenceDtoSchema
    })
  )

/**
 * One creature the attacker could turn a lost attack or spell on instead (`ATTACK_RETARGET`). The use
 * option identity is derived from the ward that stopped the action and the creature, never free-standing.
 */
export type EncounterAttackRetargetOptionDto = {
  targetActorId: string
  /** The creature's token on the action's Scene, when the action named one. */
  targetTokenId: string | null
  useOptionId: string
}

export const encounterAttackRetargetOptionDtoSchema: z.ZodMiniType<EncounterAttackRetargetOptionDto> =
  lazySchema(() =>
    z.strictObject({
      targetActorId: uuidSchema,
      targetTokenId: z.nullable(uuidSchema),
      useOptionId: checksumSchema
    })
  )

export function encounterAttackRetargetUseOptionId(input: {
  gateEffectId: string
  targetActorId: string
}): string {
  return checksumRuleDocument({ kind: 'ATTACK_RETARGET_USE', ...input })
}

/**
 * The choice an attacker whose save against a ward failed is offered before the attack or spell is lost:
 * to turn it on another creature, or to let it be lost. Nothing is held but the failed save and the
 * creatures on offer; answering with a creature replays the action against it.
 */
export type EncounterAttackRetargetOfferDto = {
  gate: EncounterFailedIncomingGateDto
  options: EncounterAttackRetargetOptionDto[]
}

export const encounterAttackRetargetOfferDtoSchema: z.ZodMiniType<EncounterAttackRetargetOfferDto> =
  lazySchema(() =>
    z
      .strictObject({
        gate: encounterFailedIncomingGateDtoSchema,
        options: z
          .array(encounterAttackRetargetOptionDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      })
      .check(
        z.superRefine((value, context) => {
          const targets = value.options.map(({ targetActorId }) => targetActorId)
          if (
            new Set(targets).size !== targets.length ||
            targets.includes(value.gate.holderActorId)
          )
            context.addIssue({
              code: 'custom',
              path: ['options'],
              message:
                'A retarget offers each creature once, never the creature that warded it off.'
            })
          for (const [index, option] of value.options.entries())
            if (
              encounterAttackRetargetUseOptionId({
                gateEffectId: value.gate.effectId,
                targetActorId: option.targetActorId
              }) !== option.useOptionId
            )
              context.addIssue({
                code: 'custom',
                path: ['options', index, 'useOptionId'],
                message: 'Retarget use option identity is invalid.'
              })
        })
      )
  )

/**
 * The root of an action a warded creature's gate stopped: its attacker failed the save, so the attack or
 * spell is lost. The action is still spent: the receipts name the slot, resource, item and action economy
 * the source paid, and nothing the action would have done is applied.
 */
const encounterGatedActionApplicationOutputImplSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_GATED_ACTION'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      sourceActorId: uuidSchema,
      sourceCharacterId: z.nullable(uuidSchema),
      ...sourceSpendReceiptShape(),
      /** What the failed save cost the source. */
      lost: z.enum(['ATTACK', 'SPELL']),
      gate: encounterFailedIncomingGateDtoSchema
    })
    .check(z.superRefine(validateSourceSpendReceipts))
)

export type EncounterGatedActionApplicationOutputDto = SourceSpendReceipts & {
  kind: 'ENCOUNTER_GATED_ACTION'
  schemaVersion: 1
  occurrenceId: string
  sourceActorId: string
  sourceCharacterId: string | null
  lost: 'ATTACK' | 'SPELL'
  gate: EncounterFailedIncomingGateDto
}

/** Named so the application-output union prints this member by name (TS7056). */
export const encounterGatedActionApplicationOutputDtoSchema: z.ZodMiniType<
  EncounterGatedActionApplicationOutputDto,
  { kind: 'ENCOUNTER_GATED_ACTION' },
  z.core.$ZodTypeInternals<
    EncounterGatedActionApplicationOutputDto,
    { kind: 'ENCOUNTER_GATED_ACTION' }
  > & {
    propValues: z.core.util.PropValues
  }
> = encounterGatedActionApplicationOutputImplSchema

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
  spellCastConsumption: SpellSlotConsumptionReceiptDto | null
  actionEconomyTransition: z.infer<typeof encounterActionEconomyTransitionDtoSchema> | null
  /** The reactor's own effect the reaction created; it is what changed the defense. */
  activeEffectTransitions: z.infer<typeof characterActiveEffectCreateReceiptDtoSchema>[]
}

/** A creature's reaction receipt: the same, with the effect it created on the creature itself. */
export type EncounterActorReactionReceiptDto = Omit<
  EncounterActionReactionReceiptDto,
  'activeEffectTransitions'
> & {
  activeEffectTransitions: z.infer<typeof encounterActorActiveEffectCreateReceiptDtoSchema>[]
}

function reactionReceiptSchema<EffectReceipt extends z.ZodMiniType>(effectReceipt: EffectReceipt) {
  return z
    .strictObject({
      selection: z.enum(['DECLINE', 'USE']),
      reaction: encounterReactionPinDtoSchema,
      choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      originalExecutionChecksum: checksumSchema,
      adjustment: z.nullable(encounterReactionAdjustmentDtoSchema),
      spellCastConsumption: z.nullable(spellSlotConsumptionReceiptDtoSchema),
      actionEconomyTransition: z.nullable(encounterActionEconomyTransitionDtoSchema),
      /** The reactor's own effect the reaction created; it is what changed the defense. */
      activeEffectTransitions: z.array(effectReceipt).check(z.maxLength(1))
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
}

// Named so the receipt unions that embed it stay under the compiler's declaration size limit (TS7056).
export const encounterActionReactionReceiptDtoSchema: z.ZodMiniType<EncounterActionReactionReceiptDto> =
  lazySchema(() =>
    reactionReceiptSchema(characterActiveEffectCreateReceiptDtoSchema).check(
      z.superRefine((value, context) => {
        if (value.reaction.characterId === null)
          context.addIssue({
            code: 'custom',
            message: 'A Character reaction receipt names its Character.'
          })
      })
    )
  )

/** A creature's reaction carries no Character identity and spends no spell slot. */
export const encounterActorReactionReceiptDtoSchema: z.ZodMiniType<EncounterActorReactionReceiptDto> =
  lazySchema(() =>
    reactionReceiptSchema(encounterActorActiveEffectCreateReceiptDtoSchema).check(
      z.superRefine((value, context) => {
        if (value.reaction.characterId !== null || value.spellCastConsumption !== null)
          context.addIssue({
            code: 'custom',
            message: 'A creature reaction receipt names no Character spend.'
          })
      })
    )
  )
