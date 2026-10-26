import { z, lazySchema } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import {
  stagedInitiativeRoundStateDtoSchema,
  type PausedInitiativeRoundStateDto as StagedInitiativeRoundStateDto
} from './initiativeState.js'
import {
  encounterInitiativeAdvancePlanDtoSchema,
  encounterInitiativeSettlementDtoSchema,
  initiativeBeforePinDtoSchema,
  type EncounterInitiativeAdvancePlanDto,
  type EncounterInitiativeSettlementDto,
  type InitiativeBeforePinDto
} from './ruleExecutionInitiative.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import {
  spatialTurnExecutionDtoSchema,
  turnEffectExecutionDtoSchema
} from './ruleExecutionEffectEvidence.js'
import { resolvedD20StageDtoSchema, spatialTurnCandidateDtoSchema } from './ruleExecutionSpatial.js'
import {
  followsInZoneTurnOrder,
  stagedTurnZonePlanDtoSchema,
  type StagedTurnZonePlanDto
} from './ruleExecutionTurnPhaseEvidence.js'
import { MAX_SPATIAL_CANDIDATES } from './spatialFacts.js'
import { serverRuleExecutionD20PolicyDtoSchema } from './ruleExecutionEvidence.js'
import { directActionTwoPhaseDtoSchema } from './ruleExecutionDirectActionPendingContexts.js'
import {
  MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES,
  completedTurnRechargePlanDtoSchema,
  legendaryActionChoiceGroupDtoSchema,
  legendaryActionChoiceOptionDtoSchema,
  turnActionEconomyRefreshDtoSchema,
  turnLegendaryActionEvidenceDtoSchema,
  turnLegendaryActionRefreshDtoSchema,
  turnRechargeCandidateDtoSchema,
  turnDeathSaveCandidateDtoSchema,
  turnDeathSaveExecutionDtoSchema,
  turnRechargeExecutionDtoSchema,
  type CompletedTurnRechargePlanDto,
  type TurnDeathSaveExecutionDto,
  type TurnActionEconomyRefreshDto,
  type TurnLegendaryActionEvidenceDto,
  type TurnLegendaryActionRefreshDto
} from './ruleExecutionTurnResources.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  pendingCompletedTurnPhaseDtoSchema,
  type PendingCompletedTurnPhaseDto
} from './ruleExecutionResults.js'
import {
  type TurnResolutionCommandDto,
  turnResolutionCommandDtoSchema
} from './ruleExecutionTurnCommands.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'

export const MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS = MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2

const turnEffectPendingCandidateDtoSchema = lazySchema(() =>
  z.strictObject({
    ordinal: z
      .number()
      .check(z.int())
      .check(z.gte(0))
      .check(z.lte(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS - 1)),
    boundaryOrdinal: integerSchema.check(z.gte(0)).check(z.lte(1)),
    stage: z.enum(['START_OF_TURN', 'END_OF_TURN']),
    targetActorId: uuidSchema,
    owner: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('CHARACTER'),
        characterId: uuidSchema,
        streamVersion: integerSchema.check(z.gte(0)),
        projectionChecksum: checksumSchema,
        mechanicalContextChecksum: checksumSchema
      }),
      z.strictObject({ kind: z.literal('ENCOUNTER_ACTOR') })
    ]),
    activeEffectId: uuidSchema,
    createdOrdinal: positiveIntegerSchema,
    effectVersion: positiveIntegerSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema,
    targetStateChecksum: checksumSchema,
    /** Who rolls the effect's damage dice (ADR 0034 decision 3); null for a sourceless effect. */
    sourceActorId: z.nullable(uuidSchema),
    d20Policy: z.nullable(z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)),
    /** The resolved save of a candidate now answering its damage dice. */
    diceStage: z.nullable(resolvedD20StageDtoSchema)
  })
)

interface TurnLegendaryActionQueueDto {
  /** Frozen ordered owners; one decision opportunity is issued per owner at most. */
  ownerActorIds: string[]
  /** The owner whose window is presently pending. */
  nextOwnerIndex: number
}

