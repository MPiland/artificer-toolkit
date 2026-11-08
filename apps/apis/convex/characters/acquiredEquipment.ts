import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  acquiredRulesDrawOnSources,
  readAcquiredEquipmentRules
} from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import { captureAcquiredEquipmentRules } from '../content/acquiredEquipmentRules'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readCampaignCharacterSources } from './sourceReads'
import {
  readCharacterSources,
  readCharacterPublication,
  readCharacterSourceRoots,
  readReferencedRoot,
  type CharacterReferencedReads
} from './context'
import { readCampaignSharedActiveRoot } from '../campaigns/contentAccess'

/** Refreshes only server-owned held item data, before source or assignment authority is removed. */
export async function retainCharacterEquipmentRules(
  ctx: QueryCtx,
  character: CharacterAuthored,
  authorityScope?: import('../campaigns/authority').CampaignInternalScope,
  reads?: Pick<CharacterReferencedReads, 'roots'> &
    Partial<Pick<CharacterReferencedReads, 'rulePublications'>> & {
      /** Source access the caller already read under the Campaign authority it holds. */
      access?: Awaited<ReturnType<typeof readCharacterSources>>
    }
) {
  const access =
    reads?.access ?? (await readCharacterSources(ctx, character, character.userId, authorityScope))
  const sourceIds = new Set(access.sources.map((source) => source.id))
  const inventory = [] as CharacterAuthored['state']['equipment']['inventory']
  const snapshotsByEquipmentId = new Map<string, string>()
  for (const item of character.state.equipment.inventory) {
    if (item.retainedRulesJson)
      readAcquiredEquipmentRules(item.retainedRulesJson, item.equipmentId, character.systemId)
    const root = await readReferencedRoot(ctx, item.equipmentId, reads)
    const current = !root
      ? null
      : reads?.rulePublications?.has(root.id)
        ? (reads.rulePublications.get(root.id) ?? null)
        : await readCharacterPublication(ctx, root, character.systemId, character.userId, access)
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
          (await readCampaignSharedActiveRoot(
            ctx,
            access.campaign,
            candidate.subjectKind,
            candidate.id,
            candidate
          )) !== null,
        spellRoots: () => readCharacterSourceRoots(ctx, character.systemId, access, 'SPELL'),
        lookupRoot: (id) => readReferencedRoot(ctx, id, reads)
      }))
    snapshotsByEquipmentId.set(item.equipmentId, retainedRulesJson)
    inventory.push({ ...item, retainedRulesJson })
  }
  return { ...character.state, equipment: { ...character.state.equipment, inventory } }
}

/**
 * Retains held rules before a source removal commits. As with Campaign party items, an item takes
 * its refreshed snapshot only when that snapshot draws on a removed Equipment or Spell; every other
 * item keeps what is stored, so a removal nothing holds changes no Character. The caller has
 * verified the Character's assignment to `campaign`, and shares `roots` across the party.
 */
export async function retainCharacterEquipmentRulesForLoss(
  ctx: QueryCtx,
  character: CharacterAuthored,
  targets: readonly { subjectKind: string; subjectId: string }[],
  campaign: Doc<'campaigns'>,
  roots: CharacterReferencedReads['roots']
) {
  const ruleTargets = targets.filter(
    (target) => target.subjectKind === 'EQUIPMENT' || target.subjectKind === 'SPELL'
  )
  if (!ruleTargets.length || !character.state.equipment.inventory.length) return character.state
  const access = await readCampaignCharacterSources(ctx, campaign, character.userId)
  const refreshed = (
    await retainCharacterEquipmentRules(ctx, character, undefined, { roots, access })
  ).equipment.inventory
  const inventory = character.state.equipment.inventory.map((item, index) => {
    const next = refreshed[index]!
    return next.retainedRulesJson !== item.retainedRulesJson &&
      acquiredRulesDrawOnSources(
        next.retainedRulesJson!,
        item.equipmentId,
        character.systemId,
        ruleTargets
      )
      ? next
      : item
  })
  return { ...character.state, equipment: { ...character.state.equipment, inventory } }
}
