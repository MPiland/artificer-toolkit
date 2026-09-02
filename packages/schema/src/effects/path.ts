import { z } from 'zod'

import { applyGrantDtoSchema } from './applyGrant.js'
import { commandManifestDtoSchema } from './commandManifest.js'
import { conditionDtoSchema } from './condition.js'
import { damageDtoSchema } from './damage.js'
import { hitPointMaximumReductionDtoSchema } from './hitPointMaximumReduction.js'
import { scalarReductionDtoSchema } from './scalarReduction.js'
import { forcedMovementDtoSchema } from './forcedMovement.js'
import { createFollowUpSaveDtoSchema } from './followUpSave.js'
import { createFollowUpCheckDtoSchema } from './followUpCheck.js'
import { healDtoSchema } from './heal.js'
import { manifestDtoSchema } from './manifest.js'
import { moveManifestDtoSchema } from './moveManifest.js'
import { manualAdjudicationDtoSchema } from './manualAdjudication.js'
import { movementRuleDtoSchema } from './movementRule.js'
import { actionEconomyRuleDtoSchema } from './actionEconomyRule.js'
import { stabilizeDtoSchema } from './stabilize.js'
import { armorClassFloorDtoSchema } from './armorClassFloor.js'
import { telepathicLinkDtoSchema } from './telepathicLink.js'
import { plantPortalDtoSchema } from './plantPortal.js'
import { treeStrideDtoSchema } from './treeStride.js'
import { closedRuleDtoSchema } from './closedRule.js'
import { actorRelationshipDtoSchema } from './actorRelationship.js'
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
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'

const createOutcomePayloadDtoSchema = ({ includeManifest }: { includeManifest: boolean }) => {
  const outcomePayloadDtoSchema: z.ZodTypeAny = z.lazy(() =>
    z.union(
      includeManifest
        ? [
            damageDtoSchema,
            hitPointMaximumReductionDtoSchema,
            scalarReductionDtoSchema,
            conditionDtoSchema,
            healDtoSchema,
            applyGrantDtoSchema,
            forcedMovementDtoSchema,
            teleportDtoSchema,
            z.lazy(() => manifestDtoSchema),
            moveManifestDtoSchema,
            commandManifestDtoSchema,
            createFollowUpSaveDtoSchema(outcomePayloadDtoSchema),
            createFollowUpCheckDtoSchema(outcomePayloadDtoSchema),
            movementRuleDtoSchema,
            actionEconomyRuleDtoSchema,
            stabilizeDtoSchema,
            armorClassFloorDtoSchema,
            telepathicLinkDtoSchema,
            plantPortalDtoSchema,
            treeStrideDtoSchema,
            actorRelationshipDtoSchema,
            closedRuleDtoSchema,
            manualAdjudicationDtoSchema
          ]
        : [
            damageDtoSchema,
            hitPointMaximumReductionDtoSchema,
            scalarReductionDtoSchema,
            conditionDtoSchema,
            healDtoSchema,
            applyGrantDtoSchema,
            forcedMovementDtoSchema,
            teleportDtoSchema,
            moveManifestDtoSchema,
            commandManifestDtoSchema,
            createFollowUpSaveDtoSchema(outcomePayloadDtoSchema),
            createFollowUpCheckDtoSchema(outcomePayloadDtoSchema),
            movementRuleDtoSchema,
            actionEconomyRuleDtoSchema,
            stabilizeDtoSchema,
            armorClassFloorDtoSchema,
            telepathicLinkDtoSchema,
            plantPortalDtoSchema,
            treeStrideDtoSchema,
            actorRelationshipDtoSchema,
            closedRuleDtoSchema,
            manualAdjudicationDtoSchema
          ]
    )
  )

  return outcomePayloadDtoSchema
}

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
    maintenanceDefinitionId: postgresUuidSchema.optional(),
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

  const rollTableRowResolutionDtoSchema = z.discriminatedUnion('resolutionKind', [
    z.object({
      resolutionKind: z.literal('RESULT'),
      resultBlock: resultBlockDtoSchema
    }),
    z.object({
      resolutionKind: z.literal('REPEAT_TABLE'),
      repeat: z.object({
        count: z.number().int().min(1).max(100),
        rerollValues: authoredNestedCollectionSchema(
          z.object({
            id: authoredIdentifierSchema,
            order: z.number().int(),
            value: z.number().int()
          })
        )
      })
    })
  ])

  const exactRollTableRowDtoSchema = z
    .object({
      id: authoredIdentifierSchema,
      order: z.number().int(),
      rollValue: z.number()
    })
    .and(rollTableRowResolutionDtoSchema)

  const rangeRollTableRowDtoSchema = z
    .object({
      id: authoredIdentifierSchema,
      order: z.number().int(),
      rollRange: z.tuple([z.number(), z.number()])
    })
    .and(rollTableRowResolutionDtoSchema)

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
