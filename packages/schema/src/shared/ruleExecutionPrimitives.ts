import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { serverUuidIdentityDtoSchema } from './serverUuidIdentity.js'

export const ruleExecutionUuidSchema = serverUuidIdentityDtoSchema
export const ruleExecutionChecksumSchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-f0-9]{64}$/))
)
export const ruleExecutionIdentifierSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)
export const ruleExecutionIntegerSchema = lazySchema(() => z.number().check(z.int()))
export const ruleExecutionNonNegativeIntegerSchema = lazySchema(() =>
  ruleExecutionIntegerSchema.check(z.nonnegative())
)
export const ruleExecutionPositiveIntegerSchema = lazySchema(() =>
  ruleExecutionIntegerSchema.check(z.positive())
)
export const ruleExecutionContractVersionSchema = lazySchema(() =>
  ruleExecutionPositiveIntegerSchema.check(z.lte(10_000))
)
export const ruleExecutionCapabilityKeySchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/))
)
export const ruleExecutionLocalNodeIdSchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/))
)
export const ruleExecutionPortNameSchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-z][a-zA-Z0-9_]{0,79}$/))
)
export const ruleExecutionAggregateVersionSchema = lazySchema(() =>
  ruleExecutionIntegerSchema.check(z.gte(0))
)
export const ruleExecutionReceiptOrdinalSchema = lazySchema(() =>
  ruleExecutionIntegerSchema.check(z.gte(0)).check(z.lte(RULE_GRAPH_LIMITS.NODES - 1))
)
export const ruleExecutionReceiptD20FaceSchema = lazySchema(() =>
  ruleExecutionIntegerSchema.check(z.gte(1)).check(z.lte(20))
)