export interface TurnCoordinatorRootDto {
  rootCommandId: string
  commandFingerprint: string
  commandType: 'START' | 'ADVANCE_TURN'
  /** Who answers the turn's decisions: always the Campaign owner. */
  initiatorUserId: string
  /** Who issued START or ADVANCE_TURN: the GM or a player ending their actor's turn. */
  requestedByUserId: string
  correlationId: string | null
  expectedEncounterVersion: number
  startSystemId: string | null
  frozenActorRuleRevisionId: string | null
  frozenActorRuleRevisionChecksum: string | null
  frozenActorRuleSnapshotChecksum: string | null
  initiative: EncounterInitiativeSettlementDto | null
  initiativeAdvance: EncounterInitiativeAdvancePlanDto | null
  stagedInitiative?: {
    beforePin: InitiativeBeforePinDto
    stagedRoundState: StagedInitiativeRoundStateDto
  }
  outgoingTurn?: PendingCompletedTurnPhaseDto
  /** The entering creature's active-effect phase, retained while its zone batch pauses. */
  incomingTurn?: PendingCompletedTurnPhaseDto
  /** The leaving creature's staged zone batch, retained while a later phase pauses. */
  outgoingZoneTurn?: StagedTurnZonePlanDto
  /** Sealed ordered owner queue retained only while the turn occurrence is pending. */
  legendaryActionQueue?: TurnLegendaryActionQueueDto
  /** Completed owner decisions retained through later turn pauses and terminal receipt creation. */
  completedLegendaryActions?: TurnLegendaryActionEvidenceDto[]
  /** Owner-start pool recoveries staged with the occurrence and persisted only at terminal commit. */
  stagedLegendaryActionRefreshes?: TurnLegendaryActionRefreshDto[]
  /** System-owned aggregate usage refreshes staged at the authoritative turn boundary. */
  stagedActionEconomyRefreshes?: TurnActionEconomyRefreshDto[]
  completedRechargePlan?: CompletedTurnRechargePlanDto | null
  /** The entering Character's death save, staged with the turn and applied at terminal commit. */
  completedDeathSavePlan?: TurnDeathSaveExecutionDto | null
  proposedTerminalTransition: {
    status: 'ACTIVE' | 'COMPLETED'
    round: number
    currentActorId: string | null
  }
  resolutionCommands: TurnResolutionCommandDto[]
}

