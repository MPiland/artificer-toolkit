import type { Subject } from '../subjects/core/subject.js'

export const RULE_VALUE_KIND = {
  BOOLEAN: 'BOOLEAN',
  NUMBER: 'NUMBER',
  TEXT: 'TEXT'
} as const

export const RULE_GRAPH_LIMITS = {
  AUTHORED_ROOT_KINDS: 64,
  DEFINITION_FAMILIES: 64,
  FACT_CONTRACTS: 128,
  OPERATION_CONTRACTS: 128,
  NODES: 64,
  NODE_INPUTS: 16,
  OUTPUTS: 32,
  RUNTIME_FACTS: 128,
  TEXT_VALUE_LENGTH: 1_000
} as const

export type RuleValueKind = (typeof RULE_VALUE_KIND)[keyof typeof RULE_VALUE_KIND]
export type RuleValue = boolean | number | string

export interface RuleFactContract {
  key: string
  valueKind: RuleValueKind
}

export interface RuleOperationReference {
  key: string
  contractVersion: number
}

/** Rules Runtime's typed sub-contract within a platform Game System capability module. */
export interface GameSystemRuleCapabilityContract {
  gameSystemId: string
  contractVersion: number
  authoredRootKinds: readonly string[]
  /** Authored content kinds the System publishes; the shell navigation lists exactly these. */
  contentKinds: readonly Exclude<Subject, 'CHARACTER'>[]
  definitionFamilyKeys: readonly string[]
  factContracts: readonly RuleFactContract[]
  operationContracts: readonly RuleOperationReference[]
}

export type RuleInputBinding =
  | {
      kind: 'FACT'
      factKey: string
    }
  | {
      kind: 'LITERAL'
      value: RuleValue
    }
  | {
      kind: 'NODE_OUTPUT'
      nodeId: string
      port: string
    }

export interface RuleGraphNodeDefinition {
  id: string
  operation: RuleOperationReference
  inputs: Readonly<Record<string, RuleInputBinding>>
}

/** Binds an authored UUID-backed result identity to one code-owned graph node. */
export interface RuleGraphSourceEntryBinding {
  sourceEntryId: string
  nodeId: string
}

/** Exact System-vocabulary identities pinned by a published graph definition. */
export interface RuleGraphVocabularyBinding {
  kind: 'ABILITY'
  definitionId: string
}

export interface RuleGraphDefinition {
  schemaVersion: 1
  id: string
  gameSystemId: string
  definitionFamilyKey: string
  nodes: readonly RuleGraphNodeDefinition[]
  outputs: Readonly<Record<string, RuleInputBinding>>
  sourceEntryBindings?: readonly RuleGraphSourceEntryBinding[]
  vocabularyBindings?: readonly RuleGraphVocabularyBinding[]
}

export interface RuleGraphSourceIdentity {
  definitionId: string
  gameSystemId: string
  definitionFamilyKey: string
  checksum: string
}

export interface CompiledRuleGraph {
  schemaVersion: 1
  source: RuleGraphSourceIdentity
  capabilityContractVersion: number
  factContracts: readonly RuleFactContract[]
  nodes: readonly RuleGraphNodeDefinition[]
  outputs: Readonly<Record<string, RuleInputBinding>>
  sourceEntryBindings?: readonly RuleGraphSourceEntryBinding[]
  vocabularyBindings?: readonly RuleGraphVocabularyBinding[]
}

export interface RuleExecutionTraceEntry {
  nodeId: string
  operation: RuleOperationReference
  inputs: Readonly<Record<string, RuleValue>>
  outputs: Readonly<Record<string, RuleValue>>
  evidence?: {
    requestId: string
    kind: 'INTEGER_RANGE'
    value: number
  }
}

export interface RuleExecutionEvidence {
  source: RuleGraphSourceIdentity
  capabilityContractVersion: number
  facts: Readonly<Record<string, RuleValue>>
  trace: readonly RuleExecutionTraceEntry[]
  outputs: Readonly<Record<string, RuleValue>>
  sourceEntryBindings?: readonly RuleGraphSourceEntryBinding[]
  vocabularyBindings?: readonly RuleGraphVocabularyBinding[]
}

export interface CompletedRuleExecution {
  status: 'COMPLETE'
  outputs: Readonly<Record<string, RuleValue>>
  evidence: RuleExecutionEvidence
}

export interface RuleIntegerRangeEvidenceRequest {
  requestId: string
  kind: 'INTEGER_RANGE'
  nodeId: string
  ordinal: number
  min: number
  max: number
}

/** Pure, serializable state. Application services persist it as an occurrence. */
export interface RuleExecutionContinuation {
  schemaVersion: 1
  occurrenceId: string
  graph: CompiledRuleGraph
  facts: Readonly<Record<string, RuleValue>>
  nextNodeIndex: number
  nodeOutputs: Readonly<Record<string, Readonly<Record<string, RuleValue>>>>
  trace: readonly RuleExecutionTraceEntry[]
  request: RuleIntegerRangeEvidenceRequest
  authority: 'APPLICATION_SERVICE'
  redaction: 'SERVER_ONLY'
}

export interface PausedRuleExecution {
  status: 'PAUSED'
  continuation: RuleExecutionContinuation
}

export type RuleExecutionResult = CompletedRuleExecution | PausedRuleExecution
