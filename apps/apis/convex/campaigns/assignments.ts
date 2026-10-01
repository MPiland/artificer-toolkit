import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  assignCampaignCharacterInputSchema,
  unassignCampaignCharacterInputSchema,
  campaignAssignmentResultSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredAssignmentSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { readCharacterRecord } from '../characters/documents'
import { readCharacterRow } from '../characters/stateDocuments'
import { writeCharacterRecord } from '../characters/characterWrites'
import { prepareCharacterBuilder } from '../characters/builderPreparation'
import { readCharacterSourceAccessLoss } from '../characters/sourceAccessLoss'
import { readCampaignAssignedCharacter } from './assignedCharacter'
import { requireCampaignAuthority } from './authority'
import { requireCampaignCharacterAuthority, readCampaignCharacterState } from './characterState'
import { removeCampaignCharacterAssignment } from './characterDeparture'

export const assign = mutation({
  args: zodToConvexFields(assignCampaignCharacterInputSchema.shape),
  returns: zodToConvex(campaignAssignmentResultSchema),
  handler: async (ctx, args) => {
    const input = assignCampaignCharacterInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const characterId = input.characterId.toLowerCase()
    const record = await readCharacterRow(ctx, characterId)
    if (!record || (membership.role === 'PLAYER' && record.userId !== userId))
      throw new Error('Character is unavailable.')
    const { membership: player } = await requireCampaignAuthority(ctx, campaign.id, record.userId)
    if (player.role !== 'PLAYER')
      throw new Error('The Campaign owner cannot assign their own Character.')
    const current = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', record.userId)
      )
      .unique()
    // Assignment retries still validate the complete Character before accepting its binding.
    const character = readCharacterRecord(record) as CharacterAuthored
    if (current?.characterId === characterId) {
      await readCampaignAssignedCharacter(ctx, campaign, player)
      return { ok: true as const }
    }
    if (record.status !== 'ACTIVE' || record.systemId !== campaign.gameSystemId)
      throw new Error('An active Character in the Campaign System is required.')
    const existing = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (existing) throw new Error('Character is already assigned to another Campaign.')
    if (current)
      await removeCampaignCharacterAssignment({
        ctx,
        campaign,
        assignment: current,
        actorUserId: userId,
        reason: 'CHARACTER_REPLACED'
      })
    await ctx.db.insert(
      'campaignCharacterAssignments',
      campaignStoredAssignmentSchema.parse({
        campaignId: campaign.id,
        characterId,
        userId: record.userId,
        assignedAt: new Date().toISOString()
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

export const unassign = mutation({
  args: zodToConvexFields(unassignCampaignCharacterInputSchema.shape),
  returns: zodToConvex(campaignAssignmentResultSchema),
  handler: async (ctx, args) => {
    const input = unassignCampaignCharacterInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    let characterId = input.characterId?.toLowerCase()
    if (membership.role === 'PLAYER') {
      const current = await readCampaignAssignedCharacter(ctx, campaign, membership)
      if (characterId && current?.id !== characterId)
        throw new Error('Assigned Character not found.')
      if (!current) return { ok: true as const }
      characterId = current.id
    }
    if (!characterId) throw new Error('Character is required for owner unassignment.')
    const { assignment } = await requireCampaignCharacterAuthority(
      ctx,
      campaign.id,
      characterId,
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
