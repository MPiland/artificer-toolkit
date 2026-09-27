import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import {
  ruleFactContractDtoSchema,
  ruleGraphDefinitionDtoSchema,
  ruleGraphNodeDefinitionDtoSchema,
  ruleGraphSourceEntryBindingDtoSchema,
  ruleInputBindingDtoSchema,
  ruleOperationReferenceDtoSchema,
  ruleValueDtoSchema
} from '../api/rulesRuntime.js'
import {
  ruleExecutionCapabilityKeySchema as capabilityKeySchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionContractVersionSchema as contractVersionSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionPortNameSchema as portNameSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

/** Server-only current published source returned by an authorized repository seam. */
export const serverPublishedRuleDefinitionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    gameSystemId: uuidSchema,
    definitionFamilyKey: capabilityKeySchema,
    checksum: checksumSchema,
    definition: ruleGraphDefinitionDtoSchema
  })
)

/** Server-only runtime invocation after domain authorization and capability discovery. */
export const serverRuleExecutionInputDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: uuidSchema,
    occurrenceId: uuidSchema,
    facts: z.record(capabilityKeySchema, ruleValueDtoSchema).check(
      z.refine((facts) => Object.keys(facts).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS, {
        message: `Rule execution supports at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} runtime facts.`
      })
    )
  })
)

export const ruleGraphSourceIdentityDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: uuidSchema,
    gameSystemId: uuidSchema,
    definitionFamilyKey: capabilityKeySchema,
    checksum: checksumSchema
  })
)

export const serverRuleExecutionTraceEntryDtoSchema = lazySchema(() =>
  z.strictObject({
    nodeId: localNodeIdSchema,
    operation: ruleOperationReferenceDtoSchema,
    inputs: z.record(portNameSchema, ruleValueDtoSchema),
    outputs: z.record(portNameSchema, ruleValueDtoSchema),
    evidence: z.optional(
      z.strictObject({
        requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
        kind: z.literal('INTEGER_RANGE'),
        value: integerSchema
      })
    )
  })
)

const sourceEntryBindingsDtoSchema = lazySchema(() =>
  z
    .array(ruleGraphSourceEntryBindingDtoSchema)
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
    .check(
      z.refine(
        (bindings) =>
          new Set(bindings.map((binding) => binding.sourceEntryId)).size === bindings.length &&
          new Set(bindings.map((binding) => binding.nodeId)).size === bindings.length,
        'Rule source-entry bindings must form a one-to-one source-entry to node relation.'
      )
    )
)

const vocabularyBindingsDtoSchema = lazySchema(() =>
  z
    .array(z.strictObject({ kind: z.literal('ABILITY'), definitionId: uuidSchema }))
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
    .check(
      z.refine(
        (bindings) =>
          new Set(bindings.map((binding) => `${binding.kind}:${binding.definitionId}`)).size ===
          bindings.length,
        'Rule vocabulary bindings must be unique.'
      )
    )
)

export const compiledRuleGraphDtoSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      source: ruleGraphSourceIdentityDtoSchema,
      capabilityContractVersion: contractVersionSchema,
      factContracts: z
        .array(ruleFactContractDtoSchema)
        .check(z.maxLength(RULE_GRAPH_LIMITS.FACT_CONTRACTS)),
      nodes: z
        .array(ruleGraphNodeDefinitionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      outputs: z.record(portNameSchema, ruleInputBindingDtoSchema).check(
        z.refine((outputs) => {
          const count = Object.keys(outputs).length
          return count >= 1 && count <= RULE_GRAPH_LIMITS.OUTPUTS
        }, `Compiled rule graphs require between one and ${RULE_GRAPH_LIMITS.OUTPUTS} outputs.`)
      ),
      sourceEntryBindings: z.optional(sourceEntryBindingsDtoSchema),
      vocabularyBindings: z.optional(vocabularyBindingsDtoSchema)
    })
    .check(
      z.superRefine((graph, context) => {
        if (
          graph.sourceEntryBindings?.some(
            (binding) => !graph.nodes.some((node) => node.id === binding.nodeId)
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceEntryBindings'],
            message: 'Compiled rule source-entry bindings must reference an existing graph node.'
          })
      })
    )
)

export type ServerPublishedRuleDefinitionDto = z.infer<
  typeof serverPublishedRuleDefinitionDtoSchema
>
export type ServerRuleExecutionInputDto = z.infer<typeof serverRuleExecutionInputDtoSchema>
export type RuleGraphSourceIdentityDto = z.infer<typeof ruleGraphSourceIdentityDtoSchema>
export type ServerRuleExecutionTraceEntryDto = z.infer<
  typeof serverRuleExecutionTraceEntryDtoSchema
>
