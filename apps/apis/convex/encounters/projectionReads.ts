import * as zMini from 'zod/mini'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterActorSidesDtoSchema,
  encounterPreparedPendingListDtoSchema,
  getEncounterActorSidesInputDtoSchema,
  type EncounterActorSidesDto,
  encounterProjectionDtoSchema,
  getCampaignEncounterInputDtoSchema,
  getEncounterInputDtoSchema,
  encounterSummaryListDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterPreparedPendingListDto,
  type EncounterSummaryDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  presentEncounterRun,
  readEncounterActorSides,
  readEncounterPreparedPending
} from '@artificer-toolkit/encounter-persistence/sessionReads'
import { readCampaignRunState } from '@artificer-toolkit/encounter-persistence/documents'

import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { encounterReadTransaction } from './encounterReadPorts'
import { readMemberEncounter } from './readAccess'
type EncounterProjection = EncounterGmProjectionDto | EncounterPlayerProjectionDto
const encounterStatusOrder = ['ACTIVE', 'PREPARED', 'COMPLETED'] as const

export async function readActiveRun(ctx: QueryCtx, campaignId: string) {
  const rows = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaignId).eq('status', 'ACTIVE'))
    .take(2)
  if (rows.length > 1) throw new Error('Campaign has multiple active Encounters.')
  return rows[0] ?? null
}

export const get = query({
  args: zodToConvexFields(getEncounterInputDtoSchema.shape),
  // Construct large native validators during metadata export, outside query invocation.
  get returns(): Validator<EncounterProjection, 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterProjection>>(encounterProjectionDtoSchema)
  },
  handler: async (ctx, args): Promise<EncounterProjection> => {
    const input = getEncounterInputDtoSchema.parse({ encounterId: args.encounterId.toLowerCase() })
    const { run, campaign, membership } = await readMemberEncounter(ctx, input.encounterId)
    return encounterProjectionDtoSchema.parse(
      await presentEncounterRun(encounterReadTransaction(ctx), run, campaign, membership)
    )
  }
})

/**
 * The Campaign's Runs as summaries, read from each Run document alone, so the list costs one
 * document per Run whatever its actors. The GM sees every status, a player only the ACTIVE Run.
 */
export async function readRunSummaries(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  role: Doc<'campaignMemberships'>['role']
): Promise<EncounterSummaryDto[]> {
  const statuses = role === 'OWNER' ? encounterStatusOrder : (['ACTIVE'] as const)
  const rows = (
    await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query('encounterRuns')
          .withIndex('by_campaignId_status', (q) =>
            q.eq('campaignId', campaign.id).eq('status', status)
          )
          .collect()
      )
    )
  )
    .flat()
    .sort(
      (left, right) =>
        encounterStatusOrder.indexOf(left.status) - encounterStatusOrder.indexOf(right.status) ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.id.localeCompare(left.id)
    )
  return rows.map((row) => {
    const state = readCampaignRunState(row, campaign)
    return {
      id: row.id,
      name: state.name,
      status: row.status,
      round: state.round,
      actorCount: role === 'OWNER' ? state.actorIds.length : null,
      updatedAt: row.updatedAt,
      version: row.version
    }
  })
}

export const list = query({
  args: zodToConvexFields(getCampaignEncounterInputDtoSchema.shape),
  returns: zodToConvex(encounterSummaryListDtoSchema),
  handler: async (ctx, args): Promise<EncounterSummaryDto[]> => {
    const input = getCampaignEncounterInputDtoSchema.parse({
      campaignId: args.campaignId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    return encounterSummaryListDtoSchema.parse(
      await readRunSummaries(ctx, campaign, membership.role)
    )
  }
})
/** Makes a paused START discoverable without exposing other prepared Encounters. */
export const pendingPrepared = query({
  args: zodToConvexFields(getCampaignEncounterInputDtoSchema.shape),
  get returns(): Validator<EncounterPreparedPendingListDto, 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterPreparedPendingListDto>>(
      encounterPreparedPendingListDtoSchema
    )
  },
  handler: async (ctx, args): Promise<EncounterPreparedPendingListDto> => {
    const input = getCampaignEncounterInputDtoSchema.parse({
      campaignId: args.campaignId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    return encounterPreparedPendingListDtoSchema.parse(
      await readEncounterPreparedPending(encounterReadTransaction(ctx), {
        rows: await ctx.db
          .query('encounterRuns')
          .withIndex('by_campaignId_status', (q) =>
            q.eq('campaignId', campaign.id).eq('status', 'PREPARED')
          )
          .collect(),
        campaign,
        membership
      })
    )
  }
})

export const actorSides = query({
  args: zodToConvexFields(getEncounterActorSidesInputDtoSchema.shape),
  returns: zodToConvex(zMini.nullable(encounterActorSidesDtoSchema)),
  handler: async (ctx, args): Promise<EncounterActorSidesDto | null> => {
    const input = getEncounterActorSidesInputDtoSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', input.encounterId.toLowerCase()))
      .unique()
    if (!row) throw new Error('Encounter is unavailable.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
    if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    if (row.version !== input.expectedVersion) return null
    return readEncounterActorSides(encounterReadTransaction(ctx), row, campaign)
  }
})
