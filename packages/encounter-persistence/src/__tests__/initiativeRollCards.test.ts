import { describe, expect, it } from 'vitest'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { persistEncounterInitiativeRollCards } from '../initiativeRollCards.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000000a1'

/** One d20 trace entry, as the settled graph records it. */
function die(requestId: string, value: number, max = 20) {
  return {
    inputs: { min: 1, max },
    evidence: { requestId, kind: 'INTEGER_RANGE', value }
  }
}

/** The fields of a turn root the card writer reads; the rest of the root is not exercised. */
function declaredRoot(trace: readonly object[]) {
  return {
    initiatorUserId: 'user',
    resolutionCommands: [],
    initiative: {
      procedure: 'DECLARED_ACTION_ROLL',
      evidence: {
        primaryResults: [
          {
            entity: { kind: 'ACTOR', id: ACTOR_ID },
            result: {
              kind: 'GRAPH_COMPLETE',
              execution: { automatic: true, score: 20, execution: { evidence: { trace } } }
            }
          }
        ]
      }
    }
  } as unknown as TurnCoordinatorRootDto
}

async function persist(root: TurnCoordinatorRootDto) {
  const ctx = {} as Parameters<typeof persistEncounterInitiativeRollCards>[0]
  return persistEncounterInitiativeRollCards(ctx, {
    state: {} as EncounterRunState,
    campaign: {} as Parameters<typeof persistEncounterInitiativeRollCards>[1]['campaign'],
    actors: [],
    root,
    occurrenceId: '00000000-0000-4000-8000-0000000000b1',
    occurredAt: '2026-10-14T00:00:00.000Z'
  })
}

describe('persistEncounterInitiativeRollCards invariants', () => {
  // ENCOUNTER-10 teaches the declared graph to roll advantage and disadvantage and to record the
  // mode with both faces; until then a declared result with several dice is not representable.
  it('refuses a declared result that settled more than one die instead of posting no card', async () => {
    await expect(persist(declaredRoot([die('first', 4), die('second', 17)]))).rejects.toThrow(
      /more than one die/
    )
  })

  it('refuses a declared die that is not a logged 1dN instead of posting no card', async () => {
    await expect(persist(declaredRoot([die('only', 3, 3)]))).rejects.toThrow(/1dN/)
  })
})
