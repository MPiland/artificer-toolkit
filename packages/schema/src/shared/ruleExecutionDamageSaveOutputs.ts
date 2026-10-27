import { z, lazySchema } from '../zod.js'
import {
  MAX_CONCENTRATION_DAMAGE_APPLICATIONS,
  compareConcentrationDamageApplications,
  concentrationCheckTriggerDtoSchema,
  concentrationDamageApplicationDtoSchema,
  concentrationMaintainedDamageApplicationDtoSchema,
  massiveDamageSaveDamageApplicationDtoSchema,
  type DamageSaveApplicationDto
} from './ruleExecutionConcentration.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import {
  concentrationCleanupDtoSchema,
  ruleCheckD20EvidenceDtoSchema
} from './ruleExecutionEncounterApplications.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

/** The pins every settled damage save keeps: the saving throw, the vocabulary and the holder's stream. */
const damageSaveHolderPinFields = () => ({
  savingThrowAbilityDefinitionId: uuidSchema,
  systemVocabularySnapshot: z.strictObject({
    id: uuidSchema,
    version: integerSchema.check(z.gte(1)),
    checksum: checksumSchema
  }),
  /** The pinned Character stream; null for a Creature or custom actor holder. */
  targetCharacter: z.nullable(
    z.strictObject({
      streamVersion: aggregateVersionSchema,
      baseProjectionChecksum: checksumSchema,
      campaignOverlayChecksum: checksumSchema,
      mechanicalContextChecksum: checksumSchema
    })
  )
})

export const concentrationCheckApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('DAMAGE_SAVE_CHECK'),
      source: z.literal('CONCENTRATION'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      parentOccurrenceId: uuidSchema,
      concentrationDefinition: z.strictObject({
        id: uuidSchema,
        checksum: checksumSchema
      }),
      ...damageSaveHolderPinFields(),
      application: concentrationMaintainedDamageApplicationDtoSchema,
      /** The context's display trigger, so every settled check can be logged without its context. */
      trigger: concentrationCheckTriggerDtoSchema,
      outcome: z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE']),
      d20: ruleCheckD20EvidenceDtoSchema,
      contextChecksum: checksumSchema,
      cleanup: z.nullable(concentrationCleanupDtoSchema),
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
)

/**
 * A damaged holder's effect repeat save, settled (D167). A made save ends the effect; the receipt
 * keeps the ids the release touched so undo and the log need not re-read the removed row.
 */
export const effectRepeatSaveApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('DAMAGE_SAVE_CHECK'),
      source: z.literal('EFFECT_REPEAT_SAVE'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      parentOccurrenceId: uuidSchema,
      activeEffect: z.strictObject({
        id: uuidSchema,
        version: integerSchema.check(z.gte(0)),
        lifecycleChecksum: checksumSchema
      }),
      ...damageSaveHolderPinFields(),
      application: concentrationDamageApplicationDtoSchema,
      trigger: concentrationCheckTriggerDtoSchema,
      outcome: z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE']),
      d20: ruleCheckD20EvidenceDtoSchema,
      contextChecksum: checksumSchema,
      /** The effect a made save ended; null on a failed save, which changes nothing. */
      released: z.nullable(
        z.strictObject({
          activeEffectId: uuidSchema,
          removedConditionIds: z
            .array(uuidSchema)
            .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
        })
      ),
      nextOccurrenceId: z.nullable(uuidSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if ((value.outcome === 'SAVE_SUCCESS') !== (value.released !== null))
          context.addIssue({
            code: 'custom',
            path: ['released'],
            message: 'An effect is released exactly on a made repeat save.'
          })
        if (value.released && value.released.activeEffectId !== value.activeEffect.id)
          context.addIssue({
            code: 'custom',
            path: ['released', 'activeEffectId'],
            message: 'The release must end the checked effect.'
          })
        if (value.trigger.dc !== value.d20.dc)
          context.addIssue({
            code: 'custom',
            path: ['trigger', 'dc'],
            message: 'The repeat-save trigger must name the checked DC.'
          })
      })
    )
)

/**
 * A massive-damage save, settled (ATTACK-16). The check only records its outcome; what a failure
 * leads to is the System's own follow-up, so the save itself changes no Run state.
 */
export const massiveDamageSaveApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('DAMAGE_SAVE_CHECK'),
      source: z.literal('MASSIVE_DAMAGE'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      parentOccurrenceId: uuidSchema,
      optionalCombatDefinition: z.strictObject({
        id: uuidSchema,
        version: integerSchema.check(z.gte(1)),
        checksum: checksumSchema
      }),
      ...damageSaveHolderPinFields(),
      application: massiveDamageSaveDamageApplicationDtoSchema,
      trigger: concentrationCheckTriggerDtoSchema,
      outcome: z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE']),
      d20: ruleCheckD20EvidenceDtoSchema,
      contextChecksum: checksumSchema,
      nextOccurrenceId: z.nullable(uuidSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if (value.application.optionalCombatDefinitionId !== value.optionalCombatDefinition.id)
          context.addIssue({
            code: 'custom',
            path: ['application', 'optionalCombatDefinitionId'],
            message: 'The massive-damage save must name the pinned rule.'
          })
        if (value.trigger.dc !== value.d20.dc)
          context.addIssue({
            code: 'custom',
            path: ['trigger', 'dc'],
            message: 'The massive-damage trigger must name the checked DC.'
          })
      })
    )
)

export const damageSaveCheckApplicationOutputDtoSchema = lazySchema(() =>
  z.discriminatedUnion('source', [
    concentrationCheckApplicationOutputDtoSchema,
    effectRepeatSaveApplicationOutputDtoSchema,
    massiveDamageSaveApplicationOutputDtoSchema
  ])
)

type DamageSaveCheckApplicationOutput = z.infer<typeof damageSaveCheckApplicationOutputDtoSchema>

/** The chain item a settled check answered: its damage bound to the state or effect it checked. */
export function damageSaveCheckBoundApplication(
  output: DamageSaveCheckApplicationOutput
): DamageSaveApplicationDto {
  switch (output.source) {
    case 'CONCENTRATION':
    case 'MASSIVE_DAMAGE':
      return output.application
    case 'EFFECT_REPEAT_SAVE':
      return { ...output.application, activeEffectId: output.activeEffect.id }
  }
}

/**
 * Whether a settled check changed Run state, so its commit advances the Run version once (D23): a
 * lost Concentration, or an effect a made repeat save ended.
 */
export function damageSaveCheckMutatesRun(output: DamageSaveCheckApplicationOutput) {
  switch (output.source) {
    case 'CONCENTRATION':
      return output.outcome === 'SAVE_FAILURE'
    case 'EFFECT_REPEAT_SAVE':
      return output.outcome === 'SAVE_SUCCESS'
    case 'MASSIVE_DAMAGE':
      return false
  }
}
