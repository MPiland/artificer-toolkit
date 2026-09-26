import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import * as zMini from 'zod/mini'
import {
  encounterCommandResultDtoSchema,
  encounterEvidenceRollDtoSchema,
  getEncounterInputDtoSchema,
  type EncounterCommandResultDto,
  type EncounterEvidenceRollDto,
  type EncounterSettledAppRollDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  EncounterD20RollModeDto,
  ResolveRuleOccurrenceInputDto,
  RollRuleEvidenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  encounterStoredEvidenceRollSchema,
  type EncounterStoredEvidenceRoll
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { selectEncounterActionD20Natural } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import type { Doc } from '../_generated/dataModel'
import { query, type MutationCtx, type QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { insertPreEvaluatedCampaignTableRoll } from '../campaigns/tableRoll'
import { requireSystem } from '../content/systemDocuments'
import { rejectDomain } from '../lib/domainRejections'
import { requireIdentity } from '../lib/identity'
import { readRunProjection } from './documents'
import { readPendingRunDecision } from './pendingReads'
import { presentEncounterResultForMember } from './resultPresentation'
import { requireUnusedEvidenceCommandId } from './timelineEntries'

/** Dice the table roll log can show; other integer ranges are recorded without a log entry. */
const LOGGED_DICE = new Set([4, 6, 8, 10, 12, 20, 100])

const MODE_LABELS = { NORMAL: 'Normal', ADVANTAGE: 'Advantage', DISADVANTAGE: 'Disadvantage' }

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
    derivedRollMode: roll.derivedRollMode
  })
}

function readStoredRoll(row: Doc<'encounterEvidenceRolls'>) {
  const { _id, _creationTime, ...stored } = row
  return encounterStoredEvidenceRollSchema.parse(stored)
}

async function readAttempts(
  ctx: QueryCtx,
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
 * Admits one "Roll dice" (ADR 0034 decision 3): only a member who may answer the request (it is in
 * their pending decision) can roll it. A repeated command id is its stored attempt (`REPLAY`).
 */
async function admitEvidenceRoll(ctx: QueryCtx, command: RollRuleEvidenceInputDto, userId: string) {
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
  const authority = await requireCampaignAuthority(ctx, run.campaignId, userId)
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
          projection: readRunProjection(run),
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
  const request = 'request' in pending ? pending.request : null
  if (!request || request.requestId !== input.requestId) rejectDomain('DECISION_NOT_PENDING')
  const derivedRollMode: EncounterD20RollModeDto | null =
    pending.kind === 'D20_EVIDENCE' ? pending.request.rollMode : null
  if (!derivedRollMode && input.rollMode !== null)
    throw new Error('Only a d20 roll takes a roll mode.')
  const rollMode = derivedRollMode ? (input.rollMode ?? derivedRollMode) : null
  return {
    kind: 'ROLL' as const,
    input,
    run,
    authority,
    fingerprint,
    pending,
    request,
    derivedRollMode,
    rollMode,
    die: request.min === 1 && LOGGED_DICE.has(request.max) ? request.max : null
  }
}

/** The dice a "Roll dice" draws, as die sizes: none for a replay, two for a d20 with a mode. */
export async function readEvidenceRollDice(
  ctx: QueryCtx,
  command: RollRuleEvidenceInputDto,
  userId: string
): Promise<number[]> {
  const admitted = await admitEvidenceRoll(ctx, command, userId)
  if (admitted.kind === 'REPLAY') return []
  const { die, rollMode, request } = admitted
  if (!die) return [request.max - request.min + 1]
  return rollMode && rollMode !== 'NORMAL' ? [die, die] : [die]
}

/**
 * Records one "Roll dice" with the room's draws (`nextInt`, D41) and posts it to the table roll
 * log. It settles nothing; rerolls are further attempts.
 */
export async function rollEncounterRuleEvidence(
  ctx: MutationCtx,
  command: RollRuleEvidenceInputDto,
  userId: string,
  nextInt: (size: number) => number
): Promise<EncounterCommandResultDto> {
  const admitted = await admitEvidenceRoll(ctx, command, userId)
  if (admitted.kind === 'REPLAY') return admitted.result
  const { input, run, authority, fingerprint, pending, derivedRollMode, rollMode, die } = admitted
  const { campaign, membership } = authority
  const evaluated = die
    ? evaluateRollExpression(parseRollExpression(`1d${die}`), { nextInt }, rollMode ?? 'NORMAL')
    : null
  const faces = evaluated
    ? evaluated.evidence.terms[0]!.rolls
    : [admitted.request.min + nextInt(admitted.request.max - admitted.request.min + 1)]
  const value = rollMode ? selectEncounterActionD20Natural(rollMode, faces) : faces[0]!
  const latest = await readAttempts(ctx, {
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
    derivedRollMode,
    createdAt: now
  })
  await ctx.db.insert('encounterEvidenceRolls', roll)
  // Every attempt goes to the table log unless it would reveal a hidden actor.
  const projection = readRunProjection(run)
  const roller =
    'rollerActorId' in pending && pending.rollerActorId
      ? projection.actors.find((actor) => actor.id === pending.rollerActorId)
      : null
  let tableRoll: RollRecordDto | null = null
  if (evaluated && roller?.public !== false) {
    const system = await requireSystem(ctx, campaign.gameSystemId)
    const override =
      rollMode && derivedRollMode && rollMode !== derivedRollMode
        ? `${MODE_LABELS[rollMode]}, changed from ${MODE_LABELS[derivedRollMode]}`
        : rollMode && rollMode !== 'NORMAL'
          ? MODE_LABELS[rollMode]
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
      ...evaluated,
      createdAt: now
    })
    await insertPreEvaluatedCampaignTableRoll(ctx, authority, userId, input.commandId, tableRoll)
  }
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: encounterCommandResultDtoSchema.parse({
      projection,
      roll: tableRoll,
      occurrence: {
        occurrenceId: pending.occurrenceId,
        occurrenceVersion: pending.occurrenceVersion,
        status: 'PENDING',
        outcome: null,
        pending
      },
      evidenceRoll: presentEvidenceRoll(roll)
    })
  })
}

