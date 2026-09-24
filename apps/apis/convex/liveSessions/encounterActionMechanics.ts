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
import { requireSystem } from '../content/systemDocuments'
import {
  persistEncounterMechanicsBatchPlan,
  readEncounterMechanicsBatchTarget,
  type EncounterMechanicsBatchResult
} from '../encounters/mechanicsBatchPersistence'

/**
 * Applies a trusted normalized batch after the terminal has checked the root command replay,
 * current authority epoch and revisions, Scene/source scope, and private transport input.
 * This function alone is not the remote-plan authorization boundary.
 */
export async function applyLiveEncounterMechanicsBatch(
  ctx: MutationCtx,
  input: EncounterMechanicsBatchInput
): Promise<EncounterMechanicsBatchResult> {
  const target = await readEncounterMechanicsBatchTarget(ctx, input)
  const { actor, campaign, userId } = target
  let characterRecord: Doc<'characters'> | null = null
  let characterFacts: Parameters<typeof planEncounterMechanicsBatch>[0]['characterFacts']
  if (actor.kind === 'CHARACTER') {
    if (!actor.sourceId || actor.sourceRevision === null)
      throw new Error('Encounter Character actor is stale.')
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
    const needsConditionLabels = target.input.applications.some(
      (application) =>
        application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE'
    )
    const system = needsConditionLabels ? await requireSystem(ctx, active.systemId) : null
    characterRecord = active
    characterFacts = {
      active,
      character,
      sheetState,
      campaignContext: { conditions: campaignState.state.conditions },
      prepared: {
        context: {
          registry: { system: system ? { conditionTypes: system.conditionTypes } : null }
        }
      }
    }
  }
  const plan = planEncounterMechanicsBatch({
    batch: target.input,
    actor,
    userId,
    characterFacts
  })
  return persistEncounterMechanicsBatchPlan(ctx, target, {
    actor,
    character: characterRecord,
    plan
  })
}
