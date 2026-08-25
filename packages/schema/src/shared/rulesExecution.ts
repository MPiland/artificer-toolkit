import { z } from 'zod'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'

import {
  ruleGraphDefinitionDtoSchema,
  ruleOperationReferenceDtoSchema,
  ruleValueDtoSchema
} from '../api/rulesRuntime.js'

const uuidSchema = z.string().uuid()
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const contractVersionSchema = z.number().int().positive().max(10_000)
const capabilityKeySchema = z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/)
const localNodeIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/)
const portNameSchema = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,79}$/)

/** Server-only current published source returned by an authorized repository seam. */
export const serverPublishedRuleDefinitionDtoSchema = z.strictObject({
  id: uuidSchema,
  gameSystemId: uuidSchema,
  definitionFamilyKey: capabilityKeySchema,
  checksum: checksumSchema,
  definition: ruleGraphDefinitionDtoSchema
})

/** Server-only runtime invocation after domain authorization and capability discovery. */
export const serverRuleExecutionInputDtoSchema = z.strictObject({
  definitionId: uuidSchema,
  facts: z
    .record(capabilityKeySchema, ruleValueDtoSchema)
    .refine((facts) => Object.keys(facts).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS, {
      message: `Rule execution supports at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} runtime facts.`
    })
})

export const ruleGraphSourceIdentityDtoSchema = z.strictObject({
  definitionId: uuidSchema,
  gameSystemId: uuidSchema,
  definitionFamilyKey: capabilityKeySchema,
  checksum: checksumSchema
})

export const serverRuleExecutionTraceEntryDtoSchema = z.strictObject({
  nodeId: localNodeIdSchema,
  operation: ruleOperationReferenceDtoSchema,
  inputs: z.record(portNameSchema, ruleValueDtoSchema),
  outputs: z.record(portNameSchema, ruleValueDtoSchema)
})

/**
 * Server-only evidence. It may contain private consumed facts and operation values. Product services
 * must project/redact domain results before returning anything to a browser or live-session client.
 */
export const serverCompletedRuleExecutionDtoSchema = z.strictObject({
  status: z.literal('COMPLETE'),
  outputs: z.record(portNameSchema, ruleValueDtoSchema),
  evidence: z.strictObject({
    source: ruleGraphSourceIdentityDtoSchema,
    capabilityContractVersion: contractVersionSchema,
    facts: z.record(capabilityKeySchema, ruleValueDtoSchema),
    trace: z.array(serverRuleExecutionTraceEntryDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
    outputs: z.record(portNameSchema, ruleValueDtoSchema)
  })
})

export type ServerPublishedRuleDefinitionDto = z.infer<
  typeof serverPublishedRuleDefinitionDtoSchema
>
export type ServerRuleExecutionInputDto = z.infer<typeof serverRuleExecutionInputDtoSchema>
export type RuleGraphSourceIdentityDto = z.infer<typeof ruleGraphSourceIdentityDtoSchema>
export type ServerRuleExecutionTraceEntryDto = z.infer<
  typeof serverRuleExecutionTraceEntryDtoSchema
>
export type ServerCompletedRuleExecutionDto = z.infer<typeof serverCompletedRuleExecutionDtoSchema>
