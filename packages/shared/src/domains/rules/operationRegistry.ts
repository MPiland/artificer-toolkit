import {
  RULE_VALUE_KIND,
  type RuleOperationReference,
  type RuleValue,
  type RuleValueKind
} from './contracts.js'

interface RuleOperationContractBase {
  key: string
  contractVersion: number
  inputs: Readonly<Record<string, RuleValueKind>>
  outputs: Readonly<Record<string, RuleValueKind>>
}

export interface PureRuleOperationContract extends RuleOperationContractBase {
  executionKind: 'PURE'
  execute(inputs: Readonly<Record<string, RuleValue>>): Readonly<Record<string, RuleValue>>
}

/**
 * A deterministic typed operation whose outputs are interpreted by a
 * server-owned application service after the kernel completes. The kernel
 * records it exactly as it records a pure operation and never mutates state.
 */
export interface ProposalRuleOperationContract extends RuleOperationContractBase {
  executionKind: 'PROPOSAL'
  execute(inputs: Readonly<Record<string, RuleValue>>): Readonly<Record<string, RuleValue>>
}

export interface EvidenceRuleOperationContract extends RuleOperationContractBase {
  executionKind: 'EVIDENCE'
  evidence: {
    kind: 'INTEGER_RANGE'
    minInput: string
    maxInput: string
    valueOutput: string
    /**
     * A BOOLEAN input that, when false, skips the request: the operation settles at the minimum
     * without asking for evidence, so a graph can ask for a die only when a fact calls for it.
     */
    enabledInput?: string
  }
}

export type RuleOperationContract =
  | PureRuleOperationContract
  | ProposalRuleOperationContract
  | EvidenceRuleOperationContract

export interface RuleOperationRegistry {
  require(reference: RuleOperationReference): RuleOperationContract
}

export class RuleOperationRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleOperationRegistryError'
  }
}

function operationIdentity(reference: RuleOperationReference): string {
  return `${reference.key}@${reference.contractVersion}`
}

export function valueMatchesKind(value: RuleValue, kind: RuleValueKind): boolean {
  switch (kind) {
    case RULE_VALUE_KIND.BOOLEAN:
      return typeof value === 'boolean'
    case RULE_VALUE_KIND.NUMBER:
      return typeof value === 'number' && Number.isFinite(value)
    case RULE_VALUE_KIND.TEXT:
      return typeof value === 'string'
  }
}

export function createRuleOperationRegistry(
  contracts: readonly RuleOperationContract[]
): RuleOperationRegistry {
  const byIdentity = new Map<string, RuleOperationContract>()

  for (const contract of contracts) {
    const identity = operationIdentity(contract)
    if (byIdentity.has(identity)) {
      throw new RuleOperationRegistryError(`Duplicate rule operation contract "${identity}".`)
    }
    if (
      contract.executionKind === 'EVIDENCE' &&
      (contract.inputs[contract.evidence.minInput] !== RULE_VALUE_KIND.NUMBER ||
        contract.inputs[contract.evidence.maxInput] !== RULE_VALUE_KIND.NUMBER ||
        contract.outputs[contract.evidence.valueOutput] !== RULE_VALUE_KIND.NUMBER)
    ) {
      throw new RuleOperationRegistryError(
        `Evidence operation contract "${identity}" must bind numeric minimum, maximum, and value ports.`
      )
    }
    if (
      contract.executionKind === 'EVIDENCE' &&
      contract.evidence.enabledInput !== undefined &&
      contract.inputs[contract.evidence.enabledInput] !== RULE_VALUE_KIND.BOOLEAN
    ) {
      throw new RuleOperationRegistryError(
        `Evidence operation contract "${identity}" must bind a boolean enabling port.`
      )
    }
    byIdentity.set(identity, contract)
  }

  return {
    require(reference) {
      const identity = operationIdentity(reference)
      const contract = byIdentity.get(identity)
      if (!contract) {
        throw new RuleOperationRegistryError(`Unknown rule operation contract "${identity}".`)
      }
      return contract
    }
  }
}
