import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { serverMovementRuleExecutionPendingSnapshotDtoSchema } from '../shared/ruleExecutionPendingSnapshots.js'
import {
  encounterSpatialMovementBatchRuleExecutionResultDtoSchema,
  movementCompleteRuleExecutionResultDtoSchema
} from '../shared/ruleExecutionSpatialResults.js'
import { spatialPointDtoSchema } from '../shared/spatialFacts.js'
import { spatialMovementPendingRootDtoSchema } from '../shared/ruleExecutionSpatial.js'
import { projectionChecksumSchema } from './identity.js'

const nonnegativeIntegerSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

export const sceneSpatialPreparationSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    expectedEncounterVersion: nonnegativeIntegerSchema,
    occurrenceId: postgresUuidSchema,
    occurredAt: z.iso.datetime(),
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
              (pending.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' &&
                pending.movementContinuation !== null &&
                pending.movementContinuation !== undefined)
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
