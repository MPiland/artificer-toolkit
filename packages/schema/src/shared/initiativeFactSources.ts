import type { EncounterRunActorState } from '../projections/encounterRunState.js'
import type { CharacterRulePolicyOutput } from '../api/characterRules.js'
import type { EncounterActorRuleResult } from '../api/encounterActorRules.js'
import type { CharacterMechanicsProjection } from '../projections/characterMechanics.js'
import type { ResolvedCampaignCharacterMechanicsProjection } from '../projections/campaignCharacterMechanics.js'

/** Exact server-owned inputs to a System adapter, not a repository or viewer projection. */
// Systems validate the pinned snapshot's relevant mechanics before using them.
type InitiativeRunActor = {
  id: string
  sourceId: string | null
  snapshot: unknown
  owner?: EncounterRunActorState['owner']
}

export type InitiativeActorFactSource =
  | {
      kind: 'CHARACTER'
      actor: InitiativeRunActor & { sourceId: string }
      characterId: string
      systemId: string
      streamVersion: number
      mechanics: Pick<CharacterMechanicsProjection, 'initiativeActorFacts'>
      overlay: Pick<ResolvedCampaignCharacterMechanicsProjection, 'rulePolicyOutput'>
      effectiveRulePolicyOutput?: CharacterRulePolicyOutput
    }
  | {
      kind: 'CREATURE'
      actor: InitiativeRunActor & { sourceRevision: number | null }
      systemId: string
      actorRule: EncounterActorRuleResult
    }
  | {
      kind: 'CUSTOM'
      actor: InitiativeRunActor & { sourceRevision: number | null }
      systemId: string | null
    }

export type InitiativeFactSources = {
  characterIds: readonly string[]
  actors: readonly InitiativeActorFactSource[]
}
