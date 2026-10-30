import { z, lazySchema } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { characterDeathSavesDtoSchema } from '../subjects/characterState.js'
import { AUTHORED_LIMITS, MAX_ENCOUNTER_ACTORS, authoredShortTextSchema } from './authoredLimits.js'
import { deathSavesAfterRoll, isCharacterDead } from './characterDeathSaves.js'
import { aimedAreaTargetDtoSchema } from './shape.js'
import { areaAimDtoSchema } from './spatialFacts.js'
import {
  d20AddedDiceDtoSchema,
  d20AddedDiceTotal,
  d20RolledAddedDiceDtoSchema
} from './d20AddedDice.js'
import { serverRuleExecutionApplicationOutputsDtoSchema } from './ruleExecutionApplicationOutputs.js'
import {
  ruleExecutionPhaseReceiptsDtoSchema,
  serverCompletedRuleExecutionDtoSchema
} from './ruleExecutionProtocol.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

/** A persisted Recharge plan is bounded by the authored Feature collection limit. */
export const MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES = AUTHORED_LIMITS.nestedCollectionItems

export type CompletedTurnRechargePlanDto = z.infer<typeof completedTurnRechargePlanDtoSchema>
export type TurnDeathSaveExecutionDto = z.infer<typeof turnDeathSaveExecutionDtoSchema>
export type TurnLegendaryActionEvidenceDto = z.infer<typeof turnLegendaryActionEvidenceDtoSchema>

export type TurnLegendaryActionRefreshDto = {
  ordinal: number
  actorId: string
  actorCurrentnessChecksum: string
  ownerFeatureId: string
  chargeId: string
  lifecycleDefinitionId: string
  lifecycleDefinitionVersion: number
  lifecycleDefinitionChecksum: string
  beforeUsed: number
  afterUsed: number
}

export type TurnActionEconomyRefreshDto = {
  ordinal: number
  actorId: string
  capabilityDefinitionId: string
  definitionVersion: number
  definitionChecksum: string
  beforeUsed: number
  afterUsed: 0
}

export const turnLegendaryActionRefreshDtoSchema: z.ZodMiniType<TurnLegendaryActionRefreshDto> =
  lazySchema(() =>
    z.strictObject({
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(MAX_ENCOUNTER_ACTORS - 1)),
      actorId: uuidSchema,
      actorCurrentnessChecksum: checksumSchema,
      ownerFeatureId: uuidSchema,
      chargeId: uuidSchema,
      lifecycleDefinitionId: uuidSchema,
      lifecycleDefinitionVersion: positiveIntegerSchema,
      lifecycleDefinitionChecksum: checksumSchema,
      beforeUsed: positiveIntegerSchema,
      afterUsed: z.literal(0)
    })
  )

export const turnActionEconomyRefreshDtoSchema: z.ZodMiniType<TurnActionEconomyRefreshDto> =
  lazySchema(() =>
    z.strictObject({
      ordinal: z
        .number()
        .check(z.int())
        .check(z.gte(0))
        .check(z.lte(MAX_ENCOUNTER_ACTORS - 1)),
      actorId: uuidSchema,
      capabilityDefinitionId: uuidSchema,
      definitionVersion: positiveIntegerSchema,
      definitionChecksum: checksumSchema,
      beforeUsed: positiveIntegerSchema,
      afterUsed: z.literal(0)
    })
  )

export const turnRechargeCandidateDtoSchema = lazySchema(() =>
  z.strictObject({
    ordinal: z
      .number()
      .check(z.int())
      .check(z.gte(0))
      .check(z.lte(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES - 1)),
    actorId: uuidSchema,
    featureId: uuidSchema,
    featureVersionChecksum: checksumSchema,
    beforeUsed: integerSchema.check(z.gte(1)),
    maximum: positiveIntegerSchema,
    policy: z.strictObject({
      gameSystemId: uuidSchema,
      definitionId: uuidSchema,
      definitionVersion: positiveIntegerSchema,
      definitionChecksum: checksumSchema,
      graphDefinitionId: uuidSchema,
      graphDefinitionVersion: positiveIntegerSchema,
      graphDefinitionChecksum: checksumSchema,
      rechargedOutput: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(128))
    })
  })
)

