import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import {
  EQUIPMENT_PROPERTY_CODE,
  HAND_CONFLICT_MESSAGE,
  isHandSlot,
  resolveHandOccupancy
} from '@artificer-toolkit/shared/core'
import type { CompiledEquipment } from '@artificer-toolkit/shared/subjects/compilers'
import { resolveDnd5eCreatureArmorClass } from '@artificer-toolkit/rules-runtime/systems/dnd5e/armorClass'
import type { QueryCtx } from '../_generated/server'
import { canReadAuthoredRoot } from './documents'
import { readStoredEquipment } from './storedEquipment'

/** The current compiled Equipment of each readable loadout entry, by Equipment id. */
export async function readLoadoutEquipment(
  ctx: QueryCtx,
  entries: readonly { equipmentId: string }[],
  userId: string | null
) {
  const compiledByEquipmentId = new Map<string, CompiledEquipment>()
  for (const { equipmentId } of entries) {
    if (compiledByEquipmentId.has(equipmentId)) continue
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', equipmentId))
      .unique()
    if (
      !root ||
      root.subjectKind !== 'EQUIPMENT' ||
      !(await canReadAuthoredRoot(ctx, root, userId))
    )
      continue
    compiledByEquipmentId.set(equipmentId, (await readStoredEquipment(ctx, root, userId)).compiled)
  }
  return compiledByEquipmentId
}

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
  const equipment = await readLoadoutEquipment(ctx, handEntries, userId)
  if (handEntries.some((entry) => !equipment.has(entry.equipmentId)))
    throw new Error('Readable Equipment is required for every held loadout entry.')
  const [conflict] = resolveHandOccupancy(
    handEntries.map((entry) => ({
      id: entry.id,
      slot: entry.useState,
      twoHanded: equipment
        .get(entry.equipmentId)!
        .properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
    }))
  ).conflicts
  if (conflict) throw new Error(HAND_CONFLICT_MESSAGE[conflict.code])
}

/**
 * A Creature's computed armor class (D107), or null while a loadout item is unreadable. Equipment
 * a Creature cannot evaluate comes back as a failure result; the caller decides what it means.
 */
export async function readCreatureArmorClass(
  ctx: QueryCtx,
  creature: Pick<CreatureAuthoredDto, 'abilityScores' | 'equipmentLoadout' | 'naturalArmorBonus'>,
  userId: string | null
) {
  const entries = creature.equipmentLoadout ?? []
  const equipment = await readLoadoutEquipment(ctx, entries, userId)
  if (entries.some((entry) => !equipment.has(entry.equipmentId))) return null
  return resolveDnd5eCreatureArmorClass({
    dexterityScore: creature.abilityScores.DEXTERITY,
    naturalArmorBonus: creature.naturalArmorBonus,
    equipment: entries.map((entry) => ({
      id: entry.id,
      useState: entry.useState,
      compiled: equipment.get(entry.equipmentId)!
    }))
  })
}
