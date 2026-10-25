import { describe, expect, it } from 'vitest'
import { turnCoordinatorRootDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'

import { buildEncounterActorRuleFacts } from '../../encounterActorRuleFacts.js'
import { reconcileEncounterActorRuleOutput } from '../../encounterActorRuleOutput.js'
import {
  evaluateEncounterActionEconomy,
  stageEncounterActionEconomyRefreshes,
  type ActionEconomyInput
} from '../../encounterActionEconomy.js'
import { prepareEncounterInitiativeSources } from '../../encounterInitiativeSources.js'
import { hydrateStagedState } from '../../encounterInitiativeStaging.js'
import { planEncounterInitiativeAdvance } from '../../encounterInitiativeStateSettlement.js'
import { prepareEncounterTurnInitiative } from '../../encounterTurnInitiative.js'
import { encounterRuleUsageUsed } from '../../encounterActorState.js'
import {
  createPlatformRulesRuntime,
  evaluateInstalledEncounterActors
} from '../../platformRulesRuntime.js'
import { scriptedDice } from '../encounterInitiativeFixtures.js'
import {
  tracerCreatureActor,
  tracerDefinitions,
  tracerEncounterState,
  tracerInitiativePolicy
} from './encounter.js'
import { TRACER_EXCHANGE_ACTION_ALLOWANCE_ID, TRACER_SYSTEM_ID } from './system.js'

const ACTOR_A = '00000000-0000-4000-8000-0000000fa001'
const ACTOR_B = '00000000-0000-4000-8000-0000000fa002'
const ACTOR_C = '00000000-0000-4000-8000-0000000fa003'
const SIDE_PCS = '00000000-0000-4000-8000-0000000fc001'
const SIDE_THUGS = '00000000-0000-4000-8000-0000000fc002'
const GM_USER_ID = '00000000-0000-4000-8000-0000000fc003'

const ratings = (quick: number) => ({
  CAREFUL: 1,
  CLEVER: 2,
  FLASHY: 0,
  FORCEFUL: 3,
  QUICK: quick,
  SNEAKY: 1
})

const SIDES = [
  { id: SIDE_PCS, label: 'Player characters' },
  { id: SIDE_THUGS, label: 'Thugs' }
]

describe('a second installed System, Encounter actor evaluation', () => {
  it('evaluates its Creatures by its own actor policy: a Quick rating of +3 is +3 initiative', () => {
    const actors = [
      tracerCreatureActor({ id: ACTOR_A, sideId: SIDE_THUGS, ratings: ratings(3) }),
      tracerCreatureActor({ id: ACTOR_B, sideId: SIDE_THUGS, ratings: ratings(-1) })
    ]
    const facts = buildEncounterActorRuleFacts({ actors })
    const output = reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: TRACER_SYSTEM_ID, facts }),
      facts
    )

    // D&D's (score - 10) / 2 would make these -4 and -6.
    expect(
      output.actors.map(({ actorId, initiativeModifier }) => [actorId, initiativeModifier])
    ).toEqual([
      [ACTOR_A, 3],
      [ACTOR_B, -1]
    ])
    expect(output.actors.every((actor) => actor.savingThrowDefinitions === undefined)).toBe(true)
  })
})

