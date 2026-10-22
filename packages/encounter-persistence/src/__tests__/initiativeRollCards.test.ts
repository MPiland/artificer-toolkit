import { describe, expect, it } from 'vitest'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { keepOneOfTwoRuleOperation } from '@artificer-toolkit/shared/rules'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { dnd5eDeclaredInitiativeRollFacts } from '@artificer-toolkit/rules-runtime/systems/dnd5e/initiativeFactAdapter'
import { persistEncounterInitiativeRollCards } from '../initiativeRollCards.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000000a1'
const OWNER_ID = 'owner'

/** One d20 trace entry, as the settled graph records it. */
function die(requestId: string, value: number, max = 20) {
  return {
    operation: { key: 'evidence.integer-range', contractVersion: 1 },
    inputs: { min: 1, max },
    evidence: { requestId, kind: 'INTEGER_RANGE', value }
  }
}

/** The graph node that keeps one of two faces, as the settled graph records it. */
function kept(value: number) {
  return {
    operation: { key: keepOneOfTwoRuleOperation.key, contractVersion: 1 },
    inputs: {},
    outputs: { value }
  }
}

/** The fields of a turn root the card writer reads; the rest of the root is not exercised. */
function declaredRoot(
  trace: readonly object[],
  options: { facts?: Record<string, unknown>; score?: number } = {}
) {
  return {
    initiatorUserId: OWNER_ID,
    resolutionCommands: [],
    initiative: {
      procedure: 'DECLARED_ACTION_ROLL',
      evidence: {
        primaryResults: [
          {
            entity: { kind: 'ACTOR', id: ACTOR_ID },
            result: {
              kind: 'GRAPH_COMPLETE',
              execution: {
                automatic: true,
                score: options.score ?? 20,
                execution: { evidence: { trace, facts: options.facts ?? {} } }
              }
            }
          }
        ]
      }
    }
  } as unknown as TurnCoordinatorRootDto
}

const actor = {
  id: ACTOR_ID,
  kind: 'CUSTOM',
  sourceId: null,
  label: 'Mira',
  public: true,
  controllerUserIds: []
} as unknown as EncounterRunActorState

/** Persists the root's cards against recording ports and returns the table cards it posted. */
async function persist(root: TurnCoordinatorRootDto) {
  const posted: RollRecordDto[] = []
  const ctx = {
    ports: {
      requireSystem: async () => ({ id: 'system', rulesetCode: 'dnd5e', rulesetVersion: '1' }),
      readGmRollVisibility: async () => 'PUBLIC',
      requireCampaignAuthority: async () => ({}),
      insertTableRoll: async (
        _authority: unknown,
        _author: string,
        _nonce: string,
        roll: RollRecordDto
      ) => {
        posted.push(roll)
        return null
      },
      retainPrivateRoll: async () => undefined
    }
  } as unknown as Parameters<typeof persistEncounterInitiativeRollCards>[0]
  await persistEncounterInitiativeRollCards(ctx, {
    state: { id: 'run', gameSystemId: DND5E_SYSTEM_ID } as EncounterRunState,
    campaign: { id: 'campaign', ownerUserId: OWNER_ID } as Parameters<
      typeof persistEncounterInitiativeRollCards
    >[1]['campaign'],
    actors: [actor],
    root,
    occurrenceId: '00000000-0000-4000-8000-0000000000b1',
    occurredAt: '2026-10-14T00:00:00.000Z'
  })
  return posted
}

describe('persistEncounterInitiativeRollCards', () => {
  it('posts a one-die card with the die plus the modifier', async () => {
    const [card, ...others] = await persist(declaredRoot([die('only', 12)], { score: 15 }))
    expect(others).toEqual([])
    expect(card?.source).toEqual({ kind: 'INITIATIVE', label: 'Initiative' })
    expect(card?.evidence).toMatchObject({ mode: 'NORMAL', terms: [{ rolls: [12] }], total: 15 })
  })

  it('posts one card with both faces and the advantage mode, keeping the higher', async () => {
    const [card, ...others] = await persist(
      declaredRoot([die('first', 4), die('second', 17), kept(17)], {
        facts: dnd5eDeclaredInitiativeRollFacts('ADVANTAGE'),
        score: 20
      })
    )
    expect(others).toEqual([])
    expect(card?.evidence).toMatchObject({
      mode: 'ADVANTAGE',
      terms: [{ rolls: [4, 17], keptRollIndex: 1 }],
      modifier: 3,
      total: 20
    })
  })

  it('posts one card with both faces and the disadvantage mode, keeping the lower', async () => {
    const [card, ...others] = await persist(
      declaredRoot([die('first', 17), die('second', 4), kept(4)], {
        facts: dnd5eDeclaredInitiativeRollFacts('DISADVANTAGE'),
        score: 7
      })
    )
    expect(others).toEqual([])
    expect(card?.evidence).toMatchObject({
      mode: 'DISADVANTAGE',
      terms: [{ rolls: [17, 4], keptRollIndex: 1 }],
      modifier: 3,
      total: 7
    })
  })
})

describe('persistEncounterInitiativeRollCards invariants', () => {
  it('refuses a declared result that settled more than two dice instead of posting no card', async () => {
    await expect(
      persist(
        declaredRoot([die('first', 4), die('second', 17), die('third', 9)], {
          facts: dnd5eDeclaredInitiativeRollFacts('ADVANTAGE')
        })
      )
    ).rejects.toThrow(/more than two dice/)
  })

  it('refuses two settled dice that carry no advantage or disadvantage mode', async () => {
    await expect(
      persist(
        declaredRoot([die('first', 4), die('second', 17)], {
          facts: dnd5eDeclaredInitiativeRollFacts('NORMAL')
        })
      )
    ).rejects.toThrow(/roll mode/)
  })

  it('refuses two settled dice of different sizes instead of posting a card the dice do not explain', async () => {
    await expect(
      persist(
        declaredRoot([die('first', 4), die('second', 6, 6)], {
          facts: dnd5eDeclaredInitiativeRollFacts('ADVANTAGE')
        })
      )
    ).rejects.toThrow(/1dN/)
  })

  it('refuses a declared die that is not a logged 1dN instead of posting no card', async () => {
    await expect(persist(declaredRoot([die('only', 3, 3)]))).rejects.toThrow(/1dN/)
  })
})
