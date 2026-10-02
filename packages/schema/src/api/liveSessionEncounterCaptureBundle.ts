import type { LiveSessionCharacterRulesInput } from './liveSessionCharacterRules.js'
import type { LiveSessionEncounterRulesInput } from './liveSessionEncounterRules.js'

/** The Character capture scope an Encounter capture scope admits for one Character actor. */
export function liveSessionCharacterRulesScope(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  actor: { id: string; sourceId: string }
): Omit<LiveSessionCharacterRulesInput, 'request'> {
  return {
    campaignId: scope.campaignId,
    authorityEpoch: scope.authorityEpoch,
    expectedUserId: scope.expectedUserId,
    expectedRole: scope.expectedRole,
    ...(scope.concentrationResponse ? { concentrationResponse: scope.concentrationResponse } : {}),
    ...(scope.turnCommand ? { turnCommand: scope.turnCommand } : {}),
    ...(scope.action ? { action: scope.action } : {}),
    ...(scope.movement ? { movement: { ...scope.movement, actorId: actor.id } } : {}),
    characterId: actor.sourceId
  }
}
