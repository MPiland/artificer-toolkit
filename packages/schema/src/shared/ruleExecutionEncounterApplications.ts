import { z } from '../zod.js'
import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  compareConcentrationDamageApplications,
  concentrationCheckTriggerDtoSchema,
  concentrationMaintainedDamageApplicationDtoSchema
} from './ruleExecutionConcentration.js'

import {
  canonicalD20ContributorKey,
  compareCanonicalD20Contributors
} from '@artificer-toolkit/shared/rules/contributors'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { authoredIdentifierSchema } from './authoredLimits.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import {
  characterMechanicsApplicationDtoSchema,
  characterMechanicsResourceReceiptDtoSchema,
  characterMechanicsTargetStateDtoSchema,
  encounterActorActiveEffectCreateReceiptDtoSchema,
  encounterFeatureResourceReceiptDtoSchema,
  maintainedEffectTransitionDtoSchema,
  stateEffectCreateReceiptDtoSchema,
  validateMaintainedEffectCreation,
  validateStateEffectTransitions
} from './ruleExecutionMechanics.js'
import {
  canonicalConcentrationContributorsDtoSchema,
  receiptD20ContributorSchema,
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema
} from './ruleExecutionEvidence.js'
import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionCapabilityKeySchema as capabilityKeySchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionContractVersionSchema as contractVersionSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeIntegerSchema,
  ruleExecutionPortNameSchema as portNameSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionReceiptD20FaceSchema as receiptD20FaceSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

export const concentrationCheckApplicationOutputDtoSchema = z
  .strictObject({
    kind: z.literal('CONCENTRATION_CHECK'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    parentOccurrenceId: uuidSchema,
    concentrationDefinition: z.strictObject({
      id: uuidSchema,
      checksum: checksumSchema
    }),
    savingThrowAbilityDefinitionId: uuidSchema,
    systemVocabularySnapshot: z.strictObject({
      id: uuidSchema,
      version: integerSchema.check(z.gte(1)),
      checksum: checksumSchema
    }),
    targetCharacter: z.strictObject({
      streamVersion: aggregateVersionSchema,
      baseProjectionChecksum: checksumSchema,
      campaignOverlayChecksum: checksumSchema,
      mechanicalContextChecksum: checksumSchema
    }),
    application: concentrationMaintainedDamageApplicationDtoSchema,
    /** The context's display trigger, so every settled check can be logged without its context. */
    trigger: concentrationCheckTriggerDtoSchema,
    outcome: z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE']),
    d20: z
      .strictObject({
        requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
        /** The mode the faces were rolled with; `derivedRollMode` is the rules-derived one. */
        rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
        derivedRollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
        rawFaces: z
          .array(integerSchema.check(z.gte(1)).check(z.lte(20)))
          .check(z.minLength(1))
          .check(z.maxLength(2)),
        selectedNatural: integerSchema.check(z.gte(1)).check(z.lte(20)),
        modifier: integerSchema,
        total: integerSchema,
        dc: positiveIntegerSchema,
        contributors: canonicalConcentrationContributorsDtoSchema,
        contributorChecksum: checksumSchema
      })
      .check(
        z.superRefine((value, context) => {
          if (
            value.rawFaces.length !== (value.rollMode === 'NORMAL' ? 1 : 2) ||
            value.selectedNatural !==
              (value.rollMode === 'ADVANTAGE'
                ? Math.max(...value.rawFaces)
                : value.rollMode === 'DISADVANTAGE'
                  ? Math.min(...value.rawFaces)
                  : value.rawFaces[0]) ||
            value.total !== value.selectedNatural + value.modifier
          )
            context.addIssue({
              code: 'custom',
              path: ['rawFaces'],
              message: 'Concentration d20 evidence does not match its pinned roll mode.'
            })
        })
      ),
    contextChecksum: checksumSchema,
    cleanup: z.nullable(
      z.strictObject({
        maintainedStateId: uuidSchema,
        removedDependentEffectIds: z
          .array(uuidSchema)
          .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2)),
        characterOwnerTransitions: z
          .array(
            z.strictObject({
              characterId: uuidSchema,
              beforeStreamVersion: aggregateVersionSchema,
              afterStreamVersion: aggregateVersionSchema
            })
          )
          .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2))
      })
    ),
    nextOccurrenceId: z.nullable(uuidSchema),
    skipped: z
      .array(
        z.extend(concentrationMaintainedDamageApplicationDtoSchema, {
          reason: z.literal('MAINTAINED_STATE_ENDED')
        })
      )
      .check(z.maxLength(MAX_CONCENTRATION_DAMAGE_APPLICATIONS - 1))
  })
  .check(
    z.superRefine((value, context) => {
      if ((value.outcome === 'SAVE_FAILURE') !== (value.cleanup !== null))
        context.addIssue({
          code: 'custom',
          path: ['cleanup'],
          message: 'Concentration cleanup must occur exactly on a failed save.'
        })
      if (value.trigger.dc !== value.d20.dc)
        context.addIssue({
          code: 'custom',
          path: ['trigger', 'dc'],
          message: 'The Concentration trigger must name the checked DC.'
        })
      if (
        value.cleanup?.maintainedStateId !== undefined &&
        value.cleanup.maintainedStateId !== value.application.maintainedStateId
      )
        context.addIssue({
          code: 'custom',
          path: ['cleanup', 'maintainedStateId'],
          message: 'Concentration cleanup must target the checked maintained state.'
        })
      let prior = value.application
      for (const [index, skipped] of value.skipped.entries()) {
        if (compareConcentrationDamageApplications(skipped, prior) <= 0)
          context.addIssue({
            code: 'custom',
            path: ['skipped', index],
            message: 'Skipped concentration checks must use canonical application order.'
          })
        if (skipped.maintainedStateId !== value.application.maintainedStateId)
          context.addIssue({
            code: 'custom',
            path: ['skipped', index, 'maintainedStateId'],
            message: 'Only checks for the ended maintained state may be skipped.'
          })
        prior = skipped
      }
    })
  )

