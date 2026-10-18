import { z, lazySchema } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { movementReactionTimelineDtoSchema } from './reaction.js'
import { spatialMovementExecutionDtoSchema } from './ruleExecutionEffectEvidence.js'
import { MAX_SPATIAL_CANDIDATES } from './spatialFacts.js'
import { encounterActionHeldD20DtoSchema } from './encounterActionPending.js'
import {
  serverRuleExecutionD20BeliefDtoSchema,
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema
} from './ruleExecutionEvidence.js'
import { movementReactionActionExecutionDtoSchema } from './ruleExecutionMovementReactionReceipts.js'
import {
  directActionTwoPhaseDtoSchema,
  encounterConcentrationDamageCheckPendingContextDtoSchema,
  encounterLegendaryResistancePinDtoSchema,
  validateEncounterLegendaryResistancePin
} from './ruleExecutionDirectActionPendingContexts.js'
import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'
import { storedRuleExecutionResultDtoSchema } from './ruleExecutionResults.js'
import {
  compareSpatialPendingCandidates,
  spatialMovementPendingRootDtoSchema,
  spatialPathPointAtDistance,
  spatialPendingCandidateDtoSchema,
  spatialPointEquals,
  validateSpatialMovementPendingRoot
} from './ruleExecutionSpatial.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

export const spatialPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_SPATIAL_MOVEMENT'),
      schemaVersion: z.literal(1),
      root: spatialMovementPendingRootDtoSchema,
      selectionChecksum: checksumSchema,
      completedExecutions: z
        .array(z.lazy(() => spatialMovementExecutionDtoSchema))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      currentCandidate: spatialPendingCandidateDtoSchema,
      remainingCandidates: z
        .array(spatialPendingCandidateDtoSchema)
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES))
    })
    .check(
      z.superRefine((value, context) => {
        validateSpatialMovementPendingRoot(value.root, context, ['root'])

        const candidateKeys = new Set<string>()
        const all = [
          ...value.completedExecutions.map((execution) => execution.candidate),
          value.currentCandidate,
          ...value.remainingCandidates
        ]
        for (const [index, candidate] of all.entries()) {
          const key = `${candidate.candidate.effectId}:${candidate.candidate.targetActorId}:${candidate.candidate.trigger}:${candidate.candidate.step ?? 0}`
          if (candidateKeys.has(key))
            context.addIssue({
              code: 'custom',
              path: ['currentCandidate'],
              message:
                'Spatial candidates must be unique across completed, current, and remaining sets.'
            })
          candidateKeys.add(key)
          const pathContact = spatialPathPointAtDistance(
            value.root.originalPath,
            candidate.candidate.pathDistance
          )
          if (pathContact === null || !spatialPointEquals(pathContact, candidate.candidate.contact))
            context.addIssue({
              code: 'custom',
              path: ['currentCandidate', 'candidate', 'contact'],
              message: 'Spatial candidate path distance must resolve on the authoritative path.'
            })
          if (index > 0 && compareSpatialPendingCandidates(all[index - 1]!, candidate) >= 0)
            context.addIssue({
              code: 'custom',
              path: ['remainingCandidates'],
              message: 'Spatial candidates must retain strict canonical path-contact order.'
            })
        }
        const currentOrdinal = value.currentCandidate.ordinal
        for (const [index, execution] of value.completedExecutions.entries()) {
          if (execution.ordinal !== index || execution.ordinal >= currentOrdinal)
            context.addIssue({
              code: 'custom',
              path: ['completedExecutions', index],
              message:
                'Completed spatial executions must be the contiguous prefix before the current candidate.'
            })
          if (execution.candidate.candidate.pathDistance > value.root.pathStartDistance + 1e-8)
            context.addIssue({
              code: 'custom',
              path: ['completedExecutions', index, 'candidate', 'candidate', 'pathDistance'],
              message: 'Completed spatial executions may not follow the committed path position.'
            })
        }
        if (currentOrdinal !== value.completedExecutions.length)
          context.addIssue({
            code: 'custom',
            path: ['currentCandidate', 'ordinal'],
            message:
              'Current spatial candidate must immediately follow completed execution ordinals.'
          })
        if (
          Math.abs(value.currentCandidate.candidate.pathDistance - value.root.pathStartDistance) >
            1e-8 ||
          !spatialPointEquals(value.currentCandidate.candidate.contact, value.root.currentPosition)
        )
          context.addIssue({
            code: 'custom',
            path: ['currentCandidate', 'candidate'],
            message:
              'The pending spatial candidate must begin at the committed current path position.'
          })
        for (const [index, candidate] of value.remainingCandidates.entries())
          if (
            candidate.ordinal !== currentOrdinal + index + 1 ||
            candidate.candidate.pathDistance + 1e-8 < value.root.pathStartDistance
          )
            context.addIssue({
              code: 'custom',
              path: ['remainingCandidates', index, 'ordinal'],
              message:
                'Remaining spatial candidates must form the contiguous suffix at or after the committed contact.'
            })
      })
    )
)

const movementReactionPendingPhaseDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('SPATIAL_EVIDENCE'),
      currentCandidate: spatialPendingCandidateDtoSchema
    }),
    z.strictObject({ kind: z.literal('CHOICE') }),
    z.strictObject({
      kind: z.literal('CONCENTRATION_EVIDENCE'),
      damageSource: z.strictObject({
        kind: z.enum(['SPATIAL', 'REACTION']),
        executionOrdinal: nonNegativeIntegerSchema
      }),
      concentration: encounterConcentrationDamageCheckPendingContextDtoSchema
    }),
    z.strictObject({
      kind: z.literal('ACTION_EVIDENCE'),
      selectedOptionId: checksumSchema,
      /** The actor whose roll this is: the reactor's attack or the mover's save. */
      rollerActorId: uuidSchema,
      maintenanceCurrentnessChecksum: z.optional(checksumSchema),
      d20Policy: z.nullable(z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)),
      /** The mode the roller's own facts imply, shown at the roll prompt (ATTACK-10.4). */
      d20Belief: z.optional(serverRuleExecutionD20BeliefDtoSchema),
      /** The d20 a roller already entered while the server waits for one more to settle the true mode. */
      heldD20: z.optional(encounterActionHeldD20DtoSchema),
      twoPhase: z.optional(z.nullable(z.lazy(() => directActionTwoPhaseDtoSchema)))
    }),
    z.strictObject({
      kind: z.literal('LEGENDARY_RESISTANCE_CHOICE'),
      selectedOptionId: checksumSchema,
      originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema),
      originalExecutionChecksum: checksumSchema,
      targetStateChecksum: checksumSchema,
      maintenanceCurrentnessChecksum: z.optional(checksumSchema),
      resistance: encounterLegendaryResistancePinDtoSchema
    })
  ])
)

