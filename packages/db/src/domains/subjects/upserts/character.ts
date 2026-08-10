import type { DBLike } from '#types'
import {
  ADVANCEMENT_METHOD_CODE,
  CHARACTER_ABILITY_GENERATION_METHOD
} from '@artificer-toolkit/shared/core'
import {
  getCharacterChosenGrantSelectionIdentityKey,
  type CharacterAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { assertNever, withTransaction } from '../../../utils/index.js'
import { normalizeSubjectStatus } from '../status.js'
import { replaceCharacterCurrency, replaceCharacterInventoryItems } from './characterInventory.js'
import {
  mapChosenGrantSelectionSource,
  mapFeatureSource,
  mapResourceGrantSource,
  mapSpellSelectionSource,
  mapTiming,
  serializeSelectionValue
} from './characterGrants.js'
import { countRolls, sortByDependency } from './characterSorting.js'
import { deleteExistingCharacterChildren, insertRows } from './characterRows.js'

export async function upsertCharacter(
  db: DBLike,
  json_data: CharacterAuthored,
  options: {
    expectedStreamVersion?: number
    incrementStreamVersion?: boolean
    afterPersist?: (trx: DBLike, nextStreamVersion: number) => Promise<void>
  } = {}
): Promise<number> {
  const chosenGrantSelectionIdentities = new Set<string>()
  for (const selection of json_data.intent.chosenGrantSelections ?? []) {
    const identity = getCharacterChosenGrantSelectionIdentityKey(selection)
    if (chosenGrantSelectionIdentities.has(identity)) {
      throw new Error(
        `Character ${json_data.id} contains duplicate chosen grant selection identity ${identity}.`
      )
    }
    chosenGrantSelectionIdentities.add(identity)
  }

  return withTransaction(db, async (trx) => {
    const lockedVersionRow = await trx
      .selectFrom('characters')
      .select('stream_version')
      .where('id', '=', json_data.id)
      .forUpdate()
      .executeTakeFirst()
    const lockedStreamVersion = lockedVersionRow?.stream_version ?? 0

    if (
      options.expectedStreamVersion != null &&
      lockedStreamVersion !== options.expectedStreamVersion
    ) {
      const error = new Error(
        `Character "${json_data.id}" stream_version conflict: expected ${options.expectedStreamVersion}.`
      )
      error.name = 'ConcurrencyError'
      throw error
    }

    const nextStreamVersion = options.incrementStreamVersion
      ? lockedStreamVersion + 1
      : lockedStreamVersion

    await trx
      .insertInto('characters')
      .values({
        id: json_data.id,
        system_id: json_data.systemId,
        user_id: json_data.userId,
        label: json_data.label,
        description: json_data.description ?? null,
        status: normalizeSubjectStatus(json_data.status),
        inspiration: json_data.state.inspiration ?? false,
        stream_version: nextStreamVersion
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          system_id: eb.ref('excluded.system_id'),
          user_id: eb.ref('excluded.user_id'),
          label: eb.ref('excluded.label'),
          description: eb.ref('excluded.description'),
          status: eb.ref('excluded.status'),
          inspiration: eb.ref('excluded.inspiration'),
          stream_version: eb.ref('excluded.stream_version')
        }))
      )
      .execute()

    await deleteExistingCharacterChildren(trx, json_data.id)

    await trx
      .insertInto('character_profile')
      .values({
        character_id: json_data.id,
        alignment_id: json_data.profile.alignmentId ?? null,
        lifestyle_id: json_data.profile.lifestyleId ?? null,
        faith: json_data.profile.faith ?? null,
        gender: json_data.profile.gender ?? null,
        age: json_data.profile.age ?? null,
        eyes: json_data.profile.eyes ?? null,
        hair: json_data.profile.hair ?? null,
        skin: json_data.profile.skin ?? null,
        height: json_data.profile.height ?? null,
        weight: json_data.profile.weight ?? null,
        physical_characteristics: json_data.profile.physicalCharacteristics ?? null,
        personality_traits: json_data.profile.personalityTraits ?? null,
        ideals: json_data.profile.ideals ?? null,
        bonds: json_data.profile.bonds ?? null,
        flaws: json_data.profile.flaws ?? null,
        organizations: json_data.profile.organizations ?? null,
        allies: json_data.profile.allies ?? null,
        enemies: json_data.profile.enemies ?? null,
        backstory: json_data.profile.backstory ?? null,
        notes: json_data.profile.notes ?? null
      })
      .execute()

    await trx
      .insertInto('character_advancement')
      .values({
        character_id: json_data.id,
        method_code: json_data.intent.advancement.method,
        experience:
          json_data.intent.advancement.method === ADVANCEMENT_METHOD_CODE.EXPERIENCE
            ? (json_data.intent.advancement.experience ?? null)
            : null
      })
      .execute()

    await trx
      .insertInto('character_race')
      .values({
        character_id: json_data.id,
        race_id: json_data.intent.race.raceId,
        subrace_id: json_data.intent.race.subraceId ?? null
      })
      .execute()

    await trx
      .insertInto('character_background')
      .values({
        character_id: json_data.id,
        background_id: json_data.intent.background.backgroundId
      })
      .execute()

    await insertRows(
      trx,
      'character_ancestry_acquisitions',
      (json_data.intent.ancestrySelections ?? []).map((acquisition) => ({
        id: acquisition.id,
        character_id: json_data.id,
        ancestry_id: acquisition.ancestryId,
        option_id: acquisition.optionId,
        source_kind: acquisition.source.kind,
        race_id: acquisition.source.kind === 'RACE' ? acquisition.source.raceId : null,
        subrace_id: acquisition.source.kind === 'SUBRACE' ? acquisition.source.subraceId : null,
        timing_kind: acquisition.timing.kind,
        class_id: acquisition.timing.kind === 'CLASS_LEVEL' ? acquisition.timing.classId : null,
        class_level:
          acquisition.timing.kind === 'CLASS_LEVEL' ? acquisition.timing.classLevel : null
      }))
    )

    await insertRows(
      trx,
      'character_classes',
      json_data.intent.classes.map((characterClass) => ({
        character_id: json_data.id,
        class_id: characterClass.classId,
        subclass_id: characterClass.subclassId ?? null,
        specialization_id: characterClass.specializationId ?? null,
        class_level: characterClass.classLevel,
        known_spells_overridden:
          json_data.state.classes?.find(
            (classState) => classState.classId === characterClass.classId
          )?.spells?.learned !== undefined
      }))
    )

    await trx
      .insertInto('character_hitpoint_intent')
      .values({
        character_id: json_data.id,
        method_code: json_data.intent.hitpoints.method
      })
      .execute()

    await insertRows(
      trx,
      'character_hitpoint_levels',
      json_data.intent.hitpoints.levels.map((level) => ({
        character_id: json_data.id,
        char_level: level.level,
        class_id: level.classId,
        class_level: level.classLevel,
        value: level.value,
        overridden: level.overridden ?? null
      }))
    )

    await insertRows(
      trx,
      'character_hitpoint_level_rolls',
      json_data.intent.hitpoints.levels.flatMap((level) =>
        (level.rolls ?? []).map((roll, index) => ({
          character_id: json_data.id,
          char_level: level.level,
          roll_index: index,
          die: roll.die,
          value: roll.value
        }))
      )
    )

    await trx
      .insertInto('character_hitpoint_state')
      .values({
        character_id: json_data.id,
        current: json_data.state.hitpoints.current,
        temp: json_data.state.hitpoints.temp ?? null,
        max_override: null
      })
      .execute()

    await insertRows(
      trx,
      'character_hit_dice_state',
      json_data.state.hitpoints.hitDice.map((hitDie) => ({
        character_id: json_data.id,
        die: hitDie.die,
        total: hitDie.total,
        used: hitDie.used
      }))
    )

    await insertRows(
      trx,
      'character_spell_slot_state',
      (json_data.state.spellSlots ?? []).map((slot) => ({
        character_id: json_data.id,
        slot_key: slot.slotKey,
        used: slot.used
      }))
    )

    await insertRows(
      trx,
      'character_conditions',
      (json_data.state.conditions ?? []).map((condition) => ({
        character_id: json_data.id,
        condition_type_id: condition.conditionTypeId,
        notes: condition.notes ?? null
      }))
    )

    if (json_data.state.exhaustion && json_data.state.exhaustion.level > 0) {
      await insertRows(trx, 'character_exhaustion', [
        {
          character_id: json_data.id,
          level: json_data.state.exhaustion.level,
          notes: json_data.state.exhaustion.notes ?? null
        }
      ])
    }

    const noteGroups = json_data.state.noteGroups ?? []
    const noteGroupIds = new Set<string>()
    for (const group of noteGroups) {
      if (noteGroupIds.has(group.id)) {
        throw new Error(`Character ${json_data.id} has duplicate note group ${group.id}.`)
      }
      noteGroupIds.add(group.id)
    }

    const notes = json_data.state.notes ?? []
    const noteIds = new Set<string>()
    for (const note of notes) {
      if (noteIds.has(note.id)) {
        throw new Error(`Character ${json_data.id} has duplicate note ${note.id}.`)
      }
      if (!noteGroupIds.has(note.groupId)) {
        throw new Error(
          `Character ${json_data.id} note ${note.id} references missing note group ${note.groupId}.`
        )
      }
      noteIds.add(note.id)
    }

    await insertRows(
      trx,
      'character_note_groups',
      noteGroups.map((group) => ({
        id: group.id,
        character_id: json_data.id,
        label: group.label,
        sort_order: group.sortOrder,
        kind: group.kind
      }))
    )

    await insertRows(
      trx,
      'character_notes',
      notes.map((note) => ({
        id: note.id,
        character_id: json_data.id,
        group_id: note.groupId,
        title: note.title,
        body: note.body ?? null,
        pinned: note.pinned ?? false,
        created_at: note.createdAt,
        updated_at: note.updatedAt
      }))
    )

    await insertRows(
      trx,
      'character_class_spells',
      (json_data.state.classes ?? []).flatMap((classState) => [
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
      ])
    )

    const orderedInventory = sortByDependency(
      json_data.state.equipment.inventory,
      (item) => item.id,
      (item) => item.containerId,
      `Character equipment for ${json_data.id}`
    )
    const inventoryIds = new Set(orderedInventory.map((item) => item.id))

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

    const creatureRows = (json_data.state.creatures ?? []).map(
      (creature: NonNullable<typeof json_data.state.creatures>[number]) => ({
        id: creature.id,
        character_id: json_data.id,
        creature_id: creature.creatureId,
        relationship_kind: creature.relationshipKind,
        origin_kind: creature.originKind,
        current_hit_points: creature.currentHitPoints ?? null,
        temp_hit_points: creature.tempHitPoints ?? null,
        custom_name: creature.customName ?? null,
        notes: creature.notes ?? null,
        is_active: creature.isActive ?? null
      })
    )

    const vehicleRows = (json_data.state.vehicles ?? []).map(
      (vehicle: NonNullable<typeof json_data.state.vehicles>[number]) => ({
        id: vehicle.id,
        character_id: json_data.id,
        vehicle_id: vehicle.vehicleId,
        current_hit_points: vehicle.currentHitPoints ?? null,
        custom_name: vehicle.customName ?? null,
        notes: vehicle.notes ?? null,
        is_active: vehicle.isActive ?? null
      })
    )

    const creatureIds = new Set(creatureRows.map((row) => row.id))
    const vehicleIds = new Set(vehicleRows.map((row) => row.id))

    const creatureHitDiceRows = (json_data.state.creatures ?? []).flatMap((creature) =>
      (creature.hitDice ?? []).map((hitDie) => ({
        character_id: json_data.id,
        character_creature_id: creature.id,
        die: hitDie.die,
        total: hitDie.total,
        used: hitDie.used
      }))
    )

    for (const creatureInstanceId of Object.keys(json_data.state.creatureEquipment ?? {})) {
      if (!creatureIds.has(creatureInstanceId)) {
        throw new Error(
          `Character ${json_data.id} creature equipment references missing creature instance ${creatureInstanceId}.`
        )
      }
    }
    for (const vehicleInstanceId of Object.keys(json_data.state.vehicleEquipment ?? {})) {
      if (!vehicleIds.has(vehicleInstanceId)) {
        throw new Error(
          `Character ${json_data.id} vehicle equipment references missing vehicle instance ${vehicleInstanceId}.`
        )
      }
    }

    await insertRows(trx, 'character_creatures', creatureRows)
    await insertRows(trx, 'character_vehicles', vehicleRows)
    await insertRows(trx, 'character_creature_hit_dice_state', creatureHitDiceRows)
    await replaceCharacterInventoryItems(
      trx,
      json_data.id,
      orderedInventory,
      json_data.state.equipment.equipped,
      json_data.state.equipment.attuned,
      json_data.state.creatureEquipment,
      json_data.state.vehicleEquipment,
      { resetMissingCurrencyContainers: true }
    )

    await replaceCharacterCurrency(trx, json_data.id, json_data.state.currency)

    const orderedFeatureAcquisitions = sortByDependency(
      json_data.intent.featureAcquisitions,
      (acquisition) => acquisition.id,
      (acquisition) =>
        acquisition.source.kind === 'OPTION' ? acquisition.source.acquiredParentId : undefined,
      `Character feature acquisitions for ${json_data.id}`
    )
    const featureAcquisitionIds = new Set(
      orderedFeatureAcquisitions.map((acquisition) => acquisition.id)
    )

    await insertRows(
      trx,
      'character_feature_acquisitions',
      orderedFeatureAcquisitions.map((acquisition) => ({
        id: acquisition.id,
        character_id: json_data.id,
        feature_id: acquisition.featureId,
        ...mapFeatureSource(acquisition.source),
        ...mapTiming(acquisition.timing)
      }))
    )

    await insertRows(
      trx,
      'character_feature_selection_records',
      orderedFeatureAcquisitions.flatMap((acquisition) =>
        (acquisition.selections ?? []).map((selection) => ({
          feature_acquisition_id: acquisition.id,
          selection_key: selection.selectionKey
        }))
      )
    )

    await insertRows(
      trx,
      'character_feature_selection_values',
      orderedFeatureAcquisitions.flatMap((acquisition) =>
        (acquisition.selections ?? []).flatMap((selection) =>
          selection.values.map((value, index) => ({
            feature_acquisition_id: acquisition.id,
            selection_key: selection.selectionKey,
            value_index: index,
            ...serializeSelectionValue(value)
          }))
        )
      )
    )

    const chosenGrantSelections = json_data.intent.chosenGrantSelections ?? []

    for (const selection of chosenGrantSelections) {
      if (
        selection.source.kind === 'OPTION' &&
        !featureAcquisitionIds.has(selection.source.acquiredParentId)
      ) {
        throw new Error(
          `Character ${json_data.id} chosen grant selection ${selection.id} references missing feature acquisition ${selection.source.acquiredParentId}.`
        )
      }
    }

    await insertRows(
      trx,
      'character_chosen_grant_selections',
      chosenGrantSelections.map((selection) => ({
        id: selection.id,
        character_id: json_data.id,
        grant_id: selection.grantId,
        ...mapChosenGrantSelectionSource(selection.source),
        ...mapTiming(selection.timing),
        progression_level: selection.progressionLevel ?? null
      }))
    )

    await insertRows(
      trx,
      'character_chosen_grant_selection_targets',
      chosenGrantSelections.flatMap((selection) =>
        selection.targetIds.map((targetId, slotIndex) => ({
          selection_id: selection.id,
          slot_index: slotIndex,
          target_id: targetId
        }))
      )
    )

    const orderedSpellSelections = sortByDependency(
      json_data.intent.spellSelections ?? [],
      (selection) => selection.id,
      (selection) => selection.replacedSelectionId,
      `Character spell selections for ${json_data.id}`
    )

    for (const selection of orderedSpellSelections) {
      if (
        selection.source.kind === 'OPTION' &&
        !featureAcquisitionIds.has(selection.source.acquiredParentId)
      ) {
        throw new Error(
          `Character ${json_data.id} spell selection ${selection.id} references missing feature acquisition ${selection.source.acquiredParentId}.`
        )
      }
    }

    await insertRows(
      trx,
      'character_spell_selections',
      orderedSpellSelections.map((selection) => ({
        id: selection.id,
        character_id: json_data.id,
        ...mapSpellSelectionSource(selection.source),
        ...mapTiming(selection.timing),
        replaced_selection_id: selection.replacedSelectionId ?? null
      }))
    )

    await insertRows(
      trx,
      'character_spell_selection_spells',
      orderedSpellSelections.flatMap((selection) =>
        selection.spells.map((spellId) => ({
          selection_id: selection.id,
          spell_id: spellId
        }))
      )
    )

    const resourceGrantRows = json_data.intent.resourceGrants ?? []

    for (const resourceGrant of resourceGrantRows) {
      if (
        resourceGrant.source.kind === 'OPTION' &&
        !featureAcquisitionIds.has(resourceGrant.source.acquiredParentId)
      ) {
        throw new Error(
          `Character ${json_data.id} resource grant ${resourceGrant.id} references missing feature acquisition ${resourceGrant.source.acquiredParentId}.`
        )
      }
    }

    await insertRows(
      trx,
      'character_resource_grants',
      resourceGrantRows.map((resourceGrant) => ({
        id: resourceGrant.id,
        character_id: json_data.id,
        resource_id: resourceGrant.resourceId,
        ...mapResourceGrantSource(resourceGrant.source),
        ...mapTiming(resourceGrant.timing)
      }))
    )

    await insertRows(
      trx,
      'character_resources',
      (json_data.state.resources ?? []).map((resource) => ({
        character_id: json_data.id,
        resource_grant_id: resource.resourceGrantId,
        used: resource.used
      }))
    )

    await trx
      .insertInto('character_abilities')
      .values({
        character_id: json_data.id,
        method_code: json_data.intent.abilities.method
      })
      .execute()

    switch (json_data.intent.abilities.method) {
      case CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY:
        await insertRows(
          trx,
          'character_abilities_standard_array',
          json_data.intent.abilities.assignments.map((assignment) => ({
            character_id: json_data.id,
            ability_code: assignment.ability,
            option_code: assignment.option
          }))
        )
        break

      case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
        await trx
          .insertInto('character_abilities_point_buy')
          .values({
            character_id: json_data.id
          })
          .execute()

        await insertRows(
          trx,
          'character_abilities_point_buy_distributed',
          json_data.intent.abilities.assignments.map((assignment) => ({
            character_id: json_data.id,
            ability_code: assignment.ability,
            option_code: assignment.option
          }))
        )
        break

      case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED: {
        await trx
          .insertInto('character_abilities_manual_rolled')
          .values({
            character_id: json_data.id,
            configuration: json_data.intent.abilities.state.configuration ?? null
          })
          .execute()

        const groupRows = (json_data.intent.abilities.state.rollGroups ?? []).map(
          (group, index) => ({
            character_id: json_data.id,
            group_index: index,
            id: group.id,
            assigned_ability_code: group.assignedAbility ?? null,
            score: group.score,
            applied: group.applied ?? null,
            rolling: group.rolling ?? null
          })
        )

        await insertRows(trx, 'character_abilities_manual_rolled_groups', groupRows)

        const manualRollRows = (json_data.intent.abilities.state.rollGroups ?? []).flatMap(
          (group, groupIndex) => {
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
          }
        )

        await insertRows(trx, 'character_abilities_manual_rolled_rolls', manualRollRows)

        await insertRows(
          trx,
          'character_abilities_manual_assignments',
          json_data.intent.abilities.state.assignments.map((assignment) => ({
            character_id: json_data.id,
            ability_code: assignment.ability,
            score: assignment.score
          }))
        )
        break
      }

      default:
        assertNever(json_data.intent.abilities)
    }

    const classEquipmentDecision = json_data.intent.startingEquipment?.class

    if (classEquipmentDecision) {
      await trx
        .insertInto('character_class_equipment_session')
        .values({
          character_id: json_data.id,
          option: null,
          gold_option: classEquipmentDecision.gold?.goldOption ?? null,
          total_gold: classEquipmentDecision.gold?.totalGold ?? null,
          applied: classEquipmentDecision.applied ?? null
        })
        .execute()

      await insertRows(
        trx,
        'character_class_equipment_groups',
        (classEquipmentDecision.groups ?? []).map((group) => ({
          character_id: json_data.id,
          group_id: group.groupId,
          option_id: group.optionId
        }))
      )

      await insertRows(
        trx,
        'character_class_equipment_items',
        (classEquipmentDecision.groups ?? []).flatMap((group) =>
          (group.selections ?? []).map((selection) => ({
            character_id: json_data.id,
            group_id: group.groupId,
            selection_item_id: selection.selectionKey,
            equipment_id: selection.equipmentId,
            quantity: selection.quantity
          }))
        )
      )
    }

    const backgroundEquipmentDecision = json_data.intent.startingEquipment?.background

    if (backgroundEquipmentDecision) {
      await trx
        .insertInto('character_background_equipment_session')
        .values({
          character_id: json_data.id,
          applied: backgroundEquipmentDecision.applied ?? null
        })
        .execute()

      await insertRows(
        trx,
        'character_background_equipment_groups',
        (backgroundEquipmentDecision.groups ?? []).map((group) => ({
          character_id: json_data.id,
          group_id: group.groupId,
          option_id: group.optionId
        }))
      )

      await insertRows(
        trx,
        'character_background_equipment_items',
        (backgroundEquipmentDecision.groups ?? []).flatMap((group) =>
          (group.selections ?? []).map((selection) => ({
            character_id: json_data.id,
            group_id: group.groupId,
            selection_item_id: selection.selectionKey,
            equipment_id: selection.equipmentId,
            quantity: selection.quantity
          }))
        )
      )
    }

    await options.afterPersist?.(trx, nextStreamVersion)

    return nextStreamVersion
  })
}
