import { v } from 'convex/values'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  advanceCampaignClockInputSchema,
  campaignClockDtoSchema,
  campaignClockRecoveryPromptDtoSchema,
  configureCampaignClockInputSchema,
  dismissCampaignClockRecoveryPromptInputSchema,
  initializeCampaignClockInputSchema,
  pauseCampaignClockInputSchema,
  reconcileCampaignClockInputSchema,
  resetCampaignClockInputSchema,
  rewindCampaignClockInputSchema,
  startCampaignClockInputSchema,
  type AdvanceCampaignClockInput,
  type ConfigureCampaignClockInput,
  type InitializeCampaignClockInput,
  type PauseCampaignClockInput,
  type ReconcileCampaignClockInput,
  type ResetCampaignClockInput,
  type RewindCampaignClockInput,
  type StartCampaignClockInput,
  type CampaignClockDto,
  type CampaignClockRecoveryPromptDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { campaignIdInputSchema } from '@artificer-toolkit/schema/api/campaignCore'
import * as zMini from 'zod/mini'
import { campaignStoredCommandSchema } from '@artificer-toolkit/schema/projections/campaignSessionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  absoluteMinute,
  deriveClock,
  latestBoundaryOccurrences,
  splitAbsoluteMinute
} from '@artificer-toolkit/rules-runtime/campaignClock'
import type { MutationCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { closeOpenClockSegment, openClockSegment } from './clockSegments'
import { internal } from '../_generated/api'

type ClockInput =
  | InitializeCampaignClockInput
  | ConfigureCampaignClockInput
  | StartCampaignClockInput
  | PauseCampaignClockInput
  | AdvanceCampaignClockInput
  | RewindCampaignClockInput
  | ResetCampaignClockInput
  | ReconcileCampaignClockInput

type ClockCommandType =
  | 'INITIALIZE_CLOCK'
  | 'CONFIGURE_CLOCK'
  | 'START_CLOCK'
  | 'PAUSE_CLOCK'
  | 'ADVANCE_CLOCK'
  | 'REWIND_CLOCK'
  | 'RESET_CLOCK'
  | 'RECONCILE_CLOCK'

function now() {
  return new Date().toISOString()
}

function toClockDto(clock: CampaignClockDto): CampaignClockDto {
  return campaignClockDtoSchema.parse({
    campaignId: clock.campaignId,
    day: clock.day,
    minuteOfDay: clock.minuteOfDay,
    running: clock.running,
    runningSince: clock.runningSince,
    dawnMinute: clock.dawnMinute,
    duskMinute: clock.duskMinute,
    processedBoundaryAbsoluteMinute: clock.processedBoundaryAbsoluteMinute,
    pausedForCombat: clock.pausedForCombat,
    version: clock.version,
    updatedAt: clock.updatedAt
  })
}

function toAbsoluteMinute(day: number, minuteOfDay: number): number {
  const absolute = absoluteMinute(day, minuteOfDay)
  if (!Number.isSafeInteger(absolute) || absolute < 0)
    throw new Error('Campaign clock exceeds supported time bounds.')
  return absolute
}

function assertClockBounds(clock: CampaignClockDto): CampaignClockDto {
  toAbsoluteMinute(clock.day, clock.minuteOfDay)
  if (
    !Number.isSafeInteger(clock.processedBoundaryAbsoluteMinute) ||
    clock.processedBoundaryAbsoluteMinute < -1
  )
    throw new Error('Campaign clock recovery watermark exceeds supported time bounds.')
  return clock
}

async function requireClockOwner(ctx: MutationCtx, campaignId: string, userId: string) {
  const authority = await requireCampaignAuthority(ctx, campaignId, userId)
  if (authority.membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
  if (authority.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  return authority.campaign
}

async function readClock(ctx: MutationCtx, campaignId: string) {
  return ctx.db
    .query('campaignClocks')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
}

async function rotateSegment(
  ctx: MutationCtx,
  clock: CampaignClockDto,
  targetAbsoluteMinute: number,
  at: string
) {
  if (!clock.running) return
  await closeOpenClockSegment(
    ctx.db,
    clock.campaignId,
    toAbsoluteMinute(clock.day, clock.minuteOfDay),
    at
  )
  await openClockSegment(ctx.db, clock.campaignId, targetAbsoluteMinute, at)
}

async function advanceDerivedClock(
  ctx: MutationCtx,
  clock: CampaignClockDto,
  targetAbsolute: number,
  actorUserId: string,
  at: string
) {
  if (!Number.isSafeInteger(targetAbsolute) || targetAbsolute < 0)
    throw new Error('Campaign clock exceeds supported time bounds.')
  if (clock.processedBoundaryAbsoluteMinute === Number.MAX_SAFE_INTEGER)
    throw new Error('Campaign clock recovery watermark exceeds supported time bounds.')
  for (const { absolute, kind } of latestBoundaryOccurrences(
    clock.processedBoundaryAbsoluteMinute + 1,
    targetAbsolute,
    clock.dawnMinute,
    clock.duskMinute
  ))
    await ctx.runMutation(internal.campaigns.clockRecovery.recover, {
      campaignId: clock.campaignId,
      actorUserId,
      absolute,
      kind,
      occurredAt: at
    })
  await ctx.runMutation(internal.campaigns.clockGrantExpiry.endExpired, {
    campaignId: clock.campaignId,
    actorUserId,
    clockMinute: targetAbsolute
  })
  return {
    ...clock,
    ...splitAbsoluteMinute(targetAbsolute),
    processedBoundaryAbsoluteMinute: Math.max(clock.processedBoundaryAbsoluteMinute, targetAbsolute)
  }
}

async function runClockCommand(
  ctx: MutationCtx,
  userId: string,
  input: ClockInput,
  commandType: ClockCommandType,
  apply: (clock: CampaignClockDto | null, at: string) => Promise<CampaignClockDto>
) {
  const campaign = await requireClockOwner(ctx, input.campaignId, userId)
  const commandId = input.commandId.toLowerCase()
  const inputFingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('campaignCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', commandId)
    )
    .unique()
  if (prior) {
    if (prior.commandType !== commandType || prior.inputFingerprint !== inputFingerprint)
      throw new Error('This command ID was already used with different input.')
    return campaignClockDtoSchema.parse(prior.resultPayload)
  }
  const existingRecord = await readClock(ctx, campaign.id)
  const existing = existingRecord ? assertClockBounds(toClockDto(existingRecord)) : null
  if (input.expectedVersion !== (existing?.version ?? 0))
    throw new Error('Campaign clock changed before this command completed.')
  const at = now()
  const next = await apply(existing, at)
  const saved = campaignClockDtoSchema.parse({
    ...next,
    campaignId: campaign.id,
    version: existing ? existing.version + 1 : next.version,
    updatedAt: at
  })
  if (existingRecord) await ctx.db.patch(existingRecord._id, saved)
  else await ctx.db.insert('campaignClocks', saved)
  await ctx.db.insert(
    'campaignCommands',
    campaignStoredCommandSchema.parse({
      campaignId: campaign.id,
      commandId,
      commandType,
      inputFingerprint,
      correctionReason: 'correctionReason' in input ? input.correctionReason : null,
      resultPayload: saved,
      createdAt: at
    })
  )
  return campaignClockDtoSchema.parse(saved)
}

export const get = query({
  args: zodToConvexFields(campaignIdInputSchema.shape),
  returns: zodToConvex(zMini.nullable(campaignClockDtoSchema)),
  handler: async (ctx, args) => {
    const { campaignId } = campaignIdInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, campaignId, userId)
    const clock = await ctx.db
      .query('campaignClocks')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    if (!clock) return null
    return assertClockBounds(deriveClock(assertClockBounds(toClockDto(clock)), now()).clock)
  }
})

export const recoveryPrompts = query({
  args: zodToConvexFields(campaignIdInputSchema.shape),
  returns: zodToConvex(zMini.array(campaignClockRecoveryPromptDtoSchema)),
  handler: async (ctx, args) => {
    const { campaignId } = campaignIdInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, campaignId, userId)
    if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    const assignedCharacterIds = new Set(
      (
        await ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
          .collect()
      ).map((assignment) => assignment.characterId)
    )
    const prompts: CampaignClockRecoveryPromptDto[] = []
    for await (const prompt of ctx.db
      .query('campaignClockRecoveryPrompts')
      .withIndex('by_campaignId_boundary_character_kind', (q) => q.eq('campaignId', campaign.id))) {
      if (!assignedCharacterIds.has(prompt.characterId)) continue
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', prompt.characterId))
        .unique()
      if (!character) continue
      prompts.push(
        campaignClockRecoveryPromptDtoSchema.parse({
          id: prompt.id,
          campaignId: prompt.campaignId,
          characterId: prompt.characterId,
          characterName: character.label,
          boundaryAbsoluteMinute: prompt.boundaryAbsoluteMinute,
          boundaryKind: prompt.boundaryKind,
          createdAt: prompt.createdAt
        })
      )
    }
    return prompts.sort(
      (left, right) =>
        left.boundaryAbsoluteMinute - right.boundaryAbsoluteMinute ||
        left.characterName.localeCompare(right.characterName)
    )
  }
})