export const movementReactionPendingContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('ENCOUNTER_MOVEMENT_REACTION'),
      schemaVersion: z.literal(1),
      root: spatialMovementPendingRootDtoSchema,
      spatialSelectionChecksum: checksumSchema,
      spatialCurrentnessChecksum: checksumSchema,
      reactionSelectionChecksum: checksumSchema,
      completedSpatialExecutions: z
        .array(z.lazy(() => spatialMovementExecutionDtoSchema))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      /** Exact aggregate/effect transition evidence already committed before a reaction boundary. */
      appliedSpatialPrefix: z._default(
        z.nullable(z.lazy(() => storedRuleExecutionResultDtoSchema)),
        null
      ),
      completedReactionExecutions: z._default(
        z.array(movementReactionActionExecutionDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      ),
      phase: movementReactionPendingPhaseDtoSchema,
      remainingSpatialCandidates: z
        .array(spatialPendingCandidateDtoSchema)
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      reactionTimeline: movementReactionTimelineDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        validateSpatialMovementPendingRoot(value.root, context, ['root'])
        const currentEntry = value.reactionTimeline[0]
        const allowsEmptyTimeline =
          value.phase.kind === 'CONCENTRATION_EVIDENCE' ||
          (value.phase.kind === 'SPATIAL_EVIDENCE' &&
            value.appliedSpatialPrefix !== null &&
            value.appliedSpatialPrefix.status === 'BATCH_COMPLETE' &&
            value.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
        if (!currentEntry && !allowsEmptyTimeline) {
          context.addIssue({
            code: 'custom',
            path: ['reactionTimeline'],
            message: 'Movement reaction decision phases require one next frozen reaction entry.'
          })
          return
        }
        const currentOption = currentEntry ? currentEntry.group.options[0]! : null
        const currentOptions = currentEntry?.group.options ?? []
        const phaseDistance =
          (value.phase.kind === 'SPATIAL_EVIDENCE'
            ? value.phase.currentCandidate.candidate.pathDistance
            : value.phase.kind === 'CONCENTRATION_EVIDENCE'
              ? value.phase.damageSource.kind === 'SPATIAL'
                ? value.completedSpatialExecutions.at(-1)?.candidate.candidate.pathDistance
                : value.completedReactionExecutions.at(-1)?.option.candidate.pathDistance
              : currentOption!.candidate.pathDistance) ?? Number.NaN
        if (
          !Number.isFinite(phaseDistance) ||
          Math.abs(phaseDistance - value.root.pathStartDistance) > 1e-8
        )
          context.addIssue({
            code: 'custom',
            path: ['phase'],
            message: 'The pending movement phase must begin at the committed path position.'
          })
        if (
          value.phase.kind === 'SPATIAL_EVIDENCE' &&
          currentOption !== null &&
          value.phase.currentCandidate.candidate.pathDistance >
            currentOption.candidate.pathDistance + 1e-8
        )
          context.addIssue({
            code: 'custom',
            path: ['phase', 'currentCandidate'],
            message: 'Pending spatial evidence may not follow the next frozen reaction contact.'
          })
        if (
          value.phase.kind === 'ACTION_EVIDENCE' ||
          value.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
        ) {
          const selectedOptionId = value.phase.selectedOptionId
          if (!currentOptions.some((option) => option.optionId === selectedOptionId))
            context.addIssue({
              code: 'custom',
              path: ['phase', 'selectedOptionId'],
              message: 'Reaction action evidence must retain one exact issued choice option.'
            })
        }
        if (value.phase.kind === 'CONCENTRATION_EVIDENCE') {
          const execution =
            value.phase.damageSource.kind === 'SPATIAL'
              ? value.completedSpatialExecutions.at(-1)
              : value.completedReactionExecutions.at(-1)
          const applications =
            value.phase.damageSource.kind === 'SPATIAL'
              ? value.completedSpatialExecutions.at(-1)?.applications
              : (() => {
                  const application = value.completedReactionExecutions.at(-1)?.application
                  return application && 'applications' in application
                    ? application.applications
                    : undefined
                })()
          const envelope =
            execution &&
            (() => {
              const {
                concentrationChecks: _concentrationChecks,
                concentrationEnd: _concentrationEnd,
                ...damageEnvelope
              } = execution
              return damageEnvelope
            })()
          if (
            !execution ||
            execution.ordinal !== value.phase.damageSource.executionOrdinal ||
            !applications?.some(
              (application) => application.kind === 'DAMAGE' && application.appliedAmount > 0
            ) ||
            !envelope ||
            checksumRuleDocument(envelope) !==
              value.phase.concentration.finalizedDamageEnvelopeChecksum ||
            value.phase.concentration.parentCommandFingerprint !== value.root.commandFingerprint
          )
            context.addIssue({
              code: 'custom',
              path: ['phase'],
              message:
                'Concentration evidence must bind the final positive-damage movement execution and its sealed child continuation.'
            })
        }
        if (value.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE') {
          if (
            checksumRuleDocument(value.phase.originalExecution) !==
              value.phase.originalExecutionChecksum ||
            value.phase.originalD20.resultPath !== 'ON_SAVE_FAIL' ||
            value.phase.originalExecution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
            value.phase.resistance.poolBefore < value.phase.resistance.featureCost ||
            value.phase.resistance.poolRemaining !==
              value.phase.resistance.poolBefore - value.phase.resistance.featureCost
          )
            context.addIssue({
              code: 'custom',
              path: ['phase'],
              message:
                'Legendary Resistance must retain one exact failed-save action and available Feature cost.'
            })
          validateEncounterLegendaryResistancePin(value.phase.resistance, context, [
            'phase',
            'resistance'
          ])
        }
        if (checksumRuleDocument(value.reactionTimeline) !== value.reactionSelectionChecksum)
          context.addIssue({
            code: 'custom',
            path: ['reactionSelectionChecksum'],
            message: 'Reaction selection checksum must bind the exact frozen timeline suffix.'
          })
        value.completedReactionExecutions.forEach((execution, index) => {
          if (execution.ordinal !== index)
            context.addIssue({
              code: 'custom',
              path: ['completedReactionExecutions', index, 'ordinal'],
              message: 'Completed movement reactions must retain contiguous canonical order.'
            })
        })
        for (const [index, execution] of value.completedSpatialExecutions.entries()) {
          if (
            execution.ordinal !== index ||
            execution.candidate.candidate.pathDistance > phaseDistance + 1e-8
          )
            context.addIssue({
              code: 'custom',
              path: ['completedSpatialExecutions', index],
              message:
                'Completed spatial executions must be the contiguous prefix through the reaction contact.'
            })
        }
        if (value.appliedSpatialPrefix !== null) {
          const prefix = value.appliedSpatialPrefix
          if (
            prefix.status !== 'BATCH_COMPLETE' ||
            prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT' ||
            JSON.stringify(prefix.executions) !==
              JSON.stringify(
                value.phase.kind === 'SPATIAL_EVIDENCE'
                  ? value.completedSpatialExecutions.slice(0, prefix.executions.length)
                  : value.completedSpatialExecutions
              )
          ) {
            context.addIssue({
              code: 'custom',
              path: ['appliedSpatialPrefix'],
              message:
                'Applied spatial prefix evidence must exactly cover the committed execution prefix.'
            })
          }
        }
        const spatialOrdinalOffset = value.phase.kind === 'SPATIAL_EVIDENCE' ? 1 : 0
        if (
          value.phase.kind === 'SPATIAL_EVIDENCE' &&
          value.phase.currentCandidate.ordinal !== value.completedSpatialExecutions.length
        )
          context.addIssue({
            code: 'custom',
            path: ['phase', 'currentCandidate', 'ordinal'],
            message: 'Pending spatial evidence must immediately follow the completed prefix.'
          })
        let priorSpatial: z.infer<typeof spatialPendingCandidateDtoSchema> | null =
          value.phase.kind === 'SPATIAL_EVIDENCE'
            ? value.phase.currentCandidate
            : value.phase.kind === 'CONCENTRATION_EVIDENCE' &&
                value.phase.damageSource.kind === 'SPATIAL'
              ? (value.completedSpatialExecutions.at(-1)?.candidate ?? null)
              : null
        for (const [index, candidate] of value.remainingSpatialCandidates.entries()) {
          if (
            candidate.ordinal !==
              value.completedSpatialExecutions.length + spatialOrdinalOffset + index ||
            (value.phase.kind === 'CONCENTRATION_EVIDENCE'
              ? value.phase.damageSource.kind === 'SPATIAL'
                ? candidate.candidate.pathDistance + 1e-8 < value.root.pathStartDistance
                : candidate.candidate.pathDistance <= value.root.pathStartDistance + 1e-8
              : value.phase.kind !== 'SPATIAL_EVIDENCE' &&
                candidate.candidate.pathDistance <= currentOption!.candidate.pathDistance + 1e-8) ||
            (priorSpatial !== null && compareSpatialPendingCandidates(priorSpatial, candidate) >= 0)
          )
            context.addIssue({
              code: 'custom',
              path: ['remainingSpatialCandidates', index],
              message:
                'Remaining spatial candidates must be the strict canonical suffix after same-contact spatial resolution.'
            })
          priorSpatial = candidate
        }
      })
    )
)
