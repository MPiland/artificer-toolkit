import {
  characterSheetAdjustmentDtoSchema,
  type CharacterMovementDisplayPreferenceDto
} from '@artificer-toolkit/schema/api/characterSheet'
import type {
  CharacterSheetAdjustment,
  CharacterSheetAdjustmentWrite
} from '@artificer-toolkit/shared/character'
import type { DBLike } from '#types'

type AdjustmentFamily = CharacterSheetAdjustment['family']

export interface CharacterSheetAdjustmentRepository {
  listByCharacter(characterId: string): Promise<CharacterSheetAdjustment[]>
  upsert(adjustment: CharacterSheetAdjustmentWrite): Promise<CharacterSheetAdjustment>
  remove(input: {
    characterId: string
    adjustmentId: string
    family: AdjustmentFamily
  }): Promise<boolean>
  getMovementPreference(characterId: string): Promise<CharacterMovementDisplayPreferenceDto>
  setMovementPreference(input: {
    characterId: string
    actorId: string
    preference: CharacterMovementDisplayPreferenceDto
  }): Promise<CharacterMovementDisplayPreferenceDto>
}

interface AdjustmentMetadataRow {
  id: string
  character_id: string
  source_category: string
  source_label: string | null
  source_note: string | null
  created_by: string
  updated_by: string
  created_at: Date | string
  updated_at: Date | string
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function metadata(row: AdjustmentMetadataRow) {
  return {
    id: row.id,
    characterId: row.character_id,
    sourceCategory: row.source_category,
    ...(row.source_label == null ? {} : { sourceLabel: row.source_label }),
    ...(row.source_note == null ? {} : { sourceNote: row.source_note }),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function parseAdjustment(
  row: AdjustmentMetadataRow,
  value: Record<string, unknown>
): CharacterSheetAdjustment {
  return characterSheetAdjustmentDtoSchema.parse({
    ...value,
    ...metadata(row)
  })
}

function tableForFamily(family: AdjustmentFamily) {
  switch (family) {
    case 'ABILITY':
      return 'character_ability_adjustments'
    case 'SAVING_THROW':
      return 'character_saving_throw_adjustments'
    case 'SKILL':
      return 'character_skill_adjustments'
    case 'PASSIVE':
      return 'character_passive_adjustments'
    case 'SENSE':
      return 'character_sense_adjustments'
    case 'MOVEMENT':
      return 'character_movement_adjustments'
    case 'HIT_POINTS':
      return 'character_hitpoint_adjustments'
    case 'SPELL':
      return 'character_spell_adjustments'
    case 'ITEM':
      return 'character_item_adjustments'
    case 'COMPANION':
      return 'character_companion_adjustments'
    case 'DEFENSE':
      return 'character_defense_additions'
    case 'PROFICIENCY':
      return 'character_proficiency_additions'
  }
}

export function createCharacterSheetAdjustmentRepository(
  db: DBLike
): CharacterSheetAdjustmentRepository {
  return {
    async listByCharacter(characterId) {
      const [
        abilities,
        savingThrows,
        skills,
        passives,
        senses,
        movement,
        hitPoints,
        spells,
        items,
        companions,
        defenses,
        proficiencies
      ] = await Promise.all([
        db
          .selectFrom('character_ability_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_saving_throw_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_skill_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_passive_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_sense_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_movement_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_hitpoint_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_spell_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_item_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_companion_adjustments')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_defense_additions')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute(),
        db
          .selectFrom('character_proficiency_additions')
          .selectAll()
          .where('character_id', '=', characterId)
          .execute()
      ])

      const adjustments: CharacterSheetAdjustment[] = [
        ...abilities.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'ABILITY',
            ability: row.ability_code,
            field: row.field_kind,
            value: row.integer_value
          })
        ),
        ...savingThrows.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'SAVING_THROW',
            ability: row.ability_code,
            field: row.field_kind,
            value: row.integer_value ?? row.proficiency_value
          })
        ),
        ...skills.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'SKILL',
            skillId: row.skill_id,
            field: row.field_kind,
            value: row.integer_value ?? row.proficiency_value ?? row.ability_value
          })
        ),
        ...passives.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'PASSIVE',
            skillId: row.skill_id,
            field: 'TOTAL_OVERRIDE',
            value: row.integer_value
          })
        ),
        ...senses.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'SENSE',
            senseId: row.sense_id,
            field: 'RANGE_OVERRIDE',
            value: row.integer_value
          })
        ),
        ...movement.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'MOVEMENT',
            speedId: row.speed_id,
            field: 'SPEED_OVERRIDE',
            value: row.integer_value
          })
        ),
        ...hitPoints.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'HIT_POINTS',
            field: row.field_kind,
            value: row.integer_value
          })
        ),
        ...spells.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'SPELL',
            source: {
              spellId: row.spell_id,
              sourceKind: row.source_kind,
              sourceInstanceId: row.source_instance_id
            },
            field: row.field_kind,
            value: row.integer_value
          })
        ),
        ...items.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'ITEM',
            itemInstanceId: row.item_instance_id,
            field: row.field_kind,
            value: row.boolean_value ?? Number(row.numeric_value)
          })
        ),
        ...companions.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'COMPANION',
            companionInstanceId: row.companion_instance_id,
            field: row.field_kind,
            value: row.integer_value ?? row.reference_value ?? row.text_value
          })
        ),
        ...defenses.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'DEFENSE',
            defenseKind: row.defense_kind,
            damageTypeId: row.damage_type_id,
            field: 'ADDITION',
            value: true
          })
        ),
        ...proficiencies.map((row) =>
          parseAdjustment(row, {
            id: row.id,
            characterId: row.character_id,
            actorId: row.updated_by,
            family: 'PROFICIENCY',
            proficiencyKind: row.proficiency_kind,
            targetId: row.target_id,
            field: 'ADDITION',
            value: true
          })
        )
      ]

      return adjustments.sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      )
    },

    async upsert(adjustment) {
      const common = {
        id: adjustment.id,
        character_id: adjustment.characterId,
        source_category: adjustment.sourceCategory ?? 'MANUAL',
        source_label: adjustment.sourceLabel ?? null,
        source_note: adjustment.sourceNote ?? null,
        created_by: adjustment.actorId,
        updated_by: adjustment.actorId
      }

      switch (adjustment.family) {
        case 'ABILITY': {
          const row = await db
            .insertInto('character_ability_adjustments')
            .values({
              ...common,
              ability_code: adjustment.ability,
              field_kind: adjustment.field,
              integer_value: adjustment.value
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'ability_code', 'field_kind']).doUpdateSet({
                integer_value: adjustment.value,
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'SAVING_THROW': {
          const integerValue = typeof adjustment.value === 'number' ? adjustment.value : null
          const proficiencyValue = typeof adjustment.value === 'string' ? adjustment.value : null
          const row = await db
            .insertInto('character_saving_throw_adjustments')
            .values({
              ...common,
              ability_code: adjustment.ability,
              field_kind: adjustment.field,
              integer_value: integerValue,
              proficiency_value: proficiencyValue
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'ability_code', 'field_kind']).doUpdateSet({
                integer_value: integerValue,
                proficiency_value: proficiencyValue,
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'SKILL': {
          const integerValue = typeof adjustment.value === 'number' ? adjustment.value : null
          const proficiencyValue =
            adjustment.field === 'PROFICIENCY_OVERRIDE' ? adjustment.value : null
          const abilityValue =
            adjustment.field === 'GOVERNING_ABILITY_OVERRIDE' ? adjustment.value : null
          const row = await db
            .insertInto('character_skill_adjustments')
            .values({
              ...common,
              skill_id: adjustment.skillId,
              field_kind: adjustment.field,
              integer_value: integerValue,
              proficiency_value: proficiencyValue,
              ability_value: abilityValue
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'skill_id', 'field_kind']).doUpdateSet({
                integer_value: integerValue,
                proficiency_value: proficiencyValue,
                ability_value: abilityValue,
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'PASSIVE': {
          const row = await db
            .insertInto('character_passive_adjustments')
            .values({
              ...common,
              skill_id: adjustment.skillId,
              field_kind: adjustment.field,
              integer_value: adjustment.value
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'skill_id', 'field_kind']).doUpdateSet({
                integer_value: adjustment.value,
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'SENSE': {
          const row = await db
            .insertInto('character_sense_adjustments')
            .values({
              ...common,
              sense_id: adjustment.senseId,
              field_kind: adjustment.field,
              integer_value: adjustment.value
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'sense_id', 'field_kind']).doUpdateSet({
                integer_value: adjustment.value,
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'MOVEMENT': {
          const row = await db
            .insertInto('character_movement_adjustments')
            .values({
              ...common,
              speed_id: adjustment.speedId,
              field_kind: adjustment.field,
              integer_value: adjustment.value
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'speed_id', 'field_kind']).doUpdateSet({
                integer_value: adjustment.value,
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'HIT_POINTS': {
          const row = await db
            .insertInto('character_hitpoint_adjustments')
            .values({
              ...common,
              field_kind: adjustment.field,
              integer_value: adjustment.value
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'field_kind']).doUpdateSet({
                integer_value: adjustment.value,
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'SPELL': {
          const row = await db
            .insertInto('character_spell_adjustments')
            .values({
              ...common,
              spell_id: adjustment.source.spellId,
              source_kind: adjustment.source.sourceKind,
              source_instance_id: adjustment.source.sourceInstanceId,
              field_kind: adjustment.field,
              integer_value: adjustment.value
            })
            .onConflict((conflict) =>
              conflict
                .columns([
                  'character_id',
                  'spell_id',
                  'source_kind',
                  'source_instance_id',
                  'field_kind'
                ])
                .doUpdateSet({
                  integer_value: adjustment.value,
                  source_category: common.source_category,
                  source_label: common.source_label,
                  source_note: common.source_note,
                  updated_by: adjustment.actorId
                })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'ITEM': {
          const numericValue = typeof adjustment.value === 'number' ? adjustment.value : null
          const booleanValue = typeof adjustment.value === 'boolean' ? adjustment.value : null
          const row = await db
            .insertInto('character_item_adjustments')
            .values({
              ...common,
              item_instance_id: adjustment.itemInstanceId,
              field_kind: adjustment.field,
              numeric_value: numericValue,
              boolean_value: booleanValue
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'item_instance_id', 'field_kind']).doUpdateSet({
                numeric_value: numericValue,
                boolean_value: booleanValue,
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'COMPANION': {
          const integerValue = typeof adjustment.value === 'number' ? adjustment.value : null
          const referenceValue =
            adjustment.field === 'ALIGNMENT_OVERRIDE' ||
            adjustment.field === 'CREATURE_TYPE_OVERRIDE'
              ? adjustment.value
              : null
          const textValue = adjustment.field === 'SIZE_OVERRIDE' ? adjustment.value : null
          const row = await db
            .insertInto('character_companion_adjustments')
            .values({
              ...common,
              companion_instance_id: adjustment.companionInstanceId,
              field_kind: adjustment.field,
              integer_value: integerValue,
              reference_value: referenceValue,
              text_value: textValue
            })
            .onConflict((conflict) =>
              conflict
                .columns(['character_id', 'companion_instance_id', 'field_kind'])
                .doUpdateSet({
                  integer_value: integerValue,
                  reference_value: referenceValue,
                  text_value: textValue,
                  source_category: common.source_category,
                  source_label: common.source_label,
                  source_note: common.source_note,
                  updated_by: adjustment.actorId
                })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'DEFENSE': {
          const row = await db
            .insertInto('character_defense_additions')
            .values({
              ...common,
              defense_kind: adjustment.defenseKind,
              damage_type_id: adjustment.damageTypeId
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'defense_kind', 'damage_type_id']).doUpdateSet({
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
        case 'PROFICIENCY': {
          const row = await db
            .insertInto('character_proficiency_additions')
            .values({
              ...common,
              proficiency_kind: adjustment.proficiencyKind,
              target_id: adjustment.targetId
            })
            .onConflict((conflict) =>
              conflict.columns(['character_id', 'proficiency_kind', 'target_id']).doUpdateSet({
                source_category: common.source_category,
                source_label: common.source_label,
                source_note: common.source_note,
                updated_by: adjustment.actorId
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow()
          return parseAdjustment(row, adjustment)
        }
      }
    },

    async remove({ characterId, adjustmentId, family }) {
      const result = await db
        .deleteFrom(tableForFamily(family))
        .where('character_id', '=', characterId)
        .where('id', '=', adjustmentId)
        .executeTakeFirst()
      return Number(result.numDeletedRows) > 0
    },

    async getMovementPreference(characterId) {
      const row = await db
        .selectFrom('character_sheet_preferences')
        .select(['movement_display_mode', 'movement_speed_id'])
        .where('character_id', '=', characterId)
        .executeTakeFirst()
      if (!row || row.movement_display_mode === 'AUTO') {
        return { mode: 'AUTO' }
      }
      return {
        mode: 'EXPLICIT',
        speedId: row.movement_speed_id!
      }
    },

    async setMovementPreference({ characterId, actorId, preference }) {
      await db
        .insertInto('character_sheet_preferences')
        .values({
          character_id: characterId,
          movement_display_mode: preference.mode,
          movement_speed_id: preference.mode === 'EXPLICIT' ? preference.speedId : null,
          updated_by: actorId
        })
        .onConflict((conflict) =>
          conflict.column('character_id').doUpdateSet({
            movement_display_mode: preference.mode,
            movement_speed_id: preference.mode === 'EXPLICIT' ? preference.speedId : null,
            updated_by: actorId
          })
        )
        .execute()
      return preference
    }
  }
}
