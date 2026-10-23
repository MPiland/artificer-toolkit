import {
  encounterCommandResultDtoSchema,
  encounterEvidenceRollDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto,
  type EncounterCommandResultDto,
  type EncounterEvidenceRollDto,
  type EncounterSettledAppRollDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  EncounterD20RollModeDto,
  ResolveRuleOccurrenceInputDto,
  RollRuleEvidenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { contestCheckD20Request } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  encounterStoredEvidenceRollSchema,
  type EncounterStoredEvidenceRoll
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { rollModeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { rollModeKeptFace } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { withAddedDiceTerms } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { rejectDomain } from './domainRejections.js'
import { readRunActor, readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingRunDecision } from './pendingReads.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { readAreaTargetPerceivedByCaster } from './actionAreaPending.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import { asHiddenRoller, recordRuleRollCard, rollerAsPerceivedByCaster } from './ruleRollCards.js'
import { requireUnusedEvidenceCommandId } from './timelineEntries.js'
import type { EncounterDocument } from './store.js'
import type {
  CampaignAuthority,
  EncounterReadTransaction,
  EncounterWriteTransaction
} from './ports.js'

/** Dice the table roll log can show; other integer ranges are recorded without a log entry. */
export const LOGGED_DICE = new Set([4, 6, 8, 10, 12, 20, 100])

function presentEvidenceRoll(roll: EncounterStoredEvidenceRoll): EncounterEvidenceRollDto {
  return encounterEvidenceRollDtoSchema.parse({
    rollId: roll.id,
    occurrenceId: roll.occurrenceId,
    occurrenceVersion: roll.occurrenceVersion,
    requestId: roll.requestId,
    attempt: roll.attempt,
    faces: roll.faces,
    value: roll.value,
    rollMode: roll.rollMode,
    keep: roll.keep,
    derivedRollMode: roll.derivedRollMode,
    ...(roll.addedFaces ? { addedFaces: roll.addedFaces } : {})
  })
}

function readStoredRoll(row: EncounterDocument<'encounterEvidenceRolls'>) {
  const { _id, _creationTime, ...stored } = row
  return encounterStoredEvidenceRollSchema.parse(stored)
}

export async function readLatestAttempt(
  ctx: EncounterReadTransaction,
  input: { occurrenceId: string; occurrenceVersion: number; requestId: string; userId: string }
) {
  return ctx.db
    .query('encounterEvidenceRolls')
    .withIndex('by_occurrenceId_version_requestId_userId', (q) =>
      q
        .eq('occurrenceId', input.occurrenceId)
        .eq('occurrenceVersion', input.occurrenceVersion)
        .eq('requestId', input.requestId)
        .eq('userId', input.userId)
    )
    .order('desc')
    .first()
}

/**
 * The dice requests a pending decision asks its viewer to roll, each with whoever rolls it. An area
 * asks one per creature's save, rolled by that creature; any other decision asks at most one.
 */
function pendingEvidenceRequests(pending: PendingEncounterRuleOccurrenceSummaryDto) {
  if (pending.kind === 'AREA_SAVES')
    return pending.saves.map((save) => ({ request: save.request, rollerActorId: save.actorId }))
  // A contest check is one d20 whichever check the roller picks; the app rolls in that check's
  // mode, so the first check's mode is only the default.
  if (pending.kind === 'CONTEST_CHECK') {
    const [check] = pending.checks
    return check
      ? [{ request: contestCheckD20Request(pending, check), rollerActorId: pending.rollerActorId }]
      : []
  }
  return 'request' in pending
    ? [
        {
          request: pending.request,
          rollerActorId: 'rollerActorId' in pending ? pending.rollerActorId : null
        }
      ]
    : []
}

/** Whether the pending occurrence is a concealment check (Hide, Search), whose roll no table sees. */
async function isConcealmentCheck(ctx: EncounterReadTransaction, occurrenceId: string) {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
    .unique()
  const snapshot =
    occurrence?.state === 'PENDING' ? await readPendingSnapshot(ctx, occurrence) : null
  return snapshot?.applicationContext.kind === 'ENCOUNTER_CONCEALMENT_CHECK'
}

/**
 * Admits one "Roll dice" (ADR 0034 decision 3): only a member who may answer the request (it is in
 * their pending decision) can roll it. A repeated command id is its stored attempt (`REPLAY`).
 */
async function admitEvidenceRoll(
  ctx: EncounterReadTransaction,
  command: RollRuleEvidenceInputDto,
  userId: string
) {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    occurrenceId: command.occurrenceId.toLowerCase()
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const authority = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  const { campaign, membership } = authority
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterEvidenceRolls')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (prior.userId !== userId || prior.commandFingerprint !== fingerprint)
      rejectDomain('COMMAND_ID_REUSED')
    return {
      kind: 'REPLAY' as const,
      result: await presentEncounterResultForMember(ctx, {
        campaign,
        membership,
        result: encounterCommandResultDtoSchema.parse({
          projection: await readEncounterGmProjection(ctx, readRunState(run)),
          roll: null,
          evidenceRoll: presentEvidenceRoll(readStoredRoll(prior))
        })
      })
    }
  }
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const usedCommand = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (usedCommand) rejectDomain('COMMAND_ID_REUSED')
  if (run.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  // The member's own pending decision is both what they may see and what they may answer.
  const pending = await readPendingRunDecision(ctx, run, campaign, membership)
  if (pending?.occurrenceId !== input.occurrenceId) rejectDomain('DECISION_NOT_PENDING')
  if (pending.occurrenceVersion !== input.expectedOccurrenceVersion)
    rejectDomain('VERSION_STALE', 'This decision changed; review it and roll again.')
  const answered = pendingEvidenceRequests(pending).find(
    ({ request }) => request.requestId === input.requestId
  )
  if (!answered) rejectDomain('DECISION_NOT_PENDING')
  const { request, rollerActorId } = answered
  const derivedRollMode: EncounterD20RollModeDto | null =
    'rollMode' in request ? request.rollMode : null
  if (!derivedRollMode && input.rollMode !== null)
    throw new Error('Only a d20 roll takes a roll mode.')
  const rollMode = derivedRollMode ? (input.rollMode ?? derivedRollMode) : null
  const keep = rollMode
    ? rollModeCapabilityRegistry.rollModeKeep({ gameSystemId: campaign.gameSystemId, rollMode })
    : null
  // A held d20 is completed by exactly one more die; the server settles the true mode from it.
  if ('heldD20' in request && request.heldD20 && keep !== 'FIRST')
    throw new Error('A held d20 takes one Normal die.')
  return {
    kind: 'ROLL' as const,
    input,
    run,
    authority,
    fingerprint,
    pending,
    request,
    rollerActorId,
    derivedRollMode,
    rollMode,
    keep,
    die: request.min === 1 && LOGGED_DICE.has(request.max) ? request.max : null
  }
}

/**
 * Records one "Roll dice" with the room's draws (`nextInt`, D41), the request's added dice (D156)
 * included, and posts it to the table roll log. It settles nothing; rerolls are further attempts.
 */
export async function rollEncounterRuleEvidence(
  ctx: EncounterWriteTransaction,
  command: RollRuleEvidenceInputDto,
  userId: string,
  nextInt: (size: number) => number
): Promise<EncounterCommandResultDto> {
  const admitted = await admitEvidenceRoll(ctx, command, userId)
  if (admitted.kind === 'REPLAY') return admitted.result
  const { input, run, authority, fingerprint, pending, derivedRollMode, rollMode, keep, die } =
    admitted
  const { campaign, membership } = authority
  const evaluated = die
    ? evaluateRollExpression(
        parseRollExpression(`1d${die}`),
        { nextInt },
        rollMode
          ? rollModeCapabilityRegistry.d20Roll({ gameSystemId: campaign.gameSystemId, rollMode })
          : undefined
      )
    : null
  const faces = evaluated
    ? evaluated.evidence.terms[0]!.rolls
    : [admitted.request.min + nextInt(admitted.request.max - admitted.request.min + 1)]
  const value = keep ? rollModeKeptFace(keep, faces) : faces[0]!
  const addedDice = ('addedDice' in admitted.request ? (admitted.request.addedDice ?? []) : []).map(
    (die) => ({
      ...die,
      rolledFaces: Array.from({ length: die.count }, () => nextInt(die.faces) + 1)
    })
  )
  const addedFaces = addedDice.flatMap(({ rolledFaces }) => rolledFaces)
  const latest = await readLatestAttempt(ctx, {
    occurrenceId: input.occurrenceId,
    occurrenceVersion: pending.occurrenceVersion,
    requestId: input.requestId,
    userId
  })
  const now = new Date().toISOString()
  const roll = encounterStoredEvidenceRollSchema.parse({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    encounterId: run.id,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: pending.occurrenceVersion,
    requestId: input.requestId,
    userId,
    commandId: input.commandId,
    commandFingerprint: fingerprint,
    attempt: (latest?.attempt ?? 0) + 1,
    faces,
    value,
    rollMode,
    keep,
    derivedRollMode,
    ...(addedFaces.length > 0 ? { addedFaces } : {}),
    createdAt: now
  })
  await ctx.db.insert('encounterEvidenceRolls', roll)
  // Every attempt gets a card: the table's, or the GM's private history for a hidden or private
  // GM roll (Q14, D62).
  const state = readRunState(run)
  const roller = admitted.rollerActorId
    ? await readRunActor(ctx, state, admitted.rollerActorId)
    : null
  let tableRoll: RollRecordDto | null = null
  if (evaluated) {
    const system = await ctx.ports.requireSystem(campaign.gameSystemId)
    const modeLabel = (mode: string) =>
      rollModeCapabilityRegistry.d20Roll({ gameSystemId: campaign.gameSystemId, rollMode: mode })
        .label
    const override =
      rollMode && derivedRollMode && rollMode !== derivedRollMode
        ? `${modeLabel(rollMode)}, changed from ${modeLabel(derivedRollMode)}`
        : rollMode && keep !== 'FIRST'
          ? modeLabel(rollMode)
          : null
    tableRoll = rollRecordDtoSchema.parse({
      id: roll.id,
      characterId: null,
      characterLabel: roller?.label ?? 'Encounter',
      source: {
        kind: 'MANUAL',
        label: [`Rolled by the app, attempt ${roll.attempt}`, override]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 80)
      },
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      ...withAddedDiceTerms(evaluated, addedDice),
      createdAt: now
    })
    const card = await recordRuleRollCard(ctx, {
      campaign,
      encounterId: run.id,
      roller:
        roller &&
        ((await isConcealmentCheck(ctx, input.occurrenceId))
          ? asHiddenRoller(roller)
          : rollerAsPerceivedByCaster(
              roller,
              await readAreaTargetPerceivedByCaster(ctx, input.occurrenceId, roller.id)
            )),
      initiatorUserId: userId,
      visibility: input.visibility,
      clientNonce: input.commandId,
      roll: tableRoll
    })
    // A private card is the GM's and, for a hidden creature a player controls, that player's own;
    // no other answer carries it back.
    if (
      card.audience === 'PRIVATE' &&
      userId !== campaign.ownerUserId &&
      userId !== card.playerCopyUserId
    )
      tableRoll = null
  }
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: encounterCommandResultDtoSchema.parse({
      projection: await readEncounterGmProjection(ctx, state),
      roll: tableRoll,
      occurrence: {
        occurrenceId: pending.occurrenceId,
        occurrenceVersion: pending.occurrenceVersion,
        status: 'PENDING',
        pending
      },
      evidenceRoll: presentEvidenceRoll(roll)
    })
  })
}

