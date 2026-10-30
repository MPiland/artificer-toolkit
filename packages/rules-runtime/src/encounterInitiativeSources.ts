import type { InitiativeFactSources } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type { CharacterEncounterInitiativeResult } from '@artificer-toolkit/schema/api/characterEncounterInitiative'
import type {
  EncounterRunActorState,
  EncounterRunCharacterActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput,
  requireEncounterActorRuleResult
} from './encounterActorRuleOutput.js'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import { requireSnapshotIdentity } from './encounterActorState.js'
import { takesInitiativeTurns } from './encounterInitiativeCursor.js'

function sortedIds(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function requireActorSources(state: EncounterRunState, actors: readonly EncounterRunActorState[]) {
  for (const actor of actors) {
    if (
      actor.encounterId !== state.id ||
      actor.systemId !== state.gameSystemId ||
      !state.actorIds.includes(actor.id) ||
      !state.sides.some((side) => side.id === actor.sideId)
    ) {
      throw new Error('Encounter initiative actor identity does not match the staged Run.')
    }
    if (
      (actor.kind === 'CUSTOM' && (actor.sourceId !== null || actor.sourceRevision !== null)) ||
      (actor.kind === 'CREATURE' && (actor.sourceId === null || actor.sourceRevision === null))
    ) {
      throw new Error('Encounter initiative actor source revision is incomplete.')
    }
  }
}

export async function prepareEncounterInitiativeSources(input: {
  state: EncounterRunState
  campaignId: string
  actors: readonly EncounterRunActorState[]
  loadCharacter(actor: EncounterRunCharacterActorState): Promise<CharacterEncounterInitiativeResult>
}): Promise<InitiativeFactSources> {
  const { state } = input
  const actors = input.actors.filter(takesInitiativeTurns)
  if (input.campaignId !== state.campaignId)
    throw new Error('Encounter initiative Campaign authority does not match the Run.')
  requireActorSources(state, actors)
  actors.forEach(requireSnapshotIdentity)

  const characterIds: string[] = []
  const sources: InitiativeFactSources['actors'][number][] = []
  const nonCharacters = actors.filter((actor) => actor.kind !== 'CHARACTER')

  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') continue
    const loaded = await input.loadCharacter(actor)
    characterIds.push(actor.sourceId)
    sources.push({
      kind: 'CHARACTER',
      actor,
      characterId: actor.sourceId,
      systemId: state.gameSystemId,
      streamVersion: loaded.streamVersion,
      mechanics: {
        initiativeActorFacts: loaded.initiativeActorFacts
      },
      overlay: { rulePolicyOutput: loaded.rulePolicyOutput }
    })
  }

  if (nonCharacters.length > 0) {
    const facts = buildEncounterActorRuleFacts({ actors: nonCharacters })
    const reconciled = reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
      facts
    )
    const output = bindEncounterActorRuleOutputToFacts(reconciled, facts)
    for (const actor of nonCharacters) {
      const actorRule = requireEncounterActorRuleResult(output, actor.id)
      if (actor.kind === 'CREATURE') {
        if (actor.systemId !== state.gameSystemId)
          throw new Error('Creature initiative source does not match the Encounter Game System.')
        sources.push({ kind: 'CREATURE', actor, systemId: actor.systemId, actorRule })
      } else {
        sources.push({ kind: 'CUSTOM', actor, systemId: actor.systemId })
      }
    }
  }

  const sortedSources = sources.sort((left, right) => left.actor.id.localeCompare(right.actor.id))
  if (
    sortedSources.length !== actors.length ||
    new Set(sortedSources.map((source) => source.actor.id)).size !== actors.length
  ) {
    throw new Error('Encounter initiative sources do not match the staged actors.')
  }
  return { characterIds: sortedIds(characterIds), actors: sortedSources }
}
