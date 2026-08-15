import { z } from 'zod'

import { characterMechanicSourceSchema } from './characterGrantFoldRules.js'

const boundedIdentitySchema = z.string().trim().min(1).max(240)

export const characterChargeSourceLevelSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CLASS_LEVEL'), classId: boundedIdentitySchema }),
  z.strictObject({ kind: z.literal('CHARACTER_LEVEL') })
])

export const characterResourceOwnerKindSchema = z.enum([
  'AUTHORED_GRANT',
  'AUTHORED_SOURCE',
  'ITEM_INSTANCE',
  'COMPANION_FEATURE',
  'SPELL_SOURCE'
])

export const characterResourceResetKindSchema = z.enum([
  'DAILY',
  'DAWN',
  'DUSK',
  'LONG_REST',
  'SHORT_REST',
  'MANUAL'
])

const resourcePoolCommonSchema = z.strictObject({
  sequence: z.number().int().min(0).max(9999),
  poolId: boundedIdentitySchema,
  resourceDefinitionId: boundedIdentitySchema,
  chargeId: boundedIdentitySchema,
  chargeCalculationId: boundedIdentitySchema,
  baseResetKind: characterResourceResetKindSchema
})

export const characterResourcePoolCandidateSchema = z.discriminatedUnion('ownerKind', [
  resourcePoolCommonSchema.extend({
    ownerKind: z.literal('AUTHORED_GRANT'),
    resourceGrantId: boundedIdentitySchema,
    availableAtLevel: z.number().int().min(1).max(20),
    activeSourceLevel: z.number().int().min(1).max(20)
  }),
  resourcePoolCommonSchema.extend({
    ownerKind: z.literal('AUTHORED_SOURCE'),
    sourceId: boundedIdentitySchema,
    source: characterMechanicSourceSchema
  }),
  resourcePoolCommonSchema.extend({
    ownerKind: z.literal('ITEM_INSTANCE'),
    itemInstanceId: boundedIdentitySchema,
    sourceId: boundedIdentitySchema.nullable()
  }),
  resourcePoolCommonSchema.extend({
    ownerKind: z.literal('COMPANION_FEATURE'),
    companionInstanceId: boundedIdentitySchema,
    featureId: boundedIdentitySchema
  }),
  resourcePoolCommonSchema.extend({
    ownerKind: z.literal('SPELL_SOURCE'),
    accessId: boundedIdentitySchema,
    sourceInstanceId: boundedIdentitySchema,
    spellId: boundedIdentitySchema
  })
])

export const characterResourcePoolCandidatesSchema = z
  .array(characterResourcePoolCandidateSchema)
  .max(500)
  .superRefine((candidates, context) => {
    const poolIds = new Set<string>()
    const calculationIds = new Set<string>()
    for (const [index, candidate] of candidates.entries()) {
      if (candidate.sequence !== index) {
        context.addIssue({
          code: 'custom',
          message: 'Resource pool candidates must use contiguous source order',
          path: [index, 'sequence']
        })
      }
      if (poolIds.has(candidate.poolId)) {
        context.addIssue({
          code: 'custom',
          message: 'Resource pool IDs must be unique',
          path: [index, 'poolId']
        })
      }
      if (calculationIds.has(candidate.chargeCalculationId)) {
        context.addIssue({
          code: 'custom',
          message: 'Resource charge calculation IDs must be unique',
          path: [index, 'chargeCalculationId']
        })
      }
      if (candidate.poolId !== candidate.chargeCalculationId) {
        context.addIssue({
          code: 'custom',
          message: 'Resource pool and charge calculation IDs must match',
          path: [index, 'chargeCalculationId']
        })
      }
      poolIds.add(candidate.poolId)
      calculationIds.add(candidate.chargeCalculationId)
    }
  })

export const characterResourceUsageFactsSchema = z
  .array(
    z.strictObject({
      poolId: boundedIdentitySchema,
      rawUsed: z.number().int().min(0).max(2_147_483_647)
    })
  )
  .max(500)
  .superRefine((usage, context) => {
    const poolIds = new Set<string>()
    for (const [index, entry] of usage.entries()) {
      if (poolIds.has(entry.poolId)) {
        context.addIssue({
          code: 'custom',
          message: 'Resource usage pool IDs must be unique',
          path: [index, 'poolId']
        })
      }
      poolIds.add(entry.poolId)
    }
  })

const characterResourceChargeContributionSchema = z.strictObject({
  sourceId: boundedIdentitySchema,
  value: z.number().int()
})

