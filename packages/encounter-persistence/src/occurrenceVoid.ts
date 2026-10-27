import { v5 as uuidV5 } from 'uuid'
import {
  encounterCommandResultDtoSchema,
  voidRuleOccurrenceInputDtoSchema,
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto,
  type VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredDecisionSkipSchema,
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { DamageSaveSource } from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { type ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { rejectDomain } from './domainRejections.js'
import { changedFields, readRunState } from './documents.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingRunDecision } from './pendingReads.js'
import { insertRunCommand } from './timelineEntries.js'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument } from './store.js'
import type { EncounterPersistenceTransaction, EncounterWritePorts } from './ports.js'

type VoidChatTransaction = EncounterPersistenceTransaction & {
  readonly ports: EncounterPersistenceTransaction['ports'] &
    Pick<EncounterWritePorts, 'postRulesChatMessage'>
}

type Resolution = ResolveRuleOccurrenceInputDto['resolution']
type PendingContext = ServerRuleExecutionPendingSnapshotDto['applicationContext']
type MovementReactionContext = Extract<PendingContext, { kind: 'ENCOUNTER_MOVEMENT_REACTION' }>
/** Only the facts that decide a void, so the decision stays one pure table. */
type RuleOccurrenceVoidFacts =
  | {
      kind: Exclude<
        PendingContext['kind'],
        'ENCOUNTER_MOVEMENT_REACTION' | 'ENCOUNTER_DAMAGE_SAVE_CHECK'
      >
    }
  | { kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK'; source?: DamageSaveSource }
  | { kind: 'ENCOUNTER_MOVEMENT_REACTION'; phase: Pick<MovementReactionContext['phase'], 'kind'> }

/** What a GM void does to one pending decision (ADR 0034 decision 2). */
type RuleOccurrenceVoid =
  | { kind: 'CANCEL' }
  | { kind: 'DECLINE'; resolution: Resolution }
  | { kind: 'REFUSE'; message: string }

const DAMAGE_SAVE_SUBJECTS: Record<DamageSaveSource, string> = {
  CONCENTRATION: 'A Concentration save',
  EFFECT_REPEAT_SAVE: 'A repeat save',
  MASSIVE_DAMAGE: 'A massive-damage save'
}

const answerRequired = (subject: string): RuleOccurrenceVoid => ({
  kind: 'REFUSE',
  message: `${subject} can't be voided; answer it to continue.`
})

/**
 * Paused action evidence cancels the whole action (nothing it staged is applied). Declinable
 * responses resolve as a decline. Steps that play cannot continue without are refused.
 */
export function classifyRuleOccurrenceVoid(context: RuleOccurrenceVoidFacts): RuleOccurrenceVoid {
  switch (context.kind) {
    case 'ENCOUNTER_ACTION':
    case 'ENCOUNTER_AREA_ACTION':
    case 'ENCOUNTER_CHARACTER_RULE_ACTION':
    case 'ENCOUNTER_ACTOR_RULE_ACTION':
    case 'ENCOUNTER_ACTOR_SPELL_CAST':
    case 'ENCOUNTER_CREATURE_RULE_ACTION':
      return { kind: 'CANCEL' }
    case 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING':
    case 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE':
      return { kind: 'DECLINE', resolution: { kind: 'DECLINE' } }
    case 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE':
      return { kind: 'DECLINE', resolution: { kind: 'PASSAGE_DECLINE' } }
    case 'ENCOUNTER_MOVEMENT_REACTION':
      return context.phase.kind === 'CHOICE' || context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
        ? { kind: 'DECLINE', resolution: { kind: 'DECLINE' } }
        : answerRequired('Dice during a move')
    case 'ENCOUNTER_DAMAGE_SAVE_CHECK':
      return answerRequired(DAMAGE_SAVE_SUBJECTS[context.source ?? 'CONCENTRATION'])
    case 'ENCOUNTER_CONCEALMENT_CHECK':
      return answerRequired('A concealment check')
    case 'ENCOUNTER_ESCAPE_CHECK':
      return answerRequired('An escape check')
    case 'ENCOUNTER_CHECK_ACTION':
      return answerRequired('A check action')
    case 'ENCOUNTER_D20_WINDOW':
      return answerRequired('A held die decision')
    case 'ENCOUNTER_INITIATIVE':
    case 'ENCOUNTER_INITIATIVE_DECLARATION':
      return answerRequired('Initiative')
    case 'ENCOUNTER_TURN_RECHARGE':
      return answerRequired('A Recharge roll')
    case 'ENCOUNTER_TURN_DEATH_SAVE':
      return answerRequired('A death save')
    case 'ENCOUNTER_TURN_ACTIVE_EFFECTS':
      return answerRequired('A turn-effect save')
    case 'ENCOUNTER_TURN_ZONE_EFFECTS':
      return answerRequired('A zone save')
    case 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE':
      return answerRequired('A Legendary Action roll')
    case 'ENCOUNTER_SPATIAL_MOVEMENT':
    case 'ENCOUNTER_CONTEST_CHECK':
      return answerRequired('Dice during a move')
    case 'NONE':
      return answerRequired('This decision')
  }
}

// Deterministic so a retried void finishes the same decline instead of refusing it as settled.
const voidNamespace = 'b6f0d5e2-7d1c-4b5e-9a43-2f1d0c8e6a71'
export function voidDeclineCommandId(voidCommandId: string) {
  return uuidV5(`${voidCommandId}:decline`, voidNamespace)
}

/** The GM answer a declining void settles through, the same path a GM decline takes. */
function voidDeclineCommand(
  input: VoidRuleOccurrenceInputDto,
  occurrence: Pick<EncounterDocument<'encounterRuleOccurrences'>, 'id' | 'version'>,
  resolution: Resolution
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: input.encounterId.toLowerCase(),
    commandId: voidDeclineCommandId(input.commandId.toLowerCase()),
    expectedVersion: input.expectedVersion,
    correlationId: null,
    occurrenceId: occurrence.id,
    expectedOccurrenceVersion: occurrence.version,
    resolution
  }
}

type VoidScope = {
  input: VoidRuleOccurrenceInputDto
  userId: string
  run: EncounterDocument<'encounterRuns'>
  campaign: EncounterDocument<'campaigns'>
  membership: EncounterDocument<'campaignMemberships'>
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
  fingerprint: string
}

type VoidAdmission =
  | { kind: 'REPLAY'; result: EncounterCommandResultDto }
  | ({ kind: 'READY' } & VoidScope)

/** GM-only; the stored VOID receipt replays before any currentness check. */
async function admitVoid(
  ctx: EncounterPersistenceTransaction,
  args: unknown
): Promise<VoidAdmission> {
  const { userId } = await ctx.ports.requireIdentity()
  const parsed = voidRuleOccurrenceInputDtoSchema.parse(args)
  const input = {
    ...parsed,
    encounterId: parsed.encounterId.toLowerCase(),
    commandId: parsed.commandId.toLowerCase(),
    occurrenceId: parsed.occurrenceId.toLowerCase()
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== 'VOID_RULE_OCCURRENCE' ||
      prior.encounterId !== run.id ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    return {
      kind: 'REPLAY',
      result: await replayEncounterCommandResult(ctx, readRunState(run), prior)
    }
  }
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', input.occurrenceId))
    .unique()
  if (!occurrence || occurrence.campaignId !== campaign.id || occurrence.encounterId !== run.id)
    throw new Error('Rule occurrence is unavailable.')
  return { kind: 'READY', input, userId, run, campaign, membership, occurrence, fingerprint }
}

/** Publishes the "Voided by the GM" timeline entry; the Run version advances with it. */
async function recordVoid(
  ctx: EncounterPersistenceTransaction,
  scope: VoidScope,
  status: 'COMPLETE' | 'VOIDED'
) {
  const { input, run, campaign, occurrence } = scope
  const version = run.version + 1
  const updatedAt = new Date().toISOString()
  const state = encounterRunStateSchema.parse({ ...readRunState(run), version, updatedAt })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, state),
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status,
      pending: null
    }
  })
  await ctx.db.patch(run._id, {
    version,
    updatedAt,
    stateJson: JSON.stringify(state),
    stateChecksum: checksumCanonicalJson(state)
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: input.type,
      ruleOccurrenceId: occurrence.id,
      commandFingerprint: scope.fingerprint,
      actorUserId: scope.userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: updatedAt
    })
  )
  return result
}

