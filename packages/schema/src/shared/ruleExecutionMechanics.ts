import { z, lazySchema } from '../zod.js'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { hitPointMaximumReductionRecoveryTagsSchema } from '../effects/hitPointMaximumReduction.js'
import {
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  activeRuleEffectScalarReductionContributionDtoSchema,
  activeRuleEffectStateContributionDtoSchema
} from './activeRuleEffects.js'
import { characterDeathSavesDtoSchema } from '../subjects/characterState.js'
import { MAX_ACTIVE_EFFECT_STORED_TICKS } from './activeRuleEffectLifecycle.js'
import { authoredIdentifierSchema } from './authoredLimits.js'
import { forcedMovementDirectionSchema } from './enums.js'
import { characterResourcePoolIdentitySchema } from './characterResourceIdentity.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionContractVersionSchema as contractVersionSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionReceiptOrdinalSchema as receiptOrdinalSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
/** A save a damage interception asked of its holder: the dice rolled, the DC they met and the result. */
export type DamageInterceptionSaveDto = {
  effectId: string
  rawDie: number
  addedTotal: number
  dc: number
  passed: boolean
}

/** Typed explicitly so the receipts embedding it stay within the declaration size limit (TS7056). */
const damageInterceptionSaveDtoSchema: z.ZodMiniType<DamageInterceptionSaveDto> = lazySchema(() =>
  z.strictObject({
    effectId: uuidSchema,
    rawDie: integerSchema.check(z.gte(1)),
    addedTotal: integerSchema,
    dc: integerSchema,
    passed: z.boolean()
  })
)
/** The charge a feature-held damage interception spent: the holder's own feature resource and its before/after counts. */
export type DamageInterceptionChargeDto = {
  ownerFeatureId: string
  chargeId: string
  cost: number
  beforeUsed: number
  afterUsed: number
  beforeRemaining: number
  afterRemaining: number
}

const damageInterceptionChargeDtoSchema: z.ZodMiniType<DamageInterceptionChargeDto> = lazySchema(
  () =>
    z.strictObject({
      ownerFeatureId: authoredIdentifierSchema,
      chargeId: authoredIdentifierSchema,
      cost: integerSchema.check(z.gte(1)),
      beforeUsed: integerSchema.check(z.gte(0)),
      afterUsed: integerSchema.check(z.gte(0)),
      beforeRemaining: integerSchema.check(z.gte(0)),
      afterRemaining: integerSchema.check(z.gte(0))
    })
)
const characterMechanicsApplicationTraceDtoSchema = lazySchema(() =>
  z.strictObject({
    sourceNodeId: identifierSchema,
    sourceOperationKey: identifierSchema,
    authoredPath: z.nullable(identifierSchema),
    resolvedPath: z.nullable(identifierSchema)
  })
)
const characterMechanicsHitPointAmountsDtoSchema = lazySchema(() =>
  z.strictObject({
    requestedAmount: integerSchema.check(z.gte(1)),
    resolvedAmount: integerSchema.check(z.gte(0)),
    appliedAmount: integerSchema.check(z.gte(0)),
    beforeCurrentHitPoints: integerSchema.check(z.gte(0)),
    afterCurrentHitPoints: integerSchema.check(z.gte(0)),
    beforeTemporaryHitPoints: integerSchema.check(z.gte(0)),
    afterTemporaryHitPoints: integerSchema.check(z.gte(0)),
    maximumHitPoints: integerSchema.check(z.gte(0))
  })
)
export const damageDispositionDtoSchema = lazySchema(() =>
  z.enum(['NORMAL', 'IMMUNE', 'RESISTANT', 'VULNERABLE', 'RESISTANT_AND_VULNERABLE'])
)
export type DamageDispositionDto = z.infer<typeof damageDispositionDtoSchema>

/**
 * Damage after the target's defenses (SRD 5.1): immunity takes it to 0, resistance halves it
 * rounding down, then vulnerability doubles it. Resistance and vulnerability do not cancel.
 */
export function resolveDispositionDamage(
  disposition: DamageDispositionDto,
  requestedAmount: number
): number {
  if (disposition === 'IMMUNE') return 0
  const resisted =
    disposition === 'RESISTANT' || disposition === 'RESISTANT_AND_VULNERABLE'
      ? Math.floor(requestedAmount / 2)
      : requestedAmount
  return disposition === 'VULNERABLE' || disposition === 'RESISTANT_AND_VULNERABLE'
    ? resisted * 2
    : resisted
}

