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

const encounterActorRuleFactSchema = z
  .strictObject({
    actorId: z.string().uuid(),
    abilityScores: z.partialRecord(abilityCodeSchema, z.number().finite()),
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
    targetProtection: encounterActorTargetProtectionSchema,
    featureResources: z
      .array(encounterActorFeatureResourceResultSchema)
      .max(AUTHORED_LIMITS.nestedCollectionItems)
  })
  .superRefine((actor, ctx) => {
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
export type EncounterActorRuleResult = z.infer<typeof encounterActorRuleResultSchema>
export type EncounterActorFeatureResourceResult = z.infer<
  typeof encounterActorFeatureResourceResultSchema
>