async function hasDeclineReceipt(
  ctx: EncounterPersistenceTransaction,
  campaignId: string,
  voidCommandId: string
) {
  const commandId = voidDeclineCommandId(voidCommandId)
  const [runCommand, ruleReceipt] = await Promise.all([
    ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaignId).eq('commandId', commandId)
      )
      .unique(),
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaignId).eq('commandId', commandId)
      )
      .unique()
  ])
  return runCommand !== null || ruleReceipt !== null
}

type RuleOccurrenceVoidPlan =
  | { kind: 'COMPLETE'; result: EncounterCommandResultDto }
  | { kind: 'DECLINE'; command: ResolveRuleOccurrenceInputDto }
  | { kind: 'RECORD' }
  | { kind: 'CANCEL'; admission: VoidScope }

/** Decides a void without writing: its replay, a pending decline, a record, or a cancel. */
async function planRuleOccurrenceVoid(
  ctx: EncounterPersistenceTransaction,
  args: unknown
): Promise<RuleOccurrenceVoidPlan> {
  const admission = await admitVoid(ctx, args)
  if (admission.kind === 'REPLAY') return { kind: 'COMPLETE', result: admission.result }
  const { input, run, occurrence } = admission
  if (occurrence.state !== 'PENDING') {
    if (await hasDeclineReceipt(ctx, admission.campaign.id, input.commandId))
      return { kind: 'RECORD' }
    rejectDomain('DECISION_NOT_PENDING')
  }
  if (
    run.version !== input.expectedVersion ||
    occurrence.version !== input.expectedOccurrenceVersion
  )
    rejectDomain('VERSION_STALE')
  const snapshot = await readPendingSnapshot(ctx, occurrence)
  if (!snapshot) throw new Error('Stored Encounter occurrence state is invalid.')
  const outcome = classifyRuleOccurrenceVoid(snapshot.applicationContext)
  if (outcome.kind === 'REFUSE') rejectDomain('DECISION_REQUIRES_ANSWER', outcome.message)
  if (outcome.kind === 'DECLINE')
    return { kind: 'DECLINE', command: voidDeclineCommand(input, occurrence, outcome.resolution) }
  return { kind: 'CANCEL', admission }
}

