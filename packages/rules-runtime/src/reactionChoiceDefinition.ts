import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import {
  RULE_GRAPH_LIMITS,
  checksumRuleDocument,
  type RuleGraphDefinition
} from '@artificer-toolkit/shared/rules'

import { RULE_RUNTIME_GRAPH_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

export const REACTION_CHOICE_OPERATION_KEY = 'evidence.bounded-choice-index'
export const REACTION_CHOICE_MIN_FACT_KEY = 'choice-min-index'
export const REACTION_CHOICE_MAX_FACT_KEY = 'choice-max-index'

/**
 * One published, System-owned wrapper around the portable bounded-choice
 * primitive. Option identities, labels, authority, and redaction never enter
 * this graph; the Encounter application context owns them.
 */
export function createReactionChoiceDefinition(input: {
  definitionId: string
  gameSystemId: string
}): ServerPublishedRuleDefinitionDto {
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.definitionId,
    gameSystemId: input.gameSystemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'choice',
        operation: {
          key: REACTION_CHOICE_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          minIndex: {
            kind: 'FACT',
            factKey: REACTION_CHOICE_MIN_FACT_KEY
          },
          maxIndex: {
            kind: 'FACT',
            factKey: REACTION_CHOICE_MAX_FACT_KEY
          }
        }
      }
    ],
    outputs: {
      selectedIndex: {
        kind: 'NODE_OUTPUT',
        nodeId: 'choice',
        port: 'selectedIndex'
      }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

export async function startReactionChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  published: ServerPublishedRuleDefinitionDto
  optionCount: number
  /** The most options the caller's offer may hold. */
  maxOptionCount?: number
}): Promise<ServerRuleExecutionContinuationDto> {
  const maxOptionCount = input.maxOptionCount ?? RULE_GRAPH_LIMITS.NODES
  if (
    !Number.isInteger(input.optionCount) ||
    input.optionCount < 1 ||
    input.optionCount > maxOptionCount
  ) {
    throw new Error(`Bounded choices require between 1 and ${maxOptionCount} options.`)
  }
  const execution = await input.runtime.executeResolved({
    command: {
      definitionId: input.published.id,
      occurrenceId: input.occurrenceId,
      facts: {
        [REACTION_CHOICE_MIN_FACT_KEY]: 0,
        [REACTION_CHOICE_MAX_FACT_KEY]: input.optionCount - 1
      }
    },
    published: input.published
  })
  if (
    execution.status !== 'PAUSED' ||
    execution.continuation.request.nodeId !== 'choice' ||
    execution.continuation.request.min !== 0 ||
    execution.continuation.request.max !== input.optionCount - 1
  ) {
    throw new Error('Movement reaction choice did not issue its exact bounded request.')
  }
  return execution.continuation
}

export async function resumeReactionChoice(input: {
  runtime: RulesRuntimeService
  continuation: ServerRuleExecutionContinuationDto
  selectedIndex: number
}): Promise<number> {
  const execution = await input.runtime.resume({
    continuation: input.continuation,
    response: {
      requestId: input.continuation.request.requestId,
      value: input.selectedIndex
    }
  })
  if (execution.status !== 'COMPLETE' || execution.outputs.selectedIndex !== input.selectedIndex) {
    throw new Error('Movement reaction choice did not settle its exact selected index.')
  }
  return input.selectedIndex
}
