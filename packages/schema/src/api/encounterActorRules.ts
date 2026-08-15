import { z } from 'zod'

import { AUTHORED_LIMITS, authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { chargeUseDtoSchema } from '../shared/charge.js'
import { abilityCodeSchema, chargeResetKindSchema } from '../shared/enums.js'

export const ENCOUNTER_ACTOR_MODEL_KEY = 'encounter-actor-policy'

const encounterActorFeatureResourceFactSchema = z.strictObject({
  featureId: authoredIdentifierSchema,
  charge: chargeUseDtoSchema.nullable(),
  used: z.number().int().nonnegative()
})

const encounterActorRuleFactSchema = z
  .strictObject({
    actorId: z.string().uuid(),
    abilityScores: z.partialRecord(abilityCodeSchema, z.number().finite()),
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

const encounterActorFeatureResourceResultSchema = z.strictObject({
  featureId: authoredIdentifierSchema,
  maximum: z.number().int().positive().nullable(),
  rawUsed: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative().nullable(),
  resetKind: chargeResetKindSchema.nullable()
})

const encounterActorRuleResultSchema = z.strictObject({
  actorId: z.string().uuid(),
  initiativeModifier: z.number().int(),
  featureResources: z
    .array(encounterActorFeatureResourceResultSchema)
    .max(AUTHORED_LIMITS.nestedCollectionItems)
})

export const encounterActorRuleOutputSchema = z.strictObject({
  actors: z.array(encounterActorRuleResultSchema).max(AUTHORED_LIMITS.nestedCollectionItems)
})

export type EncounterActorRuleInput = z.infer<typeof encounterActorRuleInputSchema>
export type EncounterActorRuleOutput = z.infer<typeof encounterActorRuleOutputSchema>
export type EncounterActorRuleResult = z.infer<typeof encounterActorRuleResultSchema>
export type EncounterActorFeatureResourceResult = z.infer<
  typeof encounterActorFeatureResourceResultSchema
>
