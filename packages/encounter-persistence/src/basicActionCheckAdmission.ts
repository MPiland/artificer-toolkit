import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { requireEncounterActorControl } from './actorController.js'
import {
  readNativeBasicActionCheckPending,
  readNativeCheckActionPending,
  readNativeD20WindowPending,
  readNativeEscapeCheckPending
} from './basicActionCheckPending.js'
import { encounterD20WindowRollerActorId } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import { rejectDomain } from './domainRejections.js'
import { readRunActor, readRunState } from './documents.js'
import { readEncounterSettledAppRoll } from './evidenceRolls.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import { presentStoredCommandReplay } from './resultPresentation.js'
import { presentTimelineEntry, type StoredCommand } from './timelineEntries.js'
import type { EncounterReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

/** The check occurrence a stored root command pended: a CHECK action's or an Escape's. */
export function storedCheckOccurrenceId(root: StoredCommand | undefined): string | null {
  if (root?.commandType === 'RESOLVE_ACTION')
    return root.root.kind === 'CHECK' ? root.root.checkReceipt.checkOccurrenceId : null
  if (root?.commandType === 'ESCAPE') return root.receipt.checkOccurrenceId
  return null
}

const takesD20Evidence = ({ kind }: ResolveRuleOccurrenceInputDto['resolution']) =>
  kind === 'ENTER_DICE' || kind === 'SYSTEM_ROLL'

const takesD20WindowDecision = ({ kind }: ResolveRuleOccurrenceInputDto['resolution']) =>
  kind === 'D20_WINDOW_DECLINE' || kind === 'D20_WINDOW_USE'

type CheckResponseInput = Omit<LiveSessionEncounterRulesInput, 'request'> & {
  response: ResolveRuleOccurrenceInputDto
}

/** What differs between the answers a root command's check can wait on: a d20, a d20 window's decision or a won outcome's dice. */
type CheckAdmissionSpec<TPending extends { context: { commandFingerprint: string } }> = {
  readPending(
    occurrence: EncounterDocument<'encounterRuleOccurrences'>,
    snapshot: ServerRuleExecutionPendingSnapshotDto | null
  ): TPending
  /** The actor whose controllers roll the d20. */
  rollerActorId(context: TPending['context']): string
  /** Whether a resolution is the kind of answer this pending decision takes. */
  takesResolution(
    resolution: ResolveRuleOccurrenceInputDto['resolution'],
    context: TPending['context']
  ): boolean
}

/**
 * Admits the roller's d20 for a pending check for the room: current control and versions, the one
 * pending occurrence, and a stored answer replaying before any currentness check. It reads no
 * rules inputs and writes nothing.
 */
async function admitCheckResponse<
  TPending extends {
    context: { commandFingerprint: string }
    snapshot: { request: { requestId: string } }
  }
>(ctx: EncounterReadTransaction, input: CheckResponseInput, spec: CheckAdmissionSpec<TPending>) {
  const { userId } = await ctx.ports.requireIdentity()
  const response: ResolveRuleOccurrenceInputDto = {
    ...input.response,
    encounterId: input.response.encounterId.toLowerCase(),
    commandId: input.response.commandId.toLowerCase(),
    occurrenceId: input.response.occurrenceId.toLowerCase(),
    correlationId: input.response.correlationId?.toLowerCase() ?? null
  }
  if (
    userId !== input.expectedUserId ||
    response.encounterId !== input.encounterId ||
    response.expectedVersion !== input.expectedVersion
  )
    throw new Error('Live Session check response scope mismatch.')
  await ctx.ports.requireActiveLiveAuthority({
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    state.campaignId,
    userId
  )
  if (campaign.id !== input.campaignId || membership.role !== input.expectedRole)
    throw new Error('Live Session check response scope mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  const scope = { run, state, campaign, membership }
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', response.occurrenceId))
    .unique()
  if (!occurrence || occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
    throw new Error('The check occurrence is unavailable.')
  const fingerprint = checksumCanonicalJson(response)
  const [stored, evidence] = await Promise.all([
    ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', response.commandId)
      )
      .unique(),
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaign.id).eq('commandId', response.commandId)
      )
      .unique()
  ])
  if (stored || evidence) {
    if (!stored || stored.commandType !== 'RESOLVE_RULE_OCCURRENCE')
      rejectDomain('COMMAND_ID_REUSED')
    presentTimelineEntry(stored)
    // Opening a d20 window records no rule result, so it leaves no receipt to check.
    const metadata = evidence
      ? serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
          JSON.parse(evidence.commandMetadataJson)
        )
      : null
    if (
      stored.encounterId !== run.id ||
      stored.actorUserId !== userId ||
      stored.commandFingerprint !== fingerprint ||
      stored.ruleOccurrenceId !== occurrence.id ||
      stored.version !== response.expectedVersion + 1 ||
      stored.version > state.version ||
      (metadata !== null &&
        (metadata.transition !== 'RESUME' ||
          metadata.expectedAggregateVersion !== response.expectedVersion ||
          metadata.expectedOccurrenceVersion !== response.expectedOccurrenceVersion)) ||
      occurrence.version < response.expectedOccurrenceVersion + 1
    )
      rejectDomain('COMMAND_ID_REUSED')
    return {
      ...scope,
      kind: 'REPLAY' as const,
      result: await presentStoredCommandReplay(ctx, { state, campaign, membership, stored })
    }
  }
  const pending = spec.readPending(occurrence, await readPendingSnapshot(ctx, occurrence))
  const { context, snapshot } = pending
  const root = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', occurrence.rootCommandId)
    )
    .unique()
  // The fingerprint covers the command's type, so a root of the other check kind cannot match.
  if (
    !root ||
    storedCheckOccurrenceId(root) !== occurrence.id ||
    root.commandFingerprint !== context.commandFingerprint
  )
    throw new Error('The check root command is unavailable.')
  const reservedCommand = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', response.commandId)
    )
    .unique()
  if (reservedCommand || response.commandId === root.commandId) rejectDomain('COMMAND_ID_REUSED')
  await requireEncounterActorControl(ctx, {
    campaign,
    membership,
    actor: await readRunActor(ctx, state, spec.rollerActorId(context))
  })
  if (
    occurrence.version !== response.expectedOccurrenceVersion ||
    occurrence.expectedEncounterVersion !== state.version ||
    !('requestId' in response.resolution) ||
    response.resolution.requestId !== snapshot.request.requestId
  )
    rejectDomain('VERSION_STALE', 'The check changed; review it and answer again.')
  if (!spec.takesResolution(response.resolution, context))
    throw new Error('The check does not take this answer.')
  if (state.status !== 'ACTIVE') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  if (state.automationMode === 'MANUAL') rejectDomain('ASSISTED_ONLY')
  const pendingOccurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .take(2)
  if (pendingOccurrences.length !== 1 || pendingOccurrences[0]?.id !== occurrence.id)
    throw new Error('Stored Encounter occurrence state is invalid.')
  return {
    ...scope,
    kind: 'READY' as const,
    response,
    fingerprint,
    occurrence,
    pending,
    initiatorUserId: root.actorUserId,
    appRoll: await readEncounterSettledAppRoll(ctx, { occurrence, response, userId })
  }
}

