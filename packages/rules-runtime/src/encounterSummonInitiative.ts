import type { LiveSessionSummonedToken } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { startInitiativeScoreBatch } from './encounterInitiativeScoreBatch.js'
import { rollsInitiative } from './encounterInitiativeCursor.js'
import { prepareEncounterInitiativeSources } from './encounterInitiativeSources.js'
import { initiativeCapabilityRegistry } from './platformEncounterPolicy.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/**
 * The initiative a summon authored to roll its own (D200) rolls when it arrives in an active Run, by
 * the Run's pinned policy graph, as the policy rolls any actor's: the dice are the system's and the
 * cast never waits on them. Null when the summon takes no roll of its own, the Run has no round yet
 * (the summon then rolls with the start cohort), or the policy cannot score it by one automatic
 * `1dN` (a manual Run, a side roll, a custom actor): the caller seats it behind its owner instead.
 */
export async function rollSummonInitiative(input: {
  state: EncounterRunState
  actor: EncounterRunActorState
  runtime: RulesRuntimeService
  occurrenceId: string
  integerSource(request: { min: number; max: number }): number
}): Promise<NonNullable<LiveSessionSummonedToken['initiativeRoll']> | null> {
  const { state, actor } = input
  const snapshot = state.initiativePolicySnapshot
  if (
    state.status !== 'ACTIVE' ||
    !rollsInitiative(actor) ||
    !actor.owner ||
    !snapshot ||
    snapshot.policy.document.procedure !== 'ACTOR_ROLL'
  )
    return null
  const adapter = initiativeCapabilityRegistry.require(state.gameSystemId)
  const sources = await prepareEncounterInitiativeSources({
    state: { ...state, actorIds: [...state.actorIds, actor.id] },
    campaignId: state.campaignId,
    actors: [actor],
    loadCharacter: () => {
      throw new Error('A summon is never a Character.')
    }
  })
  const batch = await startInitiativeScoreBatch({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    gameSystemId: state.gameSystemId,
    graph: snapshot.evaluationGraph,
    pin: snapshot.policy.document.evaluationGraph,
    procedure: 'ACTOR_ROLL',
    phase: 'PRIMARY',
    mode: 'AUTO_ROLL',
    entities: [{ kind: 'ACTOR', id: actor.id, binding: adapter.bindActor(sources.actors[0]!) }],
    integerSource: input.integerSource
  })
  if (batch.kind !== 'COMPLETE') throw new Error('A summon initiative roll cannot pause the cast.')
  const { result } = batch.completed[0]!
  if (result.kind !== 'GRAPH_COMPLETE' || !result.execution.automatic) return null
  const dice = result.execution.execution.evidence.trace.flatMap(({ evidence, inputs }) =>
    evidence ? [{ value: evidence.value, min: inputs.min, max: inputs.max }] : []
  )
  const [die] = dice
  // A summon's card shows one plain die; any other roll shape has no card to post.
  if (dice.length !== 1 || die!.min !== 1 || typeof die!.max !== 'number') return null
  return {
    sides: die!.max,
    face: die!.value,
    modifier: result.execution.score - die!.value
  }
}
