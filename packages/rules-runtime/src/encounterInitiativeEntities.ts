import type { InitiativeFactSources } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type { InitiativePolicyReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import type { InitiativeScoreBatchEntity } from './encounterInitiativeScoreBatch.js'
import { initiativeDeclarationModifier } from './encounterInitiativeDeclarationModifier.js'

export function createEncounterInitiativeScoreEntities(input: {
  state: EncounterInitiativeRoundStateDto
  /** The round's frozen policy. */
  policy: InitiativePolicyReusableDefinitionDocumentDto
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
    // The round's procedure is the frozen policy's, checked by the lifecycle against its snapshot.
    const declarationModifiers =
      input.policy.procedure === 'DECLARED_ACTION_ROLL' ? input.policy.declarationModifiers : null
    return input.state.participants.map((participant) => {
      const source = sourceByActorId.get(participant.actorId)
      if (!source) throw new Error('Locked initiative source is unavailable.')
      if (!declarationModifiers)
        return { kind: 'ACTOR', id: participant.actorId, binding: input.adapter.bindActor(source) }
      const declaredModifier = participant.declaration
        ? initiativeDeclarationModifier(declarationModifiers, participant.declaration)
        : null
      return {
        kind: 'ACTOR',
        id: participant.actorId,
        binding:
          participant.declaration && declaredModifier !== null
            ? input.adapter.bindDeclaredActor(source, participant.declaration, declaredModifier)
            : { automatic: false }
      }
    })
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
