import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { rejectDomain } from './domainRejections.js'
import { readRunState, replaceRunActor } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterWriteTransaction } from './ports.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import type { EncounterDocument } from './store.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'

type GmCommandInput = {
  type: string
  encounterId: string
  commandId: string
  expectedVersion: number
}

export type GmCommandAdmission =
  | { replay: EncounterCommandResultDto }
  | {
      replay: null
      run: EncounterDocument<'encounterRuns'>
      campaign: EncounterDocument<'campaigns'>
      state: EncounterRunState
      fingerprint: string
    }

/**
 * Admits a GM-only Run command that settles without a rule occurrence (Morale, consequence rolls):
 * the GM of an active Campaign, an unused command id (a replay returns its result), the current
 * version of an active Run, and no pending decision.
 */
export async function admitGmEncounterCommand(
  ctx: EncounterWriteTransaction,
  input: GmCommandInput,
  userId: string
): Promise<GmCommandAdmission> {
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
      prior.commandType !== input.type ||
      prior.encounterId !== run.id ||
      prior.actorUserId !== userId ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    return { replay: await replayEncounterCommandResult(ctx, readRunState(run), prior) }
  }
  if (run.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  const state = readRunState(run)
  if (state.status !== 'ACTIVE') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .first()
  if (pending) rejectDomain('PENDING_DECISION')
  return { replay: null, run, campaign, state, fingerprint }
}

/**
 * Commits an admitted GM command: writes its actor changes, advances the Run version and records
 * the command with its receipt. A private roll keeps the command off the table's timeline (D62).
 */
export async function commitGmEncounterCommand(
  ctx: EncounterWriteTransaction,
  admitted: Extract<GmCommandAdmission, { replay: null }>,
  settlement: {
    input: GmCommandInput
    userId: string
    now: string
    changes: readonly { before: EncounterRunActorState; after: EncounterRunActorState }[]
    roll: RollRecordDto | null
    rollIsPrivate: boolean
    receipt: unknown
  }
): Promise<EncounterCommandResultDto> {
  const { run, campaign, state } = admitted
  const { input, now } = settlement
  for (const { before, after } of settlement.changes) await replaceRunActor(ctx, before, after)
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
    roll: settlement.roll,
    occurrence: null
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: input.type,
      ...(settlement.rollIsPrivate ? { visibility: 'PRIVATE' as const } : {}),
      receipt: settlement.receipt,
      commandFingerprint: admitted.fingerprint,
      actorUserId: settlement.userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: now
    })
  )
  return result
}