export const turnCoordinatorRootDtoSchema: z.ZodMiniType<TurnCoordinatorRootDto> = lazySchema(() =>
  z.strictObject({
    rootCommandId: uuidSchema,
    commandFingerprint: checksumSchema,
    commandType: z.enum(['START', 'ADVANCE_TURN']),
    initiatorUserId: uuidSchema,
    requestedByUserId: uuidSchema,
    correlationId: z.nullable(uuidSchema),
    expectedEncounterVersion: integerSchema.check(z.gte(0)),
    /** Exact original START payload identity; never rules authority. */
    startSystemId: z._default(z.nullable(uuidSchema), null),
    /** Server-only transient adapter source, not an Encounter pin. */
    frozenActorRuleRevisionId: z._default(z.nullable(uuidSchema), null),
    frozenActorRuleRevisionChecksum: z._default(z.nullable(checksumSchema), null),
    frozenActorRuleSnapshotChecksum: z._default(z.nullable(checksumSchema), null),
    initiative: z._default(z.nullable(z.lazy(() => encounterInitiativeSettlementDtoSchema)), null),
    initiativeAdvance: z._default(
      z.nullable(z.lazy(() => encounterInitiativeAdvancePlanDtoSchema)),
      null
    ),
    /** Pending initiative remains occurrence-owned until this turn terminally commits. */
    stagedInitiative: z.optional(
      z.lazy(() =>
        z.strictObject({
          beforePin: initiativeBeforePinDtoSchema,
          stagedRoundState: stagedInitiativeRoundStateDtoSchema
        })
      )
    ),
    outgoingTurn: z.optional(z.lazy(() => pendingCompletedTurnPhaseDtoSchema)),
    incomingTurn: z.optional(z.lazy(() => pendingCompletedTurnPhaseDtoSchema)),
    outgoingZoneTurn: z.optional(z.lazy(() => stagedTurnZonePlanDtoSchema)),
    /** A pending Legendary Action owner queue remains turn-owned through later pauses. */
    legendaryActionQueue: z.optional(
      z
        .strictObject({
          ownerActorIds: z
            .array(uuidSchema)
            .check(z.minLength(1))
            .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
          nextOwnerIndex: z
            .number()
            .check(z.int())
            .check(z.gte(0))
            .check(z.lte(MAX_ENCOUNTER_ACTORS - 1))
        })
        .check(
          z.superRefine((queue, context) => {
            if (
              queue.nextOwnerIndex >= queue.ownerActorIds.length ||
              new Set(queue.ownerActorIds).size !== queue.ownerActorIds.length ||
              queue.ownerActorIds.some(
                (ownerId, index) => index > 0 && queue.ownerActorIds[index - 1]! >= ownerId
              )
            ) {
              context.addIssue({
                code: 'custom',
                message:
                  'Legendary Action owner queues must be unique, ordered, and point at one pending owner.'
              })
            }
          })
        )
    ),
    /** Settled Legendary Action windows remain turn-owned through later Recharge/effect pauses. */
    completedLegendaryActions: z.optional(
      z
        .array(z.lazy(() => turnLegendaryActionEvidenceDtoSchema))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    ),
    stagedLegendaryActionRefreshes: z.optional(
      z
        .array(turnLegendaryActionRefreshDtoSchema)
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
        .check(
          z.superRefine((entries, context) => {
            const identities = new Set<string>()
            for (const [index, entry] of entries.entries()) {
              const identity = `${entry.actorId}:${entry.ownerFeatureId}:${entry.chargeId}`
              if (entry.ordinal !== index || identities.has(identity)) {
                context.addIssue({
                  code: 'custom',
                  path: [index],
                  message:
                    'Legendary Action refreshes must be uniquely and deterministically ordered.'
                })
              }
              identities.add(identity)
            }
          })
        )
    ),
    stagedActionEconomyRefreshes: z.optional(
      z
        .array(turnActionEconomyRefreshDtoSchema)
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
        .check(
          z.superRefine((entries, context) => {
            const identities = new Set<string>()
            for (const [index, entry] of entries.entries()) {
              const identity = `${entry.actorId}:${entry.capabilityDefinitionId}`
              if (entry.ordinal !== index || identities.has(identity)) {
                context.addIssue({
                  code: 'custom',
                  path: [index],
                  message:
                    'Action-economy refreshes must be uniquely and deterministically ordered.'
                })
              }
              identities.add(identity)
            }
          })
        )
    ),
    /** Recharge outcomes are staged with the turn and applied only at terminal commit. */
    completedRechargePlan: z.optional(z.nullable(z.lazy(() => completedTurnRechargePlanDtoSchema))),
    completedDeathSavePlan: z.optional(z.nullable(z.lazy(() => turnDeathSaveExecutionDtoSchema))),
    proposedTerminalTransition: z.strictObject({
      status: z.enum(['ACTIVE', 'COMPLETED']),
      round: integerSchema.check(z.gte(1)),
      currentActorId: z.nullable(uuidSchema)
    }),
    resolutionCommands: z._default(
      z
        .array(turnResolutionCommandDtoSchema)
        .check(
          z.maxLength(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS + MAX_ENCOUNTER_ACTORS * 20)
        ),
      []
    )
  })
)

export const turnEffectPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_TURN_ACTIVE_EFFECTS'),
      schemaVersion: z.literal(1),
      root: turnCoordinatorRootDtoSchema,
      selectionChecksum: checksumSchema,
      currentCandidate: turnEffectPendingCandidateDtoSchema,
      completedExecutions: z
        .array(z.lazy(() => turnEffectExecutionDtoSchema))
        .check(z.maxLength(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS)),
      remainingCandidates: z
        .array(turnEffectPendingCandidateDtoSchema)
        .check(z.maxLength(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS))
    })
    .check(
      z.superRefine((value, context) => {
        const frozenSource = [
          value.root.frozenActorRuleRevisionId,
          value.root.frozenActorRuleRevisionChecksum,
          value.root.frozenActorRuleSnapshotChecksum
        ]
        if (
          frozenSource.some((entry) => entry === null) &&
          frozenSource.some((entry) => entry !== null)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['root'],
            message:
              'A paused turn-effect batch must retain either the complete frozen actor-rule source identity or none of it.'
          })
        }
        const completed = value.completedExecutions
        const current = value.currentCandidate.ordinal
        const remaining = value.remainingCandidates
        const effectIds = new Set<string>()
        const ordinals = new Set<number>()
        for (const [index, execution] of completed.entries()) {
          if (execution.ordinal !== index || execution.ordinal >= current) {
            context.addIssue({
              code: 'custom',
              path: ['completedExecutions', index],
              message:
                'Completed turn executions must be the canonical prefix before the current candidate.'
            })
          }
          if (effectIds.has(execution.activeEffectId) || ordinals.has(execution.ordinal)) {
            context.addIssue({
              code: 'custom',
              path: ['completedExecutions', index],
              message: 'Turn candidates must have unique effect identities and ordinals.'
            })
          }
          effectIds.add(execution.activeEffectId)
          ordinals.add(execution.ordinal)
        }
        if (
          current !== completed.length ||
          effectIds.has(value.currentCandidate.activeEffectId) ||
          ordinals.has(current)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['currentCandidate'],
            message:
              'Current turn candidate must immediately follow the completed prefix with a unique identity.'
          })
        }
        effectIds.add(value.currentCandidate.activeEffectId)
        ordinals.add(current)
        for (const [index, candidate] of remaining.entries()) {
          if (
            candidate.ordinal !== current + index + 1 ||
            effectIds.has(candidate.activeEffectId) ||
            ordinals.has(candidate.ordinal)
          ) {
            context.addIssue({
              code: 'custom',
              path: ['remainingCandidates', index],
              message:
                'Remaining turn candidates must be the canonical unique suffix after the current candidate.'
            })
          }
          effectIds.add(candidate.activeEffectId)
          ordinals.add(candidate.ordinal)
        }
      })
    )
)

