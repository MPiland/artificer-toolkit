import type {
  ReusableDefinitionCurrentDto,
  ReusableDefinitionDraftDto,
  ReusableDefinitionDocumentDto,
  ReusableDefinitionRootRecord
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import {
  gameSystemRuleCapabilityDtoSchema,
  ruleGraphDefinitionDtoSchema,
  type GameSystemRuleCapabilityDto,
  type RuleGraphDefinitionDto
} from '@artificer-toolkit/schema/api/rulesRuntime'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicy'
import { dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import {
  conditionRuleStateReusableDefinitionDocumentDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared/ruleState'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import { basicActionReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/basicActions'
import { reusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import {
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  RULE_VALUE_KIND,
  type RuleOperationContract
} from '@artificer-toolkit/shared/rules'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { validateOptionalCombatCheckDefinitions } from './optionalCombatCheckDefinitions.js'

import {
  RULE_RUNTIME_GRAPH_FAMILY_KEY,
  SENSE_DEFINITION_FAMILY_KEY,
  RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
  CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
  RULE_MAINTENANCE_DEFINITION_FAMILY_KEY,
  INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
  DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY,
  BASIC_ACTION_DEFINITION_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'

export {
  RULE_RUNTIME_GRAPH_FAMILY_KEY,
  RULE_RUNTIME_GRAPH_CONTRACT_VERSION,
  SENSE_DEFINITION_FAMILY_KEY,
  RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
  CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
  RULE_MAINTENANCE_DEFINITION_FAMILY_KEY,
  INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
  DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'

export class ReusableDefinitionAuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReusableDefinitionAuthorizationError'
  }
}

export class ReusableDefinitionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReusableDefinitionValidationError'
  }
}

export interface ReusableDefinitionStore {
  requireCurrent(definitionId: string): Promise<ReusableDefinitionCurrentDto>
  saveDraft(input: {
    definitionId: string
    actorUserId: string
    expectedDefinitionVersion: number
    expectedDraftVersion: number | null
    document: unknown
    checksum: string
    authorize: (root: ReusableDefinitionRootRecord) => void | Promise<void>
  }): Promise<ReusableDefinitionDraftDto>
  publishDraft(input: {
    definitionId: string
    actorUserId: string
    expectedDefinitionVersion: number
    expectedDraftVersion: number
    authorize: (root: ReusableDefinitionRootRecord) => void
    dependencyDefinitionIds: (draft: ReusableDefinitionDraftDto) => readonly string[]
    validate: (
      root: ReusableDefinitionRootRecord,
      draft: ReusableDefinitionDraftDto,
      lockedDependencies: readonly ReusableDefinitionCurrentDto[]
    ) => void | Promise<void>
  }): Promise<ReusableDefinitionCurrentDto>
}

function assertAuthority(root: ReusableDefinitionRootRecord, actorUserId: string) {
  if (root.sourceKind === 'PLATFORM') {
    throw new ReusableDefinitionAuthorizationError(
      'Platform source mutation is unavailable through this service.'
    )
  }
  if (root.sourceOwnerUserId !== actorUserId) {
    throw new ReusableDefinitionAuthorizationError(
      'Content source is not owned by the acting user.'
    )
  }
}

function validateRuntimeGraph(root: ReusableDefinitionRootRecord, document: unknown) {
  if (root.definitionFamilyKey !== RULE_RUNTIME_GRAPH_FAMILY_KEY) {
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  }
  const parsed = ruleGraphDefinitionDtoSchema.parse(document)
  if (
    parsed.id !== root.id ||
    parsed.gameSystemId !== root.gameSystemId ||
    parsed.definitionFamilyKey !== root.definitionFamilyKey
  ) {
    throw new ReusableDefinitionValidationError(
      'Published definition identity must match its reusable definition root.'
    )
  }
  return parsed
}

function validateSenseDefinition(root: ReusableDefinitionRootRecord, document: unknown) {
  if (root.definitionFamilyKey !== SENSE_DEFINITION_FAMILY_KEY) {
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  }
  const parsed = senseReusableDefinitionDocumentDtoSchema.parse(document)
  if (parsed.id !== root.id || parsed.gameSystemId !== root.gameSystemId) {
    throw new ReusableDefinitionValidationError(
      'Published definition identity must match its reusable definition root.'
    )
  }
  return parsed
}

function validateRuleCapabilityDefinition(root: ReusableDefinitionRootRecord, document: unknown) {
  if (root.definitionFamilyKey !== RULE_CAPABILITY_DEFINITION_FAMILY_KEY)
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  const parsed = ruleCapabilityReusableDefinitionDocumentDtoSchema.parse(document)
  if (parsed.id !== root.id || parsed.gameSystemId !== root.gameSystemId)
    throw new ReusableDefinitionValidationError(
      'Published definition identity must match its reusable definition root.'
    )
  return parsed
}

function validateConditionRuleStateDefinition(
  root: ReusableDefinitionRootRecord,
  document: unknown
) {
  if (root.definitionFamilyKey !== CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY)
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  const parsed = conditionRuleStateReusableDefinitionDocumentDtoSchema.parse(document)
  if (parsed.id !== root.id || parsed.gameSystemId !== root.gameSystemId)
    throw new ReusableDefinitionValidationError(
      'Published definition identity must match its reusable definition root.'
    )
  return parsed
}

function validateRuleMaintenanceDefinition(root: ReusableDefinitionRootRecord, document: unknown) {
  if (root.definitionFamilyKey !== RULE_MAINTENANCE_DEFINITION_FAMILY_KEY)
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  const parsed = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse(document)
  if (parsed.id !== root.id || parsed.gameSystemId !== root.gameSystemId)
    throw new ReusableDefinitionValidationError(
      'Published definition identity must match its reusable definition root.'
    )
  return parsed
}

/**
 * A System's basic-action catalogue entry (Q11): its closed mechanics need no further binding, and
 * its authored effects are bound when an actor offers or resolves them.
 */
function validateBasicActionDefinition(input: {
  root: ReusableDefinitionRootRecord
  document: unknown
}) {
  const { root } = input
  if (root.definitionFamilyKey !== BASIC_ACTION_DEFINITION_FAMILY_KEY)
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  const parsed = basicActionReusableDefinitionDocumentDtoSchema.parse(input.document)
  if (parsed.id !== root.id || parsed.gameSystemId !== root.gameSystemId)
    throw new ReusableDefinitionValidationError(
      'Published definition identity must match its reusable definition root.'
    )
  return parsed
}

function requirePermittedDefinitionFamily(input: {
  root: ReusableDefinitionRootRecord
  capabilities: ReadonlyMap<string, GameSystemRuleCapabilityDto>
}) {
  const capability = input.capabilities.get(input.root.gameSystemId)
  if (!capability)
    throw new ReusableDefinitionValidationError(
      `No Rules Runtime capability is registered for Game System "${input.root.gameSystemId}".`
    )
  if (!capability.definitionFamilyKeys.includes(input.root.definitionFamilyKey))
    throw new ReusableDefinitionValidationError(
      `Game System Rules Runtime capability does not permit reusable ${input.root.definitionFamilyKey} definitions.`
    )
}

async function validateInitiativePolicyDefinition(input: {
  root: ReusableDefinitionRootRecord
  document: unknown
  store: Pick<ReusableDefinitionStore, 'requireCurrent'>
  capabilities: ReadonlyMap<string, GameSystemRuleCapabilityDto>
  operations: ReturnType<typeof createRuleOperationRegistry>
}) {
  if (input.root.definitionFamilyKey !== INITIATIVE_POLICY_DEFINITION_FAMILY_KEY) {
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  }
  const policy = initiativePolicyReusableDefinitionDocumentDtoSchema.parse(input.document)
  if (policy.id !== input.root.id || policy.gameSystemId !== input.root.gameSystemId) {
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
  const pins = [policy.evaluationGraph, policy.orderChoiceGraph, ...policy.tieResolvers]
  for (const pin of pins) {
    const graph = await requireExactCurrentRuntimeGraph({
      pin,
      root: input.root,
      store: input.store,
      capability,
      operations: input.operations,
      policyName: 'Initiative policy',
      requireExecutable: false
    })
    if ('selectionOutput' in pin) {
      for (const factKey of [pin.minimumIndexFact, pin.maximumIndexFact]) {
        if (!ruleGraphReferencesFact(graph, factKey)) {
          throw new ReusableDefinitionValidationError(
            'Initiative order-choice graph must reference its exact bounded System FACT keys.'
          )
        }
        const factKind = capability.factContracts.find((fact) => fact.key === factKey)?.valueKind
        if (factKind !== RULE_VALUE_KIND.NUMBER) {
          throw new ReusableDefinitionValidationError(
            'Initiative order-choice bound facts must resolve to registered NUMBER System facts.'
          )
        }
      }
    }
    const compiled = compileRuleGraph({
      definition: graph,
      sourceChecksum: pin.definitionChecksum,
      capability,
      operations: input.operations
    })
    if (!compiled.ok) {
      throw new ReusableDefinitionValidationError(
        'Initiative policy graph pins must reference executable Rules Runtime graphs.'
      )
    }
    if ('selectionOutput' in pin) {
      const outputKind = ruleGraphOutputKind({
        graph,
        outputName: pin.selectionOutput,
        capability,
        operations: input.operations
      })
      if (outputKind !== RULE_VALUE_KIND.NUMBER) {
        throw new ReusableDefinitionValidationError(
          'Initiative policy graph output must resolve to a registered NUMBER output.'
        )
      }
    } else {
      const scoreKind = ruleGraphOutputKind({
        graph,
        outputName: pin.scoreOutput,
        capability,
        operations: input.operations
      })
      if (scoreKind !== RULE_VALUE_KIND.NUMBER) {
        throw new ReusableDefinitionValidationError(
          'Initiative policy score output must resolve to a registered NUMBER output.'
        )
      }
      const automaticKind = ruleGraphOutputKind({
        graph,
        outputName: pin.automaticOutput,
        capability,
        operations: input.operations
      })
      if (automaticKind !== RULE_VALUE_KIND.BOOLEAN) {
        throw new ReusableDefinitionValidationError(
          'Initiative policy automatic output must resolve to a registered BOOLEAN output.'
        )
      }
    }
  }
  return policy
}

async function requireExactCurrentRuntimeGraph(input: {
  pin: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
  }
  root: ReusableDefinitionRootRecord
  store: Pick<ReusableDefinitionStore, 'requireCurrent'>
  capability: GameSystemRuleCapabilityDto
  operations: ReturnType<typeof createRuleOperationRegistry>
  policyName: string
  requireExecutable?: boolean
}) {
  let current: ReusableDefinitionCurrentDto
  try {
    current = await input.store.requireCurrent(input.pin.definitionId)
  } catch {
    throw new ReusableDefinitionValidationError(
      `${input.policyName} references an unavailable current Rules Runtime graph.`
    )
  }
  if (
    current.id !== input.pin.definitionId ||
    current.definitionFamilyKey !== RULE_RUNTIME_GRAPH_FAMILY_KEY ||
    current.gameSystemId !== input.root.gameSystemId ||
    current.version !== input.pin.definitionVersion ||
    current.checksum !== input.pin.definitionChecksum
  ) {
    throw new ReusableDefinitionValidationError(
      `${input.policyName} graph pins must reference exact current Rules Runtime graphs from the same Game System.`
    )
  }
  const parsed = ruleGraphDefinitionDtoSchema.safeParse(current.document)
  if (!parsed.success || checksumRuleDocument(parsed.data) !== current.checksum) {
    throw new ReusableDefinitionValidationError(
      `${input.policyName} graph pins must reference checksum-valid current Rules Runtime graphs.`
    )
  }
  if (input.requireExecutable !== false) {
    const compiled = compileRuleGraph({
      definition: parsed.data,
      sourceChecksum: current.checksum,
      capability: input.capability,
      operations: input.operations
    })
    if (!compiled.ok) {
      throw new ReusableDefinitionValidationError(
        `${input.policyName} graph pins must reference executable Rules Runtime graphs.`
      )
    }
  }
  return parsed.data
}

async function validateDnd5eEncounterLifecycleDefinition(input: {
  root: ReusableDefinitionRootRecord
  document: unknown
  store: Pick<ReusableDefinitionStore, 'requireCurrent'>
  capabilities: ReadonlyMap<string, GameSystemRuleCapabilityDto>
  operations: ReturnType<typeof createRuleOperationRegistry>
}) {
  if (input.root.definitionFamilyKey !== DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY) {
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  }
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
    validateDnd5eRechargeGraphProtocol({
      graph,
      outputName: document.rechargeGraph.rechargedOutput,
      operations: input.operations
    })
  }
  return document
}

async function validateDnd5eOptionalCombatDefinition(input: {
  root: ReusableDefinitionRootRecord
  document: unknown
  capabilities: ReadonlyMap<string, GameSystemRuleCapabilityDto>
  resolveSystemVocabulary?: (gameSystemId: string) => Promise<unknown>
}) {
  if (input.root.definitionFamilyKey !== DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY) {
    throw new ReusableDefinitionValidationError(
      'No publisher is registered for this definition family.'
    )
  }
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

/** Shared exact-contract check for publication and current-source admission. */
export function supportsRuleOperationContract(
  capability: GameSystemRuleCapabilityDto,
  operation: { capabilityKey: string; contractVersion: number }
): boolean {
  return capability.operationContracts.some(
    (candidate) =>
      candidate.key === operation.capabilityKey &&
      candidate.contractVersion === operation.contractVersion
  )
}

function ruleGraphReferencesFact(graph: RuleGraphDefinitionDto, factKey: string) {
  return [
    ...Object.values(graph.outputs),
    ...graph.nodes.flatMap((node) => Object.values(node.inputs))
  ].some((binding) => binding.kind === 'FACT' && binding.factKey === factKey)
}

function ruleGraphOutputKind(input: {
  graph: RuleGraphDefinitionDto
  outputName: string
  capability: GameSystemRuleCapabilityDto
  operations: ReturnType<typeof createRuleOperationRegistry>
}) {
  const binding = input.graph.outputs[input.outputName]
  if (!binding) return undefined
  switch (binding.kind) {
    case 'LITERAL':
      if (typeof binding.value === 'boolean') return RULE_VALUE_KIND.BOOLEAN
      if (typeof binding.value === 'number') return RULE_VALUE_KIND.NUMBER
      return RULE_VALUE_KIND.TEXT
    case 'FACT':
      return input.capability.factContracts.find((fact) => fact.key === binding.factKey)?.valueKind
    case 'NODE_OUTPUT': {
      const node = input.graph.nodes.find((candidate) => candidate.id === binding.nodeId)
      return node ? input.operations.require(node.operation).outputs[binding.port] : undefined
    }
  }
}

/** Recharge persists one d6 request, so its published graph must have one and only one evidence stage. */
function validateDnd5eRechargeGraphProtocol(input: {
  graph: RuleGraphDefinitionDto
  outputName: string
  operations: ReturnType<typeof createRuleOperationRegistry>
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

async function validateReusableDefinition(input: {
  root: ReusableDefinitionRootRecord
  document: ReusableDefinitionDocumentDto
  checksum: string
  capabilities: ReadonlyMap<string, GameSystemRuleCapabilityDto>
  operations: ReturnType<typeof createRuleOperationRegistry>
  store: Pick<ReusableDefinitionStore, 'requireCurrent'>
  resolveSystemVocabulary?: (gameSystemId: string) => Promise<unknown>
}) {
  switch (input.root.definitionFamilyKey) {
    case RULE_RUNTIME_GRAPH_FAMILY_KEY:
      return compileRuntimeGraph(input)
    case SENSE_DEFINITION_FAMILY_KEY: {
      requirePermittedDefinitionFamily(input)
      return validateSenseDefinition(input.root, input.document)
    }
    case RULE_CAPABILITY_DEFINITION_FAMILY_KEY:
      requirePermittedDefinitionFamily(input)
      return validateRuleCapabilityDefinition(input.root, input.document)
    case CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY:
      requirePermittedDefinitionFamily(input)
      return validateConditionRuleStateDefinition(input.root, input.document)
    case RULE_MAINTENANCE_DEFINITION_FAMILY_KEY:
      requirePermittedDefinitionFamily(input)
      return validateRuleMaintenanceDefinition(input.root, input.document)
    case INITIATIVE_POLICY_DEFINITION_FAMILY_KEY:
      requirePermittedDefinitionFamily(input)
      return validateInitiativePolicyDefinition(input)
    case DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY:
      requirePermittedDefinitionFamily(input)
      return validateDnd5eEncounterLifecycleDefinition(input)
    case DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY:
      requirePermittedDefinitionFamily(input)
      return validateDnd5eOptionalCombatDefinition(input)
    case BASIC_ACTION_DEFINITION_FAMILY_KEY:
      requirePermittedDefinitionFamily(input)
      return validateBasicActionDefinition(input)
    default:
      throw new ReusableDefinitionValidationError(
        'No publisher is registered for this definition family.'
      )
  }
}

function compileRuntimeGraph(input: {
  root: ReusableDefinitionRootRecord
  document: unknown
  checksum: string
  capabilities: ReadonlyMap<string, GameSystemRuleCapabilityDto>
  operations: ReturnType<typeof createRuleOperationRegistry>
}) {
  const document = validateRuntimeGraph(input.root, input.document)
  const capability = input.capabilities.get(input.root.gameSystemId)
  if (!capability) {
    throw new ReusableDefinitionValidationError(
      `No Rules Runtime capability is registered for Game System "${input.root.gameSystemId}".`
    )
  }
  const compiled = compileRuleGraph({
    definition: document,
    sourceChecksum: input.checksum,
    capability,
    operations: input.operations
  })
  if (!compiled.ok) {
    throw new ReusableDefinitionValidationError(
      compiled.diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    )
  }
  return document
}

/** The only publisher in this foundation: a bounded neutral Rules Runtime graph. */
export function createReusableDefinitionService(config: {
  store: ReusableDefinitionStore
  capabilities: readonly unknown[]
  operations?: readonly RuleOperationContract[]
  resolveSystemVocabulary?: (gameSystemId: string) => Promise<unknown>
}) {
  const capabilities = new Map(
    config.capabilities.map((candidate) => {
      const capability = gameSystemRuleCapabilityDtoSchema.parse(candidate)
      return [capability.gameSystemId, capability] as const
    })
  )
  if (capabilities.size !== config.capabilities.length) {
    throw new ReusableDefinitionValidationError(
      'Only one Rules Runtime capability may be registered per Game System.'
    )
  }
  const operations = createRuleOperationRegistry(config.operations ?? coreRuleOperations)

  return {
    async saveDraft(input: {
      definitionId: string
      actorUserId: string
      expectedDefinitionVersion: number
      expectedDraftVersion: number | null
      document: unknown
    }): Promise<ReusableDefinitionDraftDto> {
      const definitionId = serverUuidIdentityDtoSchema.parse(input.definitionId)
      const actorUserId = serverUuidIdentityDtoSchema.parse(input.actorUserId)
      const document = reusableDefinitionDocumentDtoSchema.parse(input.document)
      const checksum = checksumRuleDocument(document)
      return config.store.saveDraft({
        ...input,
        definitionId,
        actorUserId,
        document,
        checksum,
        authorize: async (root) => {
          assertAuthority(root, actorUserId)
          await validateReusableDefinition({
            root,
            document,
            checksum,
            capabilities,
            operations,
            store: config.store,
            resolveSystemVocabulary: config.resolveSystemVocabulary
          })
        }
      })
    },

    async publishDraft(input: {
      definitionId: string
      actorUserId: string
      expectedDefinitionVersion: number
      expectedDraftVersion: number
    }): Promise<ReusableDefinitionCurrentDto> {
      const definitionId = serverUuidIdentityDtoSchema.parse(input.definitionId)
      const actorUserId = serverUuidIdentityDtoSchema.parse(input.actorUserId)
      return config.store.publishDraft({
        ...input,
        definitionId,
        actorUserId,
        authorize: (root) => assertAuthority(root, actorUserId),
        dependencyDefinitionIds: (draft) => {
          const policy = initiativePolicyReusableDefinitionDocumentDtoSchema.safeParse(
            draft.document
          )
          if (policy.success) {
            return [
              policy.data.evaluationGraph.definitionId,
              policy.data.orderChoiceGraph.definitionId,
              ...policy.data.tieResolvers.map((pin) => pin.definitionId)
            ]
          }
          const lifecycle = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(
            draft.document
          )
          if (!lifecycle.success) return []
          return [
            lifecycle.data.kind === 'LEGENDARY_ACTION'
              ? lifecycle.data.eligibilityGraph.definitionId
              : lifecycle.data.kind === 'LEGENDARY_RESISTANCE'
                ? lifecycle.data.choiceGraph.definitionId
                : lifecycle.data.rechargeGraph.definitionId
          ]
        },
        validate: async (root, draft, lockedDependencies) => {
          const document = reusableDefinitionDocumentDtoSchema.parse(draft.document)
          if (checksumRuleDocument(document) !== draft.checksum) {
            throw new ReusableDefinitionValidationError(
              'Draft checksum does not match its canonical document.'
            )
          }
          const lockedById = new Map(
            lockedDependencies.map((dependency) => [dependency.id, dependency])
          )
          await validateReusableDefinition({
            root,
            document,
            checksum: draft.checksum,
            capabilities,
            operations,
            resolveSystemVocabulary: config.resolveSystemVocabulary,
            store: {
              async requireCurrent(dependencyDefinitionId) {
                const dependency = lockedById.get(dependencyDefinitionId)
                if (!dependency) throw new Error('Reusable definition dependency was not locked.')
                return dependency
              }
            }
          })
        }
      })
    }
  }
}

/** Repository-backed current source consumed by the existing Rules Runtime service. */
export function createReusableDefinitionRuntimeSource(
  store: Pick<ReusableDefinitionStore, 'requireCurrent'>
) {
  return {
    async requireCurrent(definitionId: string) {
      const current = await store.requireCurrent(serverUuidIdentityDtoSchema.parse(definitionId))
      const document = validateRuntimeGraph(
        {
          id: current.id,
          gameSystemId: current.gameSystemId,
          contentSourceId: current.contentSourceId,
          definitionFamilyKey: current.definitionFamilyKey,
          label: current.label,
          description: current.description,
          version: current.version,
          draftVersion: null,
          sourceKind: 'PLATFORM',
          sourceOwnerUserId: null,
          current
        },
        current.document
      )
      if (checksumRuleDocument(document) !== current.checksum) {
        throw new ReusableDefinitionValidationError(
          'Current definition checksum does not match its document.'
        )
      }
      return {
        id: current.id,
        gameSystemId: current.gameSystemId,
        definitionFamilyKey: current.definitionFamilyKey,
        checksum: current.checksum,
        definition: document
      }
    }
  }
}
