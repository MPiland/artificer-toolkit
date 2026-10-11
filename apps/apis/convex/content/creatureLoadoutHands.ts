import {
  equipmentAuthoredDtoSchema,
  type EquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import {
  EQUIPMENT_PROPERTY_CODE,
  HAND_CONFLICT_MESSAGE,
  isHandSlot,
  resolveHandOccupancy
} from '@artificer-toolkit/shared/core'
import type { QueryCtx } from '../_generated/server'
import { canReadAuthoredRoot, readPublishedRootDocument } from './documents'
import { compileCurrentEquipment } from './equipmentRelationships'

/**
 * Refuses a Creature loadout whose hands cannot hold its items. Only Equipment documents know
 * whether an item is two-handed (a variant inherits it), so the check runs at publication.
 */
export async function assertCreatureLoadoutHands(
  ctx: QueryCtx,
  creature: Pick<CreatureAuthoredDto, 'equipmentLoadout'>,
  userId: string
) {
  const handEntries = (creature.equipmentLoadout ?? []).filter((entry) =>
    isHandSlot(entry.useState)
  )
  if (handEntries.length === 0) return
  const twoHandedByEquipmentId = new Map<string, boolean>()
  for (const { equipmentId } of handEntries) {
    if (twoHandedByEquipmentId.has(equipmentId)) continue
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', equipmentId))
      .unique()
    if (
      !root ||
      root.subjectKind !== 'EQUIPMENT' ||
      !(await canReadAuthoredRoot(ctx, root, userId))
    )
      throw new Error('Readable Equipment is required for every held loadout entry.')
    const stored: EquipmentAuthoredDto = equipmentAuthoredDtoSchema.parse(
      (await readPublishedRootDocument(ctx, root)).document
    )
    const { effective } = await compileCurrentEquipment(ctx, stored, userId)
    twoHandedByEquipmentId.set(
      equipmentId,
      effective.properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
    )
  }
  const [conflict] = resolveHandOccupancy(
    handEntries.map((entry) => ({
      id: entry.id,
      slot: entry.useState,
      twoHanded: twoHandedByEquipmentId.get(entry.equipmentId) === true
    }))
  ).conflicts
  if (conflict) throw new Error(HAND_CONFLICT_MESSAGE[conflict.code])
}
