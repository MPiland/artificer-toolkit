import type { DBLike } from '#types'
import {
  ADVANCEMENT_METHOD_CODE,
  CHARACTER_ABILITY_GENERATION_METHOD,
  type CharacterAuthored
} from '@artificer-toolkit/shared'
import { assertNever } from '../../../utils/index.js'
import {
  countRolls,
  deleteExistingCharacterChildren,
  insertRows,
  mapFeatureSource,
  mapResourceGrantSource,
  mapSpellSelectionSource,
  mapTiming,
  serializeSelectionValue,
  sortByDependency
} from './character.helpers.js'

export async function upsertCharacter(
  db: DBLike,
  json_data: CharacterAuthored
) {
  const trx = await db.startTransaction().execute()

  try {
    await trx
      .insertInto('characters')
      .values({
        id: json_data.id,
        system_id: json_data.systemId,
        user_id: json_data.userId,
        label: json_data.label,
        description: json_data.description ?? null
      })
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        user_id: ref('excluded.user_id'),
        label: ref('excluded.label'),
        description: ref('excluded.description')
      })))
      .execute()

    await deleteExistingCharacterChildren(trx, json_data.id)

    await trx.insertInto('character_advancement').values({
      character_id: json_data.id,
      method_code: json_data.intent.advancement.method,
      experience: json_data.intent.advancement.method === ADVANCEMENT_METHOD_CODE.EXPERIENCE
        ? json_data.intent.advancement.experience ?? null
        : null
    })
      .execute()

    await trx.insertInto('character_race').values({
      character_id: json_data.id,
      race_id: json_data.intent.race.raceId,
      subrace_id: json_data.intent.race.subraceId ?? null
    })
      .execute()

    await trx.insertInto('character_background').values({
      character_id: json_data.id,
      background_id: json_data.intent.background.backgroundId
    })
      .execute()

    await insertRows(trx, 'character_ancestry_acquisitions', (json_data.intent.ancestrySelections ?? []).map((acquisition) => ({
      id: acquisition.id,
      character_id: json_data.id,
      ancestry_id: acquisition.ancestryId,
      option_id: acquisition.optionId,
      source_kind: acquisition.source.kind,
      race_id: acquisition.source.kind === 'RACE' ? acquisition.source.raceId : null,
      subrace_id: acquisition.source.kind === 'SUBRACE' ? acquisition.source.subraceId : null,
      timing_kind: acquisition.timing.kind,
      class_id: acquisition.timing.kind === 'CLASS_LEVEL' ? acquisition.timing.classId : null,
      class_level: acquisition.timing.kind === 'CLASS_LEVEL' ? acquisition.timing.classLevel : null
    })))

    await insertRows(trx, 'character_classes', json_data.intent.classes.map((characterClass) => ({
      character_id: json_data.id,
      class_id: characterClass.classId,
      subclass_id: characterClass.subclassId ?? null,
      subtype_id: characterClass.subtypeId ?? null,
      class_level: characterClass.classLevel
    })))

    await trx.insertInto('character_hitpoint_intent').values({
      character_id: json_data.id,
      method_code: json_data.intent.hitpoints.method
    })
      .execute()

    await insertRows(trx, 'character_hitpoint_levels', json_data.intent.hitpoints.levels.map((level) => ({
      character_id: json_data.id,
      char_level: level.level,
      value: level.value,
      overridden: level.overridden ?? null
    })))

    await insertRows(trx, 'character_hitpoint_level_rolls', json_data.intent.hitpoints.levels.flatMap((level) => (level.rolls ?? []).map((roll, index) => ({
      character_id: json_data.id,
      char_level: level.level,
      roll_index: index,
      die: roll.die,
      value: roll.value
    }))))

    await trx.insertInto('character_hitpoint_state').values({
      character_id: json_data.id,
      current: json_data.state.hitpoints.current,
      temp: json_data.state.hitpoints.temp ?? null,
      max_override: json_data.state.hitpoints.maxOverride ?? null
    })
      .execute()

    await insertRows(trx, 'character_hit_dice_state', json_data.state.hitpoints.hitDice.map((hitDie) => ({
      character_id: json_data.id,
      die: hitDie.die,
      total: hitDie.total,
      used: hitDie.used
    })))

    await insertRows(trx, 'character_class_spells', (json_data.state.classes ?? []).flatMap((classState) => [
      ...(classState.spells?.learned ?? []).map((spellId) => ({
        character_id: json_data.id,
        class_id: classState.classId,
        spell_id: spellId,
        state: 'KNOWN'
      })),
      ...(classState.spells?.prepared ?? []).map((spellId) => ({
        character_id: json_data.id,
        class_id: classState.classId,
        spell_id: spellId,
        state: 'PREPARED'
      }))
    ]))

    const orderedInventory = sortByDependency(json_data.state.equipment.inventory, (item) => item.id, (item) => item.containerId, `Character equipment for ${json_data.id}`)
    const inventoryIds = new Set(orderedInventory.map((item) => item.id))

    await insertRows(trx, 'character_equipment', orderedInventory.map((item) => ({
      id: item.id,
      character_id: json_data.id,
      equipment_id: item.equipmentId,
      quantity: item.quantity,
      container_id: item.containerId ?? null,
      container_path: null,
      custom_name: item.customName ?? null,
      notes: item.notes ?? null
    })))

    for (const equipmentId of json_data.state.equipment.equipped) {
      if (!inventoryIds.has(equipmentId)) {
        throw new Error(`Character ${json_data.id} equips missing inventory item ${equipmentId}.`)
      }
    }

    for (const equipmentId of json_data.state.equipment.attuned) {
      if (!inventoryIds.has(equipmentId)) {
        throw new Error(`Character ${json_data.id} attunes missing inventory item ${equipmentId}.`)
      }
    }

    await insertRows(trx, 'character_equipped', json_data.state.equipment.equipped.map((equipmentId) => ({
      character_id: json_data.id,
      equipment_id: equipmentId
    })))

    await insertRows(trx, 'character_attuned', json_data.state.equipment.attuned.map((equipmentId) => ({
      character_id: json_data.id,
      equipment_id: equipmentId
    })))

    const creatureRows = (json_data.state.creatures ?? []).map((creature: NonNullable<typeof json_data.state.creatures>[number]) => ({
      id: creature.id,
      character_id: json_data.id,
      creature_id: creature.creatureId,
      relationship_kind: creature.relationshipKind,
      custom_name: creature.customName ?? null,
      notes: creature.notes ?? null,
      is_active: creature.isActive ?? null
    }))

    const vehicleRows = (json_data.state.vehicles ?? []).map((vehicle: NonNullable<typeof json_data.state.vehicles>[number]) => ({
      id: vehicle.id,
      character_id: json_data.id,
      vehicle_id: vehicle.vehicleId,
      custom_name: vehicle.customName ?? null,
      notes: vehicle.notes ?? null,
      is_active: vehicle.isActive ?? null
    }))

    const creatureIds = new Set(creatureRows.map((row) => row.id))
    const vehicleIds = new Set(vehicleRows.map((row) => row.id))

    const creatureEquipmentRows = Object.entries(json_data.state.creatureEquipment ?? {}).flatMap(([creatureInstanceId, assignments]) => {
      if (!creatureIds.has(creatureInstanceId)) {
        throw new Error(`Character ${json_data.id} creature equipment references missing creature instance ${creatureInstanceId}.`)
      }

      return (assignments as NonNullable<typeof json_data.state.creatureEquipment>[string]).map((assignment) => {
        if (!inventoryIds.has(assignment.equipmentItemId)) {
          throw new Error(`Character ${json_data.id} creature equipment references missing inventory item ${assignment.equipmentItemId}.`)
        }

        return {
          character_id: json_data.id,
          character_creature_id: creatureInstanceId,
          equipment_id: assignment.equipmentItemId
        }
      })
    })

    const vehicleEquipmentRows = Object.entries(json_data.state.vehicleEquipment ?? {}).flatMap(([vehicleInstanceId, assignments]) => {
      if (!vehicleIds.has(vehicleInstanceId)) {
        throw new Error(`Character ${json_data.id} vehicle equipment references missing vehicle instance ${vehicleInstanceId}.`)
      }

      return (assignments as NonNullable<typeof json_data.state.vehicleEquipment>[string]).map((assignment) => {
        if (!inventoryIds.has(assignment.equipmentItemId)) {
          throw new Error(`Character ${json_data.id} vehicle equipment references missing inventory item ${assignment.equipmentItemId}.`)
        }

        return {
          character_id: json_data.id,
          character_vehicle_id: vehicleInstanceId,
          equipment_id: assignment.equipmentItemId
        }
      })
    })

    await insertRows(trx, 'character_creatures', creatureRows)
    await insertRows(trx, 'character_vehicles', vehicleRows)
    await insertRows(trx, 'character_creature_equipment', creatureEquipmentRows)
    await insertRows(trx, 'character_vehicle_equipment', vehicleEquipmentRows)

    const currencyGroupRows = json_data.state.currency.map((group, index) => ({
      id: `${json_data.id}::currency-group::${index + 1}`,
      character_id: json_data.id,
      container_id: group.containerId ?? null
    }))

    for (const group of json_data.state.currency) {
      if (group.containerId && !inventoryIds.has(group.containerId)) {
        throw new Error(`Character ${json_data.id} currency group references missing container ${group.containerId}.`)
      }
    }

    await insertRows(trx, 'character_currency_groups', currencyGroupRows)

    await insertRows(trx, 'character_currencies', json_data.state.currency.flatMap((group, index) => group.currencies.map((currency) => ({
      group_id: currencyGroupRows[index]?.id,
      currency_id: currency.currencyId,
      amount: currency.amount
    }))))

    const orderedFeatureAcquisitions = sortByDependency(json_data.intent.featureAcquisitions, (acquisition) => acquisition.id, (acquisition) => acquisition.source.kind === 'OPTION'
      ? acquisition.source.acquiredParentId
      : undefined, `Character feature acquisitions for ${json_data.id}`)
    const featureAcquisitionIds = new Set(orderedFeatureAcquisitions.map((acquisition) => acquisition.id))

    await insertRows(trx, 'character_feature_acquisitions', orderedFeatureAcquisitions.map((acquisition) => ({
      id: acquisition.id,
      character_id: json_data.id,
      feature_id: acquisition.featureId,
      ...mapFeatureSource(acquisition.source),
      ...mapTiming(acquisition.timing)
    })))

    await insertRows(trx, 'character_feature_selection_records', orderedFeatureAcquisitions.flatMap((acquisition) => (acquisition.selections ?? []).map((selection) => ({
      feature_acquisition_id: acquisition.id,
      selection_key: selection.selectionKey
    }))))

    await insertRows(trx, 'character_feature_selection_values', orderedFeatureAcquisitions.flatMap((acquisition) => (acquisition.selections ?? []).flatMap((selection) => selection.values.map((value, index) => ({
      feature_acquisition_id: acquisition.id,
      selection_key: selection.selectionKey,
      value_index: index,
      ...serializeSelectionValue(value)
    })))))

    const orderedSpellSelections = sortByDependency(json_data.intent.spellSelections ?? [], (selection) => selection.id, (selection) => selection.replacedSelectionId, `Character spell selections for ${json_data.id}`)

    for (const selection of orderedSpellSelections) {
      if (selection.source.kind === 'OPTION' && !featureAcquisitionIds.has(selection.source.acquiredParentId)) {
        throw new Error(`Character ${json_data.id} spell selection ${selection.id} references missing feature acquisition ${selection.source.acquiredParentId}.`)
      }
    }

    await insertRows(trx, 'character_spell_selections', orderedSpellSelections.map((selection) => ({
      id: selection.id,
      character_id: json_data.id,
      ...mapSpellSelectionSource(selection.source),
      ...mapTiming(selection.timing),
      replaced_selection_id: selection.replacedSelectionId ?? null
    })))

    await insertRows(trx, 'character_spell_selection_spells', orderedSpellSelections.flatMap((selection) => selection.spells.map((spellId) => ({
      selection_id: selection.id,
      spell_id: spellId
    }))))

    const resourceGrantRows = json_data.intent.resourceGrants ?? []

    for (const resourceGrant of resourceGrantRows) {
      if (resourceGrant.source.kind === 'OPTION' && !featureAcquisitionIds.has(resourceGrant.source.acquiredParentId)) {
        throw new Error(`Character ${json_data.id} resource grant ${resourceGrant.id} references missing feature acquisition ${resourceGrant.source.acquiredParentId}.`)
      }
    }

    await insertRows(trx, 'character_resource_grants', resourceGrantRows.map((resourceGrant) => ({
      id: resourceGrant.id,
      character_id: json_data.id,
      resource_id: resourceGrant.resourceId,
      ...mapResourceGrantSource(resourceGrant.source),
      ...mapTiming(resourceGrant.timing)
    })))

    await insertRows(trx, 'character_resources', (json_data.state.resources ?? []).map((resource) => ({
      character_id: json_data.id,
      resource_grant_id: resource.resourceGrantId,
      used: resource.used
    })))

    await trx.insertInto('character_abilities').values({
      character_id: json_data.id,
      method_code: json_data.intent.abilities.method
    })
      .execute()

    switch (json_data.intent.abilities.method) {
      case CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY:
        await insertRows(trx, 'character_abilities_standard_array', json_data.intent.abilities.assignments.map((assignment) => ({
          character_id: json_data.id,
          ability_code: assignment.ability,
          option_code: assignment.option
        })))
        break

      case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
        await trx.insertInto('character_abilities_point_buy').values({
          character_id: json_data.id
        })
          .execute()

        await insertRows(trx, 'character_abilities_point_buy_distributed', json_data.intent.abilities.assignments.map((assignment) => ({
          character_id: json_data.id,
          ability_code: assignment.ability,
          option_code: assignment.option
        })))
        break

      case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED: {
        await trx.insertInto('character_abilities_manual_rolled').values({
          character_id: json_data.id,
          configuration: json_data.intent.abilities.state.configuration ?? null
        })
          .execute()

        const groupRows = (json_data.intent.abilities.state.rollGroups ?? []).map((group, index) => ({
          character_id: json_data.id,
          group_index: index,
          id: group.id,
          assigned_ability_code: group.assignedAbility ?? null,
          score: group.score,
          applied: group.applied ?? null,
          rolling: group.rolling ?? null
        }))

        await insertRows(trx, 'character_abilities_manual_rolled_groups', groupRows)

        const manualRollRows = (json_data.intent.abilities.state.rollGroups ?? []).flatMap((group, groupIndex) => {
          const keptCounts = countRolls(group.kept)

          return group.rolls.map((roll, rollIndex) => {
            const key = `${roll.die}:${roll.value}`
            const remaining = keptCounts.get(key) ?? 0
            const isKept = remaining > 0

            if (isKept) {
              keptCounts.set(key, remaining - 1)
            }

            return {
              character_id: json_data.id,
              group_index: groupIndex,
              roll_index: rollIndex,
              die: roll.die,
              value: roll.value,
              is_kept: isKept
            }
          })
        })

        await insertRows(trx, 'character_abilities_manual_rolled_rolls', manualRollRows)

        await insertRows(trx, 'character_abilities_manual_assignments', json_data.intent.abilities.state.assignments.map((assignment) => ({
          character_id: json_data.id,
          ability_code: assignment.ability,
          score: assignment.score
        })))
        break
      }

      default:
        assertNever(json_data.intent.abilities)
    }

    const classEquipmentDecision = json_data.intent.startingEquipment?.class

    if (classEquipmentDecision) {
      await trx.insertInto('character_class_equipment_session').values({
        character_id: json_data.id,
        option: null,
        gold_option: classEquipmentDecision.gold?.goldOption ?? null,
        total_gold: classEquipmentDecision.gold?.totalGold ?? null,
        applied: classEquipmentDecision.applied ?? null
      })
        .execute()

      await insertRows(trx, 'character_class_equipment_groups', (classEquipmentDecision.groups ?? []).map((group) => ({
        character_id: json_data.id,
        group_id: group.groupId,
        option_id: group.optionId
      })))

      await insertRows(trx, 'character_class_equipment_items', (classEquipmentDecision.groups ?? []).flatMap((group) => (group.selections ?? []).map((selection) => ({
        character_id: json_data.id,
        group_id: group.groupId,
        selection_item_id: selection.selectionKey,
        equipment_id: selection.equipmentId,
        quantity: selection.quantity
      }))))
    }

    const backgroundEquipmentDecision = json_data.intent.startingEquipment?.background

    if (backgroundEquipmentDecision) {
      await trx.insertInto('character_background_equipment_session').values({
        character_id: json_data.id,
        applied: backgroundEquipmentDecision.applied ?? null
      })
        .execute()

      await insertRows(trx, 'character_background_equipment_groups', (backgroundEquipmentDecision.groups ?? []).map((group) => ({
        character_id: json_data.id,
        group_id: group.groupId,
        option_id: group.optionId
      })))

      await insertRows(trx, 'character_background_equipment_items', (backgroundEquipmentDecision.groups ?? []).flatMap((group) => (group.selections ?? []).map((selection) => ({
        character_id: json_data.id,
        group_id: group.groupId,
        selection_item_id: selection.selectionKey,
        equipment_id: selection.equipmentId,
        quantity: selection.quantity
      }))))
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
