import type { DBLike } from '#types'
import {
  replaceCharacterCurrency,
  replaceCharacterInventoryItems
} from '../upserts/characterInventory.js'
import { insertRows } from '../upserts/characterRows.js'
import { withTransaction } from '../../../utils/index.js'
import {
  ConcurrencyError,
  type CharacterLiveHitPointsPatch,
  type CharacterRow,
  type CharacterSheetStatePatch
} from './characterRead.js'

type DeleteCharacterRowsDb = {
  deleteFrom: (table: string) => {
    where: (column: 'character_id', op: '=', value: string) => { execute: () => Promise<unknown> }
  }
}

async function deleteCharacterRows(db: DBLike, table: string, characterId: string): Promise<void> {
  await (db as unknown as DeleteCharacterRowsDb)
    .deleteFrom(table)
    .where('character_id', '=', characterId)
    .execute()
}

async function applyCharacterSheetStatePatch(
  db: DBLike,
  characterId: string,
  patch: CharacterSheetStatePatch
): Promise<void> {
  switch (patch.kind) {
    case 'INSPIRATION':
      return

    case 'HITPOINTS':
      await deleteCharacterRows(db, 'character_hit_dice_state', characterId)
      await deleteCharacterRows(db, 'character_hitpoint_state', characterId)
      await insertRows(db, 'character_hitpoint_state', [
        {
          character_id: characterId,
          current: patch.value.current,
          temp: patch.value.temp ?? null,
          max_override: null
        }
      ])
      await insertRows(
        db,
        'character_hit_dice_state',
        patch.value.hitDice.map((hitDie) => ({
          character_id: characterId,
          die: hitDie.die,
          total: hitDie.total,
          used: hitDie.used
        }))
      )
      return

    case 'RESOURCES':
      await deleteCharacterRows(db, 'character_resources', characterId)
      await insertRows(
        db,
        'character_resources',
        (patch.value ?? []).map((resource) => ({
          character_id: characterId,
          resource_grant_id: resource.resourceGrantId,
          used: resource.used
        }))
      )
      return

    case 'SPELL_SLOTS':
      await deleteCharacterRows(db, 'character_spell_slot_state', characterId)
      await insertRows(
        db,
        'character_spell_slot_state',
        (patch.value ?? []).map((slot) => ({
          character_id: characterId,
          slot_key: slot.slotKey,
          used: slot.used
        }))
      )
      return

    case 'CLASS_SPELLS':
      await deleteCharacterRows(db, 'character_class_spells', characterId)
      await db
        .updateTable('character_classes')
        .set({ known_spells_overridden: false })
        .where('character_id', '=', characterId)
        .execute()
      for (const classState of patch.value ?? []) {
        if (classState.spells?.learned === undefined) continue
        await db
          .updateTable('character_classes')
          .set({ known_spells_overridden: true })
          .where('character_id', '=', characterId)
          .where('class_id', '=', classState.classId)
          .execute()
      }
      await insertRows(
        db,
        'character_class_spells',
        (patch.value ?? []).flatMap((classState) => [
          ...(classState.spells?.learned ?? []).map((spellId) => ({
            character_id: characterId,
            class_id: classState.classId,
            spell_id: spellId,
            state: 'KNOWN'
          })),
          ...(classState.spells?.prepared ?? []).map((spellId) => ({
            character_id: characterId,
            class_id: classState.classId,
            spell_id: spellId,
            state: 'PREPARED'
          }))
        ])
      )
      return

    case 'CONDITIONS':
      await deleteCharacterRows(db, 'character_conditions', characterId)
      await insertRows(
        db,
        'character_conditions',
        (patch.value ?? []).map((condition) => ({
          character_id: characterId,
          condition_type_id: condition.conditionTypeId,
          notes: condition.notes ?? null
        }))
      )
      return

    case 'EXHAUSTION':
      await deleteCharacterRows(db, 'character_exhaustion', characterId)
      if (patch.value && patch.value.level > 0) {
        await insertRows(db, 'character_exhaustion', [
          {
            character_id: characterId,
            level: patch.value.level,
            notes: patch.value.notes ?? null
          }
        ])
      }
      return

    case 'EQUIPMENT':
      await replaceCharacterInventoryItems(
        db,
        characterId,
        patch.value.inventory,
        patch.value.equipped,
        patch.value.attuned,
        patch.creatureEquipment,
        patch.vehicleEquipment
      )
      return

    case 'EXTRAS': {
      const creatureIds = new Set<string>()
      for (const creature of patch.creatures) {
        if (creatureIds.has(creature.id)) {
          throw new Error(
            `Character ${characterId} has duplicate creature instance ${creature.id}.`
          )
        }
        creatureIds.add(creature.id)
      }

      const vehicleIds = new Set<string>()
      for (const vehicle of patch.vehicles) {
        if (vehicleIds.has(vehicle.id)) {
          throw new Error(`Character ${characterId} has duplicate vehicle instance ${vehicle.id}.`)
        }
        vehicleIds.add(vehicle.id)
      }

      const inventoryOwner = await db
        .selectFrom('inventory_owners')
        .select('id')
        .where('kind', '=', 'CHARACTER')
        .where('character_id', '=', characterId)
        .executeTakeFirst()
      if (!inventoryOwner)
        throw new Error(`Character "${characterId}" is missing its inventory owner.`)
      const inventoryRows = await db
        .selectFrom('inventory_items')
        .selectAll()
        .where('owner_id', '=', inventoryOwner.id)
        .execute()
      const inventoryIds = new Set(inventoryRows.map((row) => row.id))

      for (const [creatureId, assignments] of Object.entries(patch.creatureEquipment)) {
        if (!creatureIds.has(creatureId)) {
          throw new Error(
            `Character ${characterId} creature equipment references missing creature instance ${creatureId}.`
          )
        }
        for (const assignment of assignments) {
          if (!inventoryIds.has(assignment.equipmentItemId)) {
            throw new Error(
              `Character ${characterId} creature equipment references missing inventory item ${assignment.equipmentItemId}.`
            )
          }
        }
      }
      for (const [vehicleId, assignments] of Object.entries(patch.vehicleEquipment)) {
        if (!vehicleIds.has(vehicleId)) {
          throw new Error(
            `Character ${characterId} vehicle equipment references missing vehicle instance ${vehicleId}.`
          )
        }
        for (const assignment of assignments) {
          if (!inventoryIds.has(assignment.equipmentItemId)) {
            throw new Error(
              `Character ${characterId} vehicle equipment references missing inventory item ${assignment.equipmentItemId}.`
            )
          }
        }
      }

      const existingCreatureRows = await db
        .selectFrom('character_creatures')
        .select('id')
        .where('character_id', '=', characterId)
        .execute()
      const existingCreatureIds = new Set(existingCreatureRows.map((row) => row.id))
      const existingVehicleRows = await db
        .selectFrom('character_vehicles')
        .select('id')
        .where('character_id', '=', characterId)
        .execute()
      const existingVehicleIds = new Set(existingVehicleRows.map((row) => row.id))

      await deleteCharacterRows(db, 'character_creature_hit_dice_state', characterId)

      for (const creatureId of existingCreatureIds) {
        if (!creatureIds.has(creatureId)) {
          await db
            .deleteFrom('character_creatures')
            .where('character_id', '=', characterId)
            .where('id', '=', creatureId)
            .execute()
        }
      }
      for (const vehicleId of existingVehicleIds) {
        if (!vehicleIds.has(vehicleId)) {
          await db
            .deleteFrom('character_vehicles')
            .where('character_id', '=', characterId)
            .where('id', '=', vehicleId)
            .execute()
        }
      }

      for (const creature of patch.creatures) {
        const values = {
          creature_id: creature.creatureId,
          relationship_kind: creature.relationshipKind,
          origin_kind: creature.originKind,
          current_hit_points: creature.currentHitPoints ?? null,
          temp_hit_points: creature.tempHitPoints ?? null,
          custom_name: creature.customName ?? null,
          notes: creature.notes ?? null,
          is_active: creature.isActive ?? null
        }
        if (existingCreatureIds.has(creature.id)) {
          await db
            .updateTable('character_creatures')
            .set(values)
            .where('character_id', '=', characterId)
            .where('id', '=', creature.id)
            .execute()
        } else {
          await db
            .insertInto('character_creatures')
            .values({ id: creature.id, character_id: characterId, ...values })
            .execute()
        }
      }
      for (const vehicle of patch.vehicles) {
        const values = {
          vehicle_id: vehicle.vehicleId,
          current_hit_points: vehicle.currentHitPoints ?? null,
          custom_name: vehicle.customName ?? null,
          notes: vehicle.notes ?? null,
          is_active: vehicle.isActive ?? null
        }
        if (existingVehicleIds.has(vehicle.id)) {
          await db
            .updateTable('character_vehicles')
            .set(values)
            .where('character_id', '=', characterId)
            .where('id', '=', vehicle.id)
            .execute()
        } else {
          await db
            .insertInto('character_vehicles')
            .values({ id: vehicle.id, character_id: characterId, ...values })
            .execute()
        }
      }

      await replaceCharacterInventoryItems(
        db,
        characterId,
        inventoryRows.map((item) => ({
          id: item.id,
          equipmentId: item.equipment_id,
          quantity: item.quantity,
          containerId: item.container_id ?? undefined,
          customName: item.custom_name ?? undefined,
          notes: item.notes ?? undefined
        })),
        inventoryRows.filter((item) => item.equipped).map((item) => item.id),
        inventoryRows.filter((item) => item.attuned).map((item) => item.id),
        patch.creatureEquipment,
        patch.vehicleEquipment
      )
      await insertRows(
        db,
        'character_creature_hit_dice_state',
        patch.creatures.flatMap((creature) =>
          (creature.hitDice ?? []).map((hitDie) => ({
            character_id: characterId,
            character_creature_id: creature.id,
            die: hitDie.die,
            total: hitDie.total,
            used: hitDie.used
          }))
        )
      )
      return
    }

    case 'CURRENCY':
      await replaceCharacterCurrency(db, characterId, patch.value)
      return

    case 'NOTES': {
      const groups = patch.groups ?? []
      const notes = patch.notes ?? []
      const groupIds = new Set(groups.map((group) => group.id))
      if (groupIds.size !== groups.length) {
        throw new Error(`Character ${characterId} has duplicate note groups.`)
      }
      const noteIds = new Set<string>()
      for (const note of notes) {
        if (noteIds.has(note.id))
          throw new Error(`Character ${characterId} has duplicate note ${note.id}.`)
        if (!groupIds.has(note.groupId)) {
          throw new Error(
            `Character ${characterId} note ${note.id} references missing note group ${note.groupId}.`
          )
        }
        noteIds.add(note.id)
      }
      await deleteCharacterRows(db, 'character_notes', characterId)
      await deleteCharacterRows(db, 'character_note_groups', characterId)
      await insertRows(
        db,
        'character_note_groups',
        groups.map((group) => ({
          id: group.id,
          character_id: characterId,
          label: group.label,
          sort_order: group.sortOrder,
          kind: group.kind
        }))
      )
      await insertRows(
        db,
        'character_notes',
        notes.map((note) => ({
          id: note.id,
          character_id: characterId,
          group_id: note.groupId,
          title: note.title,
          body: note.body ?? null,
          pinned: note.pinned ?? false,
          created_at: note.createdAt,
          updated_at: note.updatedAt
        }))
      )
      return
    }

    default:
      return patch satisfies never
  }
}

