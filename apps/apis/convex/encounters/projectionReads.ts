import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterActorSidesDtoSchema,
  getEncounterActorSidesInputDtoSchema,
  type EncounterActorSidesDto,
  encounterProjectionDtoSchema,
  encounterProjectionListDtoSchema,
  getCampaignEncounterInputDtoSchema,
  getEncounterInputDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  healthBand,
  projectPlayerEncounterProjection
} from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import type { Doc } from '../_generated/dataModel'
import { query, type QueryCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readCharacterMaximumHitPoints } from '@artificer-toolkit/encounter-persistence/characterMaximumHitPoints'
import { loadCharacterState, readCharacterRecord } from '../characters/stateDocuments'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import {
  readCampaignCharacterState,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { requireSystem } from '../content/systemDocuments'
import { requireIdentity } from '../lib/identity'
import { getVisibleCampaignConditions } from '@artificer-toolkit/rules-runtime/character/campaignConditionVisibility'
import { characterProjectionState } from '@artificer-toolkit/encounter-persistence/characterStates'
import { readEncounterHealthViewer } from '@artificer-toolkit/encounter-persistence/healthViewer'
import {
  readRunActors,
  readRunState,
  readValidatedRunProjection
} from '@artificer-toolkit/encounter-persistence/documents'
import { encounterReadTransaction } from './encounterPorts'
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

export async function presentRun(
  ctx: QueryCtx,
  row: Doc<'encounterRuns'>,
  campaign: Doc<'campaigns'>,
  viewer: Pick<Doc<'campaignMemberships'>, 'role' | 'userId'>
): Promise<EncounterProjection> {
  const { role } = viewer
  const projection = readValidatedRunProjection(row, campaign)
  if (row.status === 'COMPLETED' && role === 'OWNER') return projection
  const system = projection.actors.some(
    (actor) =>
      (role === 'OWNER' || actor.public) &&
      (actor.kind === 'CHARACTER' ||
        (Array.isArray(actor.conditions) && actor.conditions.length > 0))
  )
    ? await requireSystem(ctx, campaign.gameSystemId)
    : null
  const actors = await Promise.all(
    projection.actors.map(async (actor) => {
      if (role === 'PLAYER' && !actor.public) return actor
      if (actor.kind !== 'CHARACTER') {
        if (!Array.isArray(actor.conditions)) return actor
        return {
          ...actor,
          conditions: actor.conditions.map(
            (condition: EncounterGmProjectionDto['actors'][number]['conditions']) => {
              const record =
                condition !== null && typeof condition === 'object' && !Array.isArray(condition)
                  ? condition
                  : null
              const conditionTypeId =
                typeof condition === 'string'
                  ? condition
                  : record && 'conditionTypeId' in record
                    ? record.conditionTypeId
                    : null
              const definition = system?.conditionTypes.find(
                (entry) => entry.id === conditionTypeId
              )
              if (!definition) return condition
              return {
                ...record,
                conditionTypeId: definition.id,
                label: definition.label,
                ...(definition.description ? { description: definition.description } : {})
              }
            }
          )
        }
      }
      const characterId = actor.sourceId
      if (!characterId) throw new Error('Stored Encounter Character actor is unavailable.')
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique()
      // Detached actors retain Run identity and last projected hit points, but grant no current
      // Sheet access or condition fallback.
      if (assignment?.campaignId !== campaign.id) return { ...actor, conditions: [] }
      await requireCampaignCharacterAuthority(ctx, campaign.id, characterId, campaign.ownerUserId)
      const { active, draft } = await loadCharacterState(ctx, characterId)
      if (!active) throw new Error('Stored Encounter Character source is unavailable.')
      if (active.userId !== assignment.userId || (draft && draft.userId !== active.userId))
        throw new Error('Stored Campaign Character assignment mismatch.')
      if (active.status !== 'ACTIVE')
        throw new Error('Character requires Builder repair before the Sheet can be read.')
      const character = readCharacterRecord(active)
      readCharacterSheetState(active)
      if (character.systemId !== campaign.gameSystemId)
        throw new Error('Stored Encounter Character System is unavailable.')
      const { state } = await readCampaignCharacterState(ctx, campaign.id, characterId)
      const current = characterProjectionState(
        {
          state: {
            ...character.state,
            conditions: [
              ...(character.state.conditions ?? []),
              ...getVisibleCampaignConditions({
                conditions: state.conditions,
                viewer: role === 'OWNER' ? 'CAMPAIGN_OWNER' : 'CHARACTER_OWNER'
              })
            ]
          }
        },
        await readCharacterMaximumHitPoints(ctx, active),
        system?.conditionTypes ?? []
      )
      return {
        ...actor,
        conditions: current.conditions,
        currentHitPoints: current.current,
        maxHitPoints: current.maximum,
        tempHitPoints: current.temporary,
        healthBand: healthBand(current.current, current.maximum)
      }
    })
  )
  const current = { ...projection, actors }
  if (role === 'OWNER') return current
  return projectPlayerEncounterProjection(
    current,
    await readEncounterHealthViewer(encounterReadTransaction(ctx), current, viewer.userId)
  )
}

export const get = query({
  args: zodToConvexFields(getEncounterInputDtoSchema.shape),
  // Construct large native validators during metadata export, outside query invocation.
  get returns(): Validator<EncounterProjection, 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterProjection>>(encounterProjectionDtoSchema)
  },
  handler: async (ctx, args): Promise<EncounterProjection> => {
    const input = getEncounterInputDtoSchema.parse({ encounterId: args.encounterId.toLowerCase() })
    const { userId } = await requireIdentity(ctx)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
      .unique()
    if (!row) throw new Error('Encounter is unavailable.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
    return encounterProjectionDtoSchema.parse(await presentRun(ctx, row, campaign, membership))
  }
})

export const active = query({
  args: zodToConvexFields(getCampaignEncounterInputDtoSchema.shape),
  get returns(): Validator<EncounterProjection | null, 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterProjection | null>>(
      zMini.nullable(encounterProjectionDtoSchema)
    )
  },
  handler: async (ctx, args): Promise<EncounterProjection | null> => {
    const input = getCampaignEncounterInputDtoSchema.parse({
      campaignId: args.campaignId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const row = await readActiveRun(ctx, campaign.id)
    return zMini
      .nullable(encounterProjectionDtoSchema)
      .parse(row ? await presentRun(ctx, row, campaign, membership) : null)
  }
})

export const list = query({
  args: zodToConvexFields(getCampaignEncounterInputDtoSchema.shape),
  get returns(): Validator<EncounterProjection[], 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterProjection[]>>(encounterProjectionListDtoSchema)
  },
  handler: async (ctx, args): Promise<EncounterProjection[]> => {
    const input = getCampaignEncounterInputDtoSchema.parse({
      campaignId: args.campaignId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const statuses = membership.role === 'OWNER' ? encounterStatusOrder : (['ACTIVE'] as const)
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
    return encounterProjectionListDtoSchema.parse(
      await Promise.all(rows.map((row) => presentRun(ctx, row, campaign, membership)))
    )
  }
})

/** Makes a paused START discoverable without exposing other prepared Encounters. */
export const pendingPrepared = query({
  args: zodToConvexFields(getCampaignEncounterInputDtoSchema.shape),
  get returns(): Validator<EncounterProjection[], 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterProjection[]>>(encounterProjectionListDtoSchema)
  },
  handler: async (ctx, args): Promise<EncounterProjection[]> => {
    const input = getCampaignEncounterInputDtoSchema.parse({
      campaignId: args.campaignId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const rows = await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaign.id).eq('status', 'PREPARED')
      )
      .collect()
    const visible: EncounterProjection[] = []
    for (const row of rows) {
      const projection = await presentRun(ctx, row, campaign, membership)
      const pending = await ctx.runQuery(internal.encounters.pendingReads.forPrepared, {
        encounterId: row.id
      })
      if (
        pending?.kind === 'INITIATIVE_DECLARATION' ||
        pending?.kind === 'INITIATIVE_EVIDENCE' ||
        pending?.kind === 'INITIATIVE_ORDER' ||
        pending?.kind === 'RECHARGE_EVIDENCE'
      )
        visible.push(projection)
    }
    return encounterProjectionListDtoSchema.parse(visible)
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
    if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
    if (row.version !== input.expectedVersion) return null
    readValidatedRunProjection(row, campaign)
    const state = readRunState(row)
    const actors = await readRunActors(ctx, state)
    if (actors.some((actor) => !state.sides.some((side) => side.id === actor.sideId)))
      throw new Error('Encounter actor side is unavailable.')
    return encounterActorSidesDtoSchema.parse({
      encounterId: row.id,
      version: row.version,
      sides: state.sides,
      actors: actors.map((actor) => ({ id: actor.id, sideId: actor.sideId }))
    })
  }
})