/**
 * The recorded faces a `SYSTEM_ROLL` answer, or a contest check rolled in the app, settles with. The
 * roll must be the responder's latest attempt for this exact request, so a client can neither
 * invent faces nor reuse another roll.
 */
export async function readEncounterSettledAppRoll(
  ctx: EncounterReadTransaction,
  input: {
    occurrence: EncounterDocument<'encounterRuleOccurrences'>
    response: ResolveRuleOccurrenceInputDto
    userId: string
  }
): Promise<EncounterSettledAppRollDto | null> {
  const resolution =
    input.response.resolution.kind === 'CONTEST_CHECK'
      ? input.response.resolution.roll
      : input.response.resolution
  if (resolution.kind !== 'SYSTEM_ROLL') return null
  const rollId = resolution.rollId.toLowerCase()
  const row = await ctx.db
    .query('encounterEvidenceRolls')
    .withIndex('by_publicId', (q) => q.eq('id', rollId))
    .unique()
  const latest = row
    ? await readLatestAttempt(ctx, {
        occurrenceId: input.occurrence.id,
        occurrenceVersion: input.occurrence.version,
        requestId: resolution.requestId,
        userId: input.userId
      })
    : null
  if (
    !row ||
    row.campaignId !== input.occurrence.campaignId ||
    row.occurrenceId !== input.occurrence.id ||
    row.occurrenceVersion !== input.occurrence.version ||
    row.requestId !== resolution.requestId ||
    row.userId !== input.userId ||
    latest?._id !== row._id
  )
    rejectDomain('ROLL_UNAVAILABLE')
  const roll = readStoredRoll(row)
  return {
    rollId: roll.id,
    faces: roll.faces,
    rollMode: roll.rollMode,
    keep: roll.keep,
    ...(roll.addedFaces ? { addedFaces: roll.addedFaces } : {})
  }
}

/** The member's latest app roll for each request of their current pending decision. */
export async function readLatestEvidenceRolls(
  ctx: EncounterReadTransaction,
  { run, campaign, membership }: CampaignAuthority & { run: EncounterDocument<'encounterRuns'> }
): Promise<EncounterEvidenceRollDto[]> {
  const pending = await readPendingRunDecision(ctx, run, campaign, membership)
  if (!pending) return []
  const rows = await Promise.all(
    pendingEvidenceRequests(pending).map(({ request }) =>
      readLatestAttempt(ctx, {
        occurrenceId: pending.occurrenceId,
        occurrenceVersion: pending.occurrenceVersion,
        requestId: request.requestId,
        userId: membership.userId
      })
    )
  )
  return rows.flatMap((row) => (row ? [presentEvidenceRoll(readStoredRoll(row))] : []))
}
