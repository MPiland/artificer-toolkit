import {
  createRulePackRepository,
  type DBLike,
  type RulePackRevisionRecord
} from '@artificer-toolkit/db'
import { rulePackDocumentDtoSchema } from '@artificer-toolkit/schema/api/rules'
import { z } from 'zod'
import { performance } from 'node:perf_hooks'

import { checksumRuleDocument } from './ruleChecksum.js'
import {
  getRuleModelContract,
  RULE_EVALUATOR_KIND,
  RULE_EVALUATOR_VERSION
} from './ruleModelContracts.js'
import { evaluateZenRuleModel } from './zenRuleEngine.js'

const MAX_RUNTIME_JSON_BYTES = 256 * 1024
const MAX_RUNTIME_JSON_DEPTH = 32

type JsonValue = z.infer<ReturnType<typeof z.json>>

export class RuleRevisionEvaluationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleRevisionEvaluationError'
  }
}

function assertJsonDepth(value: unknown, label: string, depth = 0): void {
  if (depth > MAX_RUNTIME_JSON_DEPTH) {
    throw new RuleRevisionEvaluationError(
      `${label} cannot exceed ${MAX_RUNTIME_JSON_DEPTH} levels.`
    )
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => assertJsonDepth(entry, label, depth + 1))
  } else if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((entry) => assertJsonDepth(entry, label, depth + 1))
  }
}

function assertBoundedJson(value: unknown, label: string): asserts value is JsonValue {
  assertJsonDepth(value, label)
  const serialized = JSON.stringify(value)
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > MAX_RUNTIME_JSON_BYTES) {
    throw new RuleRevisionEvaluationError(`${label} cannot exceed ${MAX_RUNTIME_JSON_BYTES} bytes.`)
  }
}

function assertCompatibleRuntime(
  revision: RulePackRevisionRecord,
  contractKey: string
): NonNullable<ReturnType<typeof getRuleModelContract>> {
  const contract = getRuleModelContract(contractKey, revision.modelContractVersion)
  if (!contract) {
    if (getRuleModelContract(contractKey)) {
      throw new RuleRevisionEvaluationError(
        'The pinned rule revision uses an unsupported model contract version.'
      )
    }
    throw new RuleRevisionEvaluationError(
      `Rule contract "${contractKey}" is not registered for authoritative evaluation.`
    )
  }
  if (revision.evaluatorKind !== RULE_EVALUATOR_KIND) {
    throw new RuleRevisionEvaluationError(
      'The pinned rule revision uses an unsupported evaluator kind.'
    )
  }
  if (revision.evaluatorVersion !== RULE_EVALUATOR_VERSION) {
    throw new RuleRevisionEvaluationError(
      'The pinned rule revision uses an unsupported evaluator version.'
    )
  }
  return contract
}

export async function evaluateRuleRevision(input: {
  db: DBLike
  revisionId: string
  modelKey: string
  contractKey?: string
  normalizedFacts: JsonValue
  trace?: boolean
}): Promise<{
  revisionId: string
  checksum: string
  evaluatorKind: string
  evaluatorVersion: string
  modelContractVersion: number
  modelKey: string
  contractKey: string
  normalizedFacts: JsonValue
  result: JsonValue
  trace: JsonValue | null
  evaluationDurationMs: number
  documentBytes: number
  normalizedFactsBytes: number
  resultBytes: number
}> {
  const revision = await createRulePackRepository(input.db).getRevision(input.revisionId)
  if (!revision) throw new RuleRevisionEvaluationError('Rule pack revision was not found.')
  if (revision.state === 'DRAFT') {
    throw new RuleRevisionEvaluationError('Draft rule pack revisions cannot be evaluated.')
  }
  const contractKey = input.contractKey ?? input.modelKey
  const contract = assertCompatibleRuntime(revision, contractKey)
  const modelContractVersion = contract.version
  assertBoundedJson(input.normalizedFacts, 'Normalized rule facts')
  const normalizedFacts = z.json().parse(contract.input.parse(input.normalizedFacts))
  assertBoundedJson(normalizedFacts, 'Normalized rule facts')

  const document = rulePackDocumentDtoSchema.parse(revision.document)
  if (checksumRuleDocument(document) !== revision.checksum) {
    throw new RuleRevisionEvaluationError(
      'The pinned rule-pack checksum does not match its document.'
    )
  }
  const evaluationStartedAt = performance.now()
  const evaluated = await evaluateZenRuleModel({
    cacheKey: revision.checksum,
    document,
    modelKey: input.modelKey,
    context: normalizedFacts,
    trace: input.trace
  })
  const evaluationDurationMs = performance.now() - evaluationStartedAt
  assertBoundedJson(evaluated.result, 'Rule model result')
  const result = z.json().parse(contract.output.parse(evaluated.result))
  assertBoundedJson(result, 'Rule model result')
  if (evaluated.trace !== null) assertBoundedJson(evaluated.trace, 'Rule model trace')

  return {
    revisionId: revision.id,
    checksum: revision.checksum,
    evaluatorKind: RULE_EVALUATOR_KIND,
    evaluatorVersion: RULE_EVALUATOR_VERSION,
    modelContractVersion,
    modelKey: input.modelKey,
    contractKey,
    normalizedFacts,
    result,
    trace: evaluated.trace,
    evaluationDurationMs,
    documentBytes: Buffer.byteLength(JSON.stringify(document), 'utf8'),
    normalizedFactsBytes: Buffer.byteLength(JSON.stringify(normalizedFacts), 'utf8'),
    resultBytes: Buffer.byteLength(JSON.stringify(result), 'utf8')
  }
}
