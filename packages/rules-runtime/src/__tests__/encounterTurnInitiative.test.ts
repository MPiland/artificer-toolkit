import { describe, expect, it } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  turnCoordinatorRootDtoSchema,
  type TurnCoordinatorRootDto
} from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'

import {
  hydrateStagedState,
  serializeStagedInitiativeRoundState
} from '../encounterInitiativeStaging.js'
import { planEncounterInitiativeAdvance } from '../encounterInitiativeStateSettlement.js'
import { prepareEncounterTurnInitiative } from '../encounterTurnInitiative.js'
import { prepareEncounterTurnResponse } from '../encounterTurnResponse.js'
import type { EncounterResponseAnswer } from '../encounterEvidenceAnswer.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  createSrdRulesRuntime,
  srdCreatureActor,
  srdEncounterState
} from '../testing/dnd5eSrdEncounter.js'
import {
  ACTOR_A,
  ACTOR_B,
  ACTOR_C,
  SIDE_FOES,
  SIDE_HEROES,
  creatureSource,
  scriptedDice
} from './encounterInitiativeFixtures.js'
import { initiativePolicySnapshot } from '../testing/initiativePolicySnapshot.js'

const GM_USER_ID = '00000000-0000-4000-8000-00000000b001'
const ROOT_COMMAND_ID = '00000000-0000-4000-8000-00000000b002'
const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000f001'
const CHECKSUM = 'a'.repeat(64)
const GOBLIN = srdByLabel(SRD.creatures, 'Goblin')

type Policy = ReturnType<typeof initiativePolicySnapshot>

/** Entered initiative: A 12, B 18, C none. */
const ACTORS = [
  srdCreatureActor({ id: ACTOR_A, creature: GOBLIN, sideId: SIDE_HEROES, initiative: 12 }),
  srdCreatureActor({ id: ACTOR_B, creature: GOBLIN, sideId: SIDE_FOES, initiative: 18 }),
  srdCreatureActor({ id: ACTOR_C, creature: GOBLIN, sideId: SIDE_FOES })
]

/** A prepared Run unless told otherwise; Manual without a policy, Assisted with one. */
function runState(input: {
  policy: Policy | null
  status?: EncounterRunState['status']
  round?: number
  currentActorId?: string | null
  version?: number
  turnSequence?: number
}): EncounterRunState {
  return srdEncounterState({
    actors: ACTORS,
    currentActorId: input.currentActorId ?? null,
    status: input.status ?? 'PREPARED',
    round: input.round ?? 0,
    version: input.version ?? 0,
    turnSequence: input.turnSequence ?? 0,
    automationMode: input.policy ? 'ASSISTED' : 'MANUAL',
    ...(input.policy ? { initiativePolicy: input.policy } : {}),
    sides: [
      { id: SIDE_HEROES, label: 'Heroes' },
      { id: SIDE_FOES, label: 'Foes' }
    ]
  })
}
function coordinatorRoot(overrides: Partial<TurnCoordinatorRootDto> = {}): TurnCoordinatorRootDto {
  return turnCoordinatorRootDtoSchema.parse({
    rootCommandId: ROOT_COMMAND_ID,
    commandFingerprint: CHECKSUM,
    commandType: 'START',
    initiatorUserId: GM_USER_ID,
    requestedByUserId: GM_USER_ID,
    correlationId: null,
    expectedEncounterVersion: 0,
    proposedTerminalTransition: { status: 'ACTIVE', round: 1, currentActorId: null },
    resolutionCommands: [],
    ...overrides
  })
}

async function prepare(input: {
  state: EncounterRunState
  root: TurnCoordinatorRootDto
  autoRoll: boolean
  dice?: readonly number[]
  resume?: { pending: ServerRuleExecutionPendingSnapshotDto; resolution: EncounterResponseAnswer }
}) {
  const dice = scriptedDice(input.dice ?? [])
  const result = await prepareEncounterTurnInitiative({
    state: input.state,
    root: input.root,
    occurrenceId: OCCURRENCE_ID,
    actors: ACTORS,
    deadCharacterIds: new Set(),
    autoRoll: input.autoRoll,
    loadSources: async () => ({
      characterIds: [],
      actors: [creatureSource(ACTOR_A, 2), creatureSource(ACTOR_B, 0), creatureSource(ACTOR_C, -1)]
    }),
    loadDeclarations: async () => {
      throw new Error('Actor-roll initiative has no declarations.')
    },
    createRuntime: async () => createSrdRulesRuntime(),
    integerSource: (request) => dice.next(request),
    createRequestId: () => {
      throw new Error('Actor-roll initiative issues no declaration requests.')
    },
    ...(input.resume ? { resume: input.resume } : {})
  })
  return { result, dice }
}

