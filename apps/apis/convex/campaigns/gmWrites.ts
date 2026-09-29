import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignAdjustmentDtoSchema,
  campaignAdjustmentInputSchema,
  campaignConditionDtoSchema,
  deleteCampaignAdjustmentInputSchema,
  deleteCampaignConditionInputSchema,
  saveCampaignConditionInputSchema,
  type CampaignEventDto
} from '@artificer-toolkit/schema/api/campaignLiveState'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { encodeCampaignEvent } from '@artificer-toolkit/schema/api/campaignEventTransport'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { getCharacterSheetAdjustmentSlotKey } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentIdentity'
import {
  validateSheetAdjustmentTarget,
  validateSpellSource
} from '@artificer-toolkit/rules-runtime/character/sheetCommandValidation'
import { type MutationCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireSystem } from '../content/systemDocuments'
import { loadCharacterSheet, projectCharacterSheetFacts } from '../characters/sheetPreparation'
import { writeCharacterRecord } from '../characters/characterWrites'
import type { CharacterSheetSourceContext } from '../characters/sheetFacts'
import { loadCharacterState } from '../characters/stateDocuments'
import { readCampaignCharacterState, requireCampaignCharacterAuthority } from './characterState'

async function requireWritableState(ctx: MutationCtx, campaignId: string, lookupId: string) {
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignCharacterAuthority(
    ctx,
    campaignId,
    lookupId,
    userId
  )
  if (membership.role !== 'OWNER') throw new Error('You cannot perform this Campaign action.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  const characterId = lookupId.toLowerCase()
  return {
    userId,
    campaign,
    characterId,
    ...(await readCampaignCharacterState(ctx, campaign.id, characterId))
  }
}

/** Campaign adjustments feed the Character's evaluation, so its stored maximum is refreshed. */
async function refreshCharacterMaximum(
  ctx: MutationCtx,
  current: Awaited<ReturnType<typeof requireWritableState>>,
  sourceContext?: CharacterSheetSourceContext
) {
  const { active } = await loadCharacterState(ctx, current.characterId)
  const { facts } = active
    ? await writeCharacterRecord(ctx, {
        current: active,
        fields: { streamVersion: active.play.streamVersion, updatedAt: active.updatedAt },
        sourceContext,
        evaluateAs: { userId: current.userId, campaignId: current.campaign.id }
      })
    : { facts: null }
  if (!facts) throw new Error('Assigned Character not found.')
  // Projecting validates the adjusted Sheet; a rejected effect rolls back the write and its event.
  projectCharacterSheetFacts(facts)
}

async function commitState(
  ctx: MutationCtx,
  current: Awaited<ReturnType<typeof requireWritableState>>,
  event: Pick<CampaignEventDto, 'type' | 'visibility' | 'payload'>
) {
  const { campaign, characterId, state, stored, userId } = current
  const document = campaignCharacterStateSchema.parse(state)
  if (document.adjustments.length === 0 && document.conditions.length === 0) {
    if (stored) await ctx.db.delete(stored._id)
  } else {
    const next = {
      campaignId: campaign.id,
      characterId,
      documentJson: JSON.stringify(document),
      checksum: checksumRuleDocument(document)
    }
    if (stored) await ctx.db.replace(stored._id, next)
    else await ctx.db.insert('campaignCharacterStates', next)
  }
  await ctx.db.insert(
    'campaignEvents',
    campaignStoredEventSchema.parse({
      ...encodeCampaignEvent({
        ...event,
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        subjectCharacterId: characterId,
        createdAt: new Date().toISOString()
      }),
      actorUserId: userId,
      visibleInHistory: event.type !== 'CAMPAIGN_COPIED'
    })
  )
}

export const saveAdjustment = mutation({
  args: zodToConvexFields(campaignAdjustmentInputSchema.shape),
  returns: zodToConvex(campaignAdjustmentDtoSchema),
  handler: async (ctx, args) => {
    const input = campaignAdjustmentInputSchema.parse(args)
    const current = await requireWritableState(ctx, input.campaignId, input.characterId)
    const { campaign, characterId, state, userId } = current
    const sheet = await loadCharacterSheet(ctx, userId, characterId, campaign.id)
    if (!sheet) throw new Error('Assigned Character not found.')
    validateSheetAdjustmentTarget(input.adjustment, sheet.resolution, sheet.character)
    if (input.adjustment.family === 'SPELL')
      validateSpellSource(input.adjustment.source, sheet.sheet)
    const slotKey = getCharacterSheetAdjustmentSlotKey(input.adjustment)
    const existing = state.adjustments.find(
      (record) => getCharacterSheetAdjustmentSlotKey(record.adjustment) === slotKey
    )
    if (existing ? existing.version !== input.expectedVersion : input.expectedVersion !== 0)
      throw new Error('Campaign adjustment changed before this save completed.')
    const { id: _inputId, ...adjustment } = input.adjustment
    const now = new Date().toISOString()
    const saved = campaignAdjustmentDtoSchema.parse({
      id: existing?.id ?? crypto.randomUUID(),
      campaignId: campaign.id,
      characterId,
      adjustment,
      visibility: input.visibility,
      version: existing ? existing.version + 1 : 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    })
    const record = { ...saved, createdBy: existing?.createdBy ?? userId }
    if (existing) {
      state.adjustments = state.adjustments.map((row) => (row.id === existing.id ? record : row))
    } else state.adjustments.push(record)
    await commitState(ctx, current, {
      type: 'CAMPAIGN_ADJUSTMENT_SAVED',
      visibility: saved.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
      payload: {
        action: 'SAVED',
        adjustmentId: saved.id,
        family: adjustment.family,
        slotKey,
        version: saved.version
      }
    })
    // Re-evaluation belongs to this transaction; a rejected effect also rolls back its audit event.
    await refreshCharacterMaximum(ctx, current, sheet.sourceContext)
    return saved
  }
})

export const deleteAdjustment = mutation({
  args: zodToConvexFields(deleteCampaignAdjustmentInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const input = deleteCampaignAdjustmentInputSchema.parse(args)
    const current = await requireWritableState(ctx, input.campaignId, input.characterId)
    const { state } = current
    const existing = state.adjustments.find((row) => row.id === input.adjustmentId.toLowerCase())
    if (!existing || existing.version !== input.expectedVersion)
      throw new Error('Campaign adjustment changed before this delete completed.')
    state.adjustments = state.adjustments.filter((row) => row.id !== existing.id)
    await commitState(ctx, current, {
      type: 'CAMPAIGN_ADJUSTMENT_DELETED',
      visibility: existing.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
      payload: {
        action: 'DELETED',
        adjustmentId: existing.id,
        family: existing.adjustment.family,
        slotKey: getCharacterSheetAdjustmentSlotKey(existing.adjustment),
        version: existing.version
      }
    })
    await refreshCharacterMaximum(ctx, current)
    return { ok: true }
  }
})

export const saveCondition = mutation({
  args: zodToConvexFields(saveCampaignConditionInputSchema.shape),
  returns: zodToConvex(campaignConditionDtoSchema),
  handler: async (ctx, args) => {
    const input = saveCampaignConditionInputSchema.parse(args)
    const current = await requireWritableState(ctx, input.campaignId, input.characterId)
    const { campaign, characterId, state, userId } = current
    const conditionTypeId = input.conditionTypeId.toLowerCase()
    const system = await requireSystem(ctx, campaign.gameSystemId)
    if (!system.conditionTypes.some((condition) => condition.id === conditionTypeId))
      throw new Error(`Condition "${conditionTypeId}" is not available in this rules system.`)
    const existing = state.conditions.find((row) => row.conditionTypeId === conditionTypeId)
    if (existing ? existing.version !== input.expectedVersion : input.expectedVersion !== 0)
      throw new Error('Campaign condition changed before this save completed.')
    const now = new Date().toISOString()
    const saved = campaignConditionDtoSchema.parse({
      id: existing?.id ?? crypto.randomUUID(),
      campaignId: campaign.id,
      characterId,
      conditionTypeId,
      ...(input.notes ? { notes: input.notes } : {}),
      visibility: input.visibility,
      version: existing ? existing.version + 1 : 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    })
    const record = { ...saved, createdBy: existing?.createdBy ?? userId }
    if (existing) {
      state.conditions = state.conditions.map((row) => (row.id === existing.id ? record : row))
    } else state.conditions.push(record)
    await commitState(ctx, current, {
      type: 'CAMPAIGN_CONDITION_SAVED',
      visibility: saved.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
      payload: { action: 'SAVED', conditionId: saved.id, conditionTypeId, version: saved.version }
    })
    return saved
  }
})

export const deleteCondition = mutation({
  args: zodToConvexFields(deleteCampaignConditionInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const input = deleteCampaignConditionInputSchema.parse(args)
    const current = await requireWritableState(ctx, input.campaignId, input.characterId)
    const { state } = current
    const existing = state.conditions.find((row) => row.id === input.conditionId.toLowerCase())
    if (!existing || existing.version !== input.expectedVersion)
      throw new Error('Campaign condition changed before this delete completed.')
    state.conditions = state.conditions.filter((row) => row.id !== existing.id)
    await commitState(ctx, current, {
      type: 'CAMPAIGN_CONDITION_DELETED',
      visibility: existing.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
      payload: {
        action: 'DELETED',
        conditionId: existing.id,
        conditionTypeId: existing.conditionTypeId,
        version: existing.version
      }
    })
    return { ok: true }
  }
})
