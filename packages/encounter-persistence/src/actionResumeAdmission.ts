import {
  encounterExecuteInputSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleReceiptSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readNativeEncounterActionAdmission } from './actionAdmission.js'
import {
  canAnswerNativeActionEvidence,
  canControlEvidenceRoller,
  offeredDecisionOptionIds,
  readNativeActionPending
} from './actionPending.js'
import { areaActionPendingContext, readNativeAreaActionPending } from './actionAreaPending.js'
import { nativeActionPendingResult } from './actionPendingResult.js'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { readEncounterSettledAppRoll } from './evidenceRolls.js'
import { isNativeActionOccurrence } from './occurrenceOwner.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * Returns null only for occurrences owned by another native coordinator. The responder must be
 * able to answer the evidence (its roller's controller or the GM); the root keeps its initiator.
 */
export async function readNativeEncounterActionResponseAdmission(
  ctx: EncounterReadTransaction,
  response: ResolveRuleOccurrenceInputDto,
  run: EncounterDocument<'encounterRuns'>,
  userId: string
) {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (query) => query.eq('id', response.occurrenceId))
    .unique()
  if (!occurrence) return null
  const rootReceipt = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', occurrence.rootCommandId)
    )
    .unique()
  const snapshot = await readPendingSnapshot(ctx, occurrence)
  if (
    !isNativeActionOccurrence({
      context: snapshot?.applicationContext ?? null,
      rootCommandType: rootReceipt?.commandType ?? null
    })
  )
    return null
  if (occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
    throw new Error('The action occurrence scope is invalid.')
  // An area answer resumes the one creature's save whose request it names, under the area's root.
  const area =
    snapshot && occurrence.state === 'PENDING' && areaActionPendingContext(snapshot)
      ? await readNativeAreaActionPending(ctx, occurrence)
      : null
  const { resolution: answer } = response
  // A Legendary Resistance decision names its creature, an open push pick (D157) takes only its own
  // destination, and every other area answer names a save's request.
  const areaPick = area?.context.forcedMovement?.pick
  const areaSave = area
    ? area.targets.find((target) =>
        areaPick
          ? answer.kind === 'FORCED_MOVEMENT' &&
            answer.requestId === areaPick.requestId &&
            target.actorId === areaPick.targetActorId
          : answer.kind === 'AREA_LEGENDARY_RESISTANCE'
            ? target.actorId === answer.actorId
            : answer.kind !== 'FORCED_MOVEMENT' &&
              'requestId' in answer &&
              target.snapshot.request.requestId === answer.requestId
      )
    : null
  if (area && !areaSave) rejectDomain('DECISION_NOT_PENDING')
  const pending = areaSave
    ? { command: area!.command, context: areaSave.context, snapshot: areaSave.snapshot }
    : occurrence.state === 'PENDING'
      ? await readNativeActionPending(ctx, occurrence)
      : null
  // A contested escape resumes through the contest path, never an action's.
  let parsed = pending?.command.type === 'RESOLVE_ACTION' ? pending.command : undefined
  if (!parsed) {
    if (rootReceipt?.commandType !== 'RESOLVE_ACTION')
      throw new Error('Stored Encounter action root mismatch.')
    const root = encounterExecuteInputSchema.parse({
      command: JSON.parse(rootReceipt.commandJson)
    }).command
    if (root.type !== 'RESOLVE_ACTION') throw new Error('Stored Encounter action root mismatch.')
    parsed = root
  }
  const initiator = pending?.context.initiatorUserId ?? rootReceipt!.actorUserId
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (
    pending &&
    !(areaSave
      ? await canControlEvidenceRoller(ctx, {
          run,
          campaign,
          membership,
          rollerActorId: areaPick ? area!.context.casterActorId : areaSave.context.rollerActorId
        })
      : await canAnswerNativeActionEvidence(ctx, { run, campaign, membership, occurrence }))
  )
    rejectDomain('NOT_ACTOR_CONTROLLER')
  const fingerprint = checksumCanonicalJson(response)
  const receipt = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', response.commandId)
    )
    .unique()
  if (receipt) {
    const { _id, _creationTime, ...stored } = receipt
    encounterStoredRuleReceiptSchema.parse(stored)
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (
      metadata.transition !== 'ACTION_EVIDENCE' ||
      metadata.rootCommandId !== parsed.commandId ||
      metadata.rootCommandFingerprint !== checksumCanonicalJson(parsed) ||
      metadata.rootInitiatorUserId !== initiator ||
      metadata.expectedAggregateVersion !== response.expectedVersion ||
      metadata.expectedOccurrenceVersion !== response.expectedOccurrenceVersion ||
      ('requestId' in answer && metadata.requestId !== answer.requestId) ||
      metadata.resolutionKind !== response.resolution.kind ||
      receipt.campaignId !== run.campaignId ||
      receipt.encounterId !== run.id ||
      receipt.occurrenceId !== occurrence.id ||
      receipt.commandType !== response.type ||
      receipt.commandFingerprint !== fingerprint ||
      receipt.actorUserId !== userId ||
      receipt.correlationId !== (response.correlationId ?? null) ||
      receipt.resultChecksum !== checksumRuleDocument(payload) ||
      payload.occurrenceId !== occurrence.id ||
      payload.occurrenceVersion !== response.expectedOccurrenceVersion + 1 ||
      payload.occurrenceVersion > occurrence.version ||
      (payload.status !== 'PAUSED' &&
        payload.status !== 'COMPLETE' &&
        payload.status !== 'AGGREGATE_CHOICE_COMPLETE') ||
      receipt.encounterVersion !== response.expectedVersion + (payload.status === 'PAUSED' ? 0 : 1)
    )
      throw new Error('Stored Encounter action evidence receipt mismatch.')
    const admission = await readNativeEncounterActionAdmission(ctx, parsed, userId, {
      occurrence,
      initiatorUserId: initiator
    })
    if (pending) {
      if (admission.kind !== 'READY')
        throw new Error('Stored Encounter action evidence receipt mismatch.')
      return {
        kind: 'REPLAY' as const,
        admission,
        result: await nativeActionPendingResult(ctx, run, occurrence)
      }
    }
    if (admission.kind !== 'REPLAY')
      throw new Error('Stored Encounter action evidence receipt mismatch.')
    return { kind: 'REPLAY' as const, admission, result: admission.result }
  }
  if (
    !pending ||
    occurrence.version !== response.expectedOccurrenceVersion ||
    run.version !== response.expectedVersion ||
    occurrence.expectedEncounterVersion !== run.version
  )
    rejectDomain('VERSION_STALE', 'The action occurrence version is stale.')
  if (areaPick) {
    if (
      answer.kind !== 'FORCED_MOVEMENT' ||
      !areaPick.positions.some(({ x, y }) => x === answer.position.x && y === answer.position.y)
    )
      rejectDomain('VERSION_STALE', 'The forced-movement destination is not on offer.')
  } else if (answer.kind === 'AREA_LEGENDARY_RESISTANCE') {
    // Only a creature whose failed save offered a choice, not yet decided, can answer it.
    const offer = areaSave?.legendaryResistance
    if (!offer || offer.decision) rejectDomain('DECISION_NOT_PENDING')
    if (answer.decision.kind === 'USE' && answer.decision.optionId !== offer.resistance.useOptionId)
      rejectDomain('VERSION_STALE', 'The Legendary Resistance option is stale.')
  } else if (areaSave?.testedJson !== undefined) rejectDomain('DECISION_NOT_PENDING')
  else {
    // A single-target action holding a creature's Legendary Resistance or reaction offer takes only
    // its answer.
    const offeredOptionIds = areaSave ? [] : offeredDecisionOptionIds(pending.context)
    if (answer.kind === 'DECLINE' || answer.kind === 'OPTION') {
      if (!offeredOptionIds.length) rejectDomain('DECISION_NOT_PENDING')
      if (answer.kind === 'OPTION' && !offeredOptionIds.includes(answer.optionId))
        rejectDomain(
          'VERSION_STALE',
          `The decision option ${answer.optionId} is not offered by this pause.`
        )
    } else if (offeredOptionIds.length) rejectDomain('DECISION_NOT_PENDING')
  }
  if (response.commandId === parsed.commandId || rootReceipt) rejectDomain('COMMAND_ID_REUSED')
  const used = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', response.commandId)
    )
    .unique()
  if (used) rejectDomain('COMMAND_ID_REUSED')
  const root = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('rootCommandId', response.commandId)
    )
    .unique()
  if (root) rejectDomain('COMMAND_ID_REUSED')
  const appRoll = await readEncounterSettledAppRoll(ctx, { occurrence, response, userId })
  const resolution = withEncounterAppRoll(response.resolution, appRoll)
  if (
    resolution.kind !== 'ENTER_DICE' &&
    resolution.kind !== 'ENTER_INTEGER' &&
    resolution.kind !== 'SYSTEM_ROLL' &&
    resolution.kind !== 'AREA_LEGENDARY_RESISTANCE' &&
    resolution.kind !== 'DECLINE' &&
    resolution.kind !== 'OPTION' &&
    resolution.kind !== 'FORCED_MOVEMENT' &&
    resolution.kind !== 'D20_WINDOW_USE' &&
    resolution.kind !== 'D20_WINDOW_DECLINE'
  )
    throw new Error('The action requires dice, integer, a decision, a destination or a d20 window.')
  const admission = await readNativeEncounterActionAdmission(ctx, parsed, userId, {
    occurrence,
    initiatorUserId: initiator
  })
  if (admission.kind !== 'READY')
    rejectDomain('VERSION_STALE', 'The action occurrence is no longer pending.')
  return {
    kind: 'READY' as const,
    admission,
    occurrence,
    pending,
    area: area ? { snapshot: area.snapshot, actorId: areaSave!.actorId } : null,
    resolution,
    appRoll
  }
}