export const dismissRecoveryPrompt = mutation({
  args: zodToConvexFields(dismissCampaignClockRecoveryPromptInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = dismissCampaignClockRecoveryPromptInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const campaign = await requireClockOwner(ctx, input.campaignId, userId)
    const prompt = await ctx.db
      .query('campaignClockRecoveryPrompts')
      .withIndex('by_campaignId_id', (q) =>
        q.eq('campaignId', campaign.id).eq('id', input.promptId)
      )
      .unique()
    if (prompt) await ctx.db.delete(prompt._id)
    return null
  }
})

export const initialize = mutation({
  args: zodToConvexFields(initializeCampaignClockInputSchema.shape),
  returns: zodToConvex(campaignClockDtoSchema),
  handler: async (ctx, args) => {
    const input = initializeCampaignClockInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return runClockCommand(ctx, userId, input, 'INITIALIZE_CLOCK', async (existing, at) => {
      if (existing) throw new Error('Campaign clock is already initialized.')
      return {
        campaignId: input.campaignId,
        day: input.day,
        minuteOfDay: input.minuteOfDay,
        running: false,
        runningSince: null,
        dawnMinute: input.dawnMinute,
        duskMinute: input.duskMinute,
        processedBoundaryAbsoluteMinute: toAbsoluteMinute(input.day, input.minuteOfDay),
        pausedForCombat: false,
        version: 0,
        updatedAt: at
      }
    })
  }
})

