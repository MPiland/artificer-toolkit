import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { readNativeConcentrationResponseAdmission } from './concentrationResponseAdmission.js'
import { verifyNativeCleavingParentChain } from './cleavingParent.js'
import type { EncounterReadTransaction } from './ports.js'

type ConcentrationResponseScope = Omit<LiveSessionEncounterRulesInput, 'request'> & {
  concentrationResponse: ResolveRuleOccurrenceInputDto
}

/** Admits the exact pending child before any player-scoped raw rules read. */
export async function readLiveConcentrationResponseAdmission(
  ctx: EncounterReadTransaction,
  input: ConcentrationResponseScope
) {
  const { userId } = await ctx.ports.requireIdentity()
  const response = input.concentrationResponse
  if (
    userId !== input.expectedUserId ||
    response.encounterId.toLowerCase() !== input.encounterId ||
    response.expectedVersion !== input.expectedVersion
  )
    throw new Error('Live Session concentration response scope mismatch.')
  await ctx.ports.requireActiveLiveAuthority({
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  const admission = await readNativeConcentrationResponseAdmission(ctx, response, userId)
  if (
    !admission ||
    admission.state.id !== input.encounterId ||
    admission.state.campaignId !== input.campaignId ||
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
