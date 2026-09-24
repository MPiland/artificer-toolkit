import type { CharacterRulePolicyOutput } from '../api/characterRules.js'
import type { EncounterActorRuleResult } from '../api/encounterActorRules.js'
import type { CharacterMechanicsProjection } from '../projections/characterMechanics.js'
import type { ResolvedCampaignCharacterMechanicsProjection } from '../projections/campaignCharacterMechanics.js'

/** Exact server-owned inputs to a System adapter, not a repository or viewer projection. */
export type InitiativeActorFactSource = {
  actor: {
    id: string
    sourceId: string | null
    sourceRevision: number | null
    // Systems validate the pinned snapshot's relevant mechanics before using them.
    snapshot: unknown
  }
} & (
  | {
      kind: 'CHARACTER'
      characterId: string
      systemId: string
      streamVersion: number
      mechanics: Pick<CharacterMechanicsProjection, 'initiativeActorFacts'>
      overlay: Pick<ResolvedCampaignCharacterMechanicsProjection, 'rulePolicyOutput'>
      effectiveRulePolicyOutput?: CharacterRulePolicyOutput
    }
  | {
      kind: 'CREATURE'
      systemId: string
      actorRule: EncounterActorRuleResult
    }
  | {
      kind: 'CUSTOM'
      systemId: string | null
    }
)

export type InitiativeFactSources = {
  characterIds: readonly string[]
  actors: readonly InitiativeActorFactSource[]
}
