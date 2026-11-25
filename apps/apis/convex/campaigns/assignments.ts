import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  assignCampaignCharacterInputSchema,
  setActiveCampaignCharacterInputSchema,
  unassignCampaignCharacterInputSchema,
  campaignAssignmentResultSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredAssignmentSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { MutationCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { readCharacterRecord } from '../characters/documents'
import { readCharacterRow } from '../characters/stateDocuments'
import { writeCharacterRecord } from '../characters/characterWrites'
import { prepareCharacterBuilder } from '../characters/builderPreparation'
import { readCharacterSourceAccessLoss } from '../characters/sourceAccessLoss'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readCampaignAttachedCharacter } from './assignedCharacter'
import { requireCampaignAuthority } from './authority'
import { requireCampaignCharacterAuthority, readCampaignCharacterState } from './characterState'
import { removeCampaignCharacterAssignment } from './characterDeparture'

export const assign = mutation({
  args: () => zodToConvexFields(assignCampaignCharacterInputSchema.shape),
  returns: () => zodToConvex(campaignAssignmentResultSchema),
  handler: async (ctx, args) => {
    const input = assignCampaignCharacterInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const characterId = input.characterId.toLowerCase()
    const record = await readCharacterRow(ctx, characterId)
    // Only the owner brings a Character into a party, the GM included (D211).
    if (!record || record.userId !== userId) throw new Error('Character is unavailable.')
    const attached = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', record.userId)
      )
      .collect()
    // Assignment retries still validate the complete Character before accepting its binding.
    const character = readCharacterRecord(record) as CharacterAuthored
    const retry = attached.find((assignment) => assignment.characterId === characterId)
    if (retry) {
      await readCampaignAttachedCharacter(ctx, campaign, membership, retry)
      return { ok: true as const }
    }
    if (record.status !== 'ACTIVE' || record.systemId !== campaign.gameSystemId)
      throw new Error('An active Character in the Campaign System is required.')
    const existing = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (existing) throw new Error('Character is already assigned to another Campaign.')
    // Attaching never replaces: the first attached Character plays, later ones wait on the bench (D236).
    await ctx.db.insert(
      'campaignCharacterAssignments',
      campaignStoredAssignmentSchema.parse({
        campaignId: campaign.id,
        characterId,
        userId: record.userId,
        assignedAt: new Date().toISOString(),
        active: !attached.some((assignment) => assignment.active)
      })
    )
    // Resolve against the proposed assignment inside this transaction; an invalid candidate rolls
    // back both the binding and any departure. Assignment never rewrites Builder-owned choices.
    const losses = await readCharacterSourceAccessLoss(ctx, character, {
      allowRetainedEquipment: true
    })
    const prepared = await prepareCharacterBuilder(ctx, {
      character,
      current: character,
      mode: 'edit'
    })
    if (
      losses.length > 0 ||
      !prepared.resolution.readiness.ready ||
      checksumRuleDocument(JSON.parse(JSON.stringify(prepared.character.intent))) !==
        checksumRuleDocument(JSON.parse(JSON.stringify(character.intent)))
    )
      throw new Error('Character sources or choices are unavailable in this Campaign.')
    const state = { adjustments: [], conditions: [] }
    if ((await readCampaignCharacterState(ctx, campaign.id, characterId)).stored)
      throw new Error('Stored Campaign Character overlay has no matching assignment.')
    await ctx.db.insert('campaignCharacterStates', {
      campaignId: campaign.id,
      characterId,
      documentJson: JSON.stringify(state),
      checksum: checksumRuleDocument(state)
    })
    // The Campaign's attunement override now feeds the Character's stored maximum hit points.
    await writeCharacterRecord(ctx, {
      current: record,
      fields: { streamVersion: record.play.streamVersion, updatedAt: record.updatedAt }
    })
    return { ok: true as const }
  }
})

export const setActive = mutation({
  args: () => zodToConvexFields(setActiveCampaignCharacterInputSchema.shape),
  returns: () => zodToConvex(campaignAssignmentResultSchema),
  handler: async (ctx, args) => {
    const input = setActiveCampaignCharacterInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, assignment } = await requireCampaignCharacterAuthority(
      ctx,
      input.campaignId,
      input.characterId,
      userId
    )
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (assignment.userId !== userId) throw new Error('Assigned Character not found.')
    if (assignment.active) return { ok: true as const }
    const current = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId_userId_active', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', userId).eq('active', true)
      )
      .unique()
    // Mid-fight the GM decides; a Prepared Run swaps freely (D236).
    if (current && (await isInRunningEncounter(ctx, campaign.id, current.characterId)))
      throw new Error('Ask the GM: your Character is in a running Encounter.')
    if (current) await ctx.db.patch(current._id, { active: false })
    await ctx.db.patch(assignment._id, { active: true })
    return { ok: true as const }
  }
})

async function isInRunningEncounter(ctx: MutationCtx, campaignId: string, characterId: string) {
  const runs = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaignId).eq('status', 'ACTIVE'))
    .collect()
  for (const run of runs) {
    const actors = await readRunActors(encounterWriteTransaction(ctx), readRunState(run))
    if (actors.some((actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId))
      return true
  }
  return false
}

export const unassign = mutation({
  args: () => zodToConvexFields(unassignCampaignCharacterInputSchema.shape),
  returns: () => zodToConvex(campaignAssignmentResultSchema),
  handler: async (ctx, args) => {
    const input = unassignCampaignCharacterInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    // Players remove their own Characters; the GM may name anyone's. Nothing is promoted afterwards.
    const { assignment } = await requireCampaignCharacterAuthority(
      ctx,
      campaign.id,
      input.characterId,
      userId
    )
    await removeCampaignCharacterAssignment({
      ctx,
      campaign,
      assignment,
      actorUserId: userId,
      reason: 'CHARACTER_UNASSIGNED'
    })
    return { ok: true as const }
  }
})
