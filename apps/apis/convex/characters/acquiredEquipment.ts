import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import { captureAcquiredEquipmentRules } from '../content/acquiredEquipmentRules'
import type { QueryCtx } from '../_generated/server'
import { readCharacterSources, readCharacterPublication, readCharacterSourceRoots } from './context'
import { readCampaignSharedRootPublication } from '../campaigns/contentAccess'

/** Refreshes only server-owned held item data, before source or assignment authority is removed. */
export async function retainCharacterEquipmentRules(ctx: QueryCtx, character: CharacterAuthored, authorityScope?: import('../campaigns/authority').CampaignInternalScope) {
  const access = await readCharacterSources(ctx, character, character.userId, authorityScope)
  const sourceIds = new Set(access.sources.map((source) => source.id))
  const inventory = [] as CharacterAuthored['state']['equipment']['inventory']
  const snapshotsByEquipmentId = new Map<string, string>()
  for (const item of character.state.equipment.inventory) {
    if (item.retainedRulesJson)
      readAcquiredEquipmentRules(item.retainedRulesJson, item.equipmentId, character.systemId)
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', item.equipmentId))
      .unique()
    const current = root
      ? await readCharacterPublication(ctx, root, character.systemId, character.userId, access)
      : null
    if (!current) {
      if (!item.retainedRulesJson)
        throw new Error('Acquired Character Equipment has no usable source or retained rules.')
      inventory.push(item)
      continue
    }
    if (current.subjectKind !== 'EQUIPMENT')
      throw new Error('Stored held Equipment subject mismatch.')
    const retainedRulesJson =
      snapshotsByEquipmentId.get(item.equipmentId) ??
      (await captureAcquiredEquipmentRules(ctx, {
        equipmentId: item.equipmentId,
        systemId: character.systemId,
        userId: character.userId,
        sourceIds,
        canReadSharedRoot: async (candidate) =>
          access.campaign !== null &&
          (await readCampaignSharedRootPublication(
            ctx,
            access.campaign,
            candidate.subjectKind,
            candidate.id
          )) !== null,
        spellRoots: () => readCharacterSourceRoots(ctx, character.systemId, access, 'SPELL')
      }))
    snapshotsByEquipmentId.set(item.equipmentId, retainedRulesJson)
    inventory.push({ ...item, retainedRulesJson })
  }
  return { ...character.state, equipment: { ...character.state.equipment, inventory } }
}