/** One committed Character equipment change: Disarm, or a shield stowed for an accepted attack. */
export const characterItemUseStateTransitionDtoSchema = z
  .strictObject({
    kind: z.literal('CHARACTER_ITEM_USE_STATE'),
    characterId: uuidSchema,
    itemInstanceId: uuidSchema,
    fromState: z.literal('EQUIPPED'),
    toState: z.literal('CARRIED'),
    beforeStreamVersion: aggregateVersionSchema,
    afterStreamVersion: aggregateVersionSchema,
    beforeStateChecksum: checksumSchema,
    afterStateChecksum: checksumSchema
  })
  .check(
    z.superRefine((value, context) => {
      if (
        value.afterStreamVersion !== value.beforeStreamVersion + 1 ||
        value.beforeStateChecksum === value.afterStateChecksum
      )
        context.addIssue({
          code: 'custom',
          message: 'Character item state transition is invalid.'
        })
    })
  )
export type CharacterItemUseStateTransitionDto = z.infer<
  typeof characterItemUseStateTransitionDtoSchema
>

/** One action-economy allowance use. An overridden ("Do it anyway") use may exceed the maximum. */
export const encounterActionEconomyTransitionDtoSchema = z
  .strictObject({
    definitionId: uuidSchema,
    definitionVersion: positiveIntegerSchema,
    definitionChecksum: checksumSchema,
    maximum: positiveIntegerSchema,
    beforeUsed: nonNegativeIntegerSchema,
    afterUsed: positiveIntegerSchema
  })
  .check(
    z.superRefine((value, context) => {
      if (value.afterUsed !== value.beforeUsed + 1)
        context.addIssue({
          code: 'custom',
          path: ['afterUsed'],
          message: 'An action-economy transition uses exactly one allowance.'
        })
    })
  )