describe('a second installed System, initiative and turn order', () => {
  it('rolls 4dF + Quick through its own published graph, orders the conflict and advances turns', async () => {
    const policy = tracerInitiativePolicy({ cadence: 'ENCOUNTER_START' })
    const actors = [
      tracerCreatureActor({ id: ACTOR_A, sideId: SIDE_THUGS, ratings: ratings(3) }),
      tracerCreatureActor({ id: ACTOR_B, sideId: SIDE_PCS, ratings: ratings(1) }),
      tracerCreatureActor({ id: ACTOR_C, sideId: SIDE_THUGS, ratings: ratings(0) })
    ]
    const state = tracerEncounterState({
      actors,
      sides: SIDES,
      status: 'PREPARED',
      initiativePolicy: policy
    })
    // A: -4 + 3 = -1, B: +3 + 1 = 4, C: 0 + 0 = 0
    const dice = scriptedDice([-1, -1, -1, -1, 1, 1, 1, 0, 0, 0, 0, 0])

    const result = await prepareEncounterTurnInitiative({
      state,
      root: turnCoordinatorRootDtoSchema.parse({
        rootCommandId: '00000000-0000-4000-8000-0000000fc004',
        commandFingerprint: 'a'.repeat(64),
        commandType: 'START',
        initiatorUserId: GM_USER_ID,
        requestedByUserId: GM_USER_ID,
        correlationId: null,
        expectedEncounterVersion: 0,
        proposedTerminalTransition: { status: 'ACTIVE', round: 1, currentActorId: null },
        resolutionCommands: []
      }),
      occurrenceId: '00000000-0000-4000-8000-0000000fc005',
      actors,
      deadCharacterIds: new Set(),
      autoRoll: true,
      loadSources: () =>
        prepareEncounterInitiativeSources({
          state,
          campaignId: state.campaignId,
          actors,
          loadCharacter: () => {
            throw new Error('The tracer conflict has no Characters.')
          }
        }),
      loadDeclarations: () => {
        throw new Error('Actor-roll initiative has no declarations.')
      },
      createRuntime: async () =>
        createPlatformRulesRuntime({
          definitions: {
            requireCurrent() {
              throw new Error('Initiative runs only its frozen graphs.')
            }
          }
        }),
      integerSource: (request) => dice.next(request),
      createRequestId: () => {
        throw new Error('Actor-roll initiative issues no declaration requests.')
      }
    })
    if (result.kind !== 'COMPLETE') throw new Error('Expected settled initiative.')
    const root = result.root

    expect(dice.requests).toEqual(Array.from({ length: 12 }, () => ({ min: -1, max: 1 })))
    expect(root.initiative).toMatchObject({
      procedure: 'ACTOR_ROLL',
      policySnapshotChecksum: policy.checksum,
      orderedActorIds: [ACTOR_B, ACTOR_C, ACTOR_A]
    })
    expect(root.proposedTerminalTransition).toEqual({
      status: 'ACTIVE',
      round: 1,
      currentActorId: ACTOR_B
    })
    const staged = root.stagedInitiative?.stagedRoundState
    if (!staged) throw new Error('Expected staged initiative.')
    expect(
      staged.participants.map(({ actorId, initiativeScore }) => [actorId, initiativeScore])
    ).toEqual([
      [ACTOR_A, -1],
      [ACTOR_B, 4],
      [ACTOR_C, 0]
    ])
    expect(
      planEncounterInitiativeAdvance({
        state: hydrateStagedState(staged),
        currentActorId: ACTOR_B,
        defeatedActorIds: new Set()
      })
    ).toMatchObject({ kind: 'SAME_ROUND', currentActorId: ACTOR_B, nextActorId: ACTOR_C })
  })
})

describe('a second installed System, action economy', () => {
  const economy = (actor: ReturnType<typeof tracerCreatureActor>, code: string) => {
    const state = tracerEncounterState({ actors: [actor], sides: SIDES })
    const target: NonNullable<ActionEconomyInput['target']> = {
      actor,
      state: { current: 3, temporary: 0, conditions: [], deathSaves: null },
      innateConditionIds: [],
      activeEffects: [],
      effectiveRulePolicyOutput: null
    }
    return {
      state,
      input: {
        actor,
        state,
        activation: { code, amount: 1 },
        target,
        loadTarget: async () => target,
        definitions: tracerDefinitions
      }
    }
  }

  it('spends its one exchange action, refuses a second and refreshes it at turn start', async () => {
    const fresh = tracerCreatureActor({ id: ACTOR_A, sideId: SIDE_THUGS, ratings: ratings(2) })
    const first = await evaluateEncounterActionEconomy(economy(fresh, 'EXCHANGE_ACTION').input)
    expect(first).toEqual({
      consumption: expect.objectContaining({
        definitionId: TRACER_EXCHANGE_ACTION_ALLOWANCE_ID,
        maximum: 1,
        beforeUsed: 0,
        afterUsed: 1
      }),
      available: true
    })

    const spent = tracerCreatureActor({
      id: ACTOR_A,
      sideId: SIDE_THUGS,
      ratings: ratings(2),
      ruleUsage: { [TRACER_EXCHANGE_ACTION_ALLOWANCE_ID]: 1 }
    })
    const spentEconomy = economy(spent, 'EXCHANGE_ACTION')
    expect(await evaluateEncounterActionEconomy(spentEconomy.input)).toMatchObject({
      available: false
    })

    const { refreshes, refreshedActor } = await stageEncounterActionEconomyRefreshes({
      actor: spent,
      state: spentEconomy.state,
      definitions: tracerDefinitions
    })
    expect(refreshes).toMatchObject([
      { capabilityDefinitionId: TRACER_EXCHANGE_ACTION_ALLOWANCE_ID, beforeUsed: 1, afterUsed: 0 }
    ])
    expect(
      refreshedActor && encounterRuleUsageUsed(refreshedActor, TRACER_EXCHANGE_ACTION_ALLOWANCE_ID)
    ).toBe(0)
  })

  it('binds no allowance to an activation the System does not have', async () => {
    const actor = tracerCreatureActor({ id: ACTOR_A, sideId: SIDE_THUGS, ratings: ratings(2) })
    expect(await evaluateEncounterActionEconomy(economy(actor, 'BONUS_ACTION').input)).toBeNull()
  })
})
