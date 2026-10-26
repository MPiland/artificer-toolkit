import { z, lazySchema } from '../zod.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from './activeRuleEffects.js'
import { concentrationEndApplicationOutputDtoSchema } from './ruleExecutionEncounterApplications.js'
import { concentrationCheckApplicationOutputDtoSchema } from './ruleExecutionDamageSaveOutputs.js'
import { characterMechanicsTargetStateDtoSchema } from './ruleExecutionMechanics.js'
import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'
import { ruleExecutionChecksumSchema, ruleExecutionUuidSchema } from './ruleExecutionPrimitives.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'

const movementOwnerTransitionsDtoSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        targetActorId: ruleExecutionUuidSchema,
        characterId: z.nullable(ruleExecutionUuidSchema),
        before: characterMechanicsTargetStateDtoSchema,
        after: characterMechanicsTargetStateDtoSchema
      })
    )
    .check(z.maxLength(MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR))
)

/** Owner transitions exist only with cleanup, one per canonical actor, each bound to a cleanup Character owner. */
function validateMovementOwnerTransitions(
  ownerTransitions: z.infer<typeof movementOwnerTransitionsDtoSchema>,
  cleanup: { characterOwnerTransitions: readonly { characterId: string }[] } | null,
  context: z.core.$RefinementCtx
) {
  let priorActorId = ''
  const ownerCharacterIds = new Set<string>()
  for (const [index, transition] of ownerTransitions.entries()) {
    if (transition.targetActorId <= priorActorId || cleanup === null)
      context.addIssue({
        code: 'custom',
        path: ['ownerTransitions', index],
        message:
          'Concentration owner transitions require failed-save cleanup and unique canonical actors.'
      })
    priorActorId = transition.targetActorId
    if (
      transition.characterId !== null &&
      (!cleanup?.characterOwnerTransitions.some(
        (owner) => owner.characterId === transition.characterId
      ) ||
        ownerCharacterIds.has(transition.characterId))
    )
      context.addIssue({
        code: 'custom',
        path: ['ownerTransitions', index, 'characterId'],
        message: 'Concentration actor changes must bind one exact cleanup Character owner.'
      })
    if (transition.characterId !== null) ownerCharacterIds.add(transition.characterId)
  }
}

/** Completed child evidence retained at the damage contact that caused it. */
export const movementConcentrationExecutionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      sourceCommandId: ruleExecutionUuidSchema,
      result: z
        .strictObject({
          status: z.literal('COMPLETE'),
          occurrenceId: ruleExecutionUuidSchema,
          occurrenceVersion: z.literal(1),
          initialFactsChecksum: ruleExecutionChecksumSchema,
          outputs: serverCompletedRuleExecutionDtoSchema.shape.outputs,
          evidence: serverCompletedRuleExecutionDtoSchema.shape.evidence,
          applicationOutputs: concentrationCheckApplicationOutputDtoSchema
        })
        .check(
          z.superRefine((result, context) => {
            if (
              result.occurrenceId !== result.applicationOutputs.occurrenceId ||
              result.occurrenceId === result.applicationOutputs.parentOccurrenceId ||
              result.evidence.source.definitionId !==
                result.applicationOutputs.concentrationDefinition.id ||
              result.evidence.source.checksum !==
                result.applicationOutputs.concentrationDefinition.checksum
            )
              context.addIssue({
                code: 'custom',
                path: ['applicationOutputs'],
                message:
                  'Movement Concentration must retain its exact child and published rule identity.'
              })
          })
        ),
      ownerTransitions: movementOwnerTransitionsDtoSchema
    })
    .check(
      z.superRefine((value, context) =>
        validateMovementOwnerTransitions(
          value.ownerTransitions,
          value.result.applicationOutputs.cleanup,
          context
        )
      )
    )
)

export const movementConcentrationExecutionsDtoSchema = lazySchema(() =>
  z
    .array(movementConcentrationExecutionDtoSchema)
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    .check(
      z.superRefine((values, context) => {
        const ids = new Set<string>()
        let priorOrdinal = -1
        for (const [index, value] of values.entries()) {
          const application = value.result.applicationOutputs.application
          if (ids.has(value.result.occurrenceId) || application.ordinal <= priorOrdinal)
            context.addIssue({
              code: 'custom',
              path: [index],
              message:
                'Movement Concentration checks must have unique child identities and canonical damage order.'
            })
          ids.add(value.result.occurrenceId)
          priorOrdinal = application.ordinal
        }
      })
    )
)

/** A holder's Concentration that ended at a movement contact with no check (D95); one holder per contact. */
export const movementConcentrationEndDtoSchema = lazySchema(() =>
  z
    .strictObject({
      sourceCommandId: ruleExecutionUuidSchema,
      result: z.strictObject({
        occurrenceId: ruleExecutionUuidSchema,
        applicationOutputs: concentrationEndApplicationOutputDtoSchema
      }),
      ownerTransitions: movementOwnerTransitionsDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.result.occurrenceId !== value.result.applicationOutputs.occurrenceId)
          context.addIssue({
            code: 'custom',
            path: ['result', 'occurrenceId'],
            message: 'A movement Concentration end must retain its exact child identity.'
          })
        validateMovementOwnerTransitions(
          value.ownerTransitions,
          value.result.applicationOutputs.cleanup,
          context
        )
      })
    )
)

export type MovementConcentrationExecutionDto = z.infer<
  typeof movementConcentrationExecutionDtoSchema
>

export type MovementConcentrationEndDto = z.infer<typeof movementConcentrationEndDtoSchema>
