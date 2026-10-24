import { z, lazySchema } from '../zod.js'
import {
  deathSavesAfterDamage,
  deathSavesAfterDeath,
  deathSavesAfterHealing,
  isCharacterDead
} from './characterDeathSaves.js'
import { replayDeathStateReceipt } from './ruleExecutionDeathStateReplay.js'
import {
  temporaryHitPointsAfterGrant,
  temporaryHitPointsAfterLoss,
  temporaryHitPointsAfterRelease
} from './temporaryHitPoints.js'
import { encounterAttackActionTransitionDtoSchema } from '../projections/encounterAttackAction.js'

import { canonicalD20ContributorKey } from '@artificer-toolkit/shared/rules/contributors'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import {
  characterActiveEffectCreateReceiptDtoSchema,
  characterMechanicsApplicationDtoSchema,
  characterMechanicsResourceReceiptDtoSchema,
  characterMechanicsTargetTransitionDtoSchema,
  encounterFeatureResourceReceiptDtoSchema,
  maintainedEffectTransitionDtoSchema,
  resolveDispositionDamage,
  sourceApplicationsChangeState,
  sourceApplicationsDtoSchema,
  stateEffectCreateReceiptDtoSchema,
  validateMaintainedEffectCreation,
  validateStateEffectTransitions
} from './ruleExecutionMechanics.js'
import {
  characterItemConsumptionReceiptDtoSchema,
  characterItemDegradationReceiptDtoSchema,
  characterItemUseStateTransitionDtoSchema,
  characterSpellSlotConsumptionReceiptDtoSchema,
  cleavingDamageApplicationOutputDtoSchema,
  concealmentCheckApplicationOutputDtoSchema,
  damageSaveCheckApplicationOutputDtoSchema,
  concentrationEndApplicationOutputDtoSchema,
  contestedActionApplicationOutputDtoSchema,
  encounterActionEconomyTransitionDtoSchema,
  encounterAreaActionApplicationOutputDtoSchema,
  encounterActorMechanicsBatchApplicationOutputDtoSchema,
  escapeCheckApplicationOutputDtoSchema,
  sourceItemDrawDtoSchema
} from './ruleExecutionEncounterApplications.js'
import { checkActionApplicationOutputDtoSchema } from './ruleExecutionCheckAction.js'
import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema
} from './ruleExecutionEvidence.js'
import {
  encounterActionReactionReceiptDtoSchema,
  encounterCounteredCastApplicationOutputDtoSchema,
  encounterGatedActionApplicationOutputDtoSchema
} from './ruleExecutionReactionChoice.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  meleeRetaliationEvidenceDtoSchema,
  validateMeleeRetaliation
} from './ruleExecutionEffectEvidence.js'
import { damageAddedDiceDtoSchema } from './d20AddedDice.js'
const noApplicationOutputDtoSchema = lazySchema(() => z.strictObject({ kind: z.literal('NONE') }))

const characterMechanicsBatchApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('CHARACTER_MECHANICS_BATCH'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      /** The area action this target's settlement belongs to, when it is one creature of an area. */
      parentOccurrenceId: z.optional(uuidSchema),
      sourceActorId: uuidSchema,
      /** Immutable Character identity for Character-originated receipts; never inferred on replay. */
      sourceCharacterId: z.nullable(uuidSchema),
      targetActorId: uuidSchema,
      sourceCharacterStreamVersion: z.nullable(aggregateVersionSchema),
      targetCharacterStreamVersion: z.nullable(aggregateVersionSchema),
      resourceConsumption: z.nullable(characterMechanicsResourceReceiptDtoSchema),
      spellCastConsumption: z._default(
        z.nullable(characterSpellSlotConsumptionReceiptDtoSchema),
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
      /** The carried weapon the source's attack drew into a hand; undo puts it back. */
      sourceItemDraw: z._default(z.nullable(sourceItemDrawDtoSchema), null),
      /** The weapon the source hit with, corroded by what it struck; undo restores it. */
      sourceItemDegradation: z._default(z.nullable(characterItemDegradationReceiptDtoSchema), null),
      sourceItemConsumption: z._default(z.nullable(characterItemConsumptionReceiptDtoSchema), null),
      /** The item the target dropped with this outcome (Heat Metal); undo puts it back in hand. */
      targetItemUseStateTransition: z._default(
        z.nullable(characterItemUseStateTransitionDtoSchema),
        null
      ),
      /** The worn item the target's outcome corroded; undo restores its penalty and use. */
      targetItemDegradation: z._default(z.nullable(characterItemDegradationReceiptDtoSchema), null),
      actionEconomyTransition: z.nullable(encounterActionEconomyTransitionDtoSchema),
      /** Present when the attack opened or filled the actor's Attack action; undo restores `before`. */
      attackActionTransition: z.optional(encounterAttackActionTransitionDtoSchema),
      /** The target's reaction decision on this attack; its spend belongs to the target, not the source. */
      reaction: z._default(z.nullable(encounterActionReactionReceiptDtoSchema), null),
      /** The target also failed a counter against this cast (D127): its slot spend rides in this batch's Character write. */
      targetFailedCounterSpend: z._default(z.boolean(), false),
      /** The action's recurring effect and, beside it, a failure-margin rider's effect. */
      activeEffectTransitions: z
        .array(characterActiveEffectCreateReceiptDtoSchema)
        .check(z.maxLength(2)),
      /** The effect of a reaction the target used on being chosen as this cast's target; it lands on the target. */
      reactionEffectTransitions: z._default(
        z.array(characterActiveEffectCreateReceiptDtoSchema).check(z.maxLength(1)),
        []
      ),
      /** Timed effects the target's own rules created on it from this action (a successful attacker's immunity to its ward); undo deletes them. */
      grantEffectTransitions: z._default(
        z.array(characterActiveEffectCreateReceiptDtoSchema).check(z.maxLength(4)),
        []
      ),
      maintenanceTransition: z.optional(z.nullable(maintainedEffectTransitionDtoSchema)),
      d20: z.nullable(serverRuleExecutionD20EvidenceDtoSchema),
      nestedD20: z._default(z.nullable(serverRuleExecutionNestedD20EvidenceDtoSchema), null),
      stateEffectTransitions: z._default(
        z.array(stateEffectCreateReceiptDtoSchema).check(z.maxLength(1)),
        []
      ),
      targetTransition: characterMechanicsTargetTransitionDtoSchema,
      applications: z
        .array(characterMechanicsApplicationDtoSchema)
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      /** The source's own conditions released by effects its action ended; empty when none. */
      sourceApplications: sourceApplicationsDtoSchema,
      /** The dice active grants added to, or took from, its damage, in node-prefix order (D156). */
      damageAddedDice: z.optional(damageAddedDiceDtoSchema),
      /** The zones its target holds that this melee hit set off against the attacker (D153). */
      meleeRetaliation: z.optional(meleeRetaliationEvidenceDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        validateMeleeRetaliation(value, context)
        validateStateEffectTransitions({
          applications: value.applications,
          transitions: value.stateEffectTransitions,
          expectedOwnerKind: 'CHARACTER',
          context
        })
        validateMaintainedEffectCreation({
          occurrenceId: value.parentOccurrenceId ?? value.occurrenceId,
          sourceActorId: value.sourceActorId,
          activeEffectTransitions: value.activeEffectTransitions,
          maintenanceTransition: value.maintenanceTransition,
          context
        })
        let current = value.targetTransition.before.currentHitPoints
        let temporary = value.targetTransition.before.temporaryHitPoints
        let temporarySource = value.targetTransition.before.temporaryHitPointsSourceEffectId ?? null
        let maximum = value.targetTransition.before.maximumHitPoints
        let deathSaves = value.targetTransition.before.deathSaves
        const conditions = new Set(value.targetTransition.before.conditionIds)
        const scalarValues = {
          ...value.targetTransition.before.scalarValues
        }
        for (const [index, application] of value.applications.entries()) {
          if (application.ordinal !== index)
            context.addIssue({
              code: 'custom',
              path: ['applications', index, 'ordinal'],
              message: 'Character mechanics application ordinals must be contiguous.'
            })
          if (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE') {
            const present = conditions.has(application.conditionId)
            const validTransition =
              application.kind === 'CONDITION_APPLY'
                ? application.afterPresent && application.applied === !present
                : application.applied
                  ? // A cleared Sheet copy stays present while the Campaign holds the condition.
                    present
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
            if (maximum === 0 && deathSaves !== null) deathSaves = deathSavesAfterDeath()
            continue
          }
          if (application.kind === 'SCALAR_REDUCTION') {
            const beforeValue = scalarValues[application.valueDefinitionId]
            const afterValue = Math.max(
              application.floor,
              beforeValue - application.reductionAmount
            )
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
            if (application.targetDied) {
              current = 0
              if (deathSaves !== null) deathSaves = deathSavesAfterDeath()
            }
            continue
          }
          if (application.kind === 'KILL') {
            if (
              application.beforeCurrentHitPoints !== current ||
              application.beforeTemporaryHitPoints !== temporary
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Kill receipt hit-point chain is invalid.'
              })
            current = 0
            temporary = 0
            temporarySource = null
            if (deathSaves !== null) deathSaves = deathSavesAfterDeath()
            continue
          }
          if (application.kind === 'KILL_NEGATED' || application.kind === 'DEPART') continue
          if (application.kind === 'STABILIZE' || application.kind === 'REVIVE') {
            const replay = replayDeathStateReceipt(application, { current, maximum, deathSaves })
            if (replay.issue)
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: replay.issue
              })
            ;({ current, deathSaves } = replay)
            continue
          }
          if (application.kind === 'TEMPORARY_HIT_POINTS_RELEASE') {
            const released = temporaryHitPointsAfterRelease(
              { amount: temporary, sourceEffectId: temporarySource },
              application.sourceActiveEffectId
            )
            if (
              application.beforeTemporaryHitPoints !== temporary ||
              application.afterTemporaryHitPoints !== released.amount ||
              application.applied !== (temporarySource === application.sourceActiveEffectId)
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Temporary hit-point release receipt is invalid.'
              })
            temporary = released.amount
            temporarySource = released.sourceEffectId
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
              message: 'Character mechanics hit-point application chain is invalid.'
            })
          if (application.kind === 'HEAL') {
            // A dead Character ignores healing (D96).
            const expectedApplied =
              deathSaves !== null && isCharacterDead(deathSaves)
                ? 0
                : Math.min(
                    application.resolvedAmount,
                    application.maximumHitPoints - application.beforeCurrentHitPoints
                  )
            if (deathSaves !== null)
              deathSaves = deathSavesAfterHealing({ deathSaves, appliedAmount: expectedApplied })
            if (
              application.resolvedAmount !== application.requestedAmount ||
              application.afterTemporaryHitPoints !== application.beforeTemporaryHitPoints ||
              application.appliedAmount !== expectedApplied ||
              application.afterCurrentHitPoints !==
                application.beforeCurrentHitPoints + expectedApplied
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Heal receipt arithmetic is invalid.'
              })
          } else if (application.kind === 'TEMPORARY_HIT_POINTS') {
            const granted = temporaryHitPointsAfterGrant(
              { amount: application.beforeTemporaryHitPoints, sourceEffectId: temporarySource },
              {
                amount: application.resolvedAmount,
                sourceEffectId: application.sourceActiveEffectId ?? null
              }
            )
            const expectedAfter = granted.amount
            temporarySource = granted.sourceEffectId
            if (
              application.resolvedAmount !== application.requestedAmount ||
              application.afterCurrentHitPoints !== application.beforeCurrentHitPoints ||
              application.appliedAmount !== expectedAfter - application.beforeTemporaryHitPoints ||
              application.afterTemporaryHitPoints !== expectedAfter
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Temporary hit-point receipt arithmetic is invalid.'
              })
          } else if (application.kind === 'DAMAGE') {
            const expectedResolved = resolveDispositionDamage(
              application.damageDisposition,
              application.requestedAmount
            )
            const temporaryLost = Math.min(application.beforeTemporaryHitPoints, expectedResolved)
            temporarySource = temporaryHitPointsAfterLoss(
              { amount: application.beforeTemporaryHitPoints, sourceEffectId: temporarySource },
              temporaryLost
            ).sourceEffectId
            const currentLost = Math.min(
              application.beforeCurrentHitPoints,
              expectedResolved - temporaryLost
            )
            const intercepted = application.interceptedBy !== undefined
            // An interception leaves a lethal blow's target at a total above 0 (Death Ward).
            const expectedAfter = intercepted
              ? application.afterCurrentHitPoints
              : application.beforeCurrentHitPoints - currentLost
            if (
              intercepted &&
              (application.beforeCurrentHitPoints - currentLost !== 0 ||
                application.beforeCurrentHitPoints < 1 ||
                application.afterCurrentHitPoints < 1 ||
                application.afterCurrentHitPoints > application.maximumHitPoints)
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Damage interception receipt is invalid.'
              })
            if (
              application.resolvedAmount !== expectedResolved ||
              application.appliedAmount !==
                temporaryLost + application.beforeCurrentHitPoints - expectedAfter ||
              application.afterCurrentHitPoints !== expectedAfter ||
              application.afterTemporaryHitPoints !==
                application.beforeTemporaryHitPoints - temporaryLost
            )
              context.addIssue({
                code: 'custom',
                path: ['applications', index],
                message: 'Damage receipt arithmetic is invalid.'
              })
            if (deathSaves !== null && !intercepted)
              deathSaves = deathSavesAfterDamage({
                deathSaves,
                currentHitPoints: application.beforeCurrentHitPoints,
                maximumHitPoints: application.maximumHitPoints,
                dealt: expectedResolved - temporaryLost,
                critical: application.critical
              })
          }
          current = application.afterCurrentHitPoints
          temporary = application.afterTemporaryHitPoints
        }
        const transitionAfter = value.targetTransition.after
        if (
          transitionAfter.currentHitPoints !== current ||
          transitionAfter.temporaryHitPoints !== temporary ||
          (transitionAfter.temporaryHitPointsSourceEffectId ?? null) !== temporarySource ||
          transitionAfter.maximumHitPoints !== maximum ||
          JSON.stringify(transitionAfter.deathSaves) !== JSON.stringify(deathSaves) ||
          transitionAfter.conditionIds.length !== conditions.size ||
          transitionAfter.conditionIds.some(
            (conditionId, index) => [...conditions][index] !== conditionId
          ) ||
          JSON.stringify(transitionAfter.scalarValues) !== JSON.stringify(scalarValues)
        )
          context.addIssue({
            code: 'custom',
            message: 'Target transition is invalid.'
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
            message: 'Resource receipt is invalid.'
          })
        if (
          featureResource &&
          (featureResource.ownerActorId !== value.sourceActorId ||
            featureResource.afterUsed !== featureResource.beforeUsed + featureResource.cost ||
            featureResource.beforeRemaining < featureResource.cost ||
            featureResource.afterRemaining !==
              featureResource.beforeRemaining - featureResource.cost)
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
        const contributorKeys = new Set<string>()
        for (const contributor of value.d20?.contributors ?? []) {
          const key = canonicalD20ContributorKey(contributor)
          if (contributorKeys.has(key))
            context.addIssue({
              code: 'custom',
              message: 'd20 contributors must be unique.'
            })
          contributorKeys.add(key)
        }
        const { before, after, inForm } = value.targetTransition
        const hitPointsChanged =
          before.currentHitPoints !== after.currentHitPoints ||
          before.temporaryHitPoints !== after.temporaryHitPoints ||
          before.maximumHitPoints !== after.maximumHitPoints ||
          JSON.stringify(before.deathSaves) !== JSON.stringify(after.deathSaves)
        // A form's hit points are not the Sheet's: they write it only when the form ends onto it.
        const transitionChanged =
          (hitPointsChanged && !inForm) ||
          before.conditionIds.some(
            (conditionId, index) => after.conditionIds[index] !== conditionId
          ) ||
          before.conditionIds.length !== after.conditionIds.length
        const stow = value.sourceItemUseStateTransition
        const draw = value.sourceItemDraw
        const sourceDegradation = value.sourceItemDegradation
        const consumption = value.sourceItemConsumption
        const spell = value.spellCastConsumption
        const hasSourceMutation =
          value.resourceConsumption !== null ||
          stow !== null ||
          draw?.kind === 'CHARACTER_ITEM_DRAW' ||
          sourceDegradation !== null ||
          consumption !== null ||
          spell !== null ||
          sourceApplicationsChangeState(value.sourceApplications, value.sourceCharacterId)
        if (
          spell &&
          (value.sourceCharacterId === null || spell.characterId !== value.sourceCharacterId)
        )
          context.addIssue({
            code: 'custom',
            path: ['spellCastConsumption'],
            message: 'Spell slot consumption must match the source Character.'
          })
        if (
          sourceDegradation &&
          (value.sourceCharacterId === null ||
            sourceDegradation.characterId !== value.sourceCharacterId)
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceItemDegradation'],
            message: 'Item degradation must match the source Character.'
          })
        if (
          consumption &&
          (value.sourceCharacterId === null || consumption.characterId !== value.sourceCharacterId)
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceItemConsumption'],
            message: 'Item consumption must match the source Character.'
          })
        const hasActiveEffectCreation =
          value.activeEffectTransitions.length > 0 ||
          value.reactionEffectTransitions.length > 0 ||
          value.grantEffectTransitions.length > 0
        const reaction = value.reaction
        const release = value.targetItemUseStateTransition
        if (
          release &&
          (release.afterStreamVersion !== value.targetCharacterStreamVersion ||
            (stow !== null && value.sourceActorId === value.targetActorId))
        )
          context.addIssue({
            code: 'custom',
            path: ['targetItemUseStateTransition'],
            message: 'Target item state transition must match the target Character version.'
          })
        const degradation = value.targetItemDegradation
        if (degradation && value.targetCharacterStreamVersion === null)
          context.addIssue({
            code: 'custom',
            path: ['targetItemDegradation'],
            message: 'Target item degradation must match the target Character.'
          })
        const hasReactionMutation =
          reaction?.spellCastConsumption != null ||
          value.targetFailedCounterSpend ||
          release !== null ||
          degradation !== null
        if (
          reaction &&
          (reaction.reaction.reactorActorId !== value.targetActorId ||
            (reaction.spellCastConsumption &&
              reaction.spellCastConsumption.characterId !== reaction.reaction.characterId))
        )
          context.addIssue({
            code: 'custom',
            path: ['reaction'],
            message: 'A reaction belongs to the attacked Character.'
          })
        if (
          stow &&
          (value.sourceCharacterId === null ||
            stow.characterId !== value.sourceCharacterId ||
            stow.afterStreamVersion !==
              (value.sourceActorId === value.targetActorId
                ? value.targetCharacterStreamVersion
                : value.sourceCharacterStreamVersion))
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceItemUseStateTransition'],
            message: 'Source item state transition must match the source Character version.'
          })
        if (
          draw &&
          (draw.kind === 'CHARACTER_ITEM_DRAW'
            ? value.sourceCharacterId === null ||
              draw.characterId !== value.sourceCharacterId ||
              draw.afterStreamVersion !==
                (value.sourceActorId === value.targetActorId
                  ? value.targetCharacterStreamVersion
                  : value.sourceCharacterStreamVersion)
            : draw.actorId !== value.sourceActorId)
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceItemDraw'],
            message: 'Source item draw must match the source and its version.'
          })
        const targetVersionRequired =
          transitionChanged ||
          (value.sourceActorId === value.targetActorId && hasSourceMutation) ||
          hasActiveEffectCreation ||
          hasReactionMutation
        if (
          value.targetCharacterStreamVersion === null
            ? targetVersionRequired
            : !targetVersionRequired && !(inForm && hitPointsChanged)
        )
          context.addIssue({
            code: 'custom',
            message: 'Target stream version presence is invalid.'
          })
        const sourceCharacterMutation =
          value.sourceActorId !== value.targetActorId &&
          (hasSourceMutation ||
            (value.sourceCharacterId !== null &&
              (value.maintenanceTransition?.characterOwnerTransitions.some(
                (transition) => transition.characterId === value.sourceCharacterId
              ) ??
                false)))
        if (sourceCharacterMutation === (value.sourceCharacterStreamVersion === null))
          context.addIssue({
            code: 'custom',
            message: 'Source stream version presence is invalid.'
          })
      })
    )
)