function requireComplete(
  result: Awaited<ReturnType<typeof prepareEncounterTurnInitiative>>
): TurnCoordinatorRootDto {
  if (result.kind !== 'COMPLETE') throw new Error('Expected settled initiative.')
  return result.root
}

function evidenceRequest(snapshot: ServerRuleExecutionPendingSnapshotDto) {
  if (snapshot.snapshotKind !== 'KERNEL_EVIDENCE' || snapshot.request.kind !== 'INTEGER_RANGE')
    throw new Error('Expected an integer evidence request.')
  return snapshot.request
}

const actorRoll = initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' })
const eachRound = initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' })

describe('prepareEncounterTurnInitiative at Encounter start', () => {
  it('orders a Manual Encounter by manual order, then entered initiative, without rules', async () => {
    const { result, dice } = await prepare({
      state: runState({ policy: null }),
      root: coordinatorRoot(),
      autoRoll: false
    })
    const root = requireComplete(result)

    expect(root.initiative).toEqual({
      round: 1,
      cadence: 'ENCOUNTER_START',
      procedure: 'MANUAL',
      policySnapshotChecksum: null,
      orderedActorIds: [ACTOR_B, ACTOR_A, ACTOR_C],
      orderedSideIds: [],
      evidence: { primaryResults: [], tieAttempts: [], orderChoices: [] }
    })
    expect(root.proposedTerminalTransition).toEqual({
      status: 'ACTIVE',
      round: 1,
      currentActorId: ACTOR_B
    })
    expect(root.stagedInitiative?.beforePin).toEqual({
      kind: 'INITIAL_START',
      actorIds: [ACTOR_A, ACTOR_B, ACTOR_C]
    })
    expect(dice.requests).toEqual([])
  })

  it('rolls every actor for a roller who auto-rolls and starts with the highest', async () => {
    // A: 11 + 2 = 13, B: 17 + 0 = 17, C: 4 - 1 = 3
    const { result, dice } = await prepare({
      state: runState({ policy: actorRoll }),
      root: coordinatorRoot(),
      autoRoll: true,
      dice: [11, 17, 4]
    })
    const root = requireComplete(result)

    expect(root.initiative).toMatchObject({
      round: 1,
      cadence: 'ENCOUNTER_START',
      procedure: 'ACTOR_ROLL',
      policySnapshotChecksum: actorRoll.checksum,
      orderedActorIds: [ACTOR_B, ACTOR_A, ACTOR_C],
      orderedSideIds: []
    })
    expect(root.proposedTerminalTransition).toEqual({
      status: 'ACTIVE',
      round: 1,
      currentActorId: ACTOR_B
    })
    expect(
      root.stagedInitiative?.stagedRoundState.participants.map((participant) => [
        participant.actorId,
        participant.status,
        participant.initiativeScore,
        participant.turnOrderOrdinal
      ])
    ).toEqual([
      [ACTOR_A, 'READY', 13, 1],
      [ACTOR_B, 'ACTIVE', 17, 0],
      [ACTOR_C, 'READY', 3, 2]
    ])
    expect(dice.remaining()).toBe(0)
  })

  it('prompts a roller who does not auto-roll, then settles from entered and app-rolled dice', async () => {
    const state = runState({ policy: actorRoll })
    const root = coordinatorRoot()
    const first = await prepare({ state, root, autoRoll: false })
    if (first.result.kind !== 'PENDING') throw new Error('Expected a pending initiative prompt.')
    expect(evidenceRequest(first.result.snapshot)).toMatchObject({ min: 1, max: 20 })

    const second = await prepare({
      state,
      root,
      autoRoll: false,
      resume: {
        pending: first.result.snapshot,
        resolution: {
          kind: 'ENTER_INTEGER',
          requestId: evidenceRequest(first.result.snapshot).requestId,
          value: 11
        }
      }
    })
    if (second.result.kind !== 'PENDING') throw new Error('Expected a pending initiative prompt.')
    const third = await prepare({
      state,
      root,
      autoRoll: false,
      resume: {
        pending: second.result.snapshot,
        resolution: {
          kind: 'SYSTEM_ROLL',
          requestId: evidenceRequest(second.result.snapshot).requestId,
          rollId: '00000000-0000-4000-8000-00000000b005',
          faces: [17],
          rollMode: null,
          keep: null
        }
      }
    })
    if (third.result.kind !== 'PENDING') throw new Error('Expected a pending initiative prompt.')
    const settled = await prepare({
      state,
      root,
      autoRoll: false,
      resume: {
        pending: third.result.snapshot,
        resolution: {
          kind: 'ENTER_INTEGER',
          requestId: evidenceRequest(third.result.snapshot).requestId,
          value: 4
        }
      }
    })

    expect(requireComplete(settled.result).initiative?.orderedActorIds).toEqual([
      ACTOR_B,
      ACTOR_A,
      ACTOR_C
    ])
  })

  it('records each answered request as an exact resolution command on the occurrence root', async () => {
    const first = await prepare({
      state: runState({ policy: actorRoll }),
      root: coordinatorRoot(),
      autoRoll: false
    })
    if (first.result.kind !== 'PENDING') throw new Error('Expected a pending initiative prompt.')
    const requestId = evidenceRequest(first.result.snapshot).requestId
    const command = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: '00000000-0000-4000-8000-00000000b003',
      commandId: '00000000-0000-4000-8000-00000000b004',
      expectedVersion: 0,
      correlationId: null,
      occurrenceId: OCCURRENCE_ID,
      expectedOccurrenceVersion: 0,
      resolution: { kind: 'ENTER_INTEGER' as const, requestId, value: 11 }
    }
    const response = prepareEncounterTurnResponse({
      pending: first.result.snapshot,
      command,
      userId: GM_USER_ID,
      ownerUserId: GM_USER_ID,
      responderControlledActorIds: new Set(),
      occurrence: {
        id: OCCURRENCE_ID,
        rootCommandId: ROOT_COMMAND_ID,
        version: 0,
        expectedEncounterVersion: 0
      },
      encounterVersion: 0
    })
    if (response.kind !== 'INITIATIVE') throw new Error('Expected an initiative response.')
    expect(response.root.resolutionCommands).toEqual([
      {
        commandId: command.commandId,
        commandFingerprint: checksumCanonicalJson(command),
        actorUserId: GM_USER_ID,
        correlationId: null,
        expectedOccurrenceVersion: 0,
        initiativeActorId: null,
        kind: 'ENTER_INTEGER',
        requestId
      }
    ])
  })

  it('reports an answer whose expected Run or occurrence version is behind as stale', async () => {
    const first = await prepare({
      state: runState({ policy: actorRoll }),
      root: coordinatorRoot(),
      autoRoll: false
    })
    if (first.result.kind !== 'PENDING') throw new Error('Expected a pending initiative prompt.')
    const pending = first.result.snapshot
    const command = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: '00000000-0000-4000-8000-00000000b003',
      commandId: '00000000-0000-4000-8000-00000000b004',
      expectedVersion: 0,
      correlationId: null,
      occurrenceId: OCCURRENCE_ID,
      expectedOccurrenceVersion: 0,
      resolution: {
        kind: 'ENTER_INTEGER' as const,
        requestId: evidenceRequest(pending).requestId,
        value: 11
      }
    }
    const respond = (answer: typeof command) =>
      prepareEncounterTurnResponse({
        pending,
        command: answer,
        userId: GM_USER_ID,
        ownerUserId: GM_USER_ID,
        responderControlledActorIds: new Set(),
        occurrence: {
          id: OCCURRENCE_ID,
          rootCommandId: ROOT_COMMAND_ID,
          version: 0,
          expectedEncounterVersion: 0
        },
        encounterVersion: 0
      })
    expect(respond({ ...command, expectedVersion: 1 })).toEqual({ kind: 'STALE' })
    expect(respond({ ...command, expectedOccurrenceVersion: 1 })).toEqual({ kind: 'STALE' })
  })

  it('refuses a resumed answer for another request and a continuation from another command', async () => {
    const state = runState({ policy: actorRoll })
    const first = await prepare({ state, root: coordinatorRoot(), autoRoll: false })
    if (first.result.kind !== 'PENDING') throw new Error('Expected a pending initiative prompt.')
    const request = evidenceRequest(first.result.snapshot)

    await expect(
      prepare({
        state,
        root: coordinatorRoot(),
        autoRoll: false,
        resume: {
          pending: first.result.snapshot,
          resolution: { kind: 'ENTER_INTEGER', requestId: 'another-request', value: 11 }
        }
      })
    ).rejects.toThrow('Encounter initiative resolution is unavailable.')
    await expect(
      prepare({
        state,
        root: coordinatorRoot({ rootCommandId: '00000000-0000-4000-8000-00000000b006' }),
        autoRoll: false,
        resume: {
          pending: first.result.snapshot,
          resolution: { kind: 'ENTER_INTEGER', requestId: request.requestId, value: 11 }
        }
      })
    ).rejects.toThrow('Encounter initiative continuation is stale.')
  })

  it('refuses to start an Encounter that is not prepared', async () => {
    await expect(
      prepare({
        state: runState({ policy: actorRoll, status: 'ACTIVE', round: 1 }),
        root: coordinatorRoot(),
        autoRoll: true
      })
    ).rejects.toThrow('Encounter start initiative is unavailable.')
  })
})

