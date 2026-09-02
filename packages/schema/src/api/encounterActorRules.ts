import { z } from 'zod'

import { AUTHORED_LIMITS, authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { chargeUseDtoSchema } from '../shared/charge.js'
import { abilityCodeSchema, chargeResetKindSchema } from '../shared/enums.js'
import { serverUuidIdentityDtoSchema } from '../shared/rulesExecution.js'

export const ENCOUNTER_ACTOR_MODEL_KEY = 'encounter-actor-policy'

export const encounterActorResourceReconciliationPolicySchema = z.enum(['CLAMP_USED_TO_MAXIMUM'])

const encounterActorTargetDefenseSchema = z.strictObject({
  kind: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
  damageTypeId: serverUuidIdentityDtoSchema
})

const normalizedEncounterActorTargetProtectionSchema = z
  .strictObject({
    status: z.literal('NORMALIZED'),
    defenses: z.array(encounterActorTargetDefenseSchema).max(100),
    conditionImmunityIds: z.array(serverUuidIdentityDtoSchema).max(100)
  })
  .superRefine((protection, ctx) => {
    const defenseKeys = new Set<string>()
    protection.defenses.forEach((defense, index) => {
      const key = `${defense.kind}:${defense.damageTypeId}`
      if (defenseKeys.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Encounter target defenses must be unique.',
          path: ['defenses', index]
        })
      }
      defenseKeys.add(key)
    })
    const conditionIds = new Set<string>()
    protection.conditionImmunityIds.forEach((conditionId, index) => {
      if (conditionIds.has(conditionId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Encounter condition immunity identities must be unique.',
          path: ['conditionImmunityIds', index]
        })
      }
      conditionIds.add(conditionId)
    })
  })

const encounterActorTargetProtectionSchema = z.discriminatedUnion('status', [
  normalizedEncounterActorTargetProtectionSchema,
  z.strictObject({ status: z.literal('NOT_NORMALIZED') })
])

const encounterActorFeatureResourceFactSchema = z.strictObject({
  featureId: authoredIdentifierSchema,
  charge: chargeUseDtoSchema.nullable(),
  used: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
})

export const encounterCreatureRuleFactsSnapshotSchema = z
  .strictObject({
    gameSystemId: serverUuidIdentityDtoSchema,
    vocabularySnapshotId: serverUuidIdentityDtoSchema,
    vocabularySnapshotVersion: z.number().int().positive(),
    vocabularySnapshotChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    abilityScores: z.record(serverUuidIdentityDtoSchema, z.number().finite()),
    /** UUID-backed check totals pinned with the Creature Blueprint snapshot. */
    checkTotals: z.record(serverUuidIdentityDtoSchema, z.number().int()).optional(),
    resourceAbilityScores: z.partialRecord(abilityCodeSchema, z.number().finite()),
    initiativeAbilityDefinitionId: serverUuidIdentityDtoSchema
  })
  .superRefine((facts, ctx) => {
    if (Object.keys(facts.abilityScores).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Creature rule facts require at least one normalized ability score.',
        path: ['abilityScores']
      })
    }
    if (!(facts.initiativeAbilityDefinitionId in facts.abilityScores)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Creature initiative ability must reference a normalized ability score.',
        path: ['initiativeAbilityDefinitionId']
      })
    }
  })

const encounterActorRuleFactSchema = z
  .strictObject({
    actorId: z.string().uuid(),
    /** Immutable Blueprint-compiled UUID facts; legacy ability-code payloads never reach rules. */
    abilityScores: z.record(serverUuidIdentityDtoSchema, z.number().finite()),
    /** Immutable Blueprint-compiled UUID check totals; codes and labels are never evaluated. */
    checkTotals: z.record(serverUuidIdentityDtoSchema, z.number().int()).default({}),
    resourceAbilityScores: z.partialRecord(abilityCodeSchema, z.number().finite()).optional(),
    initiativeAbilityDefinitionId: serverUuidIdentityDtoSchema.nullable().optional(),
    vocabularySnapshot: z
      .strictObject({
        id: serverUuidIdentityDtoSchema,
        version: z.number().int().positive(),
        checksum: z.string().regex(/^[a-f0-9]{64}$/)
      })
      .nullable()
      .optional(),
    targetProtection: encounterActorTargetProtectionSchema,
    featureResources: z
      .array(encounterActorFeatureResourceFactSchema)
      .max(AUTHORED_LIMITS.nestedCollectionItems)
  })
  .superRefine((actor, ctx) => {
    const featureIds = new Set<string>()
    actor.featureResources.forEach((feature, index) => {
      if (featureIds.has(feature.featureId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Feature resource ID "${feature.featureId}" is duplicated.`,
          path: ['featureResources', index, 'featureId']
        })
      }
      featureIds.add(feature.featureId)
    })
  })

export const encounterActorRuleInputSchema = z
  .strictObject({
    contractVersion: z.literal(1),
    actors: z.array(encounterActorRuleFactSchema).max(AUTHORED_LIMITS.nestedCollectionItems)
  })
  .superRefine((input, ctx) => {
    const actorIds = new Set<string>()
    input.actors.forEach((actor, index) => {
      if (actorIds.has(actor.actorId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Encounter actor ID "${actor.actorId}" is duplicated.`,
          path: ['actors', index, 'actorId']
        })
      }
      actorIds.add(actor.actorId)
    })
  })