// Explicitly typed so the stored results that embed it stay within the compiler's size limit (TS7056).
export type ServerRuleExecutionApplicationOutputsDto =
  | z.infer<typeof noApplicationOutputDtoSchema>
  | z.infer<typeof cleavingDamageApplicationOutputDtoSchema>
  | z.infer<typeof contestedActionApplicationOutputDtoSchema>
  | z.infer<typeof damageSaveCheckApplicationOutputDtoSchema>
  | z.infer<typeof concentrationEndApplicationOutputDtoSchema>
  | z.infer<typeof encounterAreaActionApplicationOutputDtoSchema>
  | z.infer<typeof encounterCounteredCastApplicationOutputDtoSchema>
  | z.infer<typeof encounterGatedActionApplicationOutputDtoSchema>
  | z.infer<typeof encounterActorMechanicsBatchApplicationOutputDtoSchema>
  | z.infer<typeof checkActionApplicationOutputDtoSchema>
  | z.infer<typeof escapeCheckApplicationOutputDtoSchema>
  | z.infer<typeof concealmentCheckApplicationOutputDtoSchema>
  | z.infer<typeof characterMechanicsBatchApplicationOutputDtoSchema>

export const serverRuleExecutionApplicationOutputsDtoSchema: z.ZodMiniType<ServerRuleExecutionApplicationOutputsDto> =
  lazySchema(() =>
    z.discriminatedUnion('kind', [
      noApplicationOutputDtoSchema,
      cleavingDamageApplicationOutputDtoSchema,
      contestedActionApplicationOutputDtoSchema,
      damageSaveCheckApplicationOutputDtoSchema,
      concentrationEndApplicationOutputDtoSchema,
      encounterAreaActionApplicationOutputDtoSchema,
      encounterCounteredCastApplicationOutputDtoSchema,
      encounterGatedActionApplicationOutputDtoSchema,
      encounterActorMechanicsBatchApplicationOutputDtoSchema,
      checkActionApplicationOutputDtoSchema,
      escapeCheckApplicationOutputDtoSchema,
      concealmentCheckApplicationOutputDtoSchema,
      characterMechanicsBatchApplicationOutputDtoSchema
    ])
  )
