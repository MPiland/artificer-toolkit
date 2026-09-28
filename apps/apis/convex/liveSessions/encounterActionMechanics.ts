import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  readCampaignCharacterState,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import { loadCharacterState, readCharacterRecord } from '../characters/stateDocuments'
import {
  persistEncounterMechanicsBatchPlan,
  readEncounterMechanicsBatchTarget,
  type EncounterMechanicsBatchResult
} from '@artificer-toolkit/encounter-persistence/mechanicsBatchPersistence'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/**
 * Applies a trusted normalized batch after the terminal has checked the root command replay,
 * current authority epoch and revisions, Scene/source scope, and private transport input.
 * This function alone is not the remote-plan authorization boundary. The terminal's
 * `assertLiveSessionRulesRevisions` call pins each Character to the room's captured revision, so
 * the Character read here is the one the room planned against.
 */
export async function applyLiveEncounterMechanicsBatch(
  ctx: MutationCtx,
  input: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
): Promise<EncounterMechanicsBatchResult> {
  const read = await readEncounterMechanicsBatchTarget(encounterWriteTransaction(ctx), {
    ...input,
    expectedCharacterStreamVersion: null
  })
  const { actor, campaign, userId } = read
  let characterRecord: Doc<'characters'> | null = null
  let characterFacts: Parameters<typeof planEncounterMechanicsBatch>[0]['characterFacts']
  if (actor.kind === 'CHARACTER') {
    const { assignment } = await requireCampaignCharacterAuthority(
      ctx,
      campaign.id,
      actor.sourceId,
      campaign.ownerUserId
    )
    const { active, draft } = await loadCharacterState(ctx, actor.sourceId)
    if (
      !active ||
      active.id !== actor.sourceId ||
      active.systemId !== actor.systemId ||
      active.systemId !== campaign.gameSystemId ||
      active.userId !== assignment.userId ||
      active.status !== 'ACTIVE' ||
      (draft &&
        (draft.characterId !== active.id ||
          draft.systemId !== active.systemId ||
          draft.userId !== active.userId))
    )
      throw new Error('Encounter Character actor identity is stale.')
    const character = readCharacterRecord(active) as CharacterAuthored
    const sheetState = readCharacterSheetState(active)
    const campaignState = await readCampaignCharacterState(ctx, campaign.id, active.id)
    characterRecord = active
    characterFacts = {
      active,
      character,
      sheetState,
      campaignContext: { conditions: campaignState.state.conditions }
    }
  }
  const target = {
    ...read,
    input: { ...read.input, expectedCharacterStreamVersion: characterRecord?.streamVersion ?? null }
  }
  const plan = planEncounterMechanicsBatch({
    batch: target.input,
    actor,
    userId,
    characterFacts
  })
  return persistEncounterMechanicsBatchPlan(encounterWriteTransaction(ctx), target, {
    actor,
    character: characterRecord,
    plan
  })
}