/** The decline a room movement commit settles for a GM void (D26); anything else is refused. */
export async function readRuleOccurrenceVoidDecline(
  ctx: EncounterPersistenceTransaction,
  args: unknown
): Promise<ResolveRuleOccurrenceInputDto> {
  const plan = await planRuleOccurrenceVoid(ctx, args)
  if (plan.kind !== 'DECLINE') throw new Error('The void does not decline a pending decision.')
  return plan.command
}

/**
 * Settles a cancel atomically, or returns the decline the orchestrator runs through the same path
 * a GM answer takes. A void whose decline already committed only records its timeline entry.
 */
export async function prepareRuleOccurrenceVoid(
  ctx: EncounterPersistenceTransaction,
  args: unknown
): Promise<Exclude<RuleOccurrenceVoidPlan, { kind: 'CANCEL' }>> {
  const plan = await planRuleOccurrenceVoid(ctx, args)
  if (plan.kind !== 'CANCEL') return plan
  const { admission } = plan
  const { occurrence } = admission
  // Paused actions stage nothing on the Run, so cancelling only closes the occurrence.
  const updatedAt = new Date().toISOString()
  const { _id, _creationTime, ...stored } = occurrence
  const voided = encounterStoredRuleOccurrenceSchema.parse({
    ...stored,
    state: 'VOIDED',
    version: occurrence.version + 1,
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, null),
    completedAt: updatedAt,
    updatedAt
  })
  await ctx.db.patch(_id, changedFields(occurrence, voided))
  return {
    kind: 'COMPLETE',
    result: await recordVoid(
      ctx,
      { ...admission, occurrence: { ...occurrence, ...voided } },
      'VOIDED'
    )
  }
}

/**
 * Records a void after its decline committed. A turn or move that pauses again stays fenced to the
 * current Run version, so it returns the next decision instead of a separate timeline entry.
 */
export async function recordRuleOccurrenceVoid(
  ctx: EncounterPersistenceTransaction,
  args: unknown
): Promise<EncounterCommandResultDto> {
  const admission = await admitVoid(ctx, args)
  if (admission.kind === 'REPLAY') return admission.result
  const { input, run, campaign, membership, occurrence } = admission
  if (occurrence.state === 'PENDING' && occurrence.version === input.expectedOccurrenceVersion)
    throw new Error('The voided decision did not settle.')
  const pending = await readPendingRunDecision(ctx, run, campaign, membership)
  if (pending)
    return encounterCommandResultDtoSchema.parse({
      projection: await readEncounterGmProjection(ctx, readRunState(run)),
      roll: null,
      occurrence: {
        occurrenceId: pending.occurrenceId,
        occurrenceVersion: pending.occurrenceVersion,
        status: 'PENDING',
        pending
      }
    })
  return recordVoid(ctx, admission, occurrence.state === 'VOIDED' ? 'VOIDED' : 'COMPLETE')
}

/**
 * Tells the table in chat that the GM skipped a movement decision (D26) and records the skip, so the
 * decision's player sees it in their drawer too (D39). The skipped occurrence and version key both
 * writes, so a replay or retry adds nothing; like other rules entries it spends no chat rate limit.
 */
export async function postMovementDecisionSkipped(
  ctx: VoidChatTransaction,
  input: { campaignId: string; gmUserId: string; voidCommand: VoidRuleOccurrenceInputDto }
) {
  const authority = await ctx.ports.requireCampaignAuthority(input.campaignId, input.gmUserId)
  const skip = encounterStoredDecisionSkipSchema.parse({
    encounterId: input.voidCommand.encounterId.toLowerCase(),
    occurrenceId: input.voidCommand.occurrenceId.toLowerCase(),
    occurrenceVersion: input.voidCommand.expectedOccurrenceVersion,
    voidCommandId: input.voidCommand.commandId.toLowerCase()
  })
  const prior = await ctx.db
    .query('encounterDecisionSkips')
    .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) =>
      q
        .eq('encounterId', skip.encounterId)
        .eq('occurrenceId', skip.occurrenceId)
        .eq('occurrenceVersion', skip.occurrenceVersion)
    )
    .unique()
  if (prior) return
  await ctx.db.insert('encounterDecisionSkips', skip)
  await ctx.ports.postRulesChatMessage(authority, {
    authorUserId: input.gmUserId,
    clientNonce: skip.voidCommandId,
    body: MOVEMENT_DECISION_SKIPPED_MESSAGE
  })
}