export const turnRechargeExecutionDtoSchema = lazySchema(() =>
  z.strictObject({
    ordinal: z
      .number()
      .check(z.int())
      .check(z.gte(0))
      .check(z.lte(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES - 1)),
    candidate: turnRechargeCandidateDtoSchema,
    execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
    recharged: z.boolean(),
    beforeUsed: integerSchema.check(z.gte(1)),
    afterUsed: integerSchema.check(z.gte(0)),
    rawDie: integerSchema.check(z.gte(1)).check(z.lte(6))
  })
)

export const completedTurnRechargePlanDtoSchema = lazySchema(() =>
  z
    .strictObject({
      selectionChecksum: checksumSchema,
      executions: z
        .array(turnRechargeExecutionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES))
    })
    .check(
      z.superRefine((value, context) => {
        const identities = new Set<string>()
        for (const [index, execution] of value.executions.entries()) {
          const candidate = execution.candidate
          const identity = `${candidate.actorId}:${candidate.featureId}`
          if (
            execution.ordinal !== index ||
            candidate.ordinal !== index ||
            identities.has(identity) ||
            execution.beforeUsed !== candidate.beforeUsed ||
            execution.afterUsed > execution.beforeUsed ||
            execution.afterUsed !== (execution.recharged ? 0 : execution.beforeUsed)
          ) {
            context.addIssue({
              code: 'custom',
              path: ['executions', index],
              message:
                'Completed Recharge plans must retain canonical complete Feature execution evidence.'
            })
          }
          identities.add(identity)
        }
      })
    )
)

/** The dying Character whose death save is made as its turn starts (D96). */
export const turnDeathSaveCandidateDtoSchema = lazySchema(() =>
  z.strictObject({
    actorId: uuidSchema,
    characterId: uuidSchema,
    /** The Character stream version the save is planned against; the commit fences on it. */
    streamVersion: integerSchema.check(z.gte(0)),
    /** The Character's effective maximum hit points, which cap the single point a 20 regains. */
    effectiveMaximumHitPoints: integerSchema.check(z.gte(1)),
    /** The saves before the roll: dying, so not stable and under three failures. */
    deathSaves: characterDeathSavesDtoSchema,
    /** The dice the Character's active effects add to the save (D156): Bless's d4. */
    addedDice: d20AddedDiceDtoSchema
  })
)

export const turnDeathSaveExecutionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      candidate: turnDeathSaveCandidateDtoSchema,
      execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      /** The d20 with no modifier. */
      rawDie: integerSchema.check(z.gte(1)).check(z.lte(20)),
      /** The candidate's added dice with the faces they rolled. */
      addedDice: d20RolledAddedDiceDtoSchema,
      afterDeathSaves: characterDeathSavesDtoSchema,
      /** A 20 regains 1 hit point. */
      regainsHitPoint: z.boolean()
    })
    .check(
      z.superRefine((value, context) => {
        const before = value.candidate.deathSaves
        const roll = deathSavesAfterRoll(before, value.rawDie, d20AddedDiceTotal(value.addedDice))
        const rolledDice = value.addedDice.map(({ rolledFaces: _rolledFaces, ...die }) => die)
        if (
          checksumRuleDocument(rolledDice) !== checksumRuleDocument(value.candidate.addedDice) ||
          before.stable ||
          isCharacterDead(before) ||
          roll.regainsHitPoint !== value.regainsHitPoint ||
          checksumRuleDocument(roll.deathSaves) !== checksumRuleDocument(value.afterDeathSaves)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['afterDeathSaves'],
            message:
              "A completed death save must replay its d20 and the candidate's added dice against a dying Character."
          })
        }
      })
    )
)

export const legendaryActionChoiceOptionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      optionId: checksumSchema,
      ownerActorId: uuidSchema,
      ownerFeatureId: uuidSchema,
      actionId: identifierSchema,
      /** The option's label, which names the action it runs ("Tail Attack"). */
      label: authoredShortTextSchema,
      /**
       * The actors the option may target, in canonical order: only its owner for a self action, else
       * every other Encounter actor. The controller picks one with the option (D51 option B).
       */
      targetActorIds: z
        .array(uuidSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      /** The exact execution plan the option runs. */
      actionSourceChecksum: checksumSchema,
      /**
       * Set for an area option: the turn hands the selected option to the area coordinator as a
       * rule-raised action between the outgoing turn's end and the next turn.
       */
      delegated: z.optional(z.literal(true)),
      /**
       * The authored area of an aimed area option, for the client to aim: a point it is centered on,
       * or a direction from its owner. Absent for an area the owner centers on itself.
       */
      area: z.optional(aimedAreaTargetDtoSchema),
      chargeId: uuidSchema,
      featureCost: positiveIntegerSchema,
      poolBefore: nonNegativeIntegerSchema,
      poolRemaining: nonNegativeIntegerSchema,
      lifecycle: z.strictObject({
        definitionId: uuidSchema,
        definitionVersion: positiveIntegerSchema,
        definitionChecksum: checksumSchema,
        eligibilityGraphDefinitionId: uuidSchema,
        eligibilityGraphDefinitionVersion: positiveIntegerSchema,
        eligibilityGraphDefinitionChecksum: checksumSchema,
        eligibleOutput: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(128))
      }),
      eligibilityEvidenceChecksum: checksumSchema
    })
    .check(
      z.superRefine((option, refinement) => {
        if (
          option.targetActorIds.some(
            (id, index) => index > 0 && id <= (option.targetActorIds[index - 1] ?? '')
          )
        )
          refinement.addIssue({
            code: 'custom',
            path: ['targetActorIds'],
            message: 'Legendary Action targets must be unique and canonical.'
          })
        if (option.area && !option.delegated)
          refinement.addIssue({
            code: 'custom',
            path: ['area'],
            message: 'Only a delegated Legendary Action option is aimed.'
          })
        if (
          option.featureCost > option.poolBefore ||
          option.poolRemaining !== option.poolBefore - option.featureCost
        ) {
          refinement.addIssue({
            code: 'custom',
            path: ['poolRemaining'],
            message: 'Legendary Action choice resource evidence must retain exact cost arithmetic.'
          })
        }
      })
    )
)

export const legendaryActionChoiceGroupDtoSchema = lazySchema(() =>
  z
    .strictObject({
      ownerActorId: uuidSchema,
      options: z
        .array(legendaryActionChoiceOptionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1))
    })
    .check(
      z.superRefine((group, refinement) => {
        const optionIds = new Set<string>()
        let prior = ''
        for (const [index, option] of group.options.entries()) {
          const identity = `${option.ownerFeatureId}:${option.actionId}`
          if (
            option.ownerActorId !== group.ownerActorId ||
            optionIds.has(option.optionId) ||
            (index > 0 && identity <= prior)
          ) {
            refinement.addIssue({
              code: 'custom',
              path: ['options', index],
              message: 'Legendary Action choices must retain one canonical owner group.'
            })
          }
          optionIds.add(option.optionId)
          prior = identity
        }
      })
    )
)

const legendaryActionCharacterTransitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      characterId: uuidSchema,
      beforeStreamVersion: integerSchema.check(z.gte(0)),
      afterStreamVersion: integerSchema.check(z.gte(0))
    })
    .check(
      z.refine((value) => value.afterStreamVersion === value.beforeStreamVersion + 1, {
        message: 'Legendary Action Character transitions must advance exactly once.'
      })
    )
)

