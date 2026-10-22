import type { RemoveAreaTargetInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterActionPendingInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionActionCaptureScope } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import {
  chosenEncounterAttackRetarget,
  retargetEncounterAction
} from '@artificer-toolkit/rules-runtime/encounterAttackRetarget'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readNativeEncounterActionAdmission } from './actionAdmission.js'
import { readNativeEncounterActionResponseAdmission } from './actionResumeAdmission.js'
import { rejectDomain } from './domainRejections.js'
import { readRunActor } from './documents.js'
import { requireTargetSeenByMember } from './targetVisibility.js'
import { readAreaRemovalCommitAdmission } from './areaTargetRemoval.js'
import { readCleavingResponseAdmission } from './cleavingResponseAdmission.js'
import { readContestAdmission } from './contestAdmission.js'
import { readBasicActionScopeAdmission } from './basicActionScopeAdmission.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * Shared authorization and replay fences for the pending and terminal action transactions. A
 * `removal` is the GM's removal of the last creature a pending area waits on: it admits the area's
 * own root command, resumed, in place of a creature's answer.
 */
export async function readLiveEncounterActionAdmission(
  ctx: EncounterReadTransaction,
  input: Omit<
    LiveSessionEncounterActionPendingInput,
    'snapshot' | 'revisions' | 'maintenanceOwners'
  > & { removal?: RemoveAreaTargetInputDto | null }
) {
  const { userId } = await ctx.ports.requireIdentity()
  if (
    userId !== input.expectedUserId ||
    input.command.encounterId.toLowerCase() !== input.encounterId ||
    input.command.expectedVersion !== input.expectedVersion ||
    (input.response &&
      (input.response.encounterId.toLowerCase() !== input.encounterId ||
        input.response.expectedVersion !== input.expectedVersion))
  )
    throw new Error('Live Session Encounter command scope mismatch.')
  await ctx.ports.requireActiveLiveAuthority({
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
  if (input.removal && input.response)
    throw new Error('Live Session Encounter command scope mismatch.')
  const removalAdmission = input.removal
    ? await readAreaRemovalCommitAdmission(ctx, input.removal, userId)
    : null
  const removal = removalAdmission?.removal ?? null
  const admission =
    responseAdmission?.admission ??
    removalAdmission?.admission ??
    (await readNativeEncounterActionAdmission(ctx, input.command, userId))
  // An answer that turns a ward-stopped action on another creature continues it as that creature's
  // action: the transaction carries the retargeted command, not the stored root it replaces.
  const retarget =
    responseAdmission?.kind === 'READY' &&
    responseAdmission.pending.context.pause?.kind === 'ATTACK_RETARGET' &&
    responseAdmission.resolution.kind === 'OPTION'
      ? chosenEncounterAttackRetarget(responseAdmission.pending.context.pause.payload, {
          kind: 'OPTION',
          optionId: responseAdmission.resolution.optionId
        })
      : null
  const retargeted = retarget ? retargetEncounterAction(admission.input, retarget) : null
  if (retarget)
    await requireTargetSeenByMember(ctx, {
      encounterId: admission.state.id,
      target: await readRunActor(ctx, admission.state, retarget.targetActorId),
      membership: admission.membership
    })
  const fingerprint = retargeted ? checksumCanonicalJson(retargeted) : admission.fingerprint
  if (
    admission.state.campaignId !== input.campaignId ||
    admission.membership.role !== input.expectedRole ||
    ((responseAdmission || removal) && checksumCanonicalJson(input.command) !== fingerprint)
  )
    throw new Error('Live Session Encounter scope mismatch.')
  // A lost response replays before checking the revisions consumed by its transaction.
  if (responseAdmission?.kind === 'REPLAY')
    return {
      ...admission,
      kind: 'REPLAY' as const,
      result: responseAdmission.result,
      resume: null
    }
  if (admission.kind === 'REPLAY') return { ...admission, resume: null }
  const resume = responseAdmission?.kind === 'READY' ? responseAdmission : null
  // An area's push pick names its own request, which the response admission already matched.
  if (
    resume &&
    !(resume.area && resume.resolution.kind === 'FORCED_MOVEMENT') &&
    'requestId' in resume.resolution &&
    resume.resolution.requestId !== resume.pending.snapshot.request.requestId
  )
    rejectDomain('VERSION_STALE', 'The action evidence request is stale.')
  return retargeted
    ? { ...admission, input: retargeted, fingerprint, resume, removal }
    : { ...admission, resume, removal }
}

/** The admitted, ready result of one admission reader. */
type ReadyAdmission<Read extends (...args: never[]) => Promise<{ kind: string }>> = Extract<
  Awaited<ReturnType<Read>>,
  { kind: 'READY' }
>

/**
 * Re-admits a player's action or action response for one follow-up rules capture, so every read
 * made for that action still requires a current, admissible command (ADR 0034 decision 1).
 */
export async function readLiveEncounterActionScope(
  ctx: EncounterReadTransaction,
  input: {
    campaignId: string
    authorityEpoch: string
    expectedUserId: string
    expectedRole: 'OWNER' | 'PLAYER'
    encounterId: string
    expectedVersion: number
    action: LiveSessionActionCaptureScope
  }
): Promise<
  | ReadyAdmission<typeof readCleavingResponseAdmission>
  | ReadyAdmission<typeof readContestAdmission>
  | ReadyAdmission<typeof readBasicActionScopeAdmission>
  | ReadyAdmission<typeof readNativeEncounterActionAdmission>
> {
  if (input.action.kind === 'CLEAVING_RESPONSE') {
    const cleaving = await readCleavingResponseAdmission(ctx, {
      ...input,
      response: input.action.response
    })
    if (cleaving.kind !== 'READY') throw new Error('The admitted Cleaving answer is unavailable.')
    return cleaving
  }
  if (input.action.kind === 'CONTEST') {
    const contest = await readContestAdmission(ctx, {
      ...input,
      command: input.action.command
    })
    if (contest.kind !== 'READY') throw new Error('The admitted contest is unavailable.')
    return contest
  }
  if (input.action.kind === 'BASIC_ACTION') {
    const basic = await readBasicActionScopeAdmission(ctx, {
      ...input,
      command: input.action.command
    })
    if (basic.kind !== 'READY') throw new Error('The admitted basic action is unavailable.')
    return basic
  }
  const { userId } = await ctx.ports.requireIdentity()
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