export async function patchCharacterSheetState(
  db: DBLike,
  characterId: string,
  patches: CharacterSheetStatePatch[],
  options: {
    expectedStreamVersion: number
    beforeCharacterLock?: (trx: DBLike) => Promise<void>
    afterCharacterLock?: (trx: DBLike) => Promise<void>
    afterPersist?: (trx: DBLike, nextStreamVersion: number) => Promise<void>
  }
): Promise<number> {
  return withTransaction(db, async (trx) => {
    await options.beforeCharacterLock?.(trx)
    const row = (await trx
      .selectFrom('characters')
      .selectAll()
      .where('id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()) as CharacterRow | undefined
    if (!row) throw new Error(`Character "${characterId}" was not found.`)
    if (row.stream_version !== options.expectedStreamVersion) {
      throw new ConcurrencyError(characterId, options.expectedStreamVersion)
    }
    await options.afterCharacterLock?.(trx)

    const inspirationPatch = patches.find(
      (patch): patch is Extract<CharacterSheetStatePatch, { kind: 'INSPIRATION' }> =>
        patch.kind === 'INSPIRATION'
    )
    const nextStreamVersion = row.stream_version + 1
    await trx
      .insertInto('characters')
      .values({
        id: row.id,
        system_id: row.system_id,
        user_id: row.user_id,
        label: row.label,
        description: row.description,
        status: row.status,
        inspiration: inspirationPatch?.value ?? row.inspiration,
        stream_version: nextStreamVersion
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          inspiration: eb.ref('excluded.inspiration'),
          stream_version: eb.ref('excluded.stream_version')
        }))
      )
      .execute()

    for (const patch of patches) {
      await applyCharacterSheetStatePatch(trx, characterId, patch)
    }
    await options.afterPersist?.(trx, nextStreamVersion)
    return nextStreamVersion
  })
}

