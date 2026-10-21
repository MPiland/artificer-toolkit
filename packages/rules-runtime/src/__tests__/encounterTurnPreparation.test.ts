import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { describe, expect, it } from 'vitest'

import type { ProjectableCharacterFacts } from '../encounterActionProjection.js'
import { planEncounterTurnAdvance, prepareEncounterTurn } from '../encounterTurnPreparation.js'
import { prepareEncounterTurnZoneEffects } from '../encounterTurnZoneEffects.js'
import {
  srdCreatureActor,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'
import {
  ACTOR_A,
  ACTOR_B,
  ACTOR_C,
  roundAt as fixtureRoundAt
} from './encounterInitiativeFixtures.js'

type Stages = Parameters<typeof prepareEncounterTurn<ProjectableCharacterFacts>>[1]

const ORDER = [ACTOR_A, ACTOR_B, ACTOR_C]
const OWNER_ID = testUuid(0x70)

const roundAt = (currentActorId: string, cadence: 'ENCOUNTER_START' | 'EACH_ROUND') =>
  fixtureRoundAt(ORDER, currentActorId, cadence)

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
    zones: (stage) =>
      prepareEncounterTurnZoneEffects({
        ...stage,
        loadScene: async () => null,
        loadTarget: async () => undefined,
        createRuntime: () => Promise.reject(new Error('A turn without zones needs no runtime.')),
        definitions: {
          requireCurrent: () =>
            Promise.reject(new Error('A turn without zones reads no definition.'))
        },
        random: () => 0
      }),
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
    },
    async turnStarted() {
      return false
    },
    async deathSave() {
      return { kind: 'COMPLETE', plan: null, target: null }
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
        ...planEncounterTurnAdvance({ state, initiativeRound, actors, deadCharacterIds: new Set() })
      },
      occurrenceId: testUuid(0x72),
      actors,
      deadCharacterIds: new Set(),
      initiativeRound,
      updatedAt: TIMESTAMP
    },
    stages
  )
  if (prepared.kind !== 'COMPLETE') throw new Error('Expected a complete turn.')
  return { root: prepared.root, prepared, seen, initiativeAdvance }
}

describe('a turn without zones (SPELLS-20 T4b2b)', () => {
  it('keeps no zone state, so its stored result is the one it had before zones existed', async () => {
    const { root, prepared } = await endTurn({ currentActorId: ACTOR_A })
    if (prepared.kind !== 'COMPLETE') throw new Error('Expected a complete turn.')
    expect(prepared.outgoingZones).toBeNull()
    expect(prepared.incomingZones).toBeNull()
    expect(root).not.toHaveProperty('incomingTurn')
    expect(root).not.toHaveProperty('outgoingZoneTurn')
  })
})

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
