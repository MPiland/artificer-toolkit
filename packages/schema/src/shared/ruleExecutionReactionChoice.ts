import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { z, lazySchema } from '../zod.js'
import {
  AUTHORED_LIMITS,
  MAX_ENCOUNTER_ACTORS,
  MAX_ENCOUNTER_REACTION_OPTIONS
} from './authoredLimits.js'
import {
  ruleCheckD20EvidenceDtoSchema,
  sourceSpendReceiptShape,
  validateSourceSpendReceipts,
  type SourceSpendReceipts
} from './ruleExecutionEncounterApplications.js'
import {
  frozenCheckD20DtoSchema,
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto
} from './ruleExecutionEvidence.js'
import { d20RolledSaveDtoSchema, type D20RolledSaveDto } from './ruleExecutionD20WindowOffer.js'
import {
  serverCompletedRuleExecutionDtoSchema,
  type ServerCompletedRuleExecutionDto
} from './ruleExecutionProtocol.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
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
 * The exact reaction an action offers a creature, pinned when it is offered: the one pin of every
 * reaction the action pipeline offers, whatever authored trigger it answers (a movement's reactions are
 * the movement host's own). The selection checksum covers the identity of what would be used; the
 * Character version and allowance counts are volatile and are re-read when the offer is answered.
 */
export const encounterReactionPinDtoSchema = lazySchema(() =>
  z.strictObject({
    trigger: z.enum([
      'ATTACKED_SELF',
      'DAMAGE_TAKEN',
      'SPELL_CAST',
      'TARGETED_SELF',
      'ATTACK_ROLL_BY_OTHER',
      'ATTACK_ON_OTHER',
      'ATTACK_RESOLVED_ON_SELF'
    ]),
    ...reactionPinShape()
  })
)
export type EncounterReactionPinDto = z.infer<typeof encounterReactionPinDtoSchema>

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
  pin: EncounterReactionPinDto,
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
 * An attack's hit as its offer to the creature it hit keeps it: the TEST execution and its d20, the
 * exact TEST policy a later sealed OUTCOME continues from, and the target as it stood when it was hit.
 */
export type EncounterSettledHitDto = {
  originalExecution: ServerCompletedRuleExecutionDto
  originalD20: ServerRuleExecutionD20EvidenceDto
  d20: ServerRuleExecutionD20PolicyDto
  originalExecutionChecksum: string
  targetStateChecksum: string
}

const settledHitShape = () => ({
  originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
  originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema),
  d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema),
  originalExecutionChecksum: checksumSchema,
  targetStateChecksum: checksumSchema
})

/**
 * A cast held before it executes for one creature's chance to counter it. The reactions are that
 * reactor's menu (one reaction a round); the reactors already heard from are recorded so that a replay
 * of the cast offers the next reactor rather than the same one. A counter that owes a check rolls it
 * in its holder's own action (D219), never at this pause. That action is itself a cast, which holds its
 * own offers to counter it, so an offer never nests another.
 *
 * `kind` names what is offered: `COUNTER` offers counters to the cast (`SPELL_CAST` reactions). The
 * other kinds carry the trigger of the reactions they offer, which the action resumes from once one is
 * used: `TARGETED_SELF` offers a creature the cast names as a target its reactions (Shield against Magic
 * Missile), and the cast then resolves against the reactor as the reaction leaves it; `ATTACK_ON_OTHER`
 * offers a creature beside an attack aimed at another its reactions, which adjust the roll the attack
 * then makes; `ATTACK_ROLL_BY_OTHER` offers a creature that sees an attack roll its reactions after the
 * d20 is rolled (D219, "Roll-window reaction die"). That offer is made after the action's roll: it
 * keeps the rolled d20 as `rolled`, every offer of the same roll carries the same one.
 * `HIT_BY_ATTACK` offers the creature an attack hit its reactions to the hit and to the damage it
 * deals (`ATTACKED_SELF` and `DAMAGE_TAKEN` reactions, one menu), after the attack's TEST settled: it
 * keeps that hit as `hit`, which the action tests again against the reactor as a used reaction leaves it.
 */