export const configure = mutation({
  args: zodToConvexFields(configureCampaignClockInputSchema.shape),
  returns: zodToConvex(campaignClockDtoSchema),
  handler: async (ctx, args) => {
    const input = configureCampaignClockInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return runClockCommand(ctx, userId, input, 'CONFIGURE_CLOCK', async (existing, at) => {
      if (!existing) throw new Error('Campaign clock is not initialized.')
      const derived = deriveClock(existing, at).clock
      const target = toAbsoluteMinute(derived.day, derived.minuteOfDay)
      await rotateSegment(ctx, derived, target, at)
      return advanceDerivedClock(
        ctx,
        {
          ...derived,
          dawnMinute: input.dawnMinute,
          duskMinute: input.duskMinute
        },
        target,
        userId,
        at
      )
    })
  }
})

export const start = mutation({
  args: zodToConvexFields(startCampaignClockInputSchema.shape),
  returns: zodToConvex(campaignClockDtoSchema),
  handler: async (ctx, args) => {
    const input = startCampaignClockInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return runClockCommand(ctx, userId, input, 'START_CLOCK', async (existing, at) => {
      if (!existing) throw new Error('Campaign clock is not initialized.')
      if (existing.running) throw new Error('Campaign clock is already running.')
      await openClockSegment(
        ctx.db,
        existing.campaignId,
        toAbsoluteMinute(existing.day, existing.minuteOfDay),
        at
      )
      return { ...existing, running: true, runningSince: at, pausedForCombat: false }
    })
  }
})

