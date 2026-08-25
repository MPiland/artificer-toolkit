import { z } from 'zod'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'

const uuidSchema = z.string().uuid()
const contractVersionSchema = z.number().int().positive().max(10_000)
const capabilityKeySchema = z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/)
const localNodeIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/)
const portNameSchema = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,79}$/)

export const ruleValueKindDtoSchema = z.enum(['BOOLEAN', 'NUMBER', 'TEXT'])
export const ruleValueDtoSchema = z.union([z.boolean(), z.number().finite(), z.string().max(1_000)])

export const ruleOperationReferenceDtoSchema = z.strictObject({
  key: capabilityKeySchema,
  contractVersion: contractVersionSchema
})

export const ruleFactContractDtoSchema = z.strictObject({
  key: capabilityKeySchema,
  valueKind: ruleValueKindDtoSchema
})

export const gameSystemCapabilityDtoSchema = z.strictObject({
  gameSystemId: uuidSchema,
  contractVersion: contractVersionSchema,
  authoredRootKinds: z.array(capabilityKeySchema).max(RULE_GRAPH_LIMITS.AUTHORED_ROOT_KINDS),
  definitionFamilyKeys: z.array(capabilityKeySchema).max(RULE_GRAPH_LIMITS.DEFINITION_FAMILIES),
  factContracts: z.array(ruleFactContractDtoSchema).max(RULE_GRAPH_LIMITS.FACT_CONTRACTS),
  operationContracts: z
    .array(ruleOperationReferenceDtoSchema)
    .min(1)
    .max(RULE_GRAPH_LIMITS.OPERATION_CONTRACTS)
})

export const ruleInputBindingDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('FACT'), factKey: capabilityKeySchema }),
  z.strictObject({ kind: z.literal('LITERAL'), value: ruleValueDtoSchema }),
  z.strictObject({
    kind: z.literal('NODE_OUTPUT'),
    nodeId: localNodeIdSchema,
    port: portNameSchema
  })
])

export const ruleGraphNodeDefinitionDtoSchema = z.strictObject({
  id: localNodeIdSchema,
  operation: ruleOperationReferenceDtoSchema,
  inputs: z
    .record(portNameSchema, ruleInputBindingDtoSchema)
    .refine((inputs) => Object.keys(inputs).length <= RULE_GRAPH_LIMITS.NODE_INPUTS, {
      message: `Rule nodes support at most ${RULE_GRAPH_LIMITS.NODE_INPUTS} input bindings.`
    })
})

export const ruleGraphDefinitionDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  gameSystemId: uuidSchema,
  definitionFamilyKey: capabilityKeySchema,
  nodes: z.array(ruleGraphNodeDefinitionDtoSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
  outputs: z.record(portNameSchema, ruleInputBindingDtoSchema).refine((outputs) => {
    const count = Object.keys(outputs).length
    return count >= 1 && count <= RULE_GRAPH_LIMITS.OUTPUTS
  }, `Rule graphs require between one and ${RULE_GRAPH_LIMITS.OUTPUTS} outputs.`)
})

export type RuleValueKindDto = z.infer<typeof ruleValueKindDtoSchema>
export type RuleValueDto = z.infer<typeof ruleValueDtoSchema>
export type RuleOperationReferenceDto = z.infer<typeof ruleOperationReferenceDtoSchema>
export type RuleFactContractDto = z.infer<typeof ruleFactContractDtoSchema>
export type GameSystemCapabilityDto = z.infer<typeof gameSystemCapabilityDtoSchema>
export type RuleInputBindingDto = z.infer<typeof ruleInputBindingDtoSchema>
export type RuleGraphNodeDefinitionDto = z.infer<typeof ruleGraphNodeDefinitionDtoSchema>
export type RuleGraphDefinitionDto = z.infer<typeof ruleGraphDefinitionDtoSchema>
