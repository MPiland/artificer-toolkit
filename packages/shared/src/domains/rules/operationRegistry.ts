import {
  RULE_VALUE_KIND,
  type RuleOperationReference,
  type RuleValue,
  type RuleValueKind
} from './contracts.js'

export interface RuleOperationContract {
  key: string
  contractVersion: number
  inputs: Readonly<Record<string, RuleValueKind>>
  outputs: Readonly<Record<string, RuleValueKind>>
  execute(inputs: Readonly<Record<string, RuleValue>>): Readonly<Record<string, RuleValue>>
}

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