const encounterActorFeatureResourceResultSchema = z
  .strictObject({
    featureId: authoredIdentifierSchema,
    maximum: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
    reconciliationPolicy: encounterActorResourceReconciliationPolicySchema.nullable(),
    rawUsed: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    used: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    remaining: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
    resetKind: chargeResetKindSchema.nullable()
  })
  .superRefine((resource, ctx) => {
    const finite = resource.maximum !== null
    const complete =
      resource.reconciliationPolicy !== null &&
      resource.remaining !== null &&
      resource.resetKind !== null
    const absent =
      resource.reconciliationPolicy === null &&
      resource.remaining === null &&
      resource.resetKind === null
    if (finite ? !complete : !absent) {
      ctx.addIssue({
        code: 'custom',
        message: 'Encounter feature resource finite state is incomplete.'
      })
    }
  })

const encounterActorRuleResultSchema = z
  .strictObject({
    actorId: z.string().uuid(),
    initiativeModifier: z.number().int(),
    savingThrowDefinitions: z
      .array(
        z.strictObject({
          abilityDefinitionId: serverUuidIdentityDtoSchema,
          modifier: z.number().int(),
          rollMode: z.literal('NORMAL'),
          contributors: z.array(z.never()).max(0)
        })
      )
      .max(16)
      .optional(),
    targetProtection: encounterActorTargetProtectionSchema,
    featureResources: z
      .array(encounterActorFeatureResourceResultSchema)
      .max(AUTHORED_LIMITS.nestedCollectionItems)
  })
  .superRefine((actor, ctx) => {
    const savingThrowIds = new Set<string>()
    let priorSavingThrowId = ''
    actor.savingThrowDefinitions?.forEach((savingThrow, index) => {
      if (
        savingThrowIds.has(savingThrow.abilityDefinitionId) ||
        savingThrow.abilityDefinitionId <= priorSavingThrowId
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Encounter saving-throw definitions must be unique and canonically ordered.',
          path: ['savingThrowDefinitions', index, 'abilityDefinitionId']
        })
      }
      savingThrowIds.add(savingThrow.abilityDefinitionId)
      priorSavingThrowId = savingThrow.abilityDefinitionId
    })
    const resourceIds = new Set<string>()
    actor.featureResources.forEach((resource, index) => {
      if (resourceIds.has(resource.featureId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Encounter feature resource ID "${resource.featureId}" is duplicated.`,
          path: ['featureResources', index, 'featureId']
        })
      }
      resourceIds.add(resource.featureId)
    })
  })

export const encounterActorRuleOutputSchema = z
  .strictObject({
    actors: z.array(encounterActorRuleResultSchema).max(AUTHORED_LIMITS.nestedCollectionItems)
  })
  .superRefine((output, ctx) => {
    const actorIds = new Set<string>()
    output.actors.forEach((actor, index) => {
      if (actorIds.has(actor.actorId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Encounter actor ID "${actor.actorId}" is duplicated.`,
          path: ['actors', index, 'actorId']
        })
      }
      actorIds.add(actor.actorId)
    })
  })

export type EncounterActorRuleInput = z.infer<typeof encounterActorRuleInputSchema>
export type EncounterActorRuleOutput = z.infer<typeof encounterActorRuleOutputSchema>
export type EncounterCreatureRuleFactsSnapshot = z.infer<
  typeof encounterCreatureRuleFactsSnapshotSchema
>
export type EncounterActorRuleResult = z.infer<typeof encounterActorRuleResultSchema>
export type EncounterActorFeatureResourceResult = z.infer<
  typeof encounterActorFeatureResourceResultSchema
>