const characterResourceResetResolutionSchema = z.strictObject({
  baseResetKind: characterResourceResetKindSchema,
  appliedGrantId: boundedIdentitySchema.nullable(),
  source: characterMechanicSourceSchema.nullable()
})

const resourceOutputCommonSchema = z.strictObject({
  sequence: z.number().int().min(0).max(9999),
  poolId: boundedIdentitySchema,
  resourceDefinitionId: boundedIdentitySchema,
  chargeId: boundedIdentitySchema,
  chargeCalculationId: boundedIdentitySchema,
  state: z.enum(['RESOLVED', 'UNRESOLVED']),
  maximum: z.number().int().min(0).nullable(),
  rawUsed: z.number().int().min(0).max(2_147_483_647),
  effectiveUsed: z.number().int().min(0).nullable(),
  remaining: z.number().int().min(0).nullable(),
  reasonCode: z.enum(['CALCULATED', 'MISSING_REQUIRED_FACT']),
  baseContribution: characterResourceChargeContributionSchema.nullable(),
  bonusContributions: z.array(characterResourceChargeContributionSchema),
  resetKind: characterResourceResetKindSchema,
  resetResolution: characterResourceResetResolutionSchema
})

export const characterResourceSchema = z.discriminatedUnion('ownerKind', [
  resourceOutputCommonSchema.extend({
    ownerKind: z.literal('AUTHORED_GRANT'),
    resourceGrantId: boundedIdentitySchema,
    availableAtLevel: z.number().int().min(1).max(20),
    activeSourceLevel: z.number().int().min(1).max(20)
  }),
  resourceOutputCommonSchema.extend({
    ownerKind: z.literal('AUTHORED_SOURCE'),
    sourceId: boundedIdentitySchema,
    source: characterMechanicSourceSchema
  }),
  resourceOutputCommonSchema.extend({
    ownerKind: z.literal('ITEM_INSTANCE'),
    itemInstanceId: boundedIdentitySchema,
    sourceId: boundedIdentitySchema.nullable()
  }),
  resourceOutputCommonSchema.extend({
    ownerKind: z.literal('COMPANION_FEATURE'),
    companionInstanceId: boundedIdentitySchema,
    featureId: boundedIdentitySchema
  }),
  resourceOutputCommonSchema.extend({
    ownerKind: z.literal('SPELL_SOURCE'),
    accessId: boundedIdentitySchema,
    sourceInstanceId: boundedIdentitySchema,
    spellId: boundedIdentitySchema
  })
])

export const characterResourcesSchema = z
  .array(characterResourceSchema)
  .max(500)
  .superRefine((resources, context) => {
    const poolIds = new Set<string>()
    const calculationIds = new Set<string>()
    for (const [index, resource] of resources.entries()) {
      if (poolIds.has(resource.poolId)) {
        context.addIssue({
          code: 'custom',
          message: 'Resource pool IDs must be unique',
          path: [index, 'poolId']
        })
      }
      if (calculationIds.has(resource.chargeCalculationId)) {
        context.addIssue({
          code: 'custom',
          message: 'Resource charge calculation IDs must be unique',
          path: [index, 'chargeCalculationId']
        })
      }
      if (resource.poolId !== resource.chargeCalculationId) {
        context.addIssue({
          code: 'custom',
          message: 'Resource pool and charge calculation IDs must match',
          path: [index, 'chargeCalculationId']
        })
      }

      const validState =
        resource.state === 'RESOLVED'
          ? resource.maximum !== null &&
            resource.effectiveUsed !== null &&
            resource.remaining !== null &&
            resource.effectiveUsed === Math.min(resource.rawUsed, resource.maximum) &&
            resource.remaining === Math.max(resource.maximum - resource.effectiveUsed, 0) &&
            resource.reasonCode === 'CALCULATED' &&
            resource.baseContribution !== null
          : resource.maximum === null &&
            resource.effectiveUsed === null &&
            resource.remaining === null &&
            resource.reasonCode === 'MISSING_REQUIRED_FACT' &&
            resource.baseContribution === null &&
            resource.bonusContributions.length === 0
      if (!validState) {
        context.addIssue({
          code: 'custom',
          message: 'Resource state does not match its resolution facts',
          path: [index, 'state']
        })
      }

      poolIds.add(resource.poolId)
      calculationIds.add(resource.chargeCalculationId)
    }
  })

export type CharacterChargeSourceLevel = z.infer<typeof characterChargeSourceLevelSchema>
export type CharacterResourcePoolCandidate = z.infer<typeof characterResourcePoolCandidateSchema>
export type CharacterResourceUsageFacts = z.infer<typeof characterResourceUsageFactsSchema>
export type CharacterResource = z.infer<typeof characterResourceSchema>
