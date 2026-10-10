import { z, lazySchema } from '../zod.js'

import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from './activeRuleEffects.js'
import { movementReactionChoiceOptionDtoSchema } from './reaction.js'
import { serverRuleExecutionApplicationOutputsDtoSchema } from './ruleExecutionApplicationOutputs.js'
import { characterMechanicsTargetStateDtoSchema } from './ruleExecutionMechanics.js'
import {
  movementConcentrationEndDtoSchema,
  movementConcentrationExecutionsDtoSchema
} from './ruleExecutionMovementConcentration.js'
import {
  ruleExecutionPhaseReceiptsDtoSchema,
  serverCompletedRuleExecutionDtoSchema
} from './ruleExecutionProtocol.js'
import { serverRuleExecutionD20EvidenceDtoSchema } from './ruleExecutionEvidence.js'
import {
  ruleExecutionChecksumSchema as checksum,
  ruleExecutionIntegerSchema as integer,
  ruleExecutionNonNegativeIntegerSchema as nonNegativeInteger,
  ruleExecutionPortNameSchema as portName,
  ruleExecutionPositiveIntegerSchema as positiveInteger,
  ruleExecutionReceiptOrdinalSchema as receiptOrdinal,
  ruleExecutionUuidSchema as uuid
} from './ruleExecutionPrimitives.js'

const movementReactionCharacterTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuid,
    beforeStreamVersion: integer.check(z.gte(0)),
    afterStreamVersion: integer.check(z.gte(0))
  })
)

export const pendingSpatialCharacterTransitionsDtoSchema = lazySchema(() =>
  z
    .array(movementReactionCharacterTransitionDtoSchema)
    .check(
      z.maxLength(
        MAX_ENCOUNTER_ACTORS +
          MAX_ENCOUNTER_ACTORS * MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
      )
    )
    .check(
      z.superRefine((transitions, context) => {
        let priorCharacterId = ''
        for (const [index, transition] of transitions.entries()) {
          if (
            transition.afterStreamVersion <= transition.beforeStreamVersion ||
            transition.characterId <= priorCharacterId
          )
            context.addIssue({
              code: 'custom',
              path: [index],
              message: 'Pending spatial Character transitions must advance in canonical order.'
            })
          priorCharacterId = transition.characterId
        }
      })
    )
)

