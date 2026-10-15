import { z, lazySchema } from '../zod.js'

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
import { concealFromObserversDtoSchema } from './concealFromObservers.js'
import { detectConcealedDtoSchema } from './detectConcealed.js'
import { targetingDtoSchema } from './targeting.js'
import { teleportDtoSchema } from './teleport.js'
import { durationDtoSchema } from '../shared/duration.js'
import {
  pathCodeSchema,
  pathGroupTypeSchema,
  pathLifecycleConsumeEventSchema,
  pathLifecycleEndEventSchema,
  pathLifecycleRecurringKindSchema,
  pathLifecycleTurnActorSchema,
  pathLifecycleTurnBoundarySchema,
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
  const outcomePayloadDtoSchema: z.ZodMiniType = z.lazy(() =>
    // Common closed/manual leaves avoid failed parsing of the deeper recursive branches.
    z.union(
      includeManifest
        ? [
            closedRuleDtoSchema,
            manualAdjudicationDtoSchema,
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
            concealFromObserversDtoSchema,
            detectConcealedDtoSchema
          ]
        : [
            closedRuleDtoSchema,
            manualAdjudicationDtoSchema,
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
            concealFromObserversDtoSchema,
            detectConcealedDtoSchema
          ]
    )
  )

  return outcomePayloadDtoSchema
}

export const pathLifecycleDtoSchema = lazySchema(() =>
  z.object({
    recurringKind: z.optional(pathLifecycleRecurringKindSchema),
    turnAnchor: z.optional(
      z.strictObject({
        actor: pathLifecycleTurnActorSchema,
        boundary: pathLifecycleTurnBoundarySchema
      })
    ),
    consumeOnFirstEvents: z.optional(
      authoredReferenceCollectionSchema(pathLifecycleConsumeEventSchema)
    ),
    endOnEvents: z.optional(authoredReferenceCollectionSchema(pathLifecycleEndEventSchema))
  })
)

const choiceOptionMetadataDtoSchema = lazySchema(() =>
  z.object({
    label: authoredShortTextSchema,
    description: authoredRichTextSchema
  })
)

const createResultBlockDtoSchema = (outcomePayloadDtoSchema: z.ZodMiniType) =>
  z.object({
    id: authoredIdentifierSchema,
    resultKind: z.enum(['SINGLE', 'SEQUENCE']),
    maintenanceDefinitionId: z.optional(postgresUuidSchema),
    duration: z.optional(durationDtoSchema),
    lifecycle: z.optional(pathLifecycleDtoSchema),
    outcomes: authoredNestedCollectionSchema(outcomePayloadDtoSchema)
  })

const createPathDtoSchema = (outcomePayloadDtoSchema: z.ZodMiniType) => {
  const resultBlockDtoSchema: z.ZodMiniType = z.lazy(() =>
    createResultBlockDtoSchema(outcomePayloadDtoSchema)
  )

  const choiceOptionDtoSchema = z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    groupType: z.optional(z.literal(pathGroupTypeSchema._zod.def.entries.CHOICE)),
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
        count: z.number().check(z.int()).check(z.gte(1)).check(z.lte(100)),
        rerollValues: authoredNestedCollectionSchema(
          z.object({
            id: authoredIdentifierSchema,
            order: z.number().check(z.int()),
            value: z.number().check(z.int())
          })
        )
      })
    })
  ])

  const exactRollTableRowDtoSchema = z.intersection(
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      rollValue: z.number()
    }),
    rollTableRowResolutionDtoSchema
  )

  const rangeRollTableRowDtoSchema = z.intersection(
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      rollRange: z.tuple([z.number(), z.number()])
    }),
    rollTableRowResolutionDtoSchema
  )

  return z.intersection(
    z.object({
      id: authoredIdentifierSchema,
      order: z.number().check(z.int()),
      pathCode: pathCodeSchema,
      groupType: pathGroupTypeSchema,
      originKind: z.optional(pathOriginKindSchema),
      rangeOverride: z.optional(rangeDtoSchema),
      targetingOverride: z.optional(targetingDtoSchema)
    }),
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
        rollTableKind: z.literal(pathRollTableKindSchema._zod.def.entries.EXACT),
        dieConfig: authoredIdentifierSchema,
        rows: authoredNestedCollectionSchema(exactRollTableRowDtoSchema)
      }),
      z.object({
        selectionKind: z.literal('ROLL_TABLE'),
        rollTableKind: z.literal(pathRollTableKindSchema._zod.def.entries.RANGE),
        dieConfig: authoredIdentifierSchema,
        rows: authoredNestedCollectionSchema(rangeRollTableRowDtoSchema)
      })
    ])
  )
}

const outcomePayloadDtoSchema = lazySchema(() =>
  createOutcomePayloadDtoSchema({
    includeManifest: true
  })
)

const nonManifestOutcomePayloadDtoSchema = lazySchema(() =>
  createOutcomePayloadDtoSchema({
    includeManifest: false
  })
)

export const pathDtoSchema = lazySchema(() => createPathDtoSchema(outcomePayloadDtoSchema))
export const manifestBehaviorPathDtoSchema = lazySchema(() =>
  createPathDtoSchema(nonManifestOutcomePayloadDtoSchema)
)

export type PathDto = z.infer<typeof pathDtoSchema>