export const encounterActorMechanicsBatchApplicationOutputDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_ACTOR_MECHANICS_BATCH'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    sourceActorId: uuidSchema,
    sourceCharacterId: z.optional(z.nullable(uuidSchema)),
    targetActorId: uuidSchema,
    sourceCharacterStreamVersion: z.nullable(aggregateVersionSchema),
    resourceConsumption: z.nullable(characterMechanicsResourceReceiptDtoSchema),
    spellCastConsumption: z._default(
      z.nullable(
        z.strictObject({
          spellId: uuidSchema,
          spellVersionId: uuidSchema,
          spellVersion: positiveIntegerSchema,
          spellChecksum: checksumSchema,
          candidateId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
          slotKey: z.nullable(
            z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
          ),
          beforeUsed: z.nullable(nonNegativeIntegerSchema),
          afterUsed: z.nullable(nonNegativeIntegerSchema)
        })
      ),
      null
    ),
    featureResourceConsumption: z._default(
      z.nullable(encounterFeatureResourceReceiptDtoSchema),
      null
    ),
    targetFeatureResourceConsumption: z._default(
      z.nullable(encounterFeatureResourceReceiptDtoSchema),
      null
    ),
    sourceItemUseStateTransition: z._default(
      z.nullable(characterItemUseStateTransitionDtoSchema),
      null
    ),
    actionEconomyTransition: z.nullable(encounterActionEconomyTransitionDtoSchema),
    legendaryResistance: z._default(
      z.nullable(
        z.strictObject({
          selectedIndex: z.union([z.literal(0), z.literal(1)]),
          use: z.boolean(),
          ownerFeatureId: authoredIdentifierSchema,
          chargeId: authoredIdentifierSchema,
          featureCost: positiveIntegerSchema,
          lifecycle: z.strictObject({
            definitionId: uuidSchema,
            definitionVersion: positiveIntegerSchema,
            definitionChecksum: checksumSchema,
            choiceGraphDefinitionId: uuidSchema,
            choiceGraphDefinitionVersion: positiveIntegerSchema,
            choiceGraphDefinitionChecksum: checksumSchema,
            useOutput: portNameSchema,
            interruptedStage: z.literal('AFTER_FAILED_SAVE_BEFORE_OUTCOME'),
            replacement: z.literal('SAVE_SUCCESS')
          }),
          /** The choice-graph completion is nested evidence, never the action receipt root. */
          execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
          originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
          originalExecutionChecksum: checksumSchema,
          originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema)
        })
      ),
      null
    ),
    d20: z.nullable(serverRuleExecutionD20EvidenceDtoSchema),
    nestedD20: z._default(z.nullable(serverRuleExecutionNestedD20EvidenceDtoSchema), null),
    activeEffectTransitions: z._default(
      z.array(encounterActorActiveEffectCreateReceiptDtoSchema).check(z.maxLength(1)),
      []
    ),
    maintenanceTransition: z.optional(z.nullable(maintainedEffectTransitionDtoSchema)),
    stateEffectTransitions: z._default(
      z.array(stateEffectCreateReceiptDtoSchema).check(z.maxLength(1)),
      []
    ),
    targetTransition: z.strictObject({
      checksum: checksumSchema,
      before: characterMechanicsTargetStateDtoSchema,
      after: characterMechanicsTargetStateDtoSchema
    }),
    applications: z
      .array(characterMechanicsApplicationDtoSchema)
      .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
  })
  .check(
    z.superRefine((value, context) => {
      validateStateEffectTransitions({
        applications: value.applications,
        transitions: value.stateEffectTransitions,
        expectedOwnerKind: 'ENCOUNTER_ACTOR',
        expectedTargetActorId: value.targetActorId,
        context
      })
      validateMaintainedEffectCreation({
        occurrenceId: value.occurrenceId,
        sourceActorId: value.sourceActorId,
        activeEffectTransitions: value.activeEffectTransitions,
        maintenanceTransition: value.maintenanceTransition,
        context
      })
      let current = value.targetTransition.before.currentHitPoints
      let temporary = value.targetTransition.before.temporaryHitPoints
      let maximum = value.targetTransition.before.maximumHitPoints
      const conditions = new Set(value.targetTransition.before.conditionIds)
      const scalarValues = { ...value.targetTransition.before.scalarValues }
      for (const [index, application] of value.applications.entries()) {
        if (application.ordinal !== index)
          context.addIssue({
            code: 'custom',
            path: ['applications', index, 'ordinal'],
            message: 'Encounter actor mechanics application ordinals must be contiguous.'
          })
        if (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE') {
          const present = conditions.has(application.conditionId)
          const validTransition =
            application.kind === 'CONDITION_APPLY'
              ? application.afterPresent && application.applied === !present
              : application.applied
                ? present && !application.afterPresent
                : application.afterPresent === present
          if (application.beforePresent !== present || !validTransition)
            context.addIssue({
              code: 'custom',
              path: ['applications', index],
              message: 'Condition receipt presence is invalid.'
            })
          if (application.afterPresent) conditions.add(application.conditionId)
          else conditions.delete(application.conditionId)
          continue
        }
        if (application.kind === 'HIT_POINT_MAXIMUM_REDUCTION') {
          const afterMaximum = Math.max(
            0,
            application.beforeMaximumHitPoints - application.reductionAmount
          )
          if (
            application.beforeMaximumHitPoints !== maximum ||
            application.afterMaximumHitPoints !== afterMaximum ||
            application.appliedAmount !== application.beforeMaximumHitPoints - afterMaximum ||
            application.requestedAmount !== application.reductionAmount ||
            application.resolvedAmount !== application.reductionAmount ||
            application.maximumHitPoints !== maximum ||
            application.beforeCurrentHitPoints !== current ||
            application.afterCurrentHitPoints !== Math.min(current, afterMaximum) ||
            application.beforeTemporaryHitPoints !== temporary ||
            application.afterTemporaryHitPoints !== temporary
          )
            context.addIssue({
              code: 'custom',
              path: ['applications', index],
              message: 'Hit point maximum reduction receipt arithmetic is invalid.'
            })
          current = application.afterCurrentHitPoints
          maximum = application.afterMaximumHitPoints
          continue
        }
        if (application.kind === 'SCALAR_REDUCTION') {
          const beforeValue = scalarValues[application.valueDefinitionId]
          const afterValue = Math.max(application.floor, beforeValue - application.reductionAmount)
          if (
            !Number.isSafeInteger(beforeValue) ||
            beforeValue < 0 ||
            application.stacking !== 'ADDITIVE' ||
            application.floor !== 0 ||
            application.afterValue !== afterValue ||
            application.beforeValue !== beforeValue ||
            application.targetDied !== (afterValue === application.floor)
          )
            context.addIssue({
              code: 'custom',
              path: ['applications', index],
              message: 'Scalar reduction receipt arithmetic is invalid.'
            })
          scalarValues[application.valueDefinitionId] = afterValue
          if (application.targetDied) current = 0
          continue
        }
        if (
          application.beforeCurrentHitPoints > application.maximumHitPoints ||
          application.afterCurrentHitPoints > application.maximumHitPoints ||
          application.beforeCurrentHitPoints !== current ||
          application.beforeTemporaryHitPoints !== temporary ||
          application.maximumHitPoints !== maximum
        )
          context.addIssue({
            code: 'custom',
            path: ['applications', index],
            message: 'Encounter actor hit-point application chain is invalid.'
          })
        if (application.kind === 'HEAL') {
          const applied = Math.min(
            application.resolvedAmount,
            application.maximumHitPoints - application.beforeCurrentHitPoints
          )
          if (
            application.resolvedAmount !== application.requestedAmount ||
            application.afterTemporaryHitPoints !== application.beforeTemporaryHitPoints ||
            application.appliedAmount !== applied ||
            application.afterCurrentHitPoints !== application.beforeCurrentHitPoints + applied
          )
            context.addIssue({
              code: 'custom',
              path: ['applications', index],
              message: 'Heal receipt arithmetic is invalid.'
            })
        } else if (application.kind === 'TEMPORARY_HIT_POINTS') {
          const afterTemporary = Math.max(
            application.beforeTemporaryHitPoints,
            application.resolvedAmount
          )
          if (
            application.resolvedAmount !== application.requestedAmount ||
            application.afterCurrentHitPoints !== application.beforeCurrentHitPoints ||
            application.appliedAmount !== afterTemporary - application.beforeTemporaryHitPoints ||
            application.afterTemporaryHitPoints !== afterTemporary
          )
            context.addIssue({
              code: 'custom',
              path: ['applications', index],
              message: 'Temporary hit-point receipt arithmetic is invalid.'
            })
        } else if (application.kind === 'DAMAGE') {
          const resolved =
            application.damageDisposition === 'IMMUNE'
              ? 0
              : application.damageDisposition === 'RESISTANT'
                ? Math.floor(application.requestedAmount / 2)
                : application.damageDisposition === 'VULNERABLE'
                  ? application.requestedAmount * 2
                  : application.requestedAmount
          const temporaryLost = Math.min(application.beforeTemporaryHitPoints, resolved)
          const currentLost = Math.min(application.beforeCurrentHitPoints, resolved - temporaryLost)
          if (
            application.resolvedAmount !== resolved ||
            application.appliedAmount !== temporaryLost + currentLost ||
            application.afterCurrentHitPoints !==
              application.beforeCurrentHitPoints - currentLost ||
            application.afterTemporaryHitPoints !==
              application.beforeTemporaryHitPoints - temporaryLost
          )
            context.addIssue({
              code: 'custom',
              path: ['applications', index],
              message: 'Damage receipt arithmetic is invalid.'
            })
        }
        current = application.afterCurrentHitPoints
        temporary = application.afterTemporaryHitPoints
      }
      const after = value.targetTransition.after
      if (
        after.currentHitPoints !== current ||
        after.temporaryHitPoints !== temporary ||
        after.maximumHitPoints !== maximum ||
        after.conditionIds.length !== conditions.size ||
        after.conditionIds.some((conditionId, index) => [...conditions][index] !== conditionId) ||
        JSON.stringify(after.scalarValues) !== JSON.stringify(scalarValues)
      )
        context.addIssue({
          code: 'custom',
          path: ['targetTransition', 'after'],
          message: 'Encounter actor target transition is invalid.'
        })
      const resource = value.resourceConsumption
      const featureResource = value.featureResourceConsumption
      const targetFeatureResource = value.targetFeatureResourceConsumption
      if (
        resource &&
        (resource.afterUsed !== resource.beforeUsed + resource.cost ||
          resource.beforeRemaining < resource.cost ||
          resource.afterRemaining !== resource.beforeRemaining - resource.cost)
      )
        context.addIssue({
          code: 'custom',
          path: ['resourceConsumption'],
          message: 'Resource receipt is invalid.'
        })
      const maintenance = value.maintenanceTransition ?? null
      if (maintenance && value.sourceCharacterId === undefined)
        context.addIssue({
          code: 'custom',
          path: ['sourceCharacterId'],
          message: 'Maintained replacement requires immutable source Character identity.'
        })
      if (resource && value.sourceCharacterId === null)
        context.addIssue({
          code: 'custom',
          path: ['sourceCharacterId'],
          message: 'Character resource consumption requires a Character source.'
        })
      const stow = value.sourceItemUseStateTransition
      if (
        stow &&
        (value.sourceCharacterId == null ||
          stow.characterId !== value.sourceCharacterId ||
          stow.afterStreamVersion !== value.sourceCharacterStreamVersion)
      )
        context.addIssue({
          code: 'custom',
          path: ['sourceItemUseStateTransition'],
          message: 'Source item state transition must match the source Character version.'
        })
      const sourceMaintenanceMutation =
        value.sourceCharacterId != null &&
        (maintenance?.characterOwnerTransitions.some(
          (transition) => transition.characterId === value.sourceCharacterId
        ) ??
          false)
      if (
        (value.sourceCharacterStreamVersion === null) !==
        !(resource !== null || stow !== null || sourceMaintenanceMutation)
      )
        context.addIssue({
          code: 'custom',
          path: ['sourceCharacterStreamVersion'],
          message: 'Source Character stream version presence is invalid.'
        })
      if (
        featureResource &&
        (featureResource.ownerActorId !== value.sourceActorId ||
          featureResource.afterUsed !== featureResource.beforeUsed + featureResource.cost ||
          featureResource.beforeRemaining < featureResource.cost ||
          featureResource.afterRemaining !== featureResource.beforeRemaining - featureResource.cost)
      )
        context.addIssue({
          code: 'custom',
          path: ['featureResourceConsumption'],
          message: 'Encounter feature resource receipt is invalid.'
        })
      if (resource !== null && featureResource !== null)
        context.addIssue({
          code: 'custom',
          path: ['featureResourceConsumption'],
          message: 'Character and Encounter feature resource receipts are mutually exclusive.'
        })
      if (
        targetFeatureResource &&
        (targetFeatureResource.ownerActorId !== value.targetActorId ||
          targetFeatureResource.afterUsed !==
            targetFeatureResource.beforeUsed + targetFeatureResource.cost ||
          targetFeatureResource.beforeRemaining < targetFeatureResource.cost ||
          targetFeatureResource.afterRemaining !==
            targetFeatureResource.beforeRemaining - targetFeatureResource.cost)
      )
        context.addIssue({
          code: 'custom',
          path: ['targetFeatureResourceConsumption'],
          message: 'Target Encounter feature resource receipt is invalid.'
        })
      const legendaryResistance = value.legendaryResistance
      if (legendaryResistance) {
        const expectedUse = legendaryResistance.selectedIndex === 1
        if (
          legendaryResistance.use !== expectedUse ||
          legendaryResistance.originalExecution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
          checksumRuleDocument(legendaryResistance.originalExecution) !==
            legendaryResistance.originalExecutionChecksum
        )
          context.addIssue({
            code: 'custom',
            path: ['legendaryResistance'],
            message: 'Legendary Resistance action evidence is invalid.'
          })
        const consumptionMatches =
          targetFeatureResource !== null &&
          targetFeatureResource.ownerActorId === value.targetActorId &&
          targetFeatureResource.ownerFeatureId === legendaryResistance.ownerFeatureId &&
          targetFeatureResource.chargeId === legendaryResistance.chargeId &&
          targetFeatureResource.cost === legendaryResistance.featureCost
        if (
          (legendaryResistance.use && !consumptionMatches) ||
          (!legendaryResistance.use && targetFeatureResource !== null)
        )
          context.addIssue({
            code: 'custom',
            path: ['targetFeatureResourceConsumption'],
            message: 'Legendary Resistance charge consumption does not match the selected choice.'
          })
      } else if (targetFeatureResource !== null)
        context.addIssue({
          code: 'custom',
          path: ['targetFeatureResourceConsumption'],
          message: 'Target Feature resource consumption requires Legendary Resistance evidence.'
        })
      const contributorKeys = new Set<string>()
      for (const contributor of value.d20?.contributors ?? []) {
        const key = canonicalD20ContributorKey(contributor)
        if (contributorKeys.has(key))
          context.addIssue({
            code: 'custom',
            path: ['d20', 'contributors'],
            message: 'd20 contributors must be unique.'
          })
        contributorKeys.add(key)
      }
      const influences = new Set(
        (value.d20?.contributors ?? []).map((contributor) => contributor.influence)
      )
      const expectedRollMode = influences.size === 1 ? [...influences][0] : 'NORMAL'
      if (value.d20 && value.d20.derivedRollMode !== expectedRollMode)
        context.addIssue({
          code: 'custom',
          path: ['d20', 'derivedRollMode'],
          message: 'd20 contributor mode is invalid.'
        })
    })
  )

