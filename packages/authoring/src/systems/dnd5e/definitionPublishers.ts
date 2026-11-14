import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import {
  DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY
} from '@artificer-toolkit/schema/systems/dnd5e/schemaExtension'
import { RULE_VALUE_KIND } from '@artificer-toolkit/shared/rules'

import { validateOptionalCombatCheckDefinitions } from '../../reusableDefinitions/optionalCombatCheckDefinitions.js'
import {
  requireExactCurrentRuntimeGraph,
  ReusableDefinitionValidationError,
  ruleGraphOutputKind,
  type RuleOperationRegistry,
  type ReusableDefinitionValidationInput,
  type SystemDefinitionPublisher
} from '../../reusableDefinitions/reusableDefinitionValidation.js'
import type { RuleGraphDefinitionDto } from '@artificer-toolkit/schema/api/rulesRuntime'

async function validateEncounterLifecycleDefinition(input: ReusableDefinitionValidationInput) {
  const document = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse(input.document)
  if (document.id !== input.root.id || document.gameSystemId !== input.root.gameSystemId) {
    throw new ReusableDefinitionValidationError(
      'Published definition identity must match its reusable definition root.'
    )
  }
  const capability = input.capabilities.get(input.root.gameSystemId)
  if (!capability) {
    throw new ReusableDefinitionValidationError(
      `No Rules Runtime capability is registered for Game System "${input.root.gameSystemId}".`
    )
  }
  const requirement =
    document.kind === 'LEGENDARY_ACTION'
      ? { pin: document.eligibilityGraph, outputName: document.eligibilityGraph.eligibleOutput }
      : document.kind === 'LEGENDARY_RESISTANCE'
        ? { pin: document.choiceGraph, outputName: document.choiceGraph.useOutput }
        : { pin: document.rechargeGraph, outputName: document.rechargeGraph.rechargedOutput }
  const graph = await requireExactCurrentRuntimeGraph({
    pin: requirement.pin,
    root: input.root,
    store: input.store,
    capability,
    operations: input.operations,
    policyName: 'D&D encounter lifecycle'
  })
  if (
    ruleGraphOutputKind({
      graph,
      outputName: requirement.outputName,
      capability,
      operations: input.operations
    }) !== RULE_VALUE_KIND.BOOLEAN
  ) {
    throw new ReusableDefinitionValidationError(
      'D&D encounter lifecycle graph output must resolve to a registered BOOLEAN output.'
    )
  }
  if (document.kind === 'RECHARGE') {
    validateRechargeGraphProtocol({
      graph,
      outputName: document.rechargeGraph.rechargedOutput,
      operations: input.operations
    })
  }
  return document
}

async function validateOptionalCombatDefinition(input: ReusableDefinitionValidationInput) {
  const document = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse(input.document)
  if (document.id !== input.root.id || document.gameSystemId !== input.root.gameSystemId) {
    throw new ReusableDefinitionValidationError(
      'Published definition identity must match its reusable definition root.'
    )
  }
  if (!input.capabilities.has(input.root.gameSystemId)) {
    throw new ReusableDefinitionValidationError(
      `No Rules Runtime capability is registered for Game System "${input.root.gameSystemId}".`
    )
  }
  if (!input.resolveSystemVocabulary) {
    throw new ReusableDefinitionValidationError(
      'Optional combat definition publication requires a server-owned System vocabulary resolver.'
    )
  }
  try {
    validateOptionalCombatCheckDefinitions({
      document,
      systemVocabulary: await input.resolveSystemVocabulary(input.root.gameSystemId)
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Optional combat check definition is invalid.'
    throw new ReusableDefinitionValidationError(message)
  }
  return document
}

/** Recharge persists one d6 request, so its published graph must have one and only one evidence stage. */
function validateRechargeGraphProtocol(input: {
  graph: RuleGraphDefinitionDto
  outputName: string
  operations: RuleOperationRegistry
}): void {
  const evidenceNodes = input.graph.nodes.filter(
    (node) => input.operations.require(node.operation).executionKind === 'EVIDENCE'
  )
  if (
    evidenceNodes.length !== 1 ||
    evidenceNodes[0]!.operation.key !== 'evidence.integer-range' ||
    evidenceNodes[0]!.operation.contractVersion !== 1
  ) {
    throw new ReusableDefinitionValidationError(
      'D&D recharge graphs must contain exactly one INTEGER_RANGE evidence request.'
    )
  }
  const evidence = evidenceNodes[0]!
  if (
    evidence.inputs.min?.kind !== 'LITERAL' ||
    evidence.inputs.min.value !== 1 ||
    evidence.inputs.max?.kind !== 'LITERAL' ||
    evidence.inputs.max.value !== 6
  ) {
    throw new ReusableDefinitionValidationError(
      'D&D recharge graphs must request one bounded d6 evidence value.'
    )
  }
  const nodes = new Map(input.graph.nodes.map((node) => [node.id, node]))
  const visited = new Set<string>()
  const dependsOnEvidence = (binding: RuleGraphDefinitionDto['outputs'][string]): boolean => {
    if (binding.kind !== 'NODE_OUTPUT') return false
    if (binding.nodeId === evidence.id) return true
    if (visited.has(binding.nodeId)) return false
    visited.add(binding.nodeId)
    const node = nodes.get(binding.nodeId)
    return node ? Object.values(node.inputs).some(dependsOnEvidence) : false
  }
  const output = input.graph.outputs[input.outputName]
  if (!output || !dependsOnEvidence(output)) {
    throw new ReusableDefinitionValidationError(
      'D&D recharge BOOLEAN output must depend on its single d6 evidence request.'
    )
  }
}

/** The D&D System's reusable definition publishers, one per family in its schema extension. */
export const dnd5eDefinitionPublishers = [
  {
    familyKey: DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
    dependencyDefinitionIds(document) {
      const lifecycle =
        dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(document)
      if (!lifecycle.success) return []
      return [
        lifecycle.data.kind === 'LEGENDARY_ACTION'
          ? lifecycle.data.eligibilityGraph.definitionId
          : lifecycle.data.kind === 'LEGENDARY_RESISTANCE'
            ? lifecycle.data.choiceGraph.definitionId
            : lifecycle.data.rechargeGraph.definitionId
      ]
    },
    validate: validateEncounterLifecycleDefinition
  },
  {
    familyKey: DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY,
    dependencyDefinitionIds: () => [],
    validate: validateOptionalCombatDefinition
  }
] as const satisfies readonly SystemDefinitionPublisher[]
