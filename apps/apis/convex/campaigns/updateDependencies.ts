import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readCharacterRecord, readCharacterDraft } from '../characters/documents'
import { readCharacterSourceAccessLoss } from '../characters/sourceAccessLoss'
import { prepareCharacterBuilder } from '../characters/builderPreparation'
import { writeCharacterRecord } from '../characters/characterWrites'
import { projectCharacterSheetFacts } from '../characters/sheetPreparation'
import { readActiveCampaignMembers } from './authority'
import { requireCampaignCharacterAuthority } from './characterState'
import { readCampaignSharedPublication } from './contentAccess'
import { readPartyEquipment } from './partyInventoryDocuments'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import { requireCampaignVehicleDefinition } from './vehicleSources'
import { requireEncounterPolicySources } from '../encounters/sourceDependencies'

/**
 * Validate the proposed binding in the caller's transaction; never silently prune dependent content.
 * An attunement change refreshes each assigned Character's stored maximum hit points.
 */
export async function validateCampaignUpdateDependencies(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  userId: string,
  removedSources: ReadonlySet<string>,
  attunementChanged: boolean
) {
  const members = await readActiveCampaignMembers(ctx, campaign)
  const assignments = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .take(members.length + 1)
  if (assignments.length > members.length)
    throw new Error('Stored Campaign Character assignment capacity exceeded.')
  for (const assignment of assignments.sort((a, b) => a.characterId.localeCompare(b.characterId))) {
    await requireCampaignCharacterAuthority(ctx, campaign.id, assignment.characterId, userId)
    const record = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', assignment.characterId))
      .unique()
    if (!record) throw new Error('Assigned Character is unavailable.')
    if (removedSources.size > 0) {
      const current = readCharacterRecord(record) as CharacterAuthored
      const draft = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', record.id))
        .unique()
      if (draft && draft.userId !== record.userId)
        throw new Error('Stored Character draft ownership mismatch.')
      const characters = [
        current,
        ...(draft
          ? [(await readCharacterDraft(ctx, draft, record)).payload.character as CharacterAuthored]
          : [])
      ]
      for (const character of characters) {
        try {
          const losses = await readCharacterSourceAccessLoss(ctx, character)
          const prepared = await prepareCharacterBuilder(ctx, {
            character,
            current: character,
            mode: 'edit'
          })
          if (
            losses.length > 0 ||
            checksumCanonicalJson(prepared.character.intent) !==
              checksumCanonicalJson(character.intent)
          )
            throw new Error('Authored choices would lose source access.')
        } catch (cause) {
          throw new Error(`Campaign Rules Catalogues are required by Character ${record.id}.`, {
            cause
          })
        }
      }
    }
    // The attunement override feeds each Character's evaluation, including its stored maximum.
    if (attunementChanged && record.status === 'ACTIVE') {
      const { facts } = await writeCharacterRecord(ctx, {
        current: record,
        fields: { streamVersion: record.streamVersion, updatedAt: record.updatedAt },
        evaluateAs: { userId, campaignId: campaign.id }
      })
      if (!facts) throw new Error(`Assigned Character ${record.id} could not be evaluated.`)
      projectCharacterSheetFacts(facts)
    }
  }
  if (removedSources.size === 0) return
  await requireEncounterPolicySources(ctx, campaign, removedSources)
  for await (const share of ctx.db
    .query('campaignContentShares')
    .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', campaign.id))) {
    try {
      if (!(await readCampaignSharedPublication(ctx, campaign, share.subjectKind, share.subjectId)))
        throw new Error('Shared content is unavailable.')
    } catch (cause) {
      throw new Error(
        `Campaign Rules Catalogues are required by shared ${share.subjectKind} ${share.subjectId}.`,
        { cause }
      )
    }
  }
  const equipmentIds = new Set<string>()
  for await (const item of ctx.db
    .query('campaignPartyItems')
    .withIndex('by_campaignId_equipmentId', (q) => q.eq('campaignId', campaign.id))) {
    if (item.retainedRulesJson)
      readAcquiredEquipmentRules(item.retainedRulesJson, item.equipmentId, campaign.gameSystemId)
    if (equipmentIds.has(item.equipmentId)) continue
    equipmentIds.add(item.equipmentId)
    try {
      await readPartyEquipment(ctx, campaign, item.equipmentId)
    } catch (cause) {
      throw new Error(`Campaign Rules Catalogues are required by Equipment ${item.equipmentId}.`, {
        cause
      })
    }
  }
  const vehicleIds = new Set<string>()
  for await (const vehicle of ctx.db
    .query('campaignVehicles')
    .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))) {
    if (vehicleIds.has(vehicle.vehicleDefinitionId)) continue
    vehicleIds.add(vehicle.vehicleDefinitionId)
    try {
      await requireCampaignVehicleDefinition(ctx, campaign, vehicle.vehicleDefinitionId)
    } catch (cause) {
      throw new Error(`Campaign Rules Catalogues are required by Vehicle ${vehicle.id}.`, { cause })
    }
  }
}
