import type { LiveSessionEncounterActionPendingInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionActionCaptureScope } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { QueryCtx } from '../_generated/server'
import { readNativeEncounterActionAdmission } from '../encounters/actionAdmission'
import { readNativeEncounterActionResponseAdmission } from '../encounters/actionResumeAdmission'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { rejectDomain } from '../lib/domainRejections'

/** Shared authorization and replay fences for the pending and terminal action transactions. */
export async function readLiveEncounterActionAdmission(
  ctx: QueryCtx,
  input: Omit<
    LiveSessionEncounterActionPendingInput,
    'snapshot' | 'revisions' | 'maintenanceOwners'
  >
) {
  const { userId } = await requireIdentity(ctx)
  if (
    userId !== input.expectedUserId ||
    input.command.encounterId.toLowerCase() !== input.encounterId ||
    input.command.expectedVersion !== input.expectedVersion ||
    (input.response &&
      (input.response.encounterId.toLowerCase() !== input.encounterId ||
        input.response.expectedVersion !== input.expectedVersion))
  )
    throw new Error('Live Session Encounter command scope mismatch.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  let responseAdmission = null
  if (input.response) {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
      .unique()
    if (!run) throw new Error('Encounter Run was not found.')
    responseAdmission = await readNativeEncounterActionResponseAdmission(
      ctx,
      input.response,
      run,
      userId
    )
    if (!responseAdmission) throw new Error('The occurrence is not an ordinary Encounter action.')
  }
  const admission =
    responseAdmission?.admission ??
    (await readNativeEncounterActionAdmission(ctx, input.command, userId))
  if (
    admission.state.campaignId !== input.campaignId ||
    admission.membership.role !== input.expectedRole ||
    (responseAdmission && checksumCanonicalJson(input.command) !== admission.fingerprint)
  )
    throw new Error('Live Session Encounter scope mismatch.')
  // A lost response replays before checking the revisions consumed by its transaction.
  if (responseAdmission?.kind === 'REPLAY')
    return { ...admission, kind: 'REPLAY' as const, result: responseAdmission.result, resume: null }
  if (admission.kind === 'REPLAY') return { ...admission, resume: null }
  const resume = responseAdmission?.kind === 'READY' ? responseAdmission : null
  if (resume && resume.resolution.requestId !== resume.pending.snapshot.request.requestId)
    rejectDomain('VERSION_STALE', 'The action evidence request is stale.')
  return { ...admission, resume }
}

/**
 * Re-admits a player's action or action response for one follow-up rules capture, so every read
 * made for that action still requires a current, admissible command (ADR 0034 decision 1).
 */
export async function readLiveEncounterActionScope(
  ctx: QueryCtx,
  input: {
    campaignId: string
    expectedUserId: string
    expectedRole: 'OWNER' | 'PLAYER'
    encounterId: string
    expectedVersion: number
    action: LiveSessionActionCaptureScope
  }
) {
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const response =
    input.action.kind === 'ACTION_RESPONSE'
      ? await readNativeEncounterActionResponseAdmission(ctx, input.action.response, run, userId)
      : null
  if (input.action.kind === 'ACTION_RESPONSE' && response?.kind !== 'READY')
    throw new Error('The admitted action response is unavailable.')
  const admission =
    response?.admission ??
    (input.action.kind === 'ACTION_COMMAND'
      ? await readNativeEncounterActionAdmission(ctx, input.action.command, userId)
      : null)
  if (
    admission?.kind !== 'READY' ||
    admission.state.id !== input.encounterId ||
    admission.state.version !== input.expectedVersion ||
    admission.campaign.id !== input.campaignId ||
    admission.membership.role !== input.expectedRole
  )
    throw new Error('The admitted action is unavailable.')
  return admission
}
