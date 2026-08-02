import { z } from 'zod'

import { applyGrantDtoSchema } from './applyGrant.js'
import { commandManifestDtoSchema } from './commandManifest.js'
import { conditionDtoSchema } from './condition.js'
import { damageDtoSchema } from './damage.js'
import { forcedMovementDtoSchema } from './forcedMovement.js'
import { healDtoSchema } from './heal.js'
import { manifestDtoSchema } from './manifest.js'
import { moveManifestDtoSchema } from './moveManifest.js'
import { manualAdjudicationDtoSchema } from './manualAdjudication.js'
import { targetingDtoSchema } from './targeting.js'
import { teleportDtoSchema } from './teleport.js'
import { durationDtoSchema } from '../shared/duration.js'
import {
  pathCodeSchema,
  pathGroupTypeSchema,
  pathLifecycleConsumeEventSchema,
  pathLifecycleEndEventSchema,
  pathLifecycleRecurringKindSchema,
  pathOriginKindSchema,
  pathRollTableKindSchema
} from '../shared/enums.js'
import { rangeDtoSchema } from '../shared/range.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

const createOutcomePayloadDtoSchema = ({ includeManifest }: { includeManifest: boolean }) =>
  z.union(
    includeManifest
      ? [
          damageDtoSchema,
          conditionDtoSchema,
          healDtoSchema,
          applyGrantDtoSchema,
          forcedMovementDtoSchema,
          teleportDtoSchema,
          z.lazy(() => manifestDtoSchema),
          moveManifestDtoSchema,
          commandManifestDtoSchema,
          manualAdjudicationDtoSchema
        ]
      : [
          damageDtoSchema,
          conditionDtoSchema,
          healDtoSchema,
          applyGrantDtoSchema,
          forcedMovementDtoSchema,
          teleportDtoSchema,
          moveManifestDtoSchema,
          commandManifestDtoSchema,
          manualAdjudicationDtoSchema
        ]
  )

export const pathLifecycleDtoSchema = z.object({
  recurringKind: pathLifecycleRecurringKindSchema.optional(),
  consumeOnFirstEvent: pathLifecycleConsumeEventSchema.optional(),
  endOnEvents: authoredReferenceCollectionSchema(pathLifecycleEndEventSchema).optional()
})

const choiceOptionMetadataDtoSchema = z.object({
  label: authoredShortTextSchema,
  description: authoredRichTextSchema
})

const createResultBlockDtoSchema = (outcomePayloadDtoSchema: z.ZodTypeAny) =>
  z.object({
    id: authoredIdentifierSchema,
    resultKind: z.enum(['SINGLE', 'SEQUENCE']),
    duration: durationDtoSchema.optional(),
    lifecycle: pathLifecycleDtoSchema.optional(),
    outcomes: authoredNestedCollectionSchema(outcomePayloadDtoSchema)
  })

const createPathDtoSchema = (outcomePayloadDtoSchema: z.ZodTypeAny) => {
  const resultBlockDtoSchema: z.ZodTypeAny = z.lazy(() =>
    createResultBlockDtoSchema(outcomePayloadDtoSchema)
  )

  const choiceOptionDtoSchema = z.object({
    id: authoredIdentifierSchema,
    order: z.number().int(),
    groupType: z.literal(pathGroupTypeSchema.enum.CHOICE).optional(),
    ...choiceOptionMetadataDtoSchema.shape,
    resultBlock: resultBlockDtoSchema
  })

  const exactRollTableRowDtoSchema = z.object({
    id: authoredIdentifierSchema,
    order: z.number().int(),
    rollValue: z.number(),
    resultBlock: resultBlockDtoSchema
  })

  const rangeRollTableRowDtoSchema = z.object({
    id: authoredIdentifierSchema,
    order: z.number().int(),
    rollRange: z.tuple([z.number(), z.number()]),
    resultBlock: resultBlockDtoSchema
  })

  return z
    .object({
      id: authoredIdentifierSchema,
      order: z.number().int(),
      pathCode: pathCodeSchema,
      groupType: pathGroupTypeSchema,
      originKind: pathOriginKindSchema.optional(),
      rangeOverride: rangeDtoSchema.optional(),
      targetingOverride: targetingDtoSchema.optional()
    })
    .and(
      z.union([
        z.object({
          selectionKind: z.literal('FIXED'),
          resultBlock: resultBlockDtoSchema
        }),
        z.object({
          selectionKind: z.literal('CHOICE'),
          options: authoredNestedCollectionSchema(choiceOptionDtoSchema)
        }),
        z.object({
          selectionKind: z.literal('ROLL_TABLE'),
          rollTableKind: z.literal(pathRollTableKindSchema.enum.EXACT),
          dieConfig: authoredIdentifierSchema,
          rows: authoredNestedCollectionSchema(exactRollTableRowDtoSchema)
        }),
        z.object({
          selectionKind: z.literal('ROLL_TABLE'),
          rollTableKind: z.literal(pathRollTableKindSchema.enum.RANGE),
          dieConfig: authoredIdentifierSchema,
          rows: authoredNestedCollectionSchema(rangeRollTableRowDtoSchema)
        })
      ])
    )
}

const outcomePayloadDtoSchema = createOutcomePayloadDtoSchema({
  includeManifest: true
})

const nonManifestOutcomePayloadDtoSchema = createOutcomePayloadDtoSchema({
  includeManifest: false
})

export const pathDtoSchema = createPathDtoSchema(outcomePayloadDtoSchema)
export const manifestBehaviorPathDtoSchema = createPathDtoSchema(nonManifestOutcomePayloadDtoSchema)

export type PathDto = z.infer<typeof pathDtoSchema>