/**
 * The recorded faces a `SYSTEM_ROLL` answer settles with. The roll must be the responder's latest
 * attempt for this exact request, so a client can neither invent faces nor reuse another roll.
 */
export async function readEncounterSettledAppRoll(
  ctx: QueryCtx,
  input: {
    occurrence: Doc<'encounterRuleOccurrences'>
    response: ResolveRuleOccurrenceInputDto
    userId: string
  }
): Promise<EncounterSettledAppRollDto | null> {
  const { resolution } = input.response
  if (resolution.kind !== 'SYSTEM_ROLL') return null
  const rollId = resolution.rollId.toLowerCase()
  const row = await ctx.db
    .query('encounterEvidenceRolls')
    .withIndex('by_publicId', (q) => q.eq('id', rollId))
    .unique()
  const latest = row
    ? await readAttempts(ctx, {
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
  return { rollId: roll.id, faces: roll.faces, rollMode: roll.rollMode }
}

const latestRollsValidator: Validator<EncounterEvidenceRollDto[], 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterEvidenceRollDto[]>
>(zMini.array(encounterEvidenceRollDtoSchema))

/** The caller's latest app roll for each request of their current pending decision. */
export const latest = query({
  args: zodToConvexFields(getEncounterInputDtoSchema.shape),
  returns: latestRollsValidator,
  handler: async (ctx, args): Promise<EncounterEvidenceRollDto[]> => {
    const { userId } = await requireIdentity(ctx)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', args.encounterId.toLowerCase()))
      .unique()
    if (!run) throw new Error('Encounter is unavailable.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, run.campaignId, userId)
    const pending = await readPendingRunDecision(ctx, run, campaign, membership)
    const request = pending && 'request' in pending ? pending.request : null
    if (!pending || !request) return []
    const row = await readAttempts(ctx, {
      occurrenceId: pending.occurrenceId,
      occurrenceVersion: pending.occurrenceVersion,
      requestId: request.requestId,
      userId
    })
    return row ? [presentEvidenceRoll(readStoredRoll(row))] : []
  }
})
