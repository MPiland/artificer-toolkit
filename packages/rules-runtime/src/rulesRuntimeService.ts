import { gameSystemRuleCapabilityDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  compiledRuleGraphDtoSchema,
  serverPublishedRuleDefinitionDtoSchema,
  serverRuleExecutionInputDtoSchema,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionInputDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  serverRuleExecutionContinuationDtoSchema,
  serverRuleExecutionResumeInputDtoSchema,
  serverRuleExecutionResultDtoSchema,
  type ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import {
  compileRuleGraph,
  coreRuleOperations,
  createRuleOperationRegistry,
  executeRuleGraph,
  resumeRuleGraph,
  validateCompiledRuleGraph,
  type CompiledRuleGraph,
  type RuleExecutionContinuation,
  type RuleOperationContract
} from '@artificer-toolkit/shared/rules'

import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'

export class RuleRuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleRuntimeConfigurationError'
  }
}

export class RuleDefinitionCompilationError extends Error {
  readonly diagnostics: readonly {
    code: string
    message: string
    path?: string[]
  }[]

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
  /**
   * Server-only execution for a source already resolved by an authorized
   * domain service. The supplied envelope is still parsed and validated here.
   */
  executeResolved(input: {
    command: ServerRuleExecutionInputDto
    published: ServerPublishedRuleDefinitionDto
  }): Promise<ServerRuleExecutionResultDto>
  /** Server-only: preserves the exact compiled graph used for terminal application. */
  executeResolvedWithGraph?(input: {
    command: ServerRuleExecutionInputDto
    published: ServerPublishedRuleDefinitionDto
  }): Promise<{
    result: ServerRuleExecutionResultDto
    graph: CompiledRuleGraph
  }>
  /**
   * Server-only execution of an already-persisted compiled graph. This never
   * resolves a current authored definition or recompiles source data.
   */
  executeFrozen(input: {
    graph: CompiledRuleGraph
    occurrenceId: string
    facts: Readonly<Record<string, import('@artificer-toolkit/shared/rules').RuleValue>>
  }): Promise<{
    result: ServerRuleExecutionResultDto
    graph: CompiledRuleGraph
  }>
  resume(input: unknown): Promise<ServerRuleExecutionResultDto>
  /** Server-only: preserves the sealed graph that was resumed. */
  resumeWithGraph?(input: unknown): Promise<{
    result: ServerRuleExecutionResultDto
    graph: CompiledRuleGraph
  }>
}

async function sealContinuation(candidate: unknown, integrityKey: Uint8Array<ArrayBuffer>) {
  const parsed = serverRuleExecutionContinuationDtoSchema.parse({
    ...(candidate as object),
    seal: '0'.repeat(64)
  })
  const { seal: _seal, ...continuation } = parsed
  const key = await crypto.subtle.importKey(
    'raw',
    integrityKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(canonicalizeRuleDocument(continuation))
  )
  return {
    ...continuation,
    seal: Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    )
  }
}

