import {
  overrideConfig,
  ZenDecisionContent,
  ZenEngine,
  type ZenEngineResponse
} from '@gorules/zen-engine'
import { z } from 'zod'

import type {
  RulePackDocumentDto,
  SimulateRulePackResultDto
} from '@artificer-toolkit/schema/api/rules'

import { validateRulePackDocument } from './ruleDocumentValidation.js'

overrideConfig({ functionTimeoutMillis: 50 })

const MAX_CACHED_ZEN_RUNTIMES = 8

interface ZenRuntime {
  activeEvaluations: number
  contentByModelKey: Map<string, ZenDecisionContent>
  engine: ZenEngine
}

const cachedRuntimes = new Map<string, ZenRuntime>()

function createZenRuntime(document: RulePackDocumentDto): ZenRuntime {
  const contentByModelKey = new Map<string, ZenDecisionContent>()
  const runtime: ZenRuntime = {
    activeEvaluations: 0,
    contentByModelKey,
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

function acquireZenRuntime(document: RulePackDocumentDto, cacheKey?: string): ZenRuntime {
  if (!cacheKey) {
    const runtime = createZenRuntime(document)
    runtime.activeEvaluations = 1
    return runtime
  }

  const cached = cachedRuntimes.get(cacheKey)
  if (cached) {
    cachedRuntimes.delete(cacheKey)
    cachedRuntimes.set(cacheKey, cached)
    cached.activeEvaluations += 1
    return cached
  }

  const runtime = createZenRuntime(document)
  runtime.activeEvaluations = 1
  cachedRuntimes.set(cacheKey, runtime)
  evictIdleZenRuntimes()
  return runtime
}

function releaseZenRuntime(runtime: ZenRuntime, cacheKey?: string): void {
  runtime.activeEvaluations -= 1
  if (!cacheKey) {
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
  cacheKey?: string
  document: RulePackDocumentDto
  modelKey: string
  context: z.infer<ReturnType<typeof z.json>>
  trace?: boolean
}): Promise<SimulateRulePackResultDto> {
  validateRulePackDocument(input.document)
  if (!Object.hasOwn(input.document.models, input.modelKey)) {
    throw new Error(`Rule model "${input.modelKey}" was not found.`)
  }

  const runtime = acquireZenRuntime(input.document, input.cacheKey)
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
    releaseZenRuntime(runtime, input.cacheKey)
  }
}
