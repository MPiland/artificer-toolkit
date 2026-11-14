import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'
import { z, lazySchema } from '../zod.js'
import {
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
} from './activeRuleEffects.js'
import {
  compareDamageSaveApplications,
  type DamageSaveApplicationDto
} from './ruleExecutionConcentration.js'
import {
  concentrationCleanupDtoSchema,
  concentrationEndApplicationOutputDtoSchema
} from './ruleExecutionEncounterApplications.js'
import {
  concentrationCheckApplicationOutputDtoSchema,
  damageSaveCheckBoundApplication,
  effectRepeatSaveApplicationOutputDtoSchema,
  massiveDamageSaveApplicationOutputDtoSchema
} from './ruleExecutionDamageSaveOutputs.js'
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
        let priorCastAt = ''
        for (const [index, value] of values.entries()) {
          const application = value.result.applicationOutputs.application
          // One damage application owes a check per held spell, in casting order.
          if (
            ids.has(value.result.occurrenceId) ||
            application.ordinal < priorOrdinal ||
            (application.ordinal === priorOrdinal && application.castAt < priorCastAt)
          )
            context.addIssue({
              code: 'custom',
              path: [index],
              message:
                'Movement Concentration checks must have unique child identities and canonical damage order.'
            })
          ids.add(value.result.occurrenceId)
          priorOrdinal = application.ordinal
          priorCastAt = application.castAt
        }
      })
    )
)

/** A holder's Concentration that ended at a movement contact with no check (D95). */
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

/** Every Concentration a contact ended with no check, one per held state (D95), in casting order. */
export const movementConcentrationEndsDtoSchema = lazySchema(() =>
  z
    .array(movementConcentrationEndDtoSchema)
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    .check(
      z.superRefine((values, context) => {
        const ids = new Set<string>()
        for (const [index, value] of values.entries()) {
          if (ids.has(value.result.occurrenceId))
            context.addIssue({
              code: 'custom',
              path: [index],
              message: 'Movement Concentration ends must have unique child identities.'
            })
          ids.add(value.result.occurrenceId)
        }
      })
    )
)

/**
 * A damaged holder's effect repeat save (D167), settled at the movement contact whose damage owed
 * it. A made save releases the effect: `release` keeps the Character versions that advanced.
 */
export const movementRepeatSaveExecutionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      sourceCommandId: ruleExecutionUuidSchema,
      result: z.strictObject({
        status: z.literal('COMPLETE'),
        occurrenceId: ruleExecutionUuidSchema,
        occurrenceVersion: z.literal(1),
        initialFactsChecksum: ruleExecutionChecksumSchema,
        outputs: serverCompletedRuleExecutionDtoSchema.shape.outputs,
        evidence: serverCompletedRuleExecutionDtoSchema.shape.evidence,
        applicationOutputs: effectRepeatSaveApplicationOutputDtoSchema
      }),
      release: z.nullable(
        z.strictObject({
          characterOwnerTransitions: concentrationCleanupDtoSchema.shape.characterOwnerTransitions
        })
      ),
      ownerTransitions: movementOwnerTransitionsDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        const output = value.result.applicationOutputs
        if (
          value.result.occurrenceId !== output.occurrenceId ||
          value.result.occurrenceId === output.parentOccurrenceId
        )
          context.addIssue({
            code: 'custom',
            path: ['result', 'applicationOutputs'],
            message: 'A movement repeat save must retain its exact child identity.'
          })
        if ((value.release !== null) !== (output.released !== null))
          context.addIssue({
            code: 'custom',
            path: ['release'],
            message: 'A movement repeat save releases owners exactly when its save is made.'
          })
        validateMovementOwnerTransitions(value.ownerTransitions, value.release, context)
      })
    )
)

/** One source's saves at a contact keep unique child identities and the chain's canonical order. */
function refineMovementDamageSaveOrder(
  values: readonly {
    result: {
      occurrenceId: string
      applicationOutputs: Parameters<typeof damageSaveCheckBoundApplication>[0]
    }
  }[],
  context: z.core.$RefinementCtx
) {
  const ids = new Set<string>()
  let prior: DamageSaveApplicationDto | null = null
  for (const [index, value] of values.entries()) {
    const bound = damageSaveCheckBoundApplication(value.result.applicationOutputs)
    if (
      ids.has(value.result.occurrenceId) ||
      (prior !== null && compareDamageSaveApplications(prior, bound) >= 0)
    )
      context.addIssue({
        code: 'custom',
        path: [index],
        message:
          'Movement damage saves must have unique child identities and canonical chain order.'
      })
    ids.add(value.result.occurrenceId)
    prior = bound
  }
}