async function unsealContinuation(
  candidate: unknown,
  integrityKey: Uint8Array<ArrayBuffer>
): Promise<RuleExecutionContinuation> {
  const continuation = serverRuleExecutionContinuationDtoSchema.parse(candidate)
  const { seal, ...unsealed } = continuation
  const key = await crypto.subtle.importKey(
    'raw',
    integrityKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const signature = Uint8Array.from({ length: 32 }, (_, index) =>
    Number.parseInt(seal.slice(index * 2, index * 2 + 2), 16)
  )
  if (
    !(await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(canonicalizeRuleDocument(unsealed))
    ))
  ) {
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
      const capability = gameSystemRuleCapabilityDtoSchema.parse(candidate)
      return [capability.gameSystemId, capability] as const
    })
  )
  if (capabilities.size !== input.capabilities.length) {
    throw new RuleRuntimeConfigurationError(
      'Only one capability contract may be registered per Game System.'
    )
  }

  const operations = createRuleOperationRegistry(input.operations ?? coreRuleOperations)

  function compileCurrent(
    commandCandidate: unknown,
    publishedCandidate: unknown
  ): {
    command: ServerRuleExecutionInputDto
    published: ServerPublishedRuleDefinitionDto
    graph: CompiledRuleGraph
  } {
    const command = serverRuleExecutionInputDtoSchema.parse(commandCandidate)
    const published = serverPublishedRuleDefinitionDtoSchema.parse(publishedCandidate)
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

    return { command, published, graph: compiled.value }
  }

  async function executeCurrent(
    commandCandidate: unknown,
    publishedCandidate: unknown
  ): Promise<{ result: ServerRuleExecutionResultDto; graph: CompiledRuleGraph }> {
    const { command, graph } = compileCurrent(commandCandidate, publishedCandidate)

    const result = executeRuleGraph({
      graph,
      occurrenceId: command.occurrenceId,
      facts: command.facts,
      operations
    })
    return {
      result: serverRuleExecutionResultDtoSchema.parse(
        result.status === 'PAUSED'
          ? {
              status: 'PAUSED',
              continuation: await sealContinuation(result.continuation, continuationIntegrityKey)
            }
          : result
      ),
      graph
    }
  }

  async function executeFrozen(input: {
    graph: CompiledRuleGraph
    occurrenceId: string
    facts: Readonly<Record<string, import('@artificer-toolkit/shared/rules').RuleValue>>
  }): Promise<{ result: ServerRuleExecutionResultDto; graph: CompiledRuleGraph }> {
    const graph = compiledRuleGraphDtoSchema.parse(input.graph) as CompiledRuleGraph
    const command = serverRuleExecutionInputDtoSchema.parse({
      definitionId: graph.source.definitionId,
      occurrenceId: input.occurrenceId,
      facts: input.facts
    })
    const capability = capabilities.get(graph.source.gameSystemId)
    if (!capability) {
      throw new RuleRuntimeConfigurationError(
        `No capability contract is registered for frozen Game System "${graph.source.gameSystemId}".`
      )
    }
    if (capability.contractVersion !== graph.capabilityContractVersion) {
      throw new RuleRuntimeSourceIntegrityError(
        'Frozen rule graph capability contract version is not registered for its Game System.'
      )
    }
    const validation = validateCompiledRuleGraph({
      graph,
      capability,
      operations
    })
    if (!validation.ok) {
      throw new RuleRuntimeSourceIntegrityError(
        validation.diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
      )
    }
    const result = executeRuleGraph({
      graph,
      occurrenceId: command.occurrenceId,
      facts: command.facts,
      operations
    })
    return {
      result: serverRuleExecutionResultDtoSchema.parse(
        result.status === 'PAUSED'
          ? {
              status: 'PAUSED',
              continuation: await sealContinuation(result.continuation, continuationIntegrityKey)
            }
          : result
      ),
      graph
    }
  }

  return {
    async execute(candidate) {
      const command = serverRuleExecutionInputDtoSchema.parse(candidate)
      const published = await input.definitions.requireCurrent(command.definitionId)
      return (await executeCurrent(command, published)).result
    },
    async executeResolved(resolved) {
      return (await executeCurrent(resolved.command, resolved.published)).result
    },
    async executeResolvedWithGraph(resolved) {
      return executeCurrent(resolved.command, resolved.published)
    },
    async executeFrozen(frozen) {
      return executeFrozen(frozen)
    },
    async resume(candidate) {
      const command = serverRuleExecutionResumeInputDtoSchema.parse(candidate)
      const continuation = await unsealContinuation(command.continuation, continuationIntegrityKey)
      const response = command.response
      const result = resumeRuleGraph({ continuation, response, operations })
      return serverRuleExecutionResultDtoSchema.parse(
        result.status === 'PAUSED'
          ? {
              status: 'PAUSED',
              continuation: await sealContinuation(result.continuation, continuationIntegrityKey)
            }
          : result
      )
    },
    async resumeWithGraph(candidate) {
      const command = serverRuleExecutionResumeInputDtoSchema.parse(candidate)
      const continuation = await unsealContinuation(command.continuation, continuationIntegrityKey)
      const result = resumeRuleGraph({
        continuation,
        response: command.response,
        operations
      })
      return {
        result: serverRuleExecutionResultDtoSchema.parse(
          result.status === 'PAUSED'
            ? {
                status: 'PAUSED',
                continuation: await sealContinuation(result.continuation, continuationIntegrityKey)
              }
            : result
        ),
        graph: continuation.graph
      }
    }
  }
}
