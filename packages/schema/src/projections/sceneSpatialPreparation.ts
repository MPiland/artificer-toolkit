import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { serverMovementRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import {
  encounterSpatialMovementBatchRuleExecutionResultDtoSchema,
  movementCompleteRuleExecutionResultDtoSchema
} from '../shared/ruleExecutionSpatialResults.js'
import { MAX_SPATIAL_CANDIDATES, spatialPointDtoSchema } from '../shared/spatialFacts.js'
import { spatialMovementPendingRootDtoSchema } from '../shared/ruleExecutionSpatial.js'
import { projectionChecksumSchema } from './identity.js'

/** A Scene delta batch holds the mover's move and one move for each token it drags. */
const MAX_DRAGGED_TOKENS = 101

const nonnegativeIntegerSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

export const sceneSpatialPreparationSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    expectedEncounterVersion: nonnegativeIntegerSchema,
    occurrenceId: postgresUuidSchema,
    occurredAt: z.iso.datetime(),
    /**
     * The tokens a grappler's move drags along its published displacement (D105), each from where
     * it stood to where it lands; absent when the move drags nothing.
     */
    draggedTokens: z.optional(
      z
        .array(
          z.strictObject({
            tokenId: postgresUuidSchema,
            from: spatialPointDtoSchema,
            to: spatialPointDtoSchema
          })
        )
        .check(z.minLength(1))
        .check(z.maxLength(MAX_DRAGGED_TOKENS))
    ),
    outcome: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('UNINTERRUPTED'),
        reason: z.enum(['MANUAL', 'NO_CANDIDATES'])
      }),
      z.strictObject({
        kind: z.literal('TERMINAL'),
        result: z.union([
          encounterSpatialMovementBatchRuleExecutionResultDtoSchema,
          movementCompleteRuleExecutionResultDtoSchema
        ]),
        selectionChecksum: projectionChecksumSchema,
        currentnessChecksum: projectionChecksumSchema,
        terminalPathDistance: z.optional(z.number().check(z.nonnegative())),
        /**
         * The zones holding a condition on the mover until it leaves their area that it left, in path
         * order; each settles as an `AREA_DEPARTURE` step (D146).
         */
        areaDepartures: z.optional(
          z
            .array(
              z.strictObject({
                zoneEffectId: postgresUuidSchema,
                holderActorId: postgresUuidSchema,
                pathDistance: z.number().check(z.nonnegative())
              })
            )
            .check(z.minLength(1))
            .check(z.maxLength(MAX_SPATIAL_CANDIDATES))
        ),
        /** The effects the mover held until it moved that this voluntary move ends, each a `MOVE_END` step. */
        moveEnds: z.optional(
          z
            .array(
              z.strictObject({ effectId: postgresUuidSchema, holderActorId: postgresUuidSchema })
            )
            .check(z.minLength(1))
            .check(z.maxLength(MAX_SPATIAL_CANDIDATES))
        ),
        resolutionCommands: z.optional(spatialMovementPendingRootDtoSchema.shape.resolutionCommands)
      }),
      z.strictObject({
        kind: z.literal('PENDING'),
        pendingSnapshot: serverMovementRuleExecutionPendingSnapshotDtoSchema.check(
          z.superRefine((snapshot, context) => {
            const pending = snapshot.applicationContext
            const allowed =
              pending.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
              pending.kind === 'ENCOUNTER_MOVEMENT_REACTION' ||
              pending.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' ||
              (pending.kind === 'ENCOUNTER_CONTEST_CHECK' &&
                pending.origin.kind === 'OPTIONAL_COMBAT' &&
                pending.origin.movementContinuation !== null &&
                pending.origin.movementContinuation !== undefined)
            if (!allowed)
              context.addIssue({
                code: 'custom',
                path: ['applicationContext'],
                message: 'Scene preparation requires a resumable movement pending context.'
              })
          })
        ),
        movementIntent: z.nullable(
          z.strictObject({
            tokenId: postgresUuidSchema,
            position: spatialPointDtoSchema
          })
        )
      })
    ])
  })
)

export type SceneSpatialPreparation = z.infer<typeof sceneSpatialPreparationSchema>
