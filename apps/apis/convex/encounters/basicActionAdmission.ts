import {
  encounterCommandResultDtoSchema,
  type UseEncounterBasicActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { rejectDomain } from '../lib/domainRejections'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from '../liveSessions/authorityGuard'
import { requireEncounterActorControl } from './actorController'
import { readRunActor, readRunProjection, readRunState } from './documents'
import { presentEncounterResultForMember } from './resultPresentation'
import { presentTimelineEntry, requireUnusedEvidenceCommandId } from './timelineEntries'

/**
 * Admits a basic action (Q11) for the room: the caller controls the current actor, a player's ally
 * is visible to them, and a stored result replays before any currentness check. It reads no rules
 * inputs and writes nothing.
 */
export async function readBasicActionAdmission(
  ctx: QueryCtx,
  input: Omit<LiveSessionEncounterRulesInput, 'request'> & {
    command: UseEncounterBasicActionInputDto
  }
) {
  const { userId } = await requireIdentity(ctx)
  const command: UseEncounterBasicActionInputDto = {
    ...input.command,
    encounterId: input.command.encounterId.toLowerCase(),
    commandId: input.command.commandId.toLowerCase(),
    actorId: input.command.actorId.toLowerCase(),
    definitionId: input.command.definitionId.toLowerCase(),
    allyActorId: input.command.allyActorId?.toLowerCase() ?? null
  }
  if (
    userId !== input.expectedUserId ||
    command.encounterId !== input.encounterId ||
    command.expectedVersion !== input.expectedVersion
  )
    throw new Error('Live Session basic action scope mismatch.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  readRunProjection(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (campaign.id !== input.campaignId || membership.role !== input.expectedRole)
    throw new Error('Live Session basic action scope mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  const scope = { run, state, campaign, membership }
  await requireUnusedEvidenceCommandId(ctx, campaign.id, command.commandId)
  const fingerprint = checksumCanonicalJson(command)
  const stored = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', command.commandId)
    )
    .unique()
  if (stored) {
    presentTimelineEntry(stored)
    if (
      stored.commandType !== 'USE_BASIC_ACTION' ||
      stored.encounterId !== run.id ||
      stored.actorUserId !== userId ||
      stored.version !== command.expectedVersion + 1 ||
      stored.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(stored.resultJson))
    return {
      ...scope,
      kind: 'REPLAY' as const,
      result: await presentEncounterResultForMember(ctx, { campaign, membership, result })
    }
  }
  const actor = await readRunActor(ctx, state, command.actorId)
  await requireEncounterActorControl(ctx, { campaign, membership, actor })
  if (command.allyActorId) {
    const ally = await readRunActor(ctx, state, command.allyActorId)
    // Players help only actors in their projection; a hidden actor reads as unavailable.
    if (membership.role !== 'OWNER' && !ally.public) rejectDomain('TARGET_UNAVAILABLE')
  }
  if (state.version !== command.expectedVersion) rejectDomain('VERSION_STALE')
  if (state.status !== 'ACTIVE')
    rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Actions require an active Encounter.')
  if (state.automationMode === 'MANUAL')
    throw new Error('Basic actions require an Assisted Encounter.')
  if (state.currentActorId !== command.actorId) rejectDomain('NOT_CURRENT_ACTOR')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .first()
  if (pending) rejectDomain('PENDING_DECISION')
  return { ...scope, kind: 'READY' as const, command, fingerprint }
}
