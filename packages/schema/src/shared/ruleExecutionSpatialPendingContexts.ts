import { z, lazySchema } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import { encounterReactionChildrenDtoSchema } from './encounterActionPending.js'
import { movementReactionTimelineDtoSchema } from './reaction.js'
import { spatialMovementExecutionDtoSchema } from './ruleExecutionEffectEvidence.js'
import { MAX_SPATIAL_CANDIDATES } from './spatialFacts.js'
import {
  encounterConcentrationDamageCheckPendingContextDtoSchema,
  encounterEffectRepeatSavePendingContextDtoSchema
} from './ruleExecutionDirectActionPendingContexts.js'
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
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema
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
    z.strictObject({
      kind: z.literal('CHOICE'),
      /**
       * The child actions of the reactions chosen against this move at its current contact (D219).
       * While one is recorded the choice is answered: the move takes only the room's resume.
       */
      reactionChildren: z.optional(encounterReactionChildrenDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('CONCENTRATION_EVIDENCE'),
      /** The spatial contact whose damage owes the Concentration check. */
      damageSource: z.strictObject({ executionOrdinal: nonNegativeIntegerSchema }),
      concentration: encounterConcentrationDamageCheckPendingContextDtoSchema
    }),
    z.strictObject({
      kind: z.literal('REPEAT_SAVE_EVIDENCE'),
      /** The spatial contact whose damage owes the effect repeat save (D167). */
      damageSource: z.strictObject({ executionOrdinal: nonNegativeIntegerSchema }),
      repeatSave: encounterEffectRepeatSavePendingContextDtoSchema
    })
  ])
)

/** The sealed damage-save child a pending move waits on, whichever save its contact owes next. */
export function movementPendingDamageSave(
  phase: z.infer<typeof movementReactionPendingPhaseDtoSchema>
) {
  return phase.kind === 'CONCENTRATION_EVIDENCE'
    ? { damageSource: phase.damageSource, context: phase.concentration }
    : phase.kind === 'REPEAT_SAVE_EVIDENCE'
      ? { damageSource: phase.damageSource, context: phase.repeatSave }
      : null
}

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
        const damageSave = movementPendingDamageSave(value.phase)
        const allowsEmptyTimeline =
          damageSave !== null ||
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
        const phaseDistance =
          (value.phase.kind === 'SPATIAL_EVIDENCE'
            ? value.phase.currentCandidate.candidate.pathDistance
            : damageSave !== null
              ? value.completedSpatialExecutions.at(-1)?.candidate.candidate.pathDistance
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
        if (damageSave !== null) {
          const execution = value.completedSpatialExecutions.at(-1)
          const applications = execution?.applications
          const envelope =
            execution &&
            (() => {
              const {
                concentrationChecks: _concentrationChecks,
                concentrationEnds: _concentrationEnds,
                repeatSaves: _repeatSaves,
                ...damageEnvelope
              } = execution
              return damageEnvelope
            })()
          if (
            !execution ||
            execution.ordinal !== damageSave.damageSource.executionOrdinal ||
            !applications?.some(
              (application) => application.kind === 'DAMAGE' && application.appliedAmount > 0
            ) ||
            !envelope ||
            checksumRuleDocument(envelope) !== damageSave.context.finalizedDamageEnvelopeChecksum ||
            damageSave.context.parentCommandFingerprint !== value.root.commandFingerprint
          )
            context.addIssue({
              code: 'custom',
              path: ['phase'],
              message:
                'Damage-save evidence must bind the final positive-damage movement execution and its sealed child continuation.'
            })
        }
        if (checksumRuleDocument(value.reactionTimeline) !== value.reactionSelectionChecksum)
          context.addIssue({
            code: 'custom',
            path: ['reactionSelectionChecksum'],
            message: 'Reaction selection checksum must bind the exact frozen timeline suffix.'
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
            : damageSave !== null
              ? (value.completedSpatialExecutions.at(-1)?.candidate ?? null)
              : null
        for (const [index, candidate] of value.remainingSpatialCandidates.entries()) {
          if (
            candidate.ordinal !==
              value.completedSpatialExecutions.length + spatialOrdinalOffset + index ||
            (damageSave !== null
              ? candidate.candidate.pathDistance + 1e-8 < value.root.pathStartDistance
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