describe('prepareEncounterTurnInitiative at a new round', () => {
  async function wrappedRound(policy: Policy) {
    const started = requireComplete(
      (
        await prepare({
          state: runState({ policy }),
          root: coordinatorRoot(),
          autoRoll: true,
          dice: [11, 17, 4]
        })
      ).result
    )
    const staged = started.stagedInitiative
    if (!staged) throw new Error('Expected staged initiative.')
    // The last actor (C) is active at the end of round 1.
    const settled = hydrateStagedState(staged.stagedRoundState)
    const lastTurn = {
      ...settled,
      participants: settled.participants.map((participant) => ({
        ...participant,
        status: participant.actorId === ACTOR_C ? ('ACTIVE' as const) : ('ACTED' as const)
      }))
    }
    const advance = planEncounterInitiativeAdvance({
      state: hydrateStagedState(serializeStagedInitiativeRoundState(lastTurn)),
      currentActorId: ACTOR_C,
      defeatedActorIds: new Set()
    })
    return {
      advance,
      state: runState({
        policy,
        status: 'ACTIVE',
        round: 1,
        currentActorId: ACTOR_C,
        version: 7,
        turnSequence: 3
      })
    }
  }

  it('rolls a fresh order for round 2 when initiative is rolled each round', async () => {
    const { advance, state } = await wrappedRound(eachRound)
    expect(advance).toMatchObject({ kind: 'ROUND_WRAP', nextRound: 2, cadence: 'EACH_ROUND' })

    // A: 3 + 2 = 5, B: 2 + 0 = 2, C: 20 - 1 = 19
    const { result } = await prepare({
      state,
      root: coordinatorRoot({
        commandType: 'ADVANCE_TURN',
        expectedEncounterVersion: 7,
        initiativeAdvance: advance,
        outgoingTurn: { kind: 'NONE' }
      }),
      autoRoll: true,
      dice: [3, 2, 20]
    })
    const root = requireComplete(result)

    expect(root.initiative).toMatchObject({
      round: 2,
      cadence: 'EACH_ROUND',
      orderedActorIds: [ACTOR_C, ACTOR_A, ACTOR_B]
    })
    expect(root.proposedTerminalTransition).toEqual({
      status: 'ACTIVE',
      round: 2,
      currentActorId: ACTOR_C
    })
    expect(root.stagedInitiative?.beforePin).toEqual({
      kind: 'EACH_ROUND',
      round: 1,
      version: 7,
      checksum: advance.stateChecksum,
      actorIds: [ACTOR_A, ACTOR_B, ACTOR_C]
    })
  })

  it('refuses new-round initiative when the order is kept from Encounter start', async () => {
    const { advance, state } = await wrappedRound(actorRoll)
    expect(advance).toMatchObject({ kind: 'ROUND_WRAP', cadence: 'ENCOUNTER_START' })

    await expect(
      prepare({
        state,
        root: coordinatorRoot({
          commandType: 'ADVANCE_TURN',
          expectedEncounterVersion: 7,
          initiativeAdvance: advance,
          outgoingTurn: { kind: 'NONE' }
        }),
        autoRoll: true
      })
    ).rejects.toThrow('New-round initiative is unavailable.')
  })
})
