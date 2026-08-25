import { gameSystemCapabilityDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  serverCompletedRuleExecutionDtoSchema,
  serverPublishedRuleDefinitionDtoSchema,
  serverRuleExecutionInputDtoSchema,
  type ServerCompletedRuleExecutionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  executeRuleGraph,
  type RuleOperationContract
} from '@artificer-toolkit/shared/rules'

import { checksumRuleDocument } from './ruleChecksum.js'

export class RuleRuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleRuntimeConfigurationError'
  }
}

export class RuleDefinitionCompilationError extends Error {
  readonly diagnostics: readonly { code: string; message: string; path?: string[] }[]

  constructor(diagnostics: readonly { code: string; message: string; path?: string[] }[]) {
    super(diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join('\n'))
    this.name = 'RuleDefinitionCompilationError'
    this.diagnostics = diagnostics
  }
}

export class RuleRuntimeSourceIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleRuntimeSourceIntegrityError'
  }
}

export interface PublishedRuleDefinitionSource {
  requireCurrent(definitionId: string): Promise<unknown>
}

export interface RulesRuntimeService {
  execute(input: unknown): Promise<ServerCompletedRuleExecutionDto>
}

export function createRulesRuntimeService(input: {
  capabilities: readonly unknown[]
  definitions: PublishedRuleDefinitionSource
  operations?: readonly RuleOperationContract[]
}): RulesRuntimeService {
  const capabilities = new Map(
    input.capabilities.map((candidate) => {
      const capability = gameSystemCapabilityDtoSchema.parse(candidate)
      return [capability.gameSystemId, capability] as const
    })
  )
  if (capabilities.size !== input.capabilities.length) {
    throw new RuleRuntimeConfigurationError(
      'Only one capability contract may be registered per Game System.'
    )
  }

  const operations = createRuleOperationRegistry(input.operations ?? coreRuleOperations)

  return {
    async execute(candidate) {
      const command = serverRuleExecutionInputDtoSchema.parse(candidate)
      const published = serverPublishedRuleDefinitionDtoSchema.parse(
        await input.definitions.requireCurrent(command.definitionId)
      )
      if (published.id !== command.definitionId || published.definition.id !== published.id) {
        throw new RuleRuntimeSourceIntegrityError(
          'Published rule definition identity does not match the requested definition.'
        )
      }
      if (
        published.definition.gameSystemId !== published.gameSystemId ||
        published.definition.definitionFamilyKey !== published.definitionFamilyKey
      ) {
        throw new RuleRuntimeSourceIntegrityError(
          'Published rule definition does not match its Game System or definition-family envelope.'
        )
      }
      if (checksumRuleDocument(published.definition) !== published.checksum) {
        throw new RuleRuntimeSourceIntegrityError(
          'Published rule definition checksum does not match its canonical document.'
        )
      }

      const capability = capabilities.get(published.gameSystemId)
      if (!capability) {
        throw new RuleRuntimeConfigurationError(
          `No capability contract is registered for Game System "${published.gameSystemId}".`
        )
      }

      const compiled = compileRuleGraph({
        definition: published.definition,
        sourceChecksum: published.checksum,
        capability,
        operations
      })
      if (!compiled.ok) throw new RuleDefinitionCompilationError(compiled.diagnostics)

      return serverCompletedRuleExecutionDtoSchema.parse(
        executeRuleGraph({ graph: compiled.value, facts: command.facts, operations })
      )
    }
  }
}