export const turnZoneEffectsPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_TURN_ZONE_EFFECTS'),
      schemaVersion: z.literal(1),
      root: turnCoordinatorRootDtoSchema,
      selectionChecksum: checksumSchema,
      completedExecutions: z
        .array(z.lazy(() => spatialTurnExecutionDtoSchema))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      currentCandidate: z.lazy(() => spatialTurnCandidateDtoSchema),
      remainingCandidates: z
        .array(z.lazy(() => spatialTurnCandidateDtoSchema))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES))
    })
    .check(
      z.superRefine((value, context) => {
        const candidates = [
          ...value.completedExecutions.map((execution) => execution.candidate),
          value.currentCandidate,
          ...value.remainingCandidates
        ]
        const first = candidates[0]!
        for (const [index, candidate] of candidates.entries()) {
          const previous = candidates[index - 1]
          if (
            candidate.ordinal !== index ||
            candidate.boundaryOrdinal !== first.boundaryOrdinal ||
            (previous && !followsInZoneTurnOrder(previous.candidate, candidate.candidate))
          )
            context.addIssue({
              code: 'custom',
              path: ['currentCandidate'],
              message: 'Zone turn candidates must be one boundary in canonical zone turn order.'
            })
        }
      })
    )
)

export const turnRechargePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_TURN_RECHARGE'),
      schemaVersion: z.literal(1),
      phase: z.literal('START_OF_TURN'),
      root: turnCoordinatorRootDtoSchema,
      selectionChecksum: checksumSchema,
      completedExecutions: z
        .array(turnRechargeExecutionDtoSchema)
        .check(z.maxLength(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES)),
      currentCandidate: turnRechargeCandidateDtoSchema,
      remainingCandidates: z
        .array(turnRechargeCandidateDtoSchema)
        .check(z.maxLength(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES))
    })
    .check(
      z.superRefine((value, context) => {
        const expectedActorId = value.root.proposedTerminalTransition.currentActorId
        const completed = value.completedExecutions
        const current = value.currentCandidate
        const remaining = value.remainingCandidates
        const identities = new Set<string>()
        const validateCandidate = (
          candidate: z.infer<typeof turnRechargeCandidateDtoSchema>,
          ordinal: number,
          path: (string | number)[]
        ) => {
          if (candidate.ordinal !== ordinal) {
            context.addIssue({
              code: 'custom',
              path: [...path, 'ordinal'],
              message: 'Recharge candidates must retain contiguous canonical ordinals.'
            })
          }
          if (expectedActorId === null || candidate.actorId !== expectedActorId) {
            context.addIssue({
              code: 'custom',
              path: [...path, 'actorId'],
              message: 'Recharge candidates must belong to the entering current actor.'
            })
          }
          const identity = `${candidate.actorId}:${candidate.featureId}`
          if (identities.has(identity)) {
            context.addIssue({
              code: 'custom',
              path,
              message: 'Recharge candidates must have unique actor and Feature identities.'
            })
          }
          identities.add(identity)
        }
        for (const [index, execution] of completed.entries()) {
          validateCandidate(execution.candidate, index, ['completedExecutions', index, 'candidate'])
          if (
            execution.ordinal !== index ||
            execution.candidate.ordinal !== execution.ordinal ||
            execution.beforeUsed !== execution.candidate.beforeUsed ||
            execution.afterUsed > execution.beforeUsed ||
            execution.afterUsed !== (execution.recharged ? 0 : execution.beforeUsed)
          ) {
            context.addIssue({
              code: 'custom',
              path: ['completedExecutions', index],
              message:
                'Completed Recharge executions must retain exact candidate and recovery evidence.'
            })
          }
        }
        validateCandidate(current, completed.length, ['currentCandidate'])
        for (const [index, candidate] of remaining.entries())
          validateCandidate(candidate, completed.length + index + 1, ['remainingCandidates', index])
      })
    )
)