/**
 * The disposition a target's defenses give one damage type: immunity wins, and resistance and
 * vulnerability together are both kept (`resolveDispositionDamage` applies them in order).
 */
export function damageDispositionOf(
  defenses: readonly { kind: 'IMMUNITY' | 'RESISTANCE' | 'VULNERABILITY'; damageTypeId: string }[],
  damageTypeId: string
): DamageDispositionDto {
  const own = defenses.filter((defense) => defense.damageTypeId === damageTypeId)
  const resistant = own.some(({ kind }) => kind === 'RESISTANCE')
  const vulnerable = own.some(({ kind }) => kind === 'VULNERABILITY')
  return own.some(({ kind }) => kind === 'IMMUNITY')
    ? 'IMMUNE'
    : resistant && vulnerable
      ? 'RESISTANT_AND_VULNERABLE'
      : resistant
        ? 'RESISTANT'
        : vulnerable
          ? 'VULNERABLE'
          : 'NORMAL'
}

export const characterMechanicsApplicationDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('HEAL'),
      ...characterMechanicsHitPointAmountsDtoSchema.shape,
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('TEMPORARY_HIT_POINTS'),
      ...characterMechanicsHitPointAmountsDtoSchema.shape,
      /** The active effect the temporary hit points belong to, absent when none (D156). */
      sourceActiveEffectId: z.optional(uuidSchema),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('TEMPORARY_HIT_POINTS_RELEASE'),
      /** The ended effect; the pool is lost only while that effect is still its source (D156). */
      sourceActiveEffectId: uuidSchema,
      beforeTemporaryHitPoints: integerSchema.check(z.gte(0)),
      afterTemporaryHitPoints: integerSchema.check(z.gte(0)),
      applied: z.boolean(),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('DAMAGE'),
      requestedAmount: integerSchema.check(z.gte(1)),
      resolvedAmount: integerSchema.check(z.gte(0)),
      appliedAmount: integerSchema.check(z.gte(0)),
      beforeCurrentHitPoints: integerSchema.check(z.gte(0)),
      afterCurrentHitPoints: integerSchema.check(z.gte(0)),
      beforeTemporaryHitPoints: integerSchema.check(z.gte(0)),
      afterTemporaryHitPoints: integerSchema.check(z.gte(0)),
      maximumHitPoints: integerSchema.check(z.gte(0)),
      damageTypeId: uuidSchema,
      damageDisposition: damageDispositionDtoSchema,
      /** A critical hit: damage at 0 hit points adds two death save failures (D96). */
      critical: z.boolean(),
      /** The held effect whose damage interception left the target above 0 hit points instead. */
      interceptedBy: z.optional(uuidSchema),
      /** The saves the blow's interceptions asked of the target, in the order they were rolled. */
      interceptionSaves: z.optional(z.array(damageInterceptionSaveDtoSchema)),
      /** The charge the intercepting feature spent, when it is limited-use. */
      interceptionCharge: z.optional(damageInterceptionChargeDtoSchema),
      /** Damage a held damage mirror passed on from another actor; it is never mirrored again. */
      mirrored: z.optional(z.literal(true)),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('CONDITION_APPLY'),
      conditionId: uuidSchema,
      beforePresent: z.boolean(),
      afterPresent: z.literal(true),
      applied: z.boolean(),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('CONDITION_REMOVE'),
      conditionId: uuidSchema,
      sourceActiveEffectId: uuidSchema,
      beforePresent: z.boolean(),
      /** A source-bound removal can be retained by another active contribution. */
      afterPresent: z.boolean(),
      applied: z.boolean(),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('STABILIZE'),
      /** True when the target was dying and became stable (D96); false changes nothing. */
      applied: z.boolean(),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('KILL'),
      beforeCurrentHitPoints: integerSchema.check(z.gte(0)),
      afterCurrentHitPoints: z.literal(0),
      beforeTemporaryHitPoints: integerSchema.check(z.gte(0)),
      afterTemporaryHitPoints: z.literal(0),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('REVIVE'),
      /** The hit points the revive restores to a dead target. */
      hitPoints: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('FIXED'), amount: positiveIntegerSchema }),
        z.strictObject({ kind: z.literal('MAXIMUM') })
      ]),
      /** True when the target was dead and returned to life; false changes nothing. */
      applied: z.boolean(),
      beforeCurrentHitPoints: integerSchema.check(z.gte(0)),
      afterCurrentHitPoints: integerSchema.check(z.gte(0)),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('KILL_NEGATED'),
      /** The held effect whose damage interception negated the kill; it spent a use. */
      negatedBy: uuidSchema,
      /** The charge the negating feature spent, when it is limited-use. */
      interceptionCharge: z.optional(damageInterceptionChargeDtoSchema),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('DEPART'),
      /** True when the target was present and left the Run's play (D128); false when it was already absent. */
      applied: z.boolean(),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('HIT_POINT_MAXIMUM_REDUCTION'),
      reductionAmount: positiveIntegerSchema.check(z.lte(Number.MAX_SAFE_INTEGER)),
      sourceDamageOutcomeId: uuidSchema,
      sourceDamageNodeId: identifierSchema,
      sourceDamageOperationKey: identifierSchema,
      recoveryTags: hitPointMaximumReductionRecoveryTagsSchema,
      requestedAmount: positiveIntegerSchema.check(z.lte(Number.MAX_SAFE_INTEGER)),
      resolvedAmount: positiveIntegerSchema.check(z.lte(Number.MAX_SAFE_INTEGER)),
      appliedAmount: integerSchema.check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER)),
      beforeMaximumHitPoints: integerSchema.check(z.gte(0)),
      afterMaximumHitPoints: integerSchema.check(z.gte(0)),
      beforeCurrentHitPoints: integerSchema.check(z.gte(0)),
      afterCurrentHitPoints: integerSchema.check(z.gte(0)),
      beforeTemporaryHitPoints: integerSchema.check(z.gte(0)),
      afterTemporaryHitPoints: integerSchema.check(z.gte(0)),
      maximumHitPoints: integerSchema.check(z.gte(0)),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    }),
    z.strictObject({
      ordinal: receiptOrdinalSchema,
      kind: z.literal('SCALAR_REDUCTION'),
      valueDefinitionId: uuidSchema,
      reductionAmount: positiveIntegerSchema.check(z.lte(Number.MAX_SAFE_INTEGER)),
      stacking: z.literal('ADDITIVE'),
      floor: z.literal(0),
      recoveryTriggers: z
        .array(z.enum(['SHORT_REST', 'LONG_REST']))
        .check(z.minLength(1))
        .check(z.maxLength(2)),
      terminalConsequence: z.literal('TARGET_DIED'),
      sourceOutcomeId: uuidSchema,
      beforeValue: integerSchema.check(z.gte(0)),
      afterValue: integerSchema.check(z.gte(0)),
      targetDied: z.boolean(),
      ...characterMechanicsApplicationTraceDtoSchema.shape
    })
  ])
)
export const characterMechanicsTargetStateDtoSchema = lazySchema(() =>
  z
    .strictObject({
      currentHitPoints: integerSchema.check(z.gte(0)),
      temporaryHitPoints: integerSchema.check(z.gte(0)),
      /** The active effect whose temporary hit points these are, absent when none (D156). */
      temporaryHitPointsSourceEffectId: z.optional(uuidSchema),
      maximumHitPoints: integerSchema.check(z.gte(0)),
      scalarValues: z._default(z.record(uuidSchema, integerSchema.check(z.gte(0))), {}),
      conditionIds: z.array(uuidSchema).check(z.maxLength(200)),
      /**
       * A Character's death saves, recorded so Undo restores them exactly (D96); null for an actor
       * that holds none (a Creature or custom actor is simply defeated at 0, D63).
       */
      deathSaves: z.nullable(characterDeathSavesDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if (value.currentHitPoints > value.maximumHitPoints)
          context.addIssue({
            code: 'custom',
            message: 'Target hit points exceed maximum.'
          })
        if (new Set(value.conditionIds).size !== value.conditionIds.length)
          context.addIssue({
            code: 'custom',
            message: 'Target condition identities must be unique.'
          })
      })
    )
)
export const characterMechanicsResourceReceiptDtoSchema = lazySchema(() =>
  z.strictObject({
    poolId: characterResourcePoolIdentitySchema,
    chargeId: identifierSchema,
    cost: integerSchema.check(z.gte(1)),
    beforeUsed: integerSchema.check(z.gte(0)),
    afterUsed: integerSchema.check(z.gte(0)),
    beforeRemaining: integerSchema.check(z.gte(0)),
    afterRemaining: integerSchema.check(z.gte(0))
  })
)
export const encounterFeatureResourceReceiptDtoSchema = lazySchema(() =>
  z.strictObject({
    ownerActorId: uuidSchema,
    ownerFeatureId: authoredIdentifierSchema,
    chargeId: authoredIdentifierSchema,
    cost: integerSchema.check(z.gte(1)),
    beforeUsed: integerSchema.check(z.gte(0)),
    afterUsed: integerSchema.check(z.gte(0)),
    beforeRemaining: integerSchema.check(z.gte(0)),
    afterRemaining: integerSchema.check(z.gte(0))
  })
)
export const characterActiveEffectCreateReceiptDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('CREATE'),
    activeEffectId: uuidSchema,
    characterId: uuidSchema,
    sourceEncounterId: uuidSchema,
    createdOrdinal: positiveIntegerSchema,
    afterVersion: aggregateVersionSchema,
    authoredEffectId: uuidSchema,
    compiledEntryId: uuidSchema,
    frozenGraphNodeId: localNodeIdSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema,
    frozenSourceChecksum: checksumSchema,
    capabilityContractVersion: contractVersionSchema,
    recurrenceStage: z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN']),
    remainingTicks: z.nullable(
      integerSchema.check(z.gte(1)).check(z.lte(MAX_ACTIVE_EFFECT_STORED_TICKS))
    ),
    maintainedEffectStateId: z.nullable(uuidSchema)
  })
)
/** One target-owned recurring effect created by an Encounter Feature settlement. */
export const encounterActorActiveEffectCreateReceiptDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('CREATE'),
    activeEffectId: uuidSchema,
    targetActorId: uuidSchema,
    createdOrdinal: positiveIntegerSchema,
    afterVersion: aggregateVersionSchema,
    authoredEffectId: uuidSchema,
    compiledEntryId: uuidSchema,
    frozenGraphNodeId: localNodeIdSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema,
    frozenSourceChecksum: checksumSchema,
    capabilityContractVersion: contractVersionSchema,
    recurrenceStage: z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN']),
    remainingTicks: z.nullable(
      integerSchema.check(z.gte(1)).check(z.lte(MAX_ACTIVE_EFFECT_STORED_TICKS))
    ),
    maintainedEffectStateId: z.optional(z.nullable(uuidSchema))
  })
)
/** Names what an ended effect released, in the receipt (there is no graph node to cite). */
export const ENDED_EFFECT_RELEASE_OPERATION_KEY = 'active-effect.ended'

