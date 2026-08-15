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

  const engine = new ZenEngine({
    loader: async (modelKey) => {
      const model = input.document.models[modelKey]
      if (typeof model !== 'object' || model === null || Array.isArray(model)) {
        throw new Error(`Referenced rule model "${modelKey}" was not found.`)
      }
      return new ZenDecisionContent(model)
    }
  })
  try {
    const response: ZenEngineResponse = await engine.evaluate(input.modelKey, input.context, {
      maxDepth: 32,
      trace: input.trace === true
    })
    return {
      result: jsonValue(response.result),
      trace: response.trace ? jsonValue(response.trace) : null
    }
  } finally {
    engine.dispose()
  }
}
