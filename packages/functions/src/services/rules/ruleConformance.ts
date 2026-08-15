import {
  ruleEvaluationDtoSchema,
  type RulePackDocumentDto
} from '@artificer-toolkit/schema/api/rules'
import { z } from 'zod'

import { executeDiceConfiguration } from '../rolls/rollService.js'
import { equalCanonicalJson } from './ruleChecksum.js'
import { validateActivatableRulePackDocument } from './ruleDocumentValidation.js'
import { getRuleModelContract } from './ruleModelContracts.js'
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
      const contract = getRuleModelContract(fixture.modelKey)
      const fixtureInput = contract
        ? z.json().parse(contract.input.parse(fixture.input))
        : fixture.input
      const expected = contract
        ? z.json().parse(contract.output.parse(fixture.expected))
        : ruleEvaluationDtoSchema.parse(fixture.expected)
      const initial = await evaluateZenRuleModel({
        document,
        modelKey: fixture.modelKey,
        context: fixtureInput,
        trace: false
      })
      let actual = contract
        ? z.json().parse(contract.output.parse(initial.result))
        : ruleEvaluationDtoSchema.parse(initial.result)
      if (contract && !contract.usesRuleRollProtocol) {
        if (!equalCanonicalJson(actual, expected))
          failures.push(`${fixture.label}: output differed.`)
        continue
      }
      const ruleEvaluation = ruleEvaluationDtoSchema.parse(actual)
      if (ruleEvaluation.rollRequests.length > 0) {
        if (!ruleEvaluation.eligibility.allowed || ruleEvaluation.outcomes.length > 0) {
          throw new Error('Roll requests require an allowed result with no outcomes.')
        }
        const resolved = await evaluateZenRuleModel({
          document,
          modelKey: fixture.modelKey,
          context: withDeterministicRolls(fixtureInput, ruleEvaluation.rollRequests),
          trace: false
        })
        actual = contract
          ? z.json().parse(contract.output.parse(resolved.result))
          : ruleEvaluationDtoSchema.parse(resolved.result)
        if (ruleEvaluationDtoSchema.parse(actual).rollRequests.length > 0) {
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
