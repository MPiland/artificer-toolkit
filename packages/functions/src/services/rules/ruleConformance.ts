import {
  ruleEvaluationDtoSchema,
  type RulePackDocumentDto
} from '@artificer-toolkit/schema/api/rules'
import { z } from 'zod'

import { executeDiceConfiguration } from '../rolls/rollService.js'
import { equalCanonicalJson } from './ruleChecksum.js'
import { validateActivatableRulePackDocument } from './ruleDocumentValidation.js'
import { evaluateZenRuleModel } from './zenRuleEngine.js'

export class RuleConformanceError extends Error {
  readonly failures: string[]

  constructor(failures: string[]) {
    super(`Rule pack conformance failed: ${failures.join(' ')}`)
    this.name = 'RuleConformanceError'
    this.failures = failures
  }
}

type JsonValue = z.infer<ReturnType<typeof z.json>>

function withDeterministicRolls(
  input: JsonValue,
  requests: ReturnType<typeof ruleEvaluationDtoSchema.parse>['rollRequests']
): JsonValue {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Fixtures that request rolls require an object input.')
  }
  return z.json().parse({
    ...input,
    rolls: requests.map((request) => {
      const result = executeDiceConfiguration(
        { configuration: request.configuration },
        { createId: () => request.id, random: { nextInt: () => 0 } }
      )
      return {
        requestId: request.id,
        targetActorId: request.targetActorId,
        rollId: result.id,
        normalizedExpression: result.normalizedExpression,
        total: result.evidence.total,
        evidence: result.evidence
      }
    })
  })
}

export async function assertRulePackConformance(document: RulePackDocumentDto): Promise<void> {
  validateActivatableRulePackDocument(document)
  const failures: string[] = []

  for (const fixture of document.fixtures) {
    try {
      const expected = ruleEvaluationDtoSchema.parse(fixture.expected)
      const initial = await evaluateZenRuleModel({
        document,
        modelKey: fixture.modelKey,
        context: fixture.input,
        trace: false
      })
      let actual = ruleEvaluationDtoSchema.parse(initial.result)
      if (actual.rollRequests.length > 0) {
        if (!actual.eligibility.allowed || actual.outcomes.length > 0) {
          throw new Error('Roll requests require an allowed result with no outcomes.')
        }
        const resolved = await evaluateZenRuleModel({
          document,
          modelKey: fixture.modelKey,
          context: withDeterministicRolls(fixture.input, actual.rollRequests),
          trace: false
        })
        actual = ruleEvaluationDtoSchema.parse(resolved.result)
        if (actual.rollRequests.length > 0) {
          throw new Error('Fixtures cannot request more than one roll stage.')
        }
      }
      if (!equalCanonicalJson(actual, expected)) failures.push(`${fixture.label}: output differed.`)
    } catch (error) {
      failures.push(
        `${fixture.label}: ${error instanceof Error ? error.message : 'evaluation failed.'}`
      )
    }
  }

  if (failures.length > 0) throw new RuleConformanceError(failures)
}
