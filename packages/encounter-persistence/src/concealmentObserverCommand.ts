import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type SetConcealmentObserversInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  concealmentLifecycleFor,
  encounterConcealmentOf
} from '@artificer-toolkit/rules-runtime/encounterConcealment'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { rejectDomain } from './domainRejections.js'
import { readRunActors, readRunState } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterWriteTransaction } from './ports.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'

/**
 * The GM adds creatures to or removes them from the observers one concealment hides its holder
 * from. Only that observer set changes; the Stealth total and the effect's lifecycle are the
 * concealment's own. The receipt keeps the set before and after, so the GM's undo restores it.
 */
export async function setConcealmentObservers(
  ctx: EncounterWriteTransaction,
  command: SetConcealmentObserversInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  const lower = (id: string) => id.toLowerCase()
  const input = {
    ...command,
    encounterId: lower(command.encounterId),
    commandId: lower(command.commandId),
    activeEffectId: lower(command.activeEffectId),
    add: command.add.map(lower),
    remove: command.remove.map(lower)
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== 'SET_CONCEALMENT_OBSERVERS' ||
      prior.encounterId !== run.id ||
      prior.actorUserId !== userId ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    return replayEncounterCommandResult(ctx, readRunState(run), prior)
  }
  if (run.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  const state = readRunState(run)
  if (state.status !== 'ACTIVE') rejectDomain('ENCOUNTER_NOT_ACTIVE')

  const actors = await readRunActors(ctx, state)
  const store = createActiveRuleEffectStore(ctx)
  const held = (
    await Promise.all(
      actors.map(async (holder) => ({
        holder,
        concealment: encounterConcealmentOf(await store.list(turnEffectOwner(holder, state.id)))
      }))
    )
  ).find(({ concealment }) => concealment?.effect.id === input.activeEffectId)
  if (!held?.concealment) rejectDomain('TARGET_UNAVAILABLE', 'That creature is no longer hidden.')
  const { holder, concealment } = held
  const changed = [...input.add, ...input.remove]
  if (
    new Set(changed).size !== changed.length ||
    changed.some((id) => id === holder.id || !state.actorIds.includes(id))
  )
    rejectDomain('TARGET_UNAVAILABLE', 'Only another creature in the Encounter can be an observer.')
  const before = [...concealment.observerActorIds]
  const after = [
    ...new Set([...before.filter((id) => !input.remove.includes(id)), ...input.add])
  ].sort()
  if (checksumCanonicalJson(after) === checksumCanonicalJson(before))
    rejectDomain('TARGET_UNAVAILABLE', 'That does not change who the creature is hidden from.')

  const updated = await store.updateLifecycleCas({
    id: concealment.effect.id,
    owner: turnEffectOwner(holder, state.id),
    expectedVersion: concealment.effect.version,
    lifecycle: concealmentLifecycleFor(concealment.effect, after)
  })
  const now = new Date().toISOString()
  const version = run.version + 1
  const nextState = encounterRunStateSchema.parse({ ...state, version, updatedAt: now })
  await ctx.db.patch(run._id, {
    version,
    updatedAt: now,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, nextState),
    roll: null,
    occurrence: null
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: 'SET_CONCEALMENT_OBSERVERS',
      receipt: {
        activeEffectId: updated.id,
        holderActorId: holder.id,
        beforeObserverActorIds: before,
        afterObserverActorIds: after,
        afterVersion: updated.version
      },
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: now
    })
  )
  return result
}
