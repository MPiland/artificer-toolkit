import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { describe, expect, it } from 'vitest'

import type { ProjectableCharacterFacts } from '../encounterActionProjection.js'
import {
  hydrateStagedState,
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from '../encounterInitiativeStaging.js'
import {
  applyEncounterInitiativeAdvance,
  planEncounterInitiativeAdvance,
  settleEncounterInitiativeRound
} from '../encounterInitiativeStateSettlement.js'
import { planEncounterTurnAdvance, prepareEncounterTurn } from '../encounterTurnPreparation.js'
import { srdCreatureActor, srdEncounterState, testUuid, TIMESTAMP } from './dnd5eSrdEncounter.js'
import {
  ACTOR_A,
  ACTOR_B,
  ACTOR_C,
  SIDE_FOES,
  initiativePolicySnapshot,
  preparingRound
} from './encounterInitiativeFixtures.js'

type Stages = Parameters<typeof prepareEncounterTurn<ProjectableCharacterFacts>>[1]

const ORDER = [ACTOR_A, ACTOR_B, ACTOR_C]
const OWNER_ID = testUuid(0x70)

/** The round with `currentActorId` taking its turn, the order A, B, C. */
async function roundAt(
  currentActorId: string,
  cadence: 'ENCOUNTER_START' | 'EACH_ROUND'
): Promise<EncounterInitiativeRoundStateDto> {
  let state = preparingRound({
    actors: ORDER.map((id) => ({ id, sideId: SIDE_FOES })),
    ...(cadence === 'EACH_ROUND'
      ? { policy: initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence }) }
      : {})
  })
  state = await settleEncounterInitiativeRound({
    repository: inMemoryInitiativeRepository(state).repository,
    state,
    orderedActorIds: ORDER
  })
  for (const actorId of ORDER.slice(0, ORDER.indexOf(currentActorId))) {
    const plan = planEncounterInitiativeAdvance({
      state,
      currentActorId: actorId,
      defeatedActorIds: new Set()
    })
    state = await applyEncounterInitiativeAdvance({
      repository: inMemoryInitiativeRepository(state).repository,
      state,
      plan,
      defeatedActorIds: new Set()
    })
  }
  return hydrateStagedState(serializeStagedInitiativeRoundState(state))
}

function defeating(
  actors: readonly EncounterRunActorState[],
  actorIds: readonly string[]
): EncounterRunActorState[] {
  return actors.map((actor) =>
    actorIds.includes(actor.id) && actor.kind !== 'CHARACTER'
      ? { ...actor, currentHitPoints: 0, defeated: true }
      : actor
  )
}

/**
 * Ends `currentActorId`'s turn. The outgoing turn's effects and then Legendary Actions defeat the
 * given actors; every other stage changes nothing.
 */
