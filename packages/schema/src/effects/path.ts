import { z, convexOpaqueSchema, lazySchema } from '../zod.js'

import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { effectOffersDtoSchema } from './effectOffer.js'
import { grantedActionsDtoSchema } from './grantedAction.js'
import { applyGrantDtoSchema } from './applyGrant.js'
import { conditionDtoSchema } from './condition.js'
import { damageDtoSchema } from './damage.js'
import { hitPointMaximumReductionDtoSchema } from './hitPointMaximumReduction.js'
import { scalarReductionDtoSchema } from './scalarReduction.js'
import { forcedMovementDtoSchema } from './forcedMovement.js'
import { createFollowUpSaveDtoSchema, failureMarginRiderDtoSchema } from './followUpSave.js'
import { resultBlockGateDtoSchema } from './resultBlockGate.js'
import { createFollowUpCheckDtoSchema } from './followUpCheck.js'
import { healDtoSchema } from './heal.js'
import { manifestDtoSchema } from './manifest.js'
import { manualAdjudicationDtoSchema } from './manualAdjudication.js'
import { movementRuleDtoSchema } from './movementRule.js'
import { actionEconomyRuleDtoSchema } from './actionEconomyRule.js'
import { stabilizeDtoSchema } from './stabilize.js'
import { killDtoSchema } from './kill.js'
import { reviveDtoSchema } from './revive.js'
import { armorClassFloorDtoSchema } from './armorClassFloor.js'
import { restoreResourceDtoSchema } from './restoreResource.js'
import { telepathicLinkDtoSchema } from './telepathicLink.js'
import { plantPortalDtoSchema } from './plantPortal.js'
import { treeStrideDtoSchema } from './treeStride.js'
import { closedRuleDtoSchema } from './closedRule.js'
import { actorRelationshipDtoSchema } from './actorRelationship.js'
import { activationDtoSchema } from './activation.js'
import { checkChoiceDtoSchema, heldEscapeDcDtoSchema } from './check.js'
import { concealFromObserversDtoSchema } from './concealFromObservers.js'
import { removeFromPlayDtoSchema } from './removeFromPlay.js'
import { detectConcealedDtoSchema } from './detectConcealed.js'
import { cancelTriggeringEventDtoSchema } from './cancelTriggeringEvent.js'
import { sourceImmunityDtoSchema } from './sourceImmunity.js'
import { releaseChosenItemDtoSchema } from './releaseChosenItem.js'
import { endEffectsDtoSchema } from './endEffects.js'
import { degradeEquipmentDtoSchema } from './degradeEquipment.js'
import { targetingDtoSchema } from './targeting.js'
import { teleportDtoSchema } from './teleport.js'
import { durationDtoSchema } from '../shared/duration.js'
import { activeEffectUsesSchema } from '../shared/activeRuleEffectLifecycle.js'
import {
  activationCodeSchema,
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema,
  pathCodeSchema,
  pathGroupTypeSchema,
  pathLifecycleConsumeEventSchema,
  pathLifecycleEndEventSchema,
  pathLifecycleRecurringKindSchema,
  pathLifecycleTurnActorSchema,
  pathLifecycleTurnBoundarySchema,
  pathOriginKindSchema,
  pathRollTableKindSchema,
  pathUsageSchema
} from '../shared/enums.js'
import { facetDtoSchema } from '../shared/facet.js'
import { rangeDtoSchema } from '../shared/range.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { damageTypeFilterDtoSchema, pathLifecycleEndTriggersDtoSchema } from '../shared/reaction.js'
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
            createFollowUpSaveDtoSchema(outcomePayloadDtoSchema),
            createFollowUpCheckDtoSchema(outcomePayloadDtoSchema),
            movementRuleDtoSchema,
            actionEconomyRuleDtoSchema,
            stabilizeDtoSchema,
            killDtoSchema,
            reviveDtoSchema,
            armorClassFloorDtoSchema,
            restoreResourceDtoSchema,
            telepathicLinkDtoSchema,
            plantPortalDtoSchema,
            treeStrideDtoSchema,
            actorRelationshipDtoSchema,
            concealFromObserversDtoSchema,
            removeFromPlayDtoSchema,
            detectConcealedDtoSchema,
            cancelTriggeringEventDtoSchema,
            sourceImmunityDtoSchema,
            releaseChosenItemDtoSchema,
            endEffectsDtoSchema,
            degradeEquipmentDtoSchema
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
            createFollowUpSaveDtoSchema(outcomePayloadDtoSchema),
            createFollowUpCheckDtoSchema(outcomePayloadDtoSchema),
            movementRuleDtoSchema,
            actionEconomyRuleDtoSchema,
            stabilizeDtoSchema,
            killDtoSchema,
            reviveDtoSchema,
            armorClassFloorDtoSchema,
            restoreResourceDtoSchema,
            telepathicLinkDtoSchema,
            plantPortalDtoSchema,
            treeStrideDtoSchema,
            actorRelationshipDtoSchema,
            concealFromObserversDtoSchema,
            removeFromPlayDtoSchema,
            detectConcealedDtoSchema,
            cancelTriggeringEventDtoSchema,
            sourceImmunityDtoSchema,
            releaseChosenItemDtoSchema,
            endEffectsDtoSchema,
            degradeEquipmentDtoSchema
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
    endOnEvents: z.optional(authoredReferenceCollectionSchema(pathLifecycleEndEventSchema)),
    endOnTriggers: z.optional(pathLifecycleEndTriggersDtoSchema),
    /** Condition type ids; the effect ends early while its holder has any of them. */
    endOnConditionIds: z.optional(authoredReferenceCollectionSchema(postgresUuidSchema)),
    /** The holder may end the effect themselves, at the cost of this activation. */
    holderEnd: z.optional(z.strictObject({ activation: activationCodeSchema })),
    /** See `PathLifecycleAuthored.fromSourceOnly`. */
    fromSourceOnly: z.optional(z.boolean()),
    /** See `PathLifecycleAuthored.uses`. */
    uses: z.optional(activeEffectUsesSchema),
    /** See `PathLifecycleAuthored.activeOnlyOnFinalAnchorTurn`. */
    activeOnlyOnFinalAnchorTurn: z.optional(z.boolean()),
    /** The zone holds the condition (D146); see `PathLifecycleAuthored.heldBySource`. */
    heldBySource: z.optional(z.boolean()),
    /** The check a creature the zone holds may make to free itself. */
    escape: z.optional(
      z.object({
        activation: activationDtoSchema,
        checks: checkChoiceDtoSchema,
        dc: heldEscapeDcDtoSchema
      })
    ),
    /** What the holder is left with when the effect ends; see `PathLifecycleAuthored.onEnd`. */
    onEnd: z.optional(
      z.object({
        turns: z.number().check(z.int()).check(z.gte(1)).check(z.lte(255)),
        modifiers: authoredNestedCollectionSchema(modifierGrantDtoSchema)
      })
    ),
    /** The d20 that gates the held outcomes each turn; see `PathLifecycleAuthored.turnEndGate`. */
    turnEndGate: z.optional(
      z.object({ minimumRoll: z.number().check(z.int()).check(z.gte(2)).check(z.lte(20)) })
    ),
    /** Actions the holder may take while the effect is held; see `PathLifecycleAuthored.grantedActions`. */
    grantedActions: z.optional(grantedActionsDtoSchema),
    /** Choices offered beside the holder's turns; see `PathLifecycleAuthored.effectOffers`. */
    effectOffers: z.optional(effectOffersDtoSchema)
  })
)

