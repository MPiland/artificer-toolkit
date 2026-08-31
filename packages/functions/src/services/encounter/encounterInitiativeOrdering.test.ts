import { describe, expect, it } from 'vitest'

import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { InitiativeScoreBatchEntityResult } from './encounterInitiativeScoreBatch.js'
import type { InitiativeScoreExecution } from './encounterInitiativeGraphExecution.js'
import { prepareInitiativeOrdering } from './encounterInitiativeOrdering.js'

const actorA = '00000000-0000-4000-8000-000000000001'
const actorB = '00000000-0000-4000-8000-000000000002'
const actorC = '00000000-0000-4000-8000-000000000003'

function scored(
  id: string,
  score: number,
  automatic = true,
  sortDirection: 'ASCENDING' | 'DESCENDING' = 'DESCENDING'
): InitiativeScoreBatchEntityResult {
  const execution: ServerCompletedRuleExecutionDto = {
    status: 'COMPLETE',
    outputs: { score, automatic },
    evidence: {
      source: {
        definitionId: actorA,
        gameSystemId: actorA,
        definitionFamilyKey: 'test',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: { score, automatic }
    }
  }
  const initiativeExecution: InitiativeScoreExecution = automatic
    ? { automatic: true, score, sortDirection, execution }
    : { automatic: false, score: null, sortDirection, execution }
  return {
    entity: { kind: 'ACTOR', id },
    result: {
      kind: 'GRAPH_COMPLETE',
      execution: initiativeExecution
    }
  }
}

function unavailable(
  id: string,
  kind: 'FACTS_UNAVAILABLE' | 'EVIDENCE_NOT_ALLOWED'
): InitiativeScoreBatchEntityResult {
  return { entity: { kind: 'ACTOR', id }, result: { kind } }
}

describe('prepareInitiativeOrdering', () => {
  it('orders descending and ascending scores without using UUID as a tiebreak', () => {
    const results = [scored(actorA, 10), scored(actorB, 20), scored(actorC, 20)]
    expect(prepareInitiativeOrdering({ results, sortDirection: 'DESCENDING' })).toMatchObject({
      kind: 'ORDERED',
      groups: [
        { score: 20, classification: 'TIED', members: [{ id: actorB }, { id: actorC }] },
        { score: 10, classification: 'SETTLED' }
      ]
    })
    const ascending = [
      scored(actorA, 10, true, 'ASCENDING'),
      scored(actorB, 20, true, 'ASCENDING'),
      scored(actorC, 20, true, 'ASCENDING')
    ]
    expect(
      prepareInitiativeOrdering({ results: ascending, sortDirection: 'ASCENDING' })
    ).toMatchObject({
      groups: [{ score: 10 }, { score: 20, classification: 'TIED' }]
    })
  })

  it('requires a choice for the entire cohort when one score is unavailable', () => {
    expect(
      prepareInitiativeOrdering({
        results: [scored(actorA, 10), unavailable(actorB, 'FACTS_UNAVAILABLE')],
        sortDirection: 'DESCENDING'
      })
    ).toEqual({
      kind: 'ORDER_CHOICE_REQUIRED',
      entities: [
        { kind: 'ACTOR', id: actorA },
        { kind: 'ACTOR', id: actorB }
      ]
    })
    expect(
      prepareInitiativeOrdering({
        results: [scored(actorA, 10, false), scored(actorB, 9)],
        sortDirection: 'DESCENDING'
      }).kind
    ).toBe('ORDER_CHOICE_REQUIRED')
  })

  it('rejects malformed, mixed, duplicate, and oversized cohorts', () => {
    expect(() =>
      prepareInitiativeOrdering({
        results: [scored(actorB, 1), scored(actorA, 2)],
        sortDirection: 'DESCENDING'
      })
    ).toThrow('ascending UUID')
    expect(() =>
      prepareInitiativeOrdering({
        results: [
          scored(actorA, 1),
          { ...scored(actorB, 2), entity: { kind: 'SIDE', id: actorB } }
        ],
        sortDirection: 'DESCENDING'
      })
    ).toThrow('one entity kind')
    expect(() =>
      prepareInitiativeOrdering({
        results: [scored(actorA, 1), scored(actorA, 2)],
        sortDirection: 'DESCENDING'
      })
    ).toThrow('ascending UUID')
    expect(() =>
      prepareInitiativeOrdering({
        results: [scored(actorA, 1)],
        sortDirection: 'ASCENDING'
      })
    ).toThrow('pinned ordering policy')
    expect(() =>
      prepareInitiativeOrdering({
        results: Array.from({ length: 101 }, (_, index) =>
          scored(`00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, index)
        ),
        sortDirection: 'DESCENDING'
      })
    ).toThrow('between 1 and 100')
  })
})