export const turnLegendaryActionEvidenceDtoSchema = lazySchema(() =>
  z
    .strictObject({
      choice: legendaryActionChoiceGroupDtoSchema,
      selectionChecksum: checksumSchema,
      resolution: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('DECLINED') }),
        /**
         * A delegated option, which its own rule-raised action resolves after this commit, with the
         * aim its controller gave an aimed area.
         */
        z.strictObject({
          kind: z.literal('DELEGATED'),
          selectedOptionId: checksumSchema,
          aim: z.optional(areaAimDtoSchema)
        }),
        z.strictObject({
          kind: z.literal('EXECUTED'),
          selectedOptionId: checksumSchema,
          targetActorId: uuidSchema,
          /**
           * The attack the owner rolled, which uses up its one-roll grants at commit, classified as
           * melee or not by its trigger; null when it rolled none.
           */
          attack: z.nullable(z.strictObject({ melee: z.boolean() })),
          /** Whether the owner cast a spell (a spell attack), which ends its cast-ended effects at commit. */
          castsSpell: z.boolean(),
          /** The target's decoy effect the attack was rolled against (Mirror Image); a hit destroys the decoy at commit. */
          decoyEffectId: z.optional(uuidSchema),
          execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
          initialFactsChecksum: checksumSchema,
          phaseReceipts: z.optional(z.lazy(() => ruleExecutionPhaseReceiptsDtoSchema)),
          application: z.lazy(() => serverRuleExecutionApplicationOutputsDtoSchema),
          /** The grant or state effect the option started on its target, in receipt order. */
          // Opaque here: the record type, even named, overflows the pending-state declarations
          // (TS7056). Persistence parses each with activeRuleEffectRecordSchema.
          createdEffects: z.array(z.record(z.string(), z.unknown())).check(z.maxLength(2)),
          characterTransitions: z
            .array(legendaryActionCharacterTransitionDtoSchema)
            .check(z.maxLength(2))
        })
      ])
    })
    .check(
      z.superRefine((value, context) => {
        if (checksumRuleDocument(value.choice) !== value.selectionChecksum) {
          context.addIssue({
            code: 'custom',
            path: ['selectionChecksum'],
            message: 'Legendary Action terminal evidence must bind its exact issued choice.'
          })
        }
        const resolution = value.resolution
        if (!('selectedOptionId' in resolution)) return
        const option = value.choice.options.find(
          (candidate) => candidate.optionId === resolution.selectedOptionId
        )
        if (!option) {
          context.addIssue({
            code: 'custom',
            path: ['resolution', 'selectedOptionId'],
            message: 'Legendary Action terminal evidence must select one issued option.'
          })
          return
        }
        if ((resolution.kind === 'DELEGATED') !== (option.delegated === true))
          context.addIssue({
            code: 'custom',
            path: ['resolution', 'kind'],
            message: 'Only a delegated Legendary Action option is delegated, and it always is.'
          })
        if (resolution.kind === 'DELEGATED' && resolution.aim?.kind !== option.area?.kind)
          context.addIssue({
            code: 'custom',
            path: ['resolution', 'aim'],
            message: 'A delegated Legendary Action option is aimed exactly as its area asks.'
          })
        if (resolution.kind !== 'EXECUTED') return
        const application = resolution.application
        if (
          application.kind !== 'CHARACTER_MECHANICS_BATCH' &&
          application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ) {
          context.addIssue({
            code: 'custom',
            path: ['resolution', 'application'],
            message: 'Legendary Action execution must retain one mechanics application batch.'
          })
          return
        }
        if (
          !option.targetActorIds.includes(resolution.targetActorId) ||
          application.sourceActorId !== option.ownerActorId ||
          application.targetActorId !== resolution.targetActorId
        ) {
          context.addIssue({
            code: 'custom',
            path: ['resolution'],
            message:
              'Legendary Action execution evidence must match its exact selected source and target.'
          })
        }
        const feature = application.featureResourceConsumption
        if (
          !feature ||
          feature.ownerActorId !== option.ownerActorId ||
          feature.ownerFeatureId !== option.ownerFeatureId ||
          feature.chargeId !== option.chargeId ||
          feature.cost !== option.featureCost ||
          feature.beforeRemaining !== option.poolBefore ||
          feature.afterRemaining !== option.poolRemaining ||
          feature.afterUsed !== feature.beforeUsed + feature.cost
        ) {
          context.addIssue({
            code: 'custom',
            path: ['resolution', 'application', 'featureResourceConsumption'],
            message: 'Legendary Action Feature resource evidence must match the selected option.'
          })
        }
        let previous = ''
        for (const [index, transition] of resolution.characterTransitions.entries()) {
          if (transition.characterId <= previous) {
            context.addIssue({
              code: 'custom',
              path: ['resolution', 'characterTransitions', index],
              message: 'Legendary Action Character transitions must be unique and canonical.'
            })
          }
          previous = transition.characterId
        }
      })
    )
)
