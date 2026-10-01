import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import { recoverCampaignClockBoundaryInputSchema } from '@artificer-toolkit/schema/api/campaignSessions'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from './authority'
import { executeCharacterSheetCommand } from '../characters/sheetCommands'
import { loadCharacterSheet } from '../characters/sheetPreparation'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import {
  campaignStoredClockRecoveryPromptSchema,
  campaignStoredClockRecoverySchema
} from '@artificer-toolkit/schema/projections/campaignClockPersistence'
import { readFightingCharacters } from '../liveSessions/characterHolds'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { encodeCampaignEvent } from '@artificer-toolkit/schema/api/campaignEventTransport'

export async function recoverClockBoundary({
  ctx,
  campaignId,
  actorUserId,
  absolute,
  kind,
  occurredAt
}: {
  ctx: MutationCtx
  campaignId: string
  actorUserId: string
  absolute: number
  kind: 'DAWN' | 'DUSK' | 'DAILY'
  occurredAt: string
}) {
  const assignments = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .collect()
  assignments.sort((left, right) => left.characterId.localeCompare(right.characterId))
  // The live room owns a fighting Character's play state, so the GM decides its refresh later.
  const fighting = new Set(
    (
      await readFightingCharacters(
        ctx,
        campaignId,
        await ctx.db
          .query('encounterRuns')
          .withIndex('by_campaignId_status', (q) =>
            q.eq('campaignId', campaignId).eq('status', 'ACTIVE')
          )
          .collect()
      )
    ).map((entry) => entry.characterId)
  )
  for (const assignment of assignments) {
    if (fighting.has(assignment.characterId)) {
      const prompted = await ctx.db
        .query('campaignClockRecoveryPrompts')
        .withIndex('by_campaignId_boundary_character_kind', (q) =>
          q
            .eq('campaignId', campaignId)
            .eq('boundaryAbsoluteMinute', absolute)
            .eq('characterId', assignment.characterId)
            .eq('boundaryKind', kind)
        )
        .unique()
      if (!prompted)
        await ctx.db.insert(
          'campaignClockRecoveryPrompts',
          campaignStoredClockRecoveryPromptSchema.parse({
            id: crypto.randomUUID(),
            campaignId,
            characterId: assignment.characterId,
            boundaryAbsoluteMinute: absolute,
            boundaryKind: kind,
            createdAt: occurredAt
          })
        )
      continue
    }
    const current = await loadCharacterSheet(ctx, actorUserId, assignment.characterId, campaignId)
    if (!current) throw new Error('Assigned Character not found.')
    let expectedVersion = current.active.play.streamVersion
    for (const resource of current.sheet.resources.items) {
      if (resource.used <= 0 || !resource.recoveries.some((entry) => entry.trigger === kind))
        continue
      const owner = resource.owner
      const resourceKey = createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))
      const recovered = await ctx.db
        .query('campaignClockRecoveries')
        .withIndex('by_campaignId_boundary_character_resource', (q) =>
          q
            .eq('campaignId', campaignId)
            .eq('boundaryAbsoluteMinute', absolute)
            .eq('characterId', assignment.characterId)
            .eq('resourceKey', resourceKey)
        )
        .unique()
      if (recovered) continue
      const result = await executeCharacterSheetCommand(
        ctx,
        actorUserId,
        {
          id: assignment.characterId,
          command: {
            type: 'RECOVER_SHEET_RESOURCE',
            commandId: crypto.randomUUID(),
            expectedVersion,
            owner,
            trigger: kind
          }
        },
        campaignId,
        current.sourceContext
      )
      if (!result.historyEntry) throw new Error('Character recovery produced no history entry.')
      expectedVersion = result.streamVersion
      const eventId = crypto.randomUUID()
      await ctx.db.insert(
        'campaignEvents',
        campaignStoredEventSchema.parse({
          ...encodeCampaignEvent({
            id: eventId,
            campaignId,
            type: 'CAMPAIGN_CLOCK_RESOURCE_RECOVERED',
            visibility: 'TABLE',
            subjectCharacterId: assignment.characterId,
            payload: {
              boundaryAbsoluteMinute: absolute,
              boundaryKind: kind,
              characterId: assignment.characterId,
              resourceKey,
              characterEventId: result.historyEntry.eventId
            },
            createdAt: occurredAt
          }),
          actorUserId,
          visibleInHistory: true
        })
      )
      await ctx.db.insert(
        'campaignClockRecoveries',
        campaignStoredClockRecoverySchema.parse({
          id: crypto.randomUUID(),
          campaignId,
          boundaryAbsoluteMinute: absolute,
          boundaryKind: kind,
          characterId: assignment.characterId,
          resourceKey,
          eventId,
          createdAt: occurredAt
        })
      )
    }
  }
}

/** Runs inside the calling clock mutation's transaction without loading Sheet code for clock reads. */
export const recover = internalMutation({
  args: zodToConvexFields(recoverCampaignClockBoundaryInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = recoverCampaignClockBoundaryInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    if (userId !== input.actorUserId) throw new Error('Campaign not found.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    await recoverClockBoundary({ ctx, ...input })
    return null
  }
})