const contestedActionRollDtoSchema = z
  .strictObject({
    actorId: uuidSchema,
    requestNodeId: localNodeIdSchema,
    rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    rawFaces: z.array(receiptD20FaceSchema).check(z.minLength(1)).check(z.maxLength(2)),
    selectedNatural: receiptD20FaceSchema,
    contributors: z.array(receiptD20ContributorSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
    contributorChecksum: checksumSchema,
    modifier: integerSchema,
    total: integerSchema
  })
  .check(
    z.superRefine((value, context) => {
      const expectedFaces = value.rollMode === 'NORMAL' ? 1 : 2
      const expectedSelected =
        value.rollMode === 'ADVANTAGE'
          ? Math.max(...value.rawFaces)
          : value.rollMode === 'DISADVANTAGE'
            ? Math.min(...value.rawFaces)
            : value.rawFaces[0]
      if (value.rawFaces.length !== expectedFaces || value.selectedNatural !== expectedSelected)
        context.addIssue({
          code: 'custom',
          message: 'Contested-action d20 faces do not match the sealed roll mode.'
        })
      if (value.total !== value.selectedNatural + value.modifier)
        context.addIssue({
          code: 'custom',
          path: ['total'],
          message: 'Contested-action d20 total is invalid.'
        })
      if (
        value.contributors.some(
          (contributor, index) =>
            index > 0 &&
            compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
        )
      )
        context.addIssue({
          code: 'custom',
          path: ['contributors'],
          message: 'Contested-action contributors must be strictly sorted and unique.'
        })
      if (checksumRuleDocument(value.contributors) !== value.contributorChecksum)
        context.addIssue({
          code: 'custom',
          path: ['contributorChecksum'],
          message: 'Contested-action contributor checksum is invalid.'
        })
    })
  )

export const contestedActionApplicationOutputDtoSchema = z
  .strictObject({
    kind: z.literal('CONTESTED_ACTION'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    sourceActorId: uuidSchema,
    targetActorId: uuidSchema,
    sealedContextChecksum: checksumSchema,
    policy: z.strictObject({
      definitionId: uuidSchema,
      definitionVersion: positiveIntegerSchema,
      definitionChecksum: checksumSchema,
      moduleKey: capabilityKeySchema,
      moduleContractVersion: contractVersionSchema
    }),
    contestGraph: z.strictObject({
      definitionId: uuidSchema,
      checksum: checksumSchema,
      identityChecksum: checksumSchema
    }),
    sourceRoll: contestedActionRollDtoSchema,
    targetRoll: contestedActionRollDtoSchema,
    outcome: z.enum(['SOURCE_WIN', 'TARGET_WIN_OR_TIE']),
    stateTransition: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('NONE') }),
      characterItemUseStateTransitionDtoSchema,
      z.strictObject({
        kind: z.literal('ENCOUNTER_ACTOR_ITEM_USE_STATE'),
        actorId: uuidSchema,
        loadoutEntryId: uuidSchema,
        equipmentId: uuidSchema,
        fromState: z.literal('HELD'),
        toState: z.literal('CARRIED'),
        beforeStateChecksum: checksumSchema,
        afterStateChecksum: checksumSchema
      }),
      z.strictObject({
        kind: z.literal('SCENE_TOKEN_MOVED'),
        tokenId: uuidSchema,
        destination: z.strictObject({ x: z.number(), y: z.number() })
      })
    ]),
    actionEconomyTransition: z.nullable(encounterActionEconomyTransitionDtoSchema)
  })
  .check(
    z.superRefine((value, context) => {
      if (value.sourceActorId === value.targetActorId)
        context.addIssue({
          code: 'custom',
          path: ['targetActorId'],
          message: 'Contested-action participants must be distinct.'
        })
      if (
        value.sourceRoll.actorId !== value.sourceActorId ||
        value.targetRoll.actorId !== value.targetActorId ||
        value.sourceRoll.requestNodeId === value.targetRoll.requestNodeId
      )
        context.addIssue({
          code: 'custom',
          path: ['sourceRoll'],
          message: 'Contested-action roll participants or request nodes are invalid.'
        })
      const sourceWon = value.sourceRoll.total > value.targetRoll.total
      if ((value.outcome === 'SOURCE_WIN') !== sourceWon)
        context.addIssue({
          code: 'custom',
          path: ['outcome'],
          message: 'Contested-action outcome does not match roll totals.'
        })
      if (value.outcome === 'SOURCE_WIN' && value.stateTransition.kind === 'NONE')
        context.addIssue({
          code: 'custom',
          path: ['stateTransition'],
          message: 'A contested-action source win requires one state transition.'
        })
      if (value.outcome === 'TARGET_WIN_OR_TIE' && value.stateTransition.kind !== 'NONE')
        context.addIssue({
          code: 'custom',
          path: ['stateTransition'],
          message: 'A contested-action target win or tie cannot mutate item state.'
        })
      if (
        value.stateTransition.kind === 'ENCOUNTER_ACTOR_ITEM_USE_STATE' &&
        (value.stateTransition.actorId !== value.targetActorId ||
          value.stateTransition.beforeStateChecksum === value.stateTransition.afterStateChecksum)
      )
        context.addIssue({
          code: 'custom',
          path: ['stateTransition'],
          message: 'Encounter-actor contested-action item state transition is invalid.'
        })
      if (
        value.stateTransition.kind === 'SCENE_TOKEN_MOVED' &&
        value.stateTransition.tokenId.length === 0
      )
        context.addIssue({
          code: 'custom',
          path: ['stateTransition'],
          message: 'Contested-action Scene transition is invalid.'
        })
      if (
        value.actionEconomyTransition &&
        value.actionEconomyTransition.beforeUsed >= value.actionEconomyTransition.maximum
      )
        context.addIssue({
          code: 'custom',
          path: ['actionEconomyTransition'],
          message: 'Contested-action economy transition is invalid.'
        })
    })
  )