/** An ended effect releases its sole-owned conditions and its temporary hit points (D156). */
export function isEndedEffectRelease<T extends { kind: string }>(
  application: T
): application is Extract<T, { kind: 'CONDITION_REMOVE' | 'TEMPORARY_HIT_POINTS_RELEASE' }> {
  return (
    application.kind === 'CONDITION_REMOVE' || application.kind === 'TEMPORARY_HIT_POINTS_RELEASE'
  )
}

/** A target's mechanics before and after one settled batch, bound to the batch's checksum. */
export const characterMechanicsTargetTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    checksum: checksumSchema,
    before: characterMechanicsTargetStateDtoSchema,
    after: characterMechanicsTargetStateDtoSchema
  })
)

/**
 * What a won contest's outcome settled on its target (D105, D173): its mechanics batch, null when it
 * applied none, and the pushes its commit lands on the Scene (D157). It settles at least one. The
 * batch keeps the Character Sheet version it left, null when it left the Sheet as it was, which
 * fences the outcome's undo.
 */
export const targetOutcomeTransitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('TARGET_OUTCOME'),
      mechanics: z.nullable(
        z.strictObject({
          targetTransition: characterMechanicsTargetTransitionDtoSchema,
          targetCharacterStreamVersion: z.nullable(aggregateVersionSchema),
          applications: z
            .array(characterMechanicsApplicationDtoSchema)
            .check(z.minLength(1), z.maxLength(RULE_GRAPH_LIMITS.NODES))
        })
      ),
      forcedMovements: z
        .array(
          z.strictObject({
            direction: forcedMovementDirectionSchema,
            feet: z.number().check(z.positive()),
            upTo: z.boolean()
          })
        )
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
    })
    .check(
      z.refine((value) => value.mechanics !== null || value.forcedMovements.length > 0, {
        message: 'A contest outcome settles mechanics or a forced movement on its target.'
      })
    )
)