/** Every repeat save a contact's damage owed, one per effect and damage source, in chain order. */
export const movementRepeatSavesDtoSchema = lazySchema(() =>
  z
    .array(movementRepeatSaveExecutionDtoSchema)
    .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
    .check(z.superRefine(refineMovementDamageSaveOrder))
)

/**
 * A damaged holder's massive-damage save (ATTACK-16), settled at the movement contact whose damage
 * owed it. The save records its outcome and changes no Run state, so it retains no owner versions.
 */
export const movementMassiveDamageSaveExecutionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      sourceCommandId: ruleExecutionUuidSchema,
      result: z.strictObject({
        status: z.literal('COMPLETE'),
        occurrenceId: ruleExecutionUuidSchema,
        occurrenceVersion: z.literal(1),
        initialFactsChecksum: ruleExecutionChecksumSchema,
        outputs: serverCompletedRuleExecutionDtoSchema.shape.outputs,
        evidence: serverCompletedRuleExecutionDtoSchema.shape.evidence,
        applicationOutputs: massiveDamageSaveApplicationOutputDtoSchema
      })
    })
    .check(
      z.superRefine((value, context) => {
        const output = value.result.applicationOutputs
        if (
          value.result.occurrenceId !== output.occurrenceId ||
          value.result.occurrenceId === output.parentOccurrenceId
        )
          context.addIssue({
            code: 'custom',
            path: ['result', 'applicationOutputs'],
            message: 'A movement massive-damage save must retain its exact child identity.'
          })
      })
    )
)

/** Every massive-damage save a contact's damage owed, one per damage source, in chain order. */
export const movementMassiveDamageSavesDtoSchema = lazySchema(() =>
  z
    .array(movementMassiveDamageSaveExecutionDtoSchema)
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
    .check(z.superRefine(refineMovementDamageSaveOrder))
)

export type MovementConcentrationExecutionDto = z.infer<
  typeof movementConcentrationExecutionDtoSchema
>

export type MovementConcentrationEndDto = z.infer<typeof movementConcentrationEndDtoSchema>

export type MovementRepeatSaveExecutionDto = z.infer<typeof movementRepeatSaveExecutionDtoSchema>

export type MovementMassiveDamageSaveExecutionDto = z.infer<
  typeof movementMassiveDamageSaveExecutionDtoSchema
>

/** The child receipts a movement contact retains beside its damage. */
export type MovementContactChildren = {
  concentrationEnds?: readonly MovementConcentrationEndDto[]
  concentrationChecks?: readonly MovementConcentrationExecutionDto[]
  repeatSaves?: readonly MovementRepeatSaveExecutionDto[]
  massiveDamageSaves?: readonly MovementMassiveDamageSaveExecutionDto[]
}

/** A contact without its child receipts: they do not change the identity of the damage that caused them. */
export function movementContactDamageEnvelope<T extends MovementContactChildren>(
  contact: T
): Omit<T, keyof MovementContactChildren> {
  const {
    concentrationEnds: _ends,
    concentrationChecks: _checks,
    repeatSaves: _repeatSaves,
    massiveDamageSaves: _massiveDamageSaves,
    ...envelope
  } = contact
  return envelope
}

/**
 * A contact's damage saves in the order its damage owed them (the chain order they settled in): its
 * Concentration checks, its effect repeat saves and its massive-damage saves, each with the Character
 * versions it advanced (a massive-damage save advances none).
 */
export function movementDamageSaveChildren(
  contact: Omit<MovementContactChildren, 'concentrationEnds'>
) {
  return [
    ...(contact.concentrationChecks ?? []).map((execution, index) => ({
      kind: 'CONCENTRATION' as const,
      field: 'concentrationChecks' as const,
      index,
      execution,
      release: execution.result.applicationOutputs.cleanup,
      ownerTransitions: execution.ownerTransitions
    })),
    ...(contact.repeatSaves ?? []).map((execution, index) => ({
      kind: 'REPEAT_SAVE' as const,
      field: 'repeatSaves' as const,
      index,
      execution,
      release: execution.release,
      ownerTransitions: execution.ownerTransitions
    })),
    ...(contact.massiveDamageSaves ?? []).map((execution, index) => ({
      kind: 'MASSIVE_DAMAGE_SAVE' as const,
      field: 'massiveDamageSaves' as const,
      index,
      execution,
      release: null,
      ownerTransitions: [] as MovementRepeatSaveExecutionDto['ownerTransitions']
    }))
  ].sort((left, right) =>
    compareDamageSaveApplications(
      damageSaveCheckBoundApplication(left.execution.result.applicationOutputs),
      damageSaveCheckBoundApplication(right.execution.result.applicationOutputs)
    )
  )
}