/** Admits the roller's d20 for a pending concealment check: the hider's or the searcher's. */
export function readBasicActionCheckResponseAdmission(
  ctx: EncounterReadTransaction,
  input: CheckResponseInput
) {
  return admitCheckResponse(ctx, input, {
    readPending: readNativeBasicActionCheckPending,
    rollerActorId: (context) => context.actorId,
    takesResolution: takesD20Evidence
  })
}

/** Admits the roller's decision on a held die for a rolled basic action check's d20 window. */
export function readD20WindowResponseAdmission(
  ctx: EncounterReadTransaction,
  input: CheckResponseInput
) {
  return admitCheckResponse(ctx, input, {
    readPending: readNativeD20WindowPending,
    rollerActorId: encounterD20WindowRollerActorId,
    takesResolution: takesD20WindowDecision
  })
}

/**
 * Admits the actor's answer to a pending check action (D173): the d20 of its check, the decision on
 * a held die in that d20's window, or the dice of the outcome the check won.
 */
export function readCheckActionResponseAdmission(
  ctx: EncounterReadTransaction,
  input: CheckResponseInput
) {
  return admitCheckResponse(ctx, input, {
    readPending: (occurrence, snapshot) => {
      if (snapshot?.applicationContext.kind !== 'ENCOUNTER_D20_WINDOW')
        return readNativeCheckActionPending(occurrence, snapshot)
      const window = readNativeD20WindowPending(occurrence, snapshot)
      if (window.context.source.kind !== 'CHECK_ACTION')
        throw new Error('The check action occurrence is unavailable.')
      return window
    },
    rollerActorId: (context) =>
      context.kind === 'ENCOUNTER_D20_WINDOW'
        ? encounterD20WindowRollerActorId(context)
        : context.actorId,
    takesResolution: (resolution, context) =>
      context.kind === 'ENCOUNTER_D20_WINDOW'
        ? takesD20WindowDecision(resolution)
        : context.phase.kind === 'CHECK'
          ? takesD20Evidence(resolution)
          : resolution.kind === 'ENTER_INTEGER' || resolution.kind === 'SYSTEM_ROLL'
  })
}

/** Admits the held creature's d20 for a pending Escape check (D105). */
export function readEscapeCheckResponseAdmission(
  ctx: EncounterReadTransaction,
  input: CheckResponseInput
) {
  return admitCheckResponse(ctx, input, {
    readPending: readNativeEscapeCheckPending,
    rollerActorId: (context) => context.actorId,
    takesResolution: takesD20Evidence
  })
}