export type TargetOutcomeTransitionDto = z.infer<typeof targetOutcomeTransitionDtoSchema>

/**
 * What the acting source's own state changed with its action, apart from the target's outcome: the
 * conditions an effect that ended on the event held alone and that effect's temporary hit points
 * (SPELLS-27.T2, D125, D156), and the hit points it regained from the damage its action dealt (D181).
 * Only these are receipted, because undo restores exactly those.
 */
export const sourceApplicationsDtoSchema = lazySchema(() =>
  z.array(characterMechanicsApplicationDtoSchema).check(
    z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER),
    z.superRefine((applications, context) => {
      for (const [index, application] of applications.entries())
        if (
          !(isEndedEffectRelease(application) || application.kind === 'HEAL') ||
          application.ordinal !== index
        )
          context.addIssue({
            code: 'custom',
            path: [index],
            message: 'Source applications are contiguous ended-effect releases and heals.'
          })
    })
  )
)

/**
 * Whether a source's applications moved its Character stream version. A Creature source has no
 * stream, so its releases change only the Run actor.
 */
export function sourceApplicationsChangeState(
  applications: readonly z.infer<typeof characterMechanicsApplicationDtoSchema>[],
  sourceCharacterId: string | null
) {
  return (
    sourceCharacterId !== null &&
    applications.some((application) =>
      application.kind === 'HEAL'
        ? application.appliedAmount > 0
        : (application.kind === 'CONDITION_REMOVE' ||
            application.kind === 'TEMPORARY_HIT_POINTS_RELEASE') &&
          application.applied
    )
  )
}

export const stateEffectCreateReceiptDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('CREATE'),
    owner: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('CHARACTER'), characterId: uuidSchema }),
      z.strictObject({
        kind: z.literal('ENCOUNTER_ACTOR'),
        encounterId: uuidSchema,
        targetActorId: uuidSchema
      })
    ]),
    activeEffectId: uuidSchema,
    createdOrdinal: positiveIntegerSchema,
    afterVersion: aggregateVersionSchema,
    authoredEffectId: uuidSchema,
    compiledEntryId: uuidSchema,
    frozenGraphNodeId: localNodeIdSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema,
    frozenSourceChecksum: checksumSchema,
    capabilityContractVersion: contractVersionSchema,
    contribution: z.discriminatedUnion('kind', [
      activeRuleEffectStateContributionDtoSchema,
      activeRuleEffectScalarReductionContributionDtoSchema
    ])
  })
)

export function validateStateEffectTransitions(input: {
  applications: readonly z.infer<typeof characterMechanicsApplicationDtoSchema>[]
  transitions: readonly z.infer<typeof stateEffectCreateReceiptDtoSchema>[]
  expectedOwnerKind: 'CHARACTER' | 'ENCOUNTER_ACTOR'
  expectedTargetActorId?: string
  context: z.core.$RefinementCtx
}) {
  const reductions = input.applications.filter(
    (application) =>
      application.kind === 'HIT_POINT_MAXIMUM_REDUCTION' || application.kind === 'SCALAR_REDUCTION'
  )
  if (reductions.length !== input.transitions.length) {
    input.context.addIssue({
      code: 'custom',
      path: ['stateEffectTransitions'],
      message: 'Each target state reduction requires one matching state-effect receipt.'
    })
    return
  }
  for (const [index, reduction] of reductions.entries()) {
    const transition = input.transitions[index]
    if (!transition) continue
    const contribution = transition.contribution
    const ownerMatches =
      input.expectedOwnerKind === 'CHARACTER'
        ? transition.owner.kind === 'CHARACTER'
        : transition.owner.kind === 'ENCOUNTER_ACTOR' &&
          transition.owner.targetActorId === input.expectedTargetActorId
    const contributionMatches =
      reduction.kind === 'HIT_POINT_MAXIMUM_REDUCTION'
        ? contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION' &&
          contribution.amount === reduction.reductionAmount &&
          contribution.sourceDamageOutcomeId === reduction.sourceDamageOutcomeId &&
          contribution.sourceDamageNodeId === reduction.sourceDamageNodeId &&
          contribution.sourceDamageOperationKey === reduction.sourceDamageOperationKey &&
          contribution.recoveryTags[0] === reduction.recoveryTags[0]
        : contribution.kind === 'SCALAR_REDUCTION' &&
          contribution.amount === reduction.reductionAmount &&
          contribution.valueDefinitionId === reduction.valueDefinitionId &&
          contribution.sourceOutcomeId === reduction.sourceOutcomeId &&
          contribution.sourceNodeId === reduction.sourceNodeId &&
          contribution.sourceOperationKey === reduction.sourceOperationKey
    if (
      !ownerMatches ||
      transition.frozenGraphNodeId !== reduction.sourceNodeId ||
      !contributionMatches
    )
      input.context.addIssue({
        code: 'custom',
        path: ['stateEffectTransitions', index],
        message: 'State-effect receipt does not match its target state reduction.'
      })
  }
}

