import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredSubjectKindSchema } from '../projections/identity.js'

const uuidSchema = lazySchema(() =>
  z.pipe(
    postgresUuidSchema,
    z.transform((value) => value.toLowerCase())
  )
)
const contractVersionSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.positive()).check(z.lte(10_000))
)
export const ruleCapabilityKeyDtoSchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/))
)
const localNodeIdSchema = lazySchema(() => z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/)))
export const ruleGraphPortNameDtoSchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-z][a-zA-Z0-9_]{0,79}$/))
)

export const ruleGraphSourceEntryBindingDtoSchema = lazySchema(() =>
  z.strictObject({
    sourceEntryId: uuidSchema,
    nodeId: localNodeIdSchema
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
    .array(
      z.strictObject({
        kind: z.literal('ABILITY'),
        definitionId: uuidSchema
      })
    )
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

export const ruleValueKindDtoSchema = lazySchema(() => z.enum(['BOOLEAN', 'NUMBER', 'TEXT']))
export const ruleValueDtoSchema = lazySchema(() =>
  z.union([z.boolean(), z.number(), z.string().check(z.maxLength(1_000))])
)

export const ruleOperationReferenceDtoSchema = lazySchema(() =>
  z.strictObject({
    key: ruleCapabilityKeyDtoSchema,
    contractVersion: contractVersionSchema
  })
)

export const ruleFactContractDtoSchema = lazySchema(() =>
  z.strictObject({
    key: ruleCapabilityKeyDtoSchema,
    valueKind: ruleValueKindDtoSchema
  })
)

/** Rules Runtime's typed sub-contract within a platform Game System capability module. */
export const gameSystemRuleCapabilityDtoSchema = lazySchema(() =>
  z.strictObject({
    gameSystemId: uuidSchema,
    contractVersion: contractVersionSchema,
    authoredRootKinds: z
      .array(ruleCapabilityKeyDtoSchema)
      .check(z.maxLength(RULE_GRAPH_LIMITS.AUTHORED_ROOT_KINDS)),
    contentKinds: z.array(authoredSubjectKindSchema).check(z.maxLength(8)),
    definitionFamilyKeys: z
      .array(ruleCapabilityKeyDtoSchema)
      .check(z.maxLength(RULE_GRAPH_LIMITS.DEFINITION_FAMILIES)),
    factContracts: z
      .array(ruleFactContractDtoSchema)
      .check(z.maxLength(RULE_GRAPH_LIMITS.FACT_CONTRACTS)),
    operationContracts: z
      .array(ruleOperationReferenceDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(RULE_GRAPH_LIMITS.OPERATION_CONTRACTS))
  })
)

export const ruleInputBindingDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('FACT'), factKey: ruleCapabilityKeyDtoSchema }),
    z.strictObject({ kind: z.literal('LITERAL'), value: ruleValueDtoSchema }),
    z.strictObject({
      kind: z.literal('NODE_OUTPUT'),
      nodeId: localNodeIdSchema,
      port: ruleGraphPortNameDtoSchema
    })
  ])
)

export const ruleGraphNodeDefinitionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: localNodeIdSchema,
    operation: ruleOperationReferenceDtoSchema,
    inputs: z.record(ruleGraphPortNameDtoSchema, ruleInputBindingDtoSchema).check(
      z.refine((inputs) => Object.keys(inputs).length <= RULE_GRAPH_LIMITS.NODE_INPUTS, {
        message: `Rule nodes support at most ${RULE_GRAPH_LIMITS.NODE_INPUTS} input bindings.`
      })
    )
  })
)

export const ruleGraphDefinitionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      id: uuidSchema,
      gameSystemId: uuidSchema,
      definitionFamilyKey: ruleCapabilityKeyDtoSchema,
      nodes: z
        .array(ruleGraphNodeDefinitionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
      outputs: z.record(ruleGraphPortNameDtoSchema, ruleInputBindingDtoSchema).check(
        z.refine((outputs) => {
          const count = Object.keys(outputs).length
          return count >= 1 && count <= RULE_GRAPH_LIMITS.OUTPUTS
        }, `Rule graphs require between one and ${RULE_GRAPH_LIMITS.OUTPUTS} outputs.`)
      ),
      sourceEntryBindings: z.optional(sourceEntryBindingsDtoSchema),
      vocabularyBindings: z.optional(vocabularyBindingsDtoSchema)
    })
    .check(
      z.superRefine((definition, context) => {
        if (
          definition.sourceEntryBindings?.some(
            (binding) => !definition.nodes.some((node) => node.id === binding.nodeId)
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['sourceEntryBindings'],
            message: 'Rule source-entry bindings must reference an existing graph node.'
          })
      })
    )
)

export type RuleValueKindDto = z.infer<typeof ruleValueKindDtoSchema>
export type RuleValueDto = z.infer<typeof ruleValueDtoSchema>
export type RuleOperationReferenceDto = z.infer<typeof ruleOperationReferenceDtoSchema>
export type RuleFactContractDto = z.infer<typeof ruleFactContractDtoSchema>
export type GameSystemRuleCapabilityDto = z.infer<typeof gameSystemRuleCapabilityDtoSchema>
export type RuleInputBindingDto = z.infer<typeof ruleInputBindingDtoSchema>
export type RuleGraphNodeDefinitionDto = z.infer<typeof ruleGraphNodeDefinitionDtoSchema>
export type RuleGraphSourceEntryBindingDto = z.infer<typeof ruleGraphSourceEntryBindingDtoSchema>
export type RuleGraphDefinitionDto = z.infer<typeof ruleGraphDefinitionDtoSchema>