export type EncounterCastReactionOfferDto = {
  kind: 'COUNTER' | 'TARGETED_SELF' | 'ATTACK_ON_OTHER' | 'ATTACK_ROLL_BY_OTHER' | 'HIT_BY_ATTACK'
  reactions: EncounterReactionPinDto[]
  declinedReactorActorIds: string[]
  /**
   * The attack d20 a post-roll offer follows: the action's TEST as it froze with the roll, which the
   * settlement resumes, and the app roll it settled with (null for an entered die).
   */
  rolled?: { test: D20RolledSaveDto; appRollId: string | null }
  /**
   * The hit a `HIT_BY_ATTACK` offer follows, and the damage types that hit deals: a reaction to the
   * damage reads the types it answers from here, in its own action (D219).
   */
  hit?: EncounterSettledHitDto & { damageTypeIds: string[] }
}

/** The reaction triggers an offer of each kind holds. */
const OFFERED_TRIGGERS = {
  COUNTER: ['SPELL_CAST'],
  TARGETED_SELF: ['TARGETED_SELF'],
  ATTACK_ON_OTHER: ['ATTACK_ON_OTHER'],
  ATTACK_ROLL_BY_OTHER: ['ATTACK_ROLL_BY_OTHER'],
  HIT_BY_ATTACK: ['ATTACKED_SELF', 'DAMAGE_TAKEN']
} as const satisfies Record<
  EncounterCastReactionOfferDto['kind'],
  readonly EncounterReactionPinDto['trigger'][]
>

export const encounterCastReactionOfferDtoSchema: z.ZodMiniType<EncounterCastReactionOfferDto> =
  lazySchema(() =>
    z
      .strictObject({
        kind: z.enum([
          'COUNTER',
          'TARGETED_SELF',
          'ATTACK_ON_OTHER',
          'ATTACK_ROLL_BY_OTHER',
          'HIT_BY_ATTACK'
        ]),
        reactions: z
          .array(encounterReactionPinDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(MAX_ENCOUNTER_REACTION_OPTIONS)),
        declinedReactorActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        rolled: z.optional(
          z.strictObject({
            test: z.lazy(() => d20RolledSaveDtoSchema),
            appRollId: z.nullable(uuidSchema)
          })
        ),
        hit: z.optional(
          z.strictObject({
            ...settledHitShape(),
            damageTypeIds: z
              .array(uuidSchema)
              .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
          })
        )
      })
      .check(
        z.superRefine((value, context) => {
          const offered: readonly string[] = OFFERED_TRIGGERS[value.kind]
          if (value.reactions.some(({ trigger }) => !offered.includes(trigger)))
            context.addIssue({
              code: 'custom',
              path: ['reactions'],
              message:
                'An offer holds the reactions its kind names: counters to a cast, one trigger, or a hit’s reactions.'
            })
          if ((value.kind === 'HIT_BY_ATTACK') !== (value.hit !== undefined))
            context.addIssue({
              code: 'custom',
              path: ['hit'],
              message: 'Only an offer made to the creature an attack hit keeps that hit.'
            })
          if ((value.kind === 'ATTACK_ROLL_BY_OTHER') !== (value.rolled !== undefined))
            context.addIssue({
              code: 'custom',
              path: ['rolled'],
              message: 'Only an offer made after the attack roll keeps the rolled d20.'
            })
        })
      )
  )

/**
 * The root of a cast a reaction countered: the caster still spends its slot and action, and nothing the
 * spell would have done is applied. The counter ran as its holder's own action (D219), whose own
 * receipt records the reactor's spend.
 */
const encounterCounteredCastApplicationOutputImplSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_COUNTERED_CAST'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      sourceActorId: uuidSchema,
      sourceCharacterId: z.nullable(uuidSchema),
      ...sourceSpendReceiptShape()
    })
    .check(z.superRefine(validateSourceSpendReceipts))
)