export const pause = mutation({
  args: zodToConvexFields(pauseCampaignClockInputSchema.shape),
  returns: zodToConvex(campaignClockDtoSchema),
  handler: async (ctx, args) => {
    const input = pauseCampaignClockInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return runClockCommand(ctx, userId, input, 'PAUSE_CLOCK', async (existing, at) => {
      if (!existing) throw new Error('Campaign clock is not initialized.')
      if (!existing.running) return { ...existing, pausedForCombat: false }
      const derived = deriveClock(existing, at).clock
      const target = toAbsoluteMinute(derived.day, derived.minuteOfDay)
      await closeOpenClockSegment(ctx.db, existing.campaignId, target, at)
      const advanced = await advanceDerivedClock(ctx, derived, target, userId, at)
      return { ...advanced, running: false, runningSince: null, pausedForCombat: false }
    })
  }
})

export const advance = mutation({
  args: zodToConvexFields(advanceCampaignClockInputSchema.shape),
  returns: zodToConvex(campaignClockDtoSchema),
  handler: async (ctx, args) => {
    const input = advanceCampaignClockInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return runClockCommand(ctx, userId, input, 'ADVANCE_CLOCK', async (existing, at) => {
      if (!existing) throw new Error('Campaign clock is not initialized.')
      const derived = deriveClock(existing, at).clock
      const target = toAbsoluteMinute(derived.day, derived.minuteOfDay) + input.minutes
      if (!Number.isSafeInteger(target) || target < 0)
        throw new Error('Campaign clock exceeds supported time bounds.')
      await rotateSegment(ctx, derived, target, at)
      return advanceDerivedClock(ctx, derived, target, userId, at)
    })
  }
})

export const rewind = mutation({
  args: zodToConvexFields(rewindCampaignClockInputSchema.shape),
  returns: zodToConvex(campaignClockDtoSchema),
  handler: async (ctx, args) => {
    const input = rewindCampaignClockInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return runClockCommand(ctx, userId, input, 'REWIND_CLOCK', async (existing, at) => {
      if (!existing) throw new Error('Campaign clock is not initialized.')
      const derived = deriveClock(existing, at).clock
      const target = toAbsoluteMinute(derived.day, derived.minuteOfDay) - input.minutes
      if (!Number.isSafeInteger(target) || target < 0)
        throw new Error('Campaign time cannot move before Day 1 · 00:00.')
      await rotateSegment(ctx, derived, target, at)
      return { ...derived, ...splitAbsoluteMinute(target) }
    })
  }
})

export const reset = mutation({
  args: zodToConvexFields(resetCampaignClockInputSchema.shape),
  returns: zodToConvex(campaignClockDtoSchema),
  handler: async (ctx, args) => {
    const input = resetCampaignClockInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return runClockCommand(ctx, userId, input, 'RESET_CLOCK', async (existing, at) => {
      if (!existing) throw new Error('Campaign clock is not initialized.')
      const derived = deriveClock(existing, at).clock
      const current = toAbsoluteMinute(derived.day, derived.minuteOfDay)
      const target = toAbsoluteMinute(input.day, input.minuteOfDay)
      await rotateSegment(ctx, derived, target, at)
      if (target >= current) return advanceDerivedClock(ctx, derived, target, userId, at)
      return {
        ...derived,
        day: input.day,
        minuteOfDay: input.minuteOfDay,
        processedBoundaryAbsoluteMinute: Math.max(derived.processedBoundaryAbsoluteMinute, target)
      }
    })
  }
})

export const reconcile = mutation({
  args: zodToConvexFields(reconcileCampaignClockInputSchema.shape),
  returns: zodToConvex(campaignClockDtoSchema),
  handler: async (ctx, args) => {
    const input = reconcileCampaignClockInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    return runClockCommand(ctx, userId, input, 'RECONCILE_CLOCK', async (existing, at) => {
      if (!existing) throw new Error('Campaign clock is not initialized.')
      const derived = deriveClock(existing, at).clock
      const target = toAbsoluteMinute(derived.day, derived.minuteOfDay)
      await rotateSegment(ctx, derived, target, at)
      return advanceDerivedClock(ctx, derived, target, userId, at)
    })
  }
})