/** See `PathChosenItemAuthored`. */
export const pathChosenItemDtoSchema = lazySchema(() =>
  z.strictObject({
    category: z.optional(equipmentCategoryCodeSchema),
    requiredProperties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)),
    excludedProperties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)),
    equipmentIds: z.optional(authoredReferenceCollectionSchema(postgresUuidSchema))
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
    failureMarginRider: z.optional(failureMarginRiderDtoSchema),
    gate: z.optional(resultBlockGateDtoSchema),
    suppressedByDamageTypeIds: z.optional(damageTypeFilterDtoSchema),
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

  const hitPointTierRowDtoSchema = z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    atMost: z.number().check(z.int()).check(z.gte(1)),
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
      restrictions: z.optional(facetDtoSchema),
      usage: z.optional(pathUsageSchema),
      rangeOverride: z.optional(rangeDtoSchema),
      targetingOverride: z.optional(targetingDtoSchema),
      chosenItem: z.optional(pathChosenItemDtoSchema)
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
        selectionKind: z.literal('HIT_POINT_TIERS'),
        rows: authoredNestedCollectionSchema(hitPointTierRowDtoSchema)
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

export const pathDtoSchema = lazySchema(() =>
  convexOpaqueSchema(createPathDtoSchema(outcomePayloadDtoSchema))
)
export const manifestBehaviorPathDtoSchema = lazySchema(() =>
  createPathDtoSchema(nonManifestOutcomePayloadDtoSchema)
)

export type PathDto = z.infer<typeof pathDtoSchema>
