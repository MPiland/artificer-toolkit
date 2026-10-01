import type { LiveSessionMovementSettlement } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { persistLiveMovementReaction as persistSharedMovementReaction } from '@artificer-toolkit/encounter-persistence/liveMovementReactionPersistence'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'

/** The parent checks private authority, captured revisions, and exact movement receipt order. */
export async function persistLiveMovementReaction(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    step: Extract<LiveSessionMovementSettlement, { kind: 'REACTION' }>
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
    authorizedCharacterIds: ReadonlySet<string>
  }
) {
  return persistSharedMovementReaction(encounterWriteTransaction(ctx), input, {
    applyMechanics: (mechanics) => applyLiveEncounterMechanicsBatch(ctx, mechanics),
    readCampaignCharacterState: (campaignId, characterId) =>
      readCampaignCharacterState(ctx, campaignId, characterId)
  })
}
