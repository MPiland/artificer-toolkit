import type { InitiativeFactSources } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import type { InitiativeScoreBatchEntity } from './encounterInitiativeScoreBatch.js'

export function createEncounterInitiativeScoreEntities(input: {
  state: EncounterInitiativeRoundStateDto
  sources: InitiativeFactSources
  adapter: InitiativeFactAdapter
}): readonly InitiativeScoreBatchEntity[] {
  if (input.state.round.procedure === 'MANUAL') return []
  const sourceByActorId = new Map(
    input.sources.actors.map((source) => [source.actor.id, source] as const)
  )
  if (
    sourceByActorId.size !== input.state.participants.length ||
    input.state.participants.some((participant) => !sourceByActorId.has(participant.actorId))
  ) {
    throw new Error('Locked initiative sources do not match the normalized round participants.')
  }
  if (input.state.round.procedure !== 'SIDE_ROLL') {
    return input.state.participants.map((participant) => ({
      kind: 'ACTOR',
      id: participant.actorId,
      binding:
        input.state.round.procedure === 'DECLARED_ACTION_ROLL'
          ? (() => {
              const source = sourceByActorId.get(participant.actorId)!
              if (!participant.declaration) {
                return { automatic: false as const }
              }
              return input.adapter.bindDeclaredActor(source, participant.declaration)
            })()
          : input.adapter.bindActor(sourceByActorId.get(participant.actorId)!)
    }))
  }
  return input.state.sides.map((side) => {
    const sideSource = {
      sideId: side.sideId,
      participants: input.state.participants
        .filter((participant) => participant.sideId === side.sideId)
        .map((participant) => sourceByActorId.get(participant.actorId)!)
    }
    if (sideSource.participants.length < 1) {
      throw new Error('Every normalized initiative side requires at least one participant.')
    }
    return { kind: 'SIDE', id: side.sideId, binding: input.adapter.bindSide(sideSource) }
  })
}