export type EncounterCounteredCastApplicationOutputDto = SourceSpendReceipts & {
  kind: 'ENCOUNTER_COUNTERED_CAST'
  schemaVersion: 1
  occurrenceId: string
  sourceActorId: string
  sourceCharacterId: string | null
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
 * Why an action's source owes a check before its action runs: the ward of the creature it aims at
 * (`INCOMING_ATTACK_GATE`), or the check its own authored reaction trigger asks against the level of
 * the cast it answers (D219).
 */
export type EncounterIncomingGateOriginDto =
  | { kind: 'WARD'; effectId: string; holderActorId: string }
  | { kind: 'TRIGGER'; triggerLevel: number }

const wardGateOriginSchema = lazySchema(() =>
  z.strictObject({ kind: z.literal('WARD'), effectId: uuidSchema, holderActorId: uuidSchema })
)

export const encounterIncomingGateOriginDtoSchema: z.ZodMiniType<EncounterIncomingGateOriginDto> =
  lazySchema(() =>
    z.discriminatedUnion('kind', [
      wardGateOriginSchema,
      z.strictObject({ kind: z.literal('TRIGGER'), triggerLevel: nonNegativeIntegerSchema })
    ])
  )

/**
 * The check an action's source must pass before its action runs: why it is owed, its ability and DC,
 * and the source's frozen d20. The pause waits on that one roll.
 */
export type EncounterIncomingGateOfferDto = {
  origin: EncounterIncomingGateOriginDto
  checkDefinitionId: string
  dc: number
  d20: z.infer<typeof frozenCheckD20DtoSchema>
}

export const encounterIncomingGateOfferDtoSchema: z.ZodMiniType<EncounterIncomingGateOfferDto> =
  lazySchema(() =>
    z.strictObject({
      origin: encounterIncomingGateOriginDtoSchema,
      checkDefinitionId: uuidSchema,
      dc: positiveIntegerSchema,
      d20: frozenCheckD20DtoSchema
    })
  )

/** A gate its action's source rolled: why it was owed, its ability and DC, and the d20 rolled. */
export type EncounterSettledIncomingGateDto = {
  origin: EncounterIncomingGateOriginDto
  checkDefinitionId: string
  dc: number
  d20: z.infer<typeof ruleCheckD20EvidenceDtoSchema>
}

export const encounterSettledIncomingGateDtoSchema: z.ZodMiniType<EncounterSettledIncomingGateDto> =
  lazySchema(() =>
    z.strictObject({
      origin: encounterIncomingGateOriginDtoSchema,
      checkDefinitionId: uuidSchema,
      dc: positiveIntegerSchema,
      d20: ruleCheckD20EvidenceDtoSchema
    })
  )

/** A failed gate a ward raised: only a ward's failure offers the action another creature. */
export type EncounterFailedWardGateDto = EncounterSettledIncomingGateDto & {
  origin: Extract<EncounterIncomingGateOriginDto, { kind: 'WARD' }>
}

const encounterFailedWardGateDtoSchema: z.ZodMiniType<EncounterFailedWardGateDto> = lazySchema(() =>
  z.strictObject({
    origin: wardGateOriginSchema,
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
  gate: EncounterFailedWardGateDto
  options: EncounterAttackRetargetOptionDto[]
}

export const encounterAttackRetargetOfferDtoSchema: z.ZodMiniType<EncounterAttackRetargetOfferDto> =
  lazySchema(() =>
    z
      .strictObject({
        gate: encounterFailedWardGateDtoSchema,
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
            targets.includes(value.gate.origin.holderActorId)
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
                gateEffectId: value.gate.origin.effectId,
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
 * The root of an action its gate stopped: its source failed the check it owed (a warded creature's
 * save, or its own reaction trigger's check), so the attack or spell is lost. The action is still
 * spent: the receipts name the slot, resource, item and action economy the source paid, and nothing
 * the action would have done is applied.
 */
const encounterGatedActionApplicationOutputImplSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_GATED_ACTION'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      /** The chosen list this is one lost ray of; absent on a root, which holds the action's spend. */
      parentOccurrenceId: z.optional(uuidSchema),
      sourceActorId: uuidSchema,
      sourceCharacterId: z.nullable(uuidSchema),
      ...sourceSpendReceiptShape(),
      /** What the failed check cost the source. */
      lost: z.enum(['ATTACK', 'SPELL']),
      gate: encounterSettledIncomingGateDtoSchema
    })
    .check(z.superRefine(validateSourceSpendReceipts))
)

export type EncounterGatedActionApplicationOutputDto = SourceSpendReceipts & {
  kind: 'ENCOUNTER_GATED_ACTION'
  schemaVersion: 1
  occurrenceId: string
  parentOccurrenceId?: string
  sourceActorId: string
  sourceCharacterId: string | null
  lost: 'ATTACK' | 'SPELL'
  gate: EncounterSettledIncomingGateDto
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