export const movementReactionActionExecutionDtoSchema = lazySchema(() =>
  z.lazy(() =>
    z
      .strictObject({
        ordinal: receiptOrdinal,
        sourceCommandId: uuid,
        concentrationEnd: z.optional(movementConcentrationEndDtoSchema),
        concentrationChecks: z.optional(movementConcentrationExecutionsDtoSchema),
        option: movementReactionChoiceOptionDtoSchema,
        allowance: z.strictObject({
          definitionId: uuid,
          maximum: positiveInteger.check(z.lte(10_000)),
          beforeUsed: nonNegativeInteger,
          afterUsed: positiveInteger
        }),
        execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        initialFactsChecksum: z.optional(checksum),
        phaseReceipts: z.optional(z.lazy(() => ruleExecutionPhaseReceiptsDtoSchema)),
        application: serverRuleExecutionApplicationOutputsDtoSchema,
        /** Explicit mover binding when no spatial contact has identified the Character. */
        targetCharacterId: z.optional(uuid),
        legendaryResistance: z._default(
          z.nullable(
            z.strictObject({
              selectedIndex: z.union([z.literal(0), z.literal(1)]),
              use: z.boolean(),
              lifecycle: z.strictObject({
                definitionId: uuid,
                definitionVersion: positiveInteger,
                definitionChecksum: checksum,
                choiceGraphDefinitionId: uuid,
                choiceGraphDefinitionVersion: positiveInteger,
                choiceGraphDefinitionChecksum: checksum,
                useOutput: portName,
                interruptedStage: z.literal('AFTER_FAILED_SAVE_BEFORE_OUTCOME'),
                replacement: z.literal('SAVE_SUCCESS')
              }),
              execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
              originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema)
            })
          ),
          null
        ),
        characterTransitions: z
          .array(movementReactionCharacterTransitionDtoSchema)
          .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR + 2)),
        maintenanceOwnerTransitions: z.optional(
          z
            .array(
              z.strictObject({
                targetActorId: uuid,
                characterId: z.nullable(uuid),
                before: characterMechanicsTargetStateDtoSchema,
                after: characterMechanicsTargetStateDtoSchema
              })
            )
            .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR))
        )
      })
      .check(
        z.superRefine((value, context) => {
          if (value.targetCharacterId !== undefined) {
            const application = value.application
            if (
              application.kind !== 'CHARACTER_MECHANICS_BATCH' ||
              (application.targetCharacterStreamVersion !== null &&
                !value.characterTransitions.some(
                  (transition) =>
                    transition.characterId === value.targetCharacterId &&
                    transition.beforeStreamVersion ===
                      application.targetCharacterStreamVersion! - 1 &&
                    transition.afterStreamVersion === application.targetCharacterStreamVersion
                ))
            )
              context.addIssue({
                code: 'custom',
                path: ['targetCharacterId'],
                message: 'Movement reaction target identity must bind its Character mechanics span.'
              })
          }
          if (
            value.allowance.afterUsed !== value.allowance.beforeUsed + 1 ||
            value.allowance.afterUsed > value.allowance.maximum
          )
            context.addIssue({
              code: 'custom',
              path: ['allowance'],
              message:
                'Movement reaction allowance evidence must consume exactly one available use.'
            })
          let priorCharacterId = ''
          for (const [index, transition] of value.characterTransitions.entries()) {
            if (
              transition.afterStreamVersion !== transition.beforeStreamVersion + 1 ||
              transition.characterId <= priorCharacterId
            )
              context.addIssue({
                code: 'custom',
                path: ['characterTransitions', index],
                message:
                  'Movement reaction Character transitions must be unique, ordered, and advance exactly once.'
              })
            priorCharacterId = transition.characterId
          }
          if (
            (value.application.kind === 'CHARACTER_MECHANICS_BATCH' ||
              value.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH') &&
            value.application.maintenanceTransition
          )
            for (const transition of value.application.maintenanceTransition
              .characterOwnerTransitions)
              if (
                !value.characterTransitions.some(
                  (receiptTransition) =>
                    receiptTransition.characterId === transition.characterId &&
                    receiptTransition.beforeStreamVersion === transition.beforeStreamVersion &&
                    receiptTransition.afterStreamVersion === transition.afterStreamVersion
                )
              )
                context.addIssue({
                  code: 'custom',
                  path: ['characterTransitions'],
                  message:
                    'Movement reaction Character transitions must include each maintained owner transition.'
                })
          const maintenance =
            value.application.kind === 'CHARACTER_MECHANICS_BATCH' ||
            value.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
              ? value.application.maintenanceTransition
              : null
          const ownerTransitions = value.maintenanceOwnerTransitions
          if (maintenance && ownerTransitions === undefined)
            context.addIssue({
              code: 'custom',
              path: ['maintenanceOwnerTransitions'],
              message: 'Maintained movement reactions must retain owner cleanup transitions.'
            })
          if (!maintenance && ownerTransitions !== undefined)
            context.addIssue({
              code: 'custom',
              path: ['maintenanceOwnerTransitions'],
              message: 'Movement reaction owner cleanup transitions require maintenance.'
            })
          let priorTargetActorId = ''
          for (const [index, transition] of (ownerTransitions ?? []).entries()) {
            const matchesRemovedOwner =
              maintenance?.removedDependentEffects.some((effect) =>
                transition.characterId === null
                  ? effect.kind === 'ENCOUNTER_ACTOR' &&
                    effect.targetActorId === transition.targetActorId
                  : effect.kind === 'CHARACTER' && effect.characterId === transition.characterId
              ) ||
              // D99: a Character whose carried Concentration grant the reaction ends is cleaned up too.
              (transition.characterId !== null &&
                maintenance?.endedCarriedGrants.some(
                  (grant) => grant.characterId === transition.characterId
                ))
            if (transition.targetActorId <= priorTargetActorId || !matchesRemovedOwner)
              context.addIssue({
                code: 'custom',
                path: ['maintenanceOwnerTransitions', index],
                message:
                  'Movement reaction owner cleanup transitions must be unique, canonical, and match removed owners.'
              })
            if (
              transition.before.currentHitPoints !== transition.after.currentHitPoints ||
              transition.before.temporaryHitPoints !== transition.after.temporaryHitPoints ||
              transition.after.conditionIds.some(
                (conditionId) => !transition.before.conditionIds.includes(conditionId)
              )
            )
              context.addIssue({
                code: 'custom',
                path: ['maintenanceOwnerTransitions', index],
                message: 'Movement reaction owner cleanup state transition is invalid.'
              })
            priorTargetActorId = transition.targetActorId
          }
          const representedEncounterActors = new Set(
            (ownerTransitions ?? [])
              .filter((transition) => transition.characterId === null)
              .map((transition) => transition.targetActorId)
          )
          if (
            maintenance?.removedDependentEffects.some(
              (effect) =>
                effect.kind === 'ENCOUNTER_ACTOR' &&
                !representedEncounterActors.has(effect.targetActorId)
            )
          )
            context.addIssue({
              code: 'custom',
              path: ['maintenanceOwnerTransitions'],
              message: 'Movement reaction cleanup must retain every removed Encounter actor owner.'
            })
        })
      )
  )
)