export const turnDeathSavePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_TURN_DEATH_SAVE'),
      schemaVersion: z.literal(1),
      phase: z.literal('START_OF_TURN'),
      root: turnCoordinatorRootDtoSchema,
      candidate: turnDeathSaveCandidateDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.root.proposedTerminalTransition.currentActorId !== value.candidate.actorId) {
          context.addIssue({
            code: 'custom',
            path: ['candidate', 'actorId'],
            message: 'A death save belongs to the entering current actor.'
          })
        }
      })
    )
)

export const legendaryActionChoicePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE'),
      schemaVersion: z.literal(1),
      root: turnCoordinatorRootDtoSchema,
      selectionChecksum: checksumSchema,
      choice: legendaryActionChoiceGroupDtoSchema
    })
    .check(
      z.superRefine((value, refinement) => {
        if (checksumRuleDocument(value.choice) !== value.selectionChecksum) {
          refinement.addIssue({
            code: 'custom',
            path: ['selectionChecksum'],
            message: 'Legendary Action selection checksum must bind the exact frozen choice group.'
          })
        }
        if (value.root.commandType !== 'ADVANCE_TURN' || !value.root.outgoingTurn) {
          refinement.addIssue({
            code: 'custom',
            path: ['root'],
            message:
              'A Legendary Action choice must retain the completed outgoing ADVANCE_TURN phase.'
          })
        }
      })
    )
)

/**
 * Server-only evidence boundary of a selected Legendary Action, paused on one of its action's
 * requests: the owner's attack or damage dice, or a save its target rolls. The Kernel continuation
 * remains the only executable payload; this context retains the exact turn, selection and phase
 * pins needed to revalidate it on resume.
 */
export const legendaryActionEvidencePendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'),
      schemaVersion: z.literal(1),
      root: turnCoordinatorRootDtoSchema,
      choiceSelectionChecksum: checksumSchema,
      choice: legendaryActionChoiceGroupDtoSchema,
      selectionChecksum: checksumSchema,
      selectedOption: legendaryActionChoiceOptionDtoSchema,
      targetActorId: uuidSchema,
      /** The actor whose controllers answer this request: the owner, or the target for its save. */
      rollerActorId: uuidSchema,
      /** The request's d20 policy; null for a damage die. */
      d20Policy: z.nullable(z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)),
      twoPhase: z.nullable(z.lazy(() => directActionTwoPhaseDtoSchema))
    })
    .check(
      z.superRefine((value, refinement) => {
        if (checksumRuleDocument(value.choice) !== value.choiceSelectionChecksum) {
          refinement.addIssue({
            code: 'custom',
            path: ['choiceSelectionChecksum'],
            message: 'Legendary Action evidence must retain its exact issued choice group.'
          })
        }
        if (checksumRuleDocument(value.selectedOption) !== value.selectionChecksum) {
          refinement.addIssue({
            code: 'custom',
            path: ['selectionChecksum'],
            message: 'Legendary Action evidence must bind its exact selected option.'
          })
        }
        if (value.root.commandType !== 'ADVANCE_TURN' || !value.root.outgoingTurn) {
          refinement.addIssue({
            code: 'custom',
            path: ['root'],
            message:
              'Legendary Action evidence must retain the completed outgoing ADVANCE_TURN phase.'
          })
        }
        if (
          value.choice.options.find(
            (option) => option.optionId === value.selectedOption.optionId
          ) === undefined ||
          !value.selectedOption.targetActorIds.includes(value.targetActorId) ||
          (value.rollerActorId !== value.selectedOption.ownerActorId &&
            value.rollerActorId !== value.targetActorId)
        ) {
          refinement.addIssue({
            code: 'custom',
            path: ['selectedOption'],
            message: 'Legendary Action evidence must select one exact issued option.'
          })
        }
      })
    )
)