async function endTurn(input: {
  currentActorId: string
  cadence?: 'ENCOUNTER_START' | 'EACH_ROUND'
  outgoingDefeats?: readonly string[]
  legendaryDefeats?: readonly string[]
}) {
  const cadence = input.cadence ?? 'ENCOUNTER_START'
  const initiativeRound = await roundAt(input.currentActorId, cadence)
  const actors = ORDER.map((id) => srdCreatureActor({ id, creature: wolf }))
  const state = srdEncounterState({ actors, currentActorId: input.currentActorId })
  const seen = { incomingActorIds: [] as (string | null)[], refreshedActorIds: [] as string[] }
  let initiativeAdvance: TurnCoordinatorRootDto['initiativeAdvance'] = null
  const stages: Stages = {
    async effects(stage) {
      if (stage.boundary.stage === 'START_OF_TURN')
        seen.incomingActorIds.push(stage.boundary.actorId)
      return {
        kind: 'COMPLETE',
        actors:
          stage.boundary.stage === 'END_OF_TURN'
            ? defeating(stage.actors, input.outgoingDefeats ?? [])
            : stage.actors,
        movementTargets: new Map(),
        plan: null,
        phase: { kind: 'NONE' }
      }
    },
    async legendary(stage) {
      const incoming = stage.root.proposedTerminalTransition.currentActorId
      if (stage.refreshIncoming !== false && incoming) seen.refreshedActorIds.push(incoming)
      return {
        kind: 'COMPLETE',
        root: stage.root,
        actors: defeating(stage.actors, input.legendaryDefeats ?? []),
        movementTargets: new Map()
      }
    },
    async initiative(stage) {
      initiativeAdvance = stage.root.initiativeAdvance
      return {
        kind: 'COMPLETE',
        root: {
          ...stage.root,
          proposedTerminalTransition: {
            ...stage.root.proposedTerminalTransition,
            currentActorId: ACTOR_A
          }
        }
      }
    },
    async recharge(stage) {
      return { kind: 'COMPLETE', plan: null, actors: stage.actors }
    }
  }
  const prepared = await prepareEncounterTurn(
    {
      state,
      campaign: { id: state.campaignId, ownerUserId: OWNER_ID },
      autoRoll: true,
      autoRollByActorId: {},
      root: {
        rootCommandId: testUuid(0x71),
        commandFingerprint: 'f'.repeat(64),
        commandType: 'ADVANCE_TURN',
        initiatorUserId: OWNER_ID,
        requestedByUserId: OWNER_ID,
        correlationId: null,
        expectedEncounterVersion: state.version,
        startSystemId: null,
        frozenActorRuleRevisionId: null,
        frozenActorRuleRevisionChecksum: null,
        frozenActorRuleSnapshotChecksum: null,
        initiative: null,
        resolutionCommands: [],
        // The advance as the turn ended, before its transition settles.
        ...planEncounterTurnAdvance({ state, initiativeRound, actors })
      },
      occurrenceId: testUuid(0x72),
      actors,
      initiativeRound,
      updatedAt: TIMESTAMP
    },
    stages
  )
  if (prepared.kind !== 'COMPLETE') throw new Error('Expected a complete turn.')
  return { root: prepared.root, seen, initiativeAdvance }
}

describe('the next turn is chosen after the turn transition settles (D63)', () => {
  it('skips the next actor when the outgoing turn’s effects defeat it', async () => {
    const { root, seen } = await endTurn({ currentActorId: ACTOR_A, outgoingDefeats: [ACTOR_B] })
    expect(root.initiativeAdvance).toMatchObject({ kind: 'SAME_ROUND', nextActorId: ACTOR_C })
    expect(root.proposedTerminalTransition).toEqual({
      status: 'ACTIVE',
      round: 1,
      currentActorId: ACTOR_C
    })
    // The skipped actor's turn neither starts nor refreshes its resources.
    expect(seen).toEqual({ incomingActorIds: [ACTOR_C], refreshedActorIds: [ACTOR_C] })
  })

  it('skips the next actor when a Legendary Action at the end of the turn defeats it', async () => {
    const { root, seen } = await endTurn({ currentActorId: ACTOR_A, legendaryDefeats: [ACTOR_B] })
    expect(root.initiativeAdvance).toMatchObject({ kind: 'SAME_ROUND', nextActorId: ACTOR_C })
    expect(root.proposedTerminalTransition.currentActorId).toBe(ACTOR_C)
    expect(seen).toEqual({ incomingActorIds: [ACTOR_C], refreshedActorIds: [ACTOR_C] })
  })

  it('opens the new round past its opener when the transition defeats it', async () => {
    const { root, seen } = await endTurn({ currentActorId: ACTOR_C, legendaryDefeats: [ACTOR_A] })
    expect(root.initiativeAdvance).toMatchObject({
      kind: 'ROUND_WRAP',
      nextRound: 2,
      firstActorId: ACTOR_B
    })
    expect(root.proposedTerminalTransition).toEqual({
      status: 'ACTIVE',
      round: 2,
      currentActorId: ACTOR_B
    })
    expect(seen).toEqual({ incomingActorIds: [ACTOR_B], refreshedActorIds: [ACTOR_B] })
  })

  it('wraps into a rolled new round when the transition defeats everyone left in this one', async () => {
    const { root, initiativeAdvance } = await endTurn({
      currentActorId: ACTOR_B,
      cadence: 'EACH_ROUND',
      outgoingDefeats: [ACTOR_C]
    })
    expect(initiativeAdvance).toMatchObject({
      kind: 'ROUND_WRAP',
      cadence: 'EACH_ROUND',
      nextRound: 2
    })
    expect(root.initiativeAdvance).toEqual(initiativeAdvance)
    expect(root.proposedTerminalTransition).toEqual({
      status: 'ACTIVE',
      round: 2,
      currentActorId: ACTOR_A
    })
  })
})
