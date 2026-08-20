import {
  overrideConfig,
  ZenDecisionContent,
  ZenEngine,
  type ZenEngineResponse
} from '@gorules/zen-engine'
import { z } from 'zod'

import {
  rulePackDocumentDtoSchema,
  type RulePackDocumentDto,
  type SimulateRulePackResultDto
} from '@artificer-toolkit/schema/api/rules'

import { checksumRuleDocument } from './ruleChecksum.js'
import { validateRulePackDocument } from './ruleDocumentValidation.js'

overrideConfig({ functionTimeoutMillis: 50 })

const MAX_CACHED_ZEN_RUNTIMES = 8

interface ZenRuntime {
  activeEvaluations: number
  contentByModelKey: Map<string, ZenDecisionContent>
  engine: ZenEngine
  modelKeys: ReadonlySet<string>
}

const cachedRuntimes = new Map<string, ZenRuntime>()

function createZenRuntime(document: RulePackDocumentDto): ZenRuntime {
  const contentByModelKey = new Map<string, ZenDecisionContent>()
  const runtime: ZenRuntime = {
    activeEvaluations: 0,
    contentByModelKey,
    modelKeys: new Set(Object.keys(document.models)),
    engine: new ZenEngine({
      loader: async (modelKey) => {
        const cached = contentByModelKey.get(modelKey)
        if (cached) return cached

        const model = document.models[modelKey]
        if (typeof model !== 'object' || model === null || Array.isArray(model)) {
          throw new Error(`Referenced rule model "${modelKey}" was not found.`)
        }
        const content = new ZenDecisionContent(model)
        contentByModelKey.set(modelKey, content)
        return content
      }
    })
  }
  return runtime
}

function evictIdleZenRuntimes(): void {
  for (const [cacheKey, runtime] of cachedRuntimes) {
    if (cachedRuntimes.size <= MAX_CACHED_ZEN_RUNTIMES) return
    if (runtime.activeEvaluations > 0) continue
    cachedRuntimes.delete(cacheKey)
    runtime.engine.dispose()
  }
}

function acquirePinnedZenRuntime(input: {
  checksum: string
  document: unknown
}): ZenRuntime {
  const cached = cachedRuntimes.get(input.checksum)
  if (cached) {
    cachedRuntimes.delete(input.checksum)
    cachedRuntimes.set(input.checksum, cached)
    cached.activeEvaluations += 1
    return cached
  }

  const document = rulePackDocumentDtoSchema.parse(input.document)
  validateRulePackDocument(document)
  if (checksumRuleDocument(document) !== input.checksum) {
    throw new Error('The pinned rule-pack checksum does not match its document.')
  }
  const runtime = createZenRuntime(document)
  runtime.activeEvaluations = 1
  cachedRuntimes.set(input.checksum, runtime)
  evictIdleZenRuntimes()
  return runtime
}

function releaseZenRuntime(runtime: ZenRuntime, pinned = false): void {
  runtime.activeEvaluations -= 1
  if (!pinned) {
    runtime.engine.dispose()
    return
  }
  evictIdleZenRuntimes()
}

function jsonValue(value: unknown): z.infer<ReturnType<typeof z.json>> {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('The rule model returned a non-JSON result.')
  const parsed: unknown = JSON.parse(serialized)
  return z.json().parse(parsed)
}

export async function evaluateZenRuleModel(input: {
  document: RulePackDocumentDto
  modelKey: string
  context: z.infer<ReturnType<typeof z.json>>
  trace?: boolean
}): Promise<SimulateRulePackResultDto> {
  validateRulePackDocument(input.document)
  if (!Object.hasOwn(input.document.models, input.modelKey)) {
    throw new Error(`Rule model "${input.modelKey}" was not found.`)
  }

  const runtime = createZenRuntime(input.document)
  runtime.activeEvaluations = 1
  try {
    const response: ZenEngineResponse = await runtime.engine.evaluate(
      input.modelKey,
      input.context,
      {
        maxDepth: 32,
        trace: input.trace === true
      }
    )
    return {
      result: jsonValue(response.result),
      trace: response.trace ? jsonValue(response.trace) : null
    }
  } finally {
    releaseZenRuntime(runtime)
  }
}

/**
 * Evaluates a persisted immutable revision after its caller has verified its identity.
 * This is intentionally the only checksum-keyed runtime namespace: callers cannot supply
 * an arbitrary cache key to ordinary rule simulation or conformance evaluation.
 */
export async function evaluatePinnedZenRuleModel(input: {
  checksum: string
  document: unknown
  modelKey: string
  context: z.infer<ReturnType<typeof z.json>>
  trace?: boolean
}): Promise<SimulateRulePackResultDto> {
  const runtime = acquirePinnedZenRuntime({ checksum: input.checksum, document: input.document })
  try {
    if (!runtime.modelKeys.has(input.modelKey)) {
      throw new Error(`Rule model "${input.modelKey}" was not found.`)
    }
    const response: ZenEngineResponse = await runtime.engine.evaluate(
      input.modelKey,
      input.context,
      {
        maxDepth: 32,
        trace: input.trace === true
      }
    )
    return {
      result: jsonValue(response.result),
      trace: response.trace ? jsonValue(response.trace) : null
    }
  } finally {
    releaseZenRuntime(runtime, true)
  }
}