export const cleavingDamageApplicationOutputDtoSchema = z
  .strictObject({
    kind: z.literal('CLEAVING_DAMAGE'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    parentOccurrenceId: uuidSchema,
    sourceActorId: uuidSchema,
    targetActorId: z.nullable(uuidSchema),
    selectedOptionId: z.nullable(checksumSchema),
    sealedContextChecksum: checksumSchema,
    outcome: z.enum(['DECLINED', 'APPLIED']),
    damage: z.strictObject({
      sourceNodeId: localNodeIdSchema,
      sourceOperationKey: capabilityKeySchema,
      damageTypeId: uuidSchema,
      requestedAmount: positiveIntegerSchema,
      resolvedAmount: positiveIntegerSchema,
      appliedAmount: nonNegativeIntegerSchema
    }),
    targetTransition: z.nullable(
      z.strictObject({
        checksum: checksumSchema,
        before: characterMechanicsTargetStateDtoSchema,
        after: characterMechanicsTargetStateDtoSchema
      })
    )
  })
  .check(
    z.superRefine((value, context) => {
      const applied = value.outcome === 'APPLIED'
      if (
        (applied &&
          (value.targetActorId === null ||
            value.selectedOptionId === null ||
            value.targetTransition === null)) ||
        (!applied &&
          (value.targetActorId !== null ||
            value.selectedOptionId !== null ||
            value.targetTransition !== null)) ||
        value.damage.requestedAmount !== value.damage.resolvedAmount
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Cleaving settlement evidence is inconsistent.'
        })
      }
    })
  )
