import { z, lazySchema } from '../zod.js'

import { characterMechanicSourceSchema } from './characterGrantFoldRules.js'
import { characterResourcePoolIdentitySchema } from '../shared/characterResourceIdentity.js'

const boundedIdentitySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

export const characterChargeSourceLevelSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('CLASS_LEVEL'), classId: boundedIdentitySchema }),
    z.strictObject({ kind: z.literal('CHARACTER_LEVEL') })
  ])
)

export const characterResourceOwnerKindSchema = lazySchema(() =>
  z.enum([
    'AUTHORED_GRANT',
    'AUTHORED_SOURCE',
    'ITEM_INSTANCE',
    'COMPANION_FEATURE',
    'SPELL_SOURCE'
  ])
)

export const characterResourceResetKindSchema = lazySchema(() =>
  z.enum(['DAILY', 'DAWN', 'DUSK', 'LONG_REST', 'SHORT_REST', 'MANUAL'])
)

const resourcePoolCommonSchema = lazySchema(() =>
  z.strictObject({
    sequence: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9999)),
    poolId: characterResourcePoolIdentitySchema,
    resourceDefinitionId: boundedIdentitySchema,
    chargeId: boundedIdentitySchema,
    chargeCalculationId: characterResourcePoolIdentitySchema,
    baseResetKind: characterResourceResetKindSchema
  })
)

export const characterResourcePoolCandidateSchema = lazySchema(() =>
  z.discriminatedUnion('ownerKind', [
    z.extend(resourcePoolCommonSchema, {
      ownerKind: z.literal('AUTHORED_GRANT'),
      resourceGrantId: boundedIdentitySchema,
      availableAtLevel: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)),
      activeSourceLevel: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))
    }),
    z.extend(resourcePoolCommonSchema, {
      ownerKind: z.literal('AUTHORED_SOURCE'),
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema
    }),
    z.extend(resourcePoolCommonSchema, {
      ownerKind: z.literal('ITEM_INSTANCE'),
      itemInstanceId: boundedIdentitySchema,
      sourceId: z.nullable(boundedIdentitySchema)
    }),
    z.extend(resourcePoolCommonSchema, {
      ownerKind: z.literal('COMPANION_FEATURE'),
      companionInstanceId: boundedIdentitySchema,
      featureId: boundedIdentitySchema
    }),
    z.extend(resourcePoolCommonSchema, {
      ownerKind: z.literal('SPELL_SOURCE'),
      accessId: boundedIdentitySchema,
      sourceInstanceId: boundedIdentitySchema,
      spellId: boundedIdentitySchema
    })
  ])
)

export const characterResourcePoolCandidatesSchema = lazySchema(() =>
  z
    .array(characterResourcePoolCandidateSchema)
    .check(z.maxLength(500))
    .check(
      z.superRefine((candidates, context) => {
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
    )
)

export const characterResourceUsageFactsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        poolId: characterResourcePoolIdentitySchema,
        rawUsed: z.number().check(z.int()).check(z.gte(0)).check(z.lte(2_147_483_647))
      })
    )
    .check(z.maxLength(500))
    .check(
      z.superRefine((usage, context) => {
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
    )
)

const characterResourceChargeContributionSchema = lazySchema(() =>
  z.strictObject({
    sourceId: boundedIdentitySchema,
    value: z.number().check(z.int())
  })
)

const characterResourceResetResolutionSchema = lazySchema(() =>
  z.strictObject({
    baseResetKind: characterResourceResetKindSchema,
    appliedGrantId: z.nullable(boundedIdentitySchema),
    source: z.nullable(characterMechanicSourceSchema)
  })
)

const resourceOutputCommonSchema = lazySchema(() =>
  z.strictObject({
    sequence: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9999)),
    poolId: characterResourcePoolIdentitySchema,
    resourceDefinitionId: boundedIdentitySchema,
    chargeId: boundedIdentitySchema,
    chargeCalculationId: characterResourcePoolIdentitySchema,
    state: z.enum(['RESOLVED', 'UNRESOLVED']),
    maximum: z.nullable(z.number().check(z.int()).check(z.gte(0))),
    rawUsed: z.number().check(z.int()).check(z.gte(0)).check(z.lte(2_147_483_647)),
    effectiveUsed: z.nullable(z.number().check(z.int()).check(z.gte(0))),
    remaining: z.nullable(z.number().check(z.int()).check(z.gte(0))),
    reasonCode: z.enum(['CALCULATED', 'MISSING_REQUIRED_FACT']),
    baseContribution: z.nullable(characterResourceChargeContributionSchema),
    bonusContributions: z.array(characterResourceChargeContributionSchema),
    resetKind: characterResourceResetKindSchema,
    resetResolution: characterResourceResetResolutionSchema
  })
)

export const characterResourceSchema = lazySchema(() =>
  z.discriminatedUnion('ownerKind', [
    z.extend(resourceOutputCommonSchema, {
      ownerKind: z.literal('AUTHORED_GRANT'),
      resourceGrantId: boundedIdentitySchema,
      availableAtLevel: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)),
      activeSourceLevel: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))
    }),
    z.extend(resourceOutputCommonSchema, {
      ownerKind: z.literal('AUTHORED_SOURCE'),
      sourceId: boundedIdentitySchema,
      source: characterMechanicSourceSchema
    }),
    z.extend(resourceOutputCommonSchema, {
      ownerKind: z.literal('ITEM_INSTANCE'),
      itemInstanceId: boundedIdentitySchema,
      sourceId: z.nullable(boundedIdentitySchema)
    }),
    z.extend(resourceOutputCommonSchema, {
      ownerKind: z.literal('COMPANION_FEATURE'),
      companionInstanceId: boundedIdentitySchema,
      featureId: boundedIdentitySchema
    }),
    z.extend(resourceOutputCommonSchema, {
      ownerKind: z.literal('SPELL_SOURCE'),
      accessId: boundedIdentitySchema,
      sourceInstanceId: boundedIdentitySchema,
      spellId: boundedIdentitySchema
    })
  ])
)

export const characterResourcesSchema = lazySchema(() =>
  z
    .array(characterResourceSchema)
    .check(z.maxLength(500))
    .check(
      z.superRefine((resources, context) => {
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
    )
)

export type CharacterChargeSourceLevel = z.infer<typeof characterChargeSourceLevelSchema>
export type CharacterResourcePoolCandidate = z.infer<typeof characterResourcePoolCandidateSchema>
export type CharacterResourceUsageFacts = z.infer<typeof characterResourceUsageFactsSchema>
export type CharacterResource = z.infer<typeof characterResourceSchema>
