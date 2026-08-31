import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'

import type { InitiativeScoreBatchEntityResult } from './encounterInitiativeScoreBatch.js'

export type InitiativeScoreOrderGroup = {
  score: number
  members: readonly { kind: 'ACTOR' | 'SIDE'; id: string }[]
  classification: 'SETTLED' | 'TIED'
}

export type InitiativeOrderingResult =
  | { kind: 'ORDERED'; groups: readonly InitiativeScoreOrderGroup[] }
  | { kind: 'ORDER_CHOICE_REQUIRED'; entities: readonly { kind: 'ACTOR' | 'SIDE'; id: string }[] }

function validateCohort(results: readonly InitiativeScoreBatchEntityResult[]) {
  if (results.length < 1 || results.length > AUTHORED_LIMITS.nestedCollectionItems) {
    throw new Error(
      `Initiative ordering requires between 1 and ${AUTHORED_LIMITS.nestedCollectionItems} entities.`
    )
  }
  const firstKind = results[0].entity.kind
  let previousId = ''
  for (const entry of results) {
    if (entry.entity.kind !== firstKind) {
      throw new Error('Initiative ordering requires one entity kind per cohort.')
    }
    const canonicalId = serverUuidIdentityDtoSchema.parse(entry.entity.id)
    if (canonicalId !== entry.entity.id || entry.entity.id <= previousId) {
      throw new Error('Initiative ordering entities must use canonical ascending UUID identities.')
    }
    previousId = entry.entity.id
  }
  return results.map(({ entity }) => entity)
}

export function prepareInitiativeOrdering(input: {
  results: readonly InitiativeScoreBatchEntityResult[]
  sortDirection: 'ASCENDING' | 'DESCENDING'
}): InitiativeOrderingResult {
  const entities = validateCohort(input.results)
  for (const entry of input.results) {
    if (
      entry.result.kind === 'GRAPH_COMPLETE' &&
      entry.result.execution.sortDirection !== input.sortDirection
    ) {
      throw new Error('Initiative score order direction does not match the pinned ordering policy.')
    }
  }
  const unavailable = input.results.some((entry) => {
    if (entry.result.kind !== 'GRAPH_COMPLETE') return true
    return !entry.result.execution.automatic || !Number.isFinite(entry.result.execution.score)
  })
  if (unavailable) return { kind: 'ORDER_CHOICE_REQUIRED', entities }

  const sorted = [...input.results].sort((left, right) => {
    if (left.result.kind !== 'GRAPH_COMPLETE' || right.result.kind !== 'GRAPH_COMPLETE') {
      throw new Error('Unreachable unavailable score.')
    }
    if (!left.result.execution.automatic || !right.result.execution.automatic) {
      throw new Error('Unreachable unavailable automatic score.')
    }
    const leftScore = left.result.execution.score
    const rightScore = right.result.execution.score
    return input.sortDirection === 'ASCENDING' ? leftScore - rightScore : rightScore - leftScore
  })
  const groups: InitiativeScoreOrderGroup[] = []
  for (const entry of sorted) {
    if (entry.result.kind !== 'GRAPH_COMPLETE' || !entry.result.execution.automatic) {
      throw new Error('Unreachable unavailable score.')
    }
    const score = entry.result.execution.score
    const previous = groups.at(-1)
    if (previous?.score === score) {
      previous.members = [...previous.members, entry.entity]
      previous.classification = 'TIED'
    } else {
      groups.push({
        score,
        members: [entry.entity],
        classification: 'SETTLED'
      })
    }
  }
  return { kind: 'ORDERED', groups }
}
