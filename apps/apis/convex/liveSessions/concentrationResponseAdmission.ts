import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { QueryCtx } from '../_generated/server'
import { readNativeConcentrationResponseAdmission } from '../encounters/concentrationResponseAdmission'
import { verifyNativeCleavingParentChain } from '../encounters/cleavingParent'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'

type ConcentrationResponseScope = Omit<LiveSessionEncounterRulesInput, 'request'> & {
  concentrationResponse: ResolveRuleOccurrenceInputDto
}

/** Admits the exact pending child before any player-scoped raw rules read. */
export async function readLiveConcentrationResponseAdmission(
  ctx: QueryCtx,
  input: ConcentrationResponseScope
) {
  const { userId } = await requireIdentity(ctx)
  const response = input.concentrationResponse
  if (
    userId !== input.expectedUserId ||
    response.encounterId.toLowerCase() !== input.encounterId ||
    response.expectedVersion !== input.expectedVersion
  )
    throw new Error('Live Session concentration response scope mismatch.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: input.campaignId,
    sessionId: input.sessionId,
    epoch: input.authorityEpoch
  })
  const admission = await readNativeConcentrationResponseAdmission(ctx, response, userId)
  if (
    !admission ||
    admission.state.id !== input.encounterId ||
    admission.state.campaignId !== input.campaignId ||
    admission.state.sessionId !== input.sessionId ||
    admission.membership.role !== input.expectedRole
  )
    throw new Error('Live Session concentration response is unavailable.')
  if (admission.kind === 'READY' && admission.pending.snapshot.deferredCleaving)
    await verifyNativeCleavingParentChain(
      ctx,
      admission.state,
      admission.pending.snapshot.deferredCleaving
    )
  return admission
}