export async function patchCharacterLiveHitPoints(
  db: DBLike,
  characterId: string,
  input: CharacterLiveHitPointsPatch
): Promise<number> {
  return withTransaction(db, async (trx) => {
    await input.beforeCharacterLock?.(trx)
    const row = (await trx
      .selectFrom('characters')
      .selectAll()
      .where('id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()) as CharacterRow | undefined
    if (!row) throw new Error(`Character "${characterId}" was not found.`)
    if (row.stream_version !== input.expectedStreamVersion) {
      throw new ConcurrencyError(characterId, input.expectedStreamVersion)
    }

    const hitPoints = await trx
      .selectFrom('character_hitpoint_state')
      .select(['current', 'temp'])
      .where('character_id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()
    if (
      !hitPoints ||
      hitPoints.current !== input.expected.current ||
      (hitPoints.temp ?? undefined) !== input.expected.temp
    ) {
      throw new Error(
        `Character "${characterId}" canonical hit points do not match its committed mechanics projection.`
      )
    }

    const nextStreamVersion = row.stream_version + 1
    await trx
      .updateTable('character_hitpoint_state')
      .set({ current: input.next.current, temp: input.next.temp ?? null })
      .where('character_id', '=', characterId)
      .execute()
    await trx
      .updateTable('characters')
      .set({ stream_version: nextStreamVersion })
      .where('id', '=', characterId)
      .execute()
    await input.afterPersist?.(trx, nextStreamVersion)
    return nextStreamVersion
  })
}