/** A carried-over Concentration grant the caster's new Concentration ends (D99, SPELLS-5.7). */
export interface EndedCarriedGrantDto {
  characterId: string
  activeEffectId: string
  createdOrdinal: number
  expectedVersion: number
  definitionChecksum: string
  lifecycleChecksum: string
}

type RemovedDependentEffectDto = Omit<EndedCarriedGrantDto, 'characterId'> &
  ({ kind: 'CHARACTER'; characterId: string } | { kind: 'ENCOUNTER_ACTOR'; targetActorId: string })

// Explicitly typed: the inferred shapes, repeated through every pending-state declaration that embeds
// the receipt, overflow the compiler's declaration size (TS7056).
const removedDependentEffectSchema: z.ZodMiniType<RemovedDependentEffectDto> = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHARACTER'),
      characterId: uuidSchema,
      activeEffectId: uuidSchema,
      createdOrdinal: positiveIntegerSchema,
      expectedVersion: aggregateVersionSchema,
      definitionChecksum: checksumSchema,
      lifecycleChecksum: checksumSchema
    }),
    z.strictObject({
      kind: z.literal('ENCOUNTER_ACTOR'),
      targetActorId: uuidSchema,
      activeEffectId: uuidSchema,
      createdOrdinal: positiveIntegerSchema,
      expectedVersion: aggregateVersionSchema,
      definitionChecksum: checksumSchema,
      lifecycleChecksum: checksumSchema
    })
  ])
)

const endedCarriedGrantSchema: z.ZodMiniType<EndedCarriedGrantDto> = lazySchema(() =>
  z.strictObject({
    characterId: uuidSchema,
    activeEffectId: uuidSchema,
    createdOrdinal: positiveIntegerSchema,
    expectedVersion: aggregateVersionSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema
  })
)

