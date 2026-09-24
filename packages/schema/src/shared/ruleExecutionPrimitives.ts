import { z } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { serverUuidIdentityDtoSchema } from './serverUuidIdentity.js'

export const ruleExecutionUuidSchema = serverUuidIdentityDtoSchema
export const ruleExecutionChecksumSchema = z.string().check(z.regex(/^[a-f0-9]{64}$/))
export const ruleExecutionIdentifierSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(240))
export const ruleExecutionIntegerSchema = z.number().check(z.int())
export const ruleExecutionNonNegativeIntegerSchema = ruleExecutionIntegerSchema.check(
  z.nonnegative()
)
export const ruleExecutionPositiveIntegerSchema = ruleExecutionIntegerSchema.check(z.positive())
export const ruleExecutionContractVersionSchema = ruleExecutionPositiveIntegerSchema.check(
  z.lte(10_000)
)
export const ruleExecutionCapabilityKeySchema = z.string().check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/))
export const ruleExecutionLocalNodeIdSchema = z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/))
export const ruleExecutionPortNameSchema = z.string().check(z.regex(/^[a-z][a-zA-Z0-9_]{0,79}$/))
export const ruleExecutionAggregateVersionSchema = ruleExecutionIntegerSchema.check(z.gte(0))
export const ruleExecutionReceiptOrdinalSchema = ruleExecutionIntegerSchema
  .check(z.gte(0))
  .check(z.lte(RULE_GRAPH_LIMITS.NODES - 1))
export const ruleExecutionReceiptD20FaceSchema = ruleExecutionIntegerSchema
  .check(z.gte(1))
  .check(z.lte(20))
