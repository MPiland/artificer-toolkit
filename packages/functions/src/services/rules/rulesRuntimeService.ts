import { gameSystemCapabilityDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  serverRuleExecutionContinuationDtoSchema,
  serverRuleExecutionResumeInputDtoSchema,
  serverRuleExecutionResultDtoSchema,
  serverPublishedRuleDefinitionDtoSchema,
  serverRuleExecutionInputDtoSchema,
  type ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  executeRuleGraph,
  resumeRuleGraph,
  type RuleExecutionContinuation,
  type RuleOperationContract
} from '@artificer-toolkit/shared/rules'

import { canonicalizeRuleDocument, checksumRuleDocument } from './ruleChecksum.js'

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
  execute(input: unknown): Promise<ServerRuleExecutionResultDto>
  resume(input: unknown): Promise<ServerRuleExecutionResultDto>
}

function continuationSeal(candidate: unknown, integrityKey: Uint8Array): string {
  return createHmac('sha256', integrityKey)
    .update(canonicalizeRuleDocument(candidate))
    .digest('hex')
}

function sealContinuation(candidate: unknown, integrityKey: Uint8Array) {
  const parsed = serverRuleExecutionContinuationDtoSchema.parse({
    ...(candidate as object),
    seal: '0'.repeat(64)
  })
  const { seal: _seal, ...continuation } = parsed
  return { ...continuation, seal: continuationSeal(continuation, integrityKey) }
}

function unsealContinuation(
  candidate: unknown,
  integrityKey: Uint8Array
): RuleExecutionContinuation {
  const continuation = serverRuleExecutionContinuationDtoSchema.parse(candidate)
  const { seal, ...unsealed } = continuation
  const expected = continuationSeal(unsealed, integrityKey)
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(seal, 'hex'))) {
    throw new RuleRuntimeSourceIntegrityError(
      'Frozen rule continuation checksum does not match its contents.'
    )
  }
  return unsealed as RuleExecutionContinuation
}

export function createRulesRuntimeService(input: {
  capabilities: readonly unknown[]
  definitions: PublishedRuleDefinitionSource
  continuationIntegrityKey: Uint8Array
  operations?: readonly RuleOperationContract[]
}): RulesRuntimeService {
  if (input.continuationIntegrityKey.byteLength < 32)
    throw new RuleRuntimeConfigurationError(
      'Rule continuation integrity key must contain at least 32 bytes.'
    )
  const continuationIntegrityKey = Uint8Array.from(input.continuationIntegrityKey)
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

      const result = executeRuleGraph({
        graph: compiled.value,
        occurrenceId: command.occurrenceId,
        facts: command.facts,
        operations
      })
      return serverRuleExecutionResultDtoSchema.parse(
        result.status === 'PAUSED'
          ? {
              status: 'PAUSED',
              continuation: sealContinuation(result.continuation, continuationIntegrityKey)
            }
          : result
      )
    },
    async resume(candidate) {
      const command = serverRuleExecutionResumeInputDtoSchema.parse(candidate)
      const continuation = unsealContinuation(command.continuation, continuationIntegrityKey)
      const response = command.response
      const result = resumeRuleGraph({ continuation, response, operations })
      return serverRuleExecutionResultDtoSchema.parse(
        result.status === 'PAUSED'
          ? {
              status: 'PAUSED',
              continuation: sealContinuation(result.continuation, continuationIntegrityKey)
            }
          : result
      )
    }
  }
}
import { createHmac, timingSafeEqual } from 'node:crypto'