export const maintainedEffectTransitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('REPLACE_SAME_DEFINITION'),
      priorState: z.nullable(
        z.strictObject({
          id: uuidSchema,
          version: aggregateVersionSchema,
          maintenanceDefinitionId: uuidSchema,
          // The checksum pins the prior descriptor, whatever its provenance (D151).
          descriptorChecksum: checksumSchema,
          sourceActorId: uuidSchema
        })
      ),
      removedDependentEffects: z
        .array(removedDependentEffectSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2)),
      /** D99: carried-over Concentration grants the caster's new Concentration ends (Characters only). */
      endedCarriedGrants: z
        .array(endedCarriedGrantSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2)),
      createdState: z.strictObject({
        id: uuidSchema,
        version: aggregateVersionSchema,
        maintenanceDefinitionId: uuidSchema,
        descriptorChecksum: checksumSchema,
        definitionChecksum: checksumSchema,
        sourceActionId: z.string().check(z.minLength(1)).check(z.maxLength(240)),
        sourceOccurrenceId: uuidSchema,
        sourceActorId: uuidSchema
      }),
      characterOwnerTransitions: z
        .array(
          z.strictObject({
            characterId: uuidSchema,
            beforeStreamVersion: aggregateVersionSchema,
            afterStreamVersion: aggregateVersionSchema
          })
        )
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2)),
      createdDependentEffectIds: z
        .array(uuidSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
    })
    .check(
      z.superRefine((value, context) => {
        const removed = new Set<string>()
        let previousTuple = ''
        for (const [index, effect] of value.removedDependentEffects.entries()) {
          const owner =
            effect.kind === 'CHARACTER' ? `0:${effect.characterId}` : `1:${effect.targetActorId}`
          if (removed.has(effect.activeEffectId))
            context.addIssue({
              code: 'custom',
              message: 'Removed maintained dependent effects must be unique.'
            })
          const tuple = `${owner}:${effect.createdOrdinal.toString().padStart(10, '0')}:${effect.activeEffectId}`
          if (tuple <= previousTuple)
            context.addIssue({
              code: 'custom',
              path: ['removedDependentEffects', index],
              message: 'Removed maintained dependent effects must use canonical owner order.'
            })
          previousTuple = tuple
          removed.add(effect.activeEffectId)
        }
        let previousCarried = ''
        for (const [index, effect] of value.endedCarriedGrants.entries()) {
          const tuple = `${effect.characterId}:${effect.createdOrdinal.toString().padStart(10, '0')}:${effect.activeEffectId}`
          if (tuple <= previousCarried || removed.has(effect.activeEffectId))
            context.addIssue({
              code: 'custom',
              path: ['endedCarriedGrants', index],
              message: 'Ended carried grants must be unique and use canonical owner order.'
            })
          previousCarried = tuple
        }
        if (
          new Set(value.createdDependentEffectIds).size !== value.createdDependentEffectIds.length
        )
          context.addIssue({
            code: 'custom',
            message: 'Created maintained dependent effects must be unique.'
          })
        if (value.priorState === null && value.removedDependentEffects.length > 0)
          context.addIssue({
            code: 'custom',
            message: 'Maintained replacement prior state and removals are inconsistent.'
          })
        if (
          value.priorState &&
          (value.priorState.maintenanceDefinitionId !==
            value.createdState.maintenanceDefinitionId ||
            value.priorState.sourceActorId !== value.createdState.sourceActorId)
        )
          context.addIssue({
            code: 'custom',
            message: 'Maintained replacement state identity is invalid.'
          })
        const characterOwners = [
          ...new Set(
            value.removedDependentEffects
              .filter((effect) => effect.kind === 'CHARACTER')
              .map((effect) => effect.characterId)
              .concat(value.endedCarriedGrants.map((effect) => effect.characterId))
          )
        ].sort()
        const transitions = value.characterOwnerTransitions
        if (
          transitions.length !== characterOwners.length ||
          transitions.some(
            (transition, index) =>
              transition.characterId !== characterOwners[index] ||
              transition.afterStreamVersion !== transition.beforeStreamVersion + 1
          )
        )
          context.addIssue({
            code: 'custom',
            message: 'Maintained Character owner transitions are invalid.'
          })
      })
    )
)

export function validateMaintainedEffectCreation(input: {
  occurrenceId: string
  sourceActorId: string
  activeEffectTransitions: readonly {
    activeEffectId: string
    maintainedEffectStateId?: string | null
  }[]
  maintenanceTransition?: z.infer<typeof maintainedEffectTransitionDtoSchema> | null
  context: z.core.$RefinementCtx
}) {
  const maintenance = input.maintenanceTransition ?? null
  if (maintenance) {
    if (
      maintenance.createdState.sourceOccurrenceId !== input.occurrenceId ||
      maintenance.createdState.sourceActorId !== input.sourceActorId
    )
      input.context.addIssue({
        code: 'custom',
        path: ['maintenanceTransition'],
        message: 'Maintained replacement root binding is invalid.'
      })
    const dependentIds = new Set(maintenance.createdDependentEffectIds)
    if (
      input.activeEffectTransitions.length !== dependentIds.size ||
      input.activeEffectTransitions.some(
        (transition) =>
          transition.maintainedEffectStateId !== maintenance.createdState.id ||
          !dependentIds.has(transition.activeEffectId)
      )
    )
      input.context.addIssue({
        code: 'custom',
        path: ['maintenanceTransition'],
        message: 'Maintained replacement created dependencies are invalid.'
      })
  } else if (
    input.activeEffectTransitions.some((transition) => transition.maintainedEffectStateId != null)
  )
    input.context.addIssue({
      code: 'custom',
      path: ['activeEffectTransitions'],
      message: 'Unbound maintained active effects are invalid.'
    })
}
