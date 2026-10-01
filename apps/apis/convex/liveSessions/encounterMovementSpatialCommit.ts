import type { LiveSessionMovementSettlement } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { persistLiveMovementSpatial as persistSharedMovementSpatial } from '@artificer-toolkit/encounter-persistence/liveMovementSpatialPersistence'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'

type SpatialStep = Extract<LiveSessionMovementSettlement, { kind: 'SPATIAL' }>
/** Applies only a validated, ordered spatial receipt; the parent owns authority and root admission. */
export async function persistLiveMovementSpatial(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    step: SpatialStep
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
    sceneId: string
    effectOriginals: ReadonlyMap<string, EncounterSpatialRuleEffectRecord>
    appliedEffectIds: Set<string>
  }
) {
  return persistSharedMovementSpatial(encounterWriteTransaction(ctx), input, {
    applyMechanics: (mechanics) => applyLiveEncounterMechanicsBatch(ctx, mechanics),
    readCampaignCharacterState: (campaignId, characterId) =>
      readCampaignCharacterState(ctx, campaignId, characterId)
  })
}
