import {
  createCharacterSpellSourceKey,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import type {
  CharacterSheetCommandInputDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterSheetAdjustmentCommandDto } from '@artificer-toolkit/schema/api/characterSheet'
import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'
import type { CharacterBuilderResolution } from './builderTypes.js'
import { CharacterSheetCommandError, formatCodeLabel } from './sheetCommandReducer.js'

type CharacterSheetAdjustmentCommand = CharacterSheetAdjustmentCommandDto

export function validateSheetAdjustmentTarget(
  input: CharacterSheetAdjustmentCommand,
  resolution: CharacterBuilderResolution,
  character: CharacterAuthored
): void {
  const system = resolution.registry.system
  const ensureVocabularyTarget = (
    records: ReadonlyArray<{ id: string }> | undefined,
    targetId: string,
    label: string
  ) => {
    if (!records?.some((record) => record.id === targetId)) {
      throw new CharacterSheetCommandError(
        `${label} "${targetId}" is not available in this rules system.`
      )
    }
  }

  switch (input.family) {
    case 'ABILITY':
    case 'SAVING_THROW':
      if (!systemCoreCodeRegistry.abilityCodes(character.systemId).includes(input.ability)) {
        throw new CharacterSheetCommandError(`Ability "${input.ability}" is not available.`)
      }
      return
    case 'HIT_POINTS':
      return
    case 'SKILL':
    case 'PASSIVE':
      ensureVocabularyTarget(system?.skills, input.skillId, 'Skill')
      return
    case 'SENSE':
      ensureVocabularyTarget(system?.senses, input.senseId, 'Sense')
      return
    case 'MOVEMENT':
      ensureVocabularyTarget(system?.speeds, input.speedId, 'Movement type')
      return
    case 'DEFENSE':
      ensureVocabularyTarget(system?.damageTypes, input.damageTypeId, 'Damage type')
      return
    case 'PROFICIENCY':
      if (input.proficiencyKind === 'LANGUAGE') {
        ensureVocabularyTarget(system?.languages, input.targetId, 'Language')
        return
      }
      const equipment = resolution.catalog.equipment.find(
        (candidate) => candidate.id === input.targetId
      )
      const validCategory =
        input.proficiencyKind === 'ARMOR'
          ? equipment?.category === 'ARMOR' || equipment?.category === 'SHIELD'
          : equipment?.category === input.proficiencyKind
      if (!equipment || !validCategory) {
        throw new CharacterSheetCommandError(
          `${formatCodeLabel(input.proficiencyKind)} proficiency target "${input.targetId}" is not available.`
        )
      }
      return
    case 'ITEM':
      if (!character.state.equipment.inventory.some((item) => item.id === input.itemInstanceId)) {
        throw new CharacterSheetCommandError(
          `Owned item "${input.itemInstanceId}" is not available on this character.`
        )
      }
      return
    case 'COMPANION':
      if (
        !character.state.creatures?.some((creature) => creature.id === input.companionInstanceId)
      ) {
        throw new CharacterSheetCommandError(
          `Companion "${input.companionInstanceId}" is not available on this character.`
        )
      }
      if (input.field === 'ALIGNMENT_OVERRIDE') {
        ensureVocabularyTarget(system?.alignments, input.value, 'Alignment')
      }
      if (input.field === 'CREATURE_TYPE_OVERRIDE') {
        ensureVocabularyTarget(system?.creatureTypes, input.value, 'Creature type')
      }
      if (
        input.field === 'SIZE_OVERRIDE' &&
        !systemCoreCodeRegistry
          .entries(character.systemId, 'size')
          .some(({ code }) => code === input.value)
      ) {
        throw new CharacterSheetCommandError(`Size "${input.value}" is not available.`)
      }
      return
  }
}

export function validatePanelTarget(
  target: CharacterSheetPanelTargetDto,
  resolution: CharacterBuilderResolution,
  character: CharacterAuthored
): void {
  if (
    (target.kind === 'ABILITY' || target.kind === 'SAVING_THROW') &&
    !systemCoreCodeRegistry.abilityCodes(character.systemId).includes(target.ability)
  ) {
    throw new CharacterSheetCommandError(`Ability "${target.ability}" is not available.`)
  }
  if (
    target.kind === 'SKILL' &&
    !resolution.registry.system?.skills.some((skill) => skill.id === target.skillId)
  ) {
    throw new CharacterSheetCommandError(
      `Skill "${target.skillId}" is not available in this rules system.`
    )
  }
  if (
    target.kind === 'COMPANION' &&
    !character.state.creatures?.some((creature) => creature.id === target.companionInstanceId)
  ) {
    throw new CharacterSheetCommandError(
      `Companion "${target.companionInstanceId}" is not available on this character.`
    )
  }
}

export function validateActionResourceUse(params: {
  sheet: CharacterSheetResponseDto
  actionId: string | undefined
  resourceId: string
  amount: number
}): void {
  if (!params.actionId) return
  const action = params.sheet.actions.items.find((candidate) => candidate.id === params.actionId)
  if (!action) {
    throw new CharacterSheetCommandError(`Action "${params.actionId}" is not available.`)
  }
  if (action.availability.status === 'UNAVAILABLE') {
    throw new CharacterSheetCommandError(
      `Action "${action.label}" is unavailable: ${formatCodeLabel(action.availability.reasonCode)}.`
    )
  }
  if (action.resourceGrantId !== params.resourceId || action.resourceCost !== params.amount) {
    throw new CharacterSheetCommandError(
      `Action "${action.label}" does not use the requested resource and cost.`
    )
  }
}

type SpellMechanicCustomizationCommand = Extract<
  CharacterSheetCommandInputDto,
  {
    type: 'SET_SPELL_MECHANIC_CUSTOMIZATION' | 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION'
  }
>

export function getSpellCustomizationFields(
  category: SpellMechanicCustomizationCommand['category']
): readonly Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['field'][] {
  switch (category) {
    case 'TO_HIT':
      return ['ATTACK_BONUS', 'ATTACK_OVERRIDE']
    case 'SAVE_DC':
      return ['DC_BONUS', 'DC_OVERRIDE']
    case 'DAMAGE':
      return ['DAMAGE_BONUS']
  }
}

export function getSpellCustomizationField(
  command: Extract<SpellMechanicCustomizationCommand, { type: 'SET_SPELL_MECHANIC_CUSTOMIZATION' }>
): Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['field'] {
  switch (command.category) {
    case 'TO_HIT':
      return command.mode === 'OVERRIDE' ? 'ATTACK_OVERRIDE' : 'ATTACK_BONUS'
    case 'SAVE_DC':
      return command.mode === 'OVERRIDE' ? 'DC_OVERRIDE' : 'DC_BONUS'
    case 'DAMAGE':
      if (command.mode !== 'BONUS') {
        throw new CharacterSheetCommandError('Damage customization supports a bonus only.')
      }
      return 'DAMAGE_BONUS'
  }
}

export function sameSpellSource(
  left: Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['source'],
  right: Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['source']
): boolean {
  return createCharacterSpellSourceKey(left) === createCharacterSpellSourceKey(right)
}

export function validateSpellMechanicCustomization(
  command: SpellMechanicCustomizationCommand,
  sheet: CharacterSheetResponseDto
): void {
  const sourceKey = createCharacterSpellSourceKey(command.source)
  const spell = sheet.spells.spells.find((candidate) => candidate.id === command.source.spellId)
  const source = spell?.sources?.find(
    (candidate) => createCharacterSpellSourceKey(candidate.source) === sourceKey
  )
  if (!spell || !source) {
    throw new CharacterSheetCommandError(
      `Spell source "${sourceKey}" is not available on this character.`
    )
  }

  const mechanics = spell.mechanics ?? []
  const valid =
    command.category === 'TO_HIT'
      ? mechanics.some(
          (mechanic) =>
            mechanic.trigger === 'MELEE_SPELL_ATTACK' ||
            mechanic.trigger === 'RANGED_SPELL_ATTACK' ||
            mechanic.attackBonus !== undefined
        )
      : command.category === 'SAVE_DC'
        ? mechanics.some((mechanic) => mechanic.save !== undefined)
        : mechanics.some((mechanic) =>
            mechanic.outcomes.some((outcome) => outcome.kind === 'DAMAGE')
          )
  if (!valid) {
    throw new CharacterSheetCommandError(
      `${formatCodeLabel(command.category)} customization is not available for this spell.`
    )
  }

  if (command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION') {
    getSpellCustomizationField(command)
  }
}

export function validateSpellSource(
  source: Extract<
    CharacterSheetCommandInputDto,
    { type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION' }
  >['source'],
  sheet: CharacterSheetResponseDto
): void {
  const sourceKey = createCharacterSpellSourceKey(source)
  const available = sheet.spells.spells.some((spell) =>
    spell.sources?.some(
      (candidate) => createCharacterSpellSourceKey(candidate.source) === sourceKey
    )
  )
  if (!available) {
    throw new CharacterSheetCommandError(
      `Spell source "${sourceKey}" is not available on this character.`
    )
  }
}

/**
 * Removing a recorded consequence is the GM's alone: every recovery the table names is a judgment
 * call (ATTACK-15.2, D187a), so the Character's owner cannot clear it.
 */
export function assertGmOnlySheetCommandAllowed(
  command: CharacterSheetCommandInputDto,
  isCampaignGm: boolean
): void {
  if (command.type === 'REMOVE_CONSEQUENCE' && !isCampaignGm)
    throw new CharacterSheetCommandError('Only the GM removes a recorded consequence.')
}

export function assertCampaignGmSheetCommandAllowed(command: CharacterSheetCommandInputDto): void {
  switch (command.type) {
    case 'SET_INSPIRATION':
    case 'END_ACTIVE_EFFECT':
    case 'END_CONCENTRATION':
    case 'ADJUST_HIT_POINTS':
    case 'USE_HIT_DIE':
    case 'SET_DEATH_SAVES':
    case 'ROLL_DEATH_SAVE':
      return
    case 'COMPLETE_REST':
      if (command.resetMaximumHitPointModifier) break
      return
    case 'SET_EXHAUSTION':
    case 'ADD_CONDITION':
    case 'REMOVE_CONDITION':
    case 'REMOVE_CONSEQUENCE':
    case 'USE_RESOURCE':
    case 'RESTORE_RESOURCE':
    case 'USE_SHEET_RESOURCE':
    case 'RECOVER_SHEET_RESOURCE':
    case 'USE_SPELL_SLOT':
    case 'RESTORE_SPELL_SLOT':
    case 'CAST_SPELL':
    case 'SET_PREPARED_SPELLS':
    case 'SET_KNOWN_SPELLS':
      return
    case 'ADD_INVENTORY_ITEM':
      if (command.notes === undefined) return
      break
    case 'REMOVE_INVENTORY_ITEM':
      return
    case 'UPDATE_INVENTORY_ITEM':
      if (command.notes === undefined) return
      break
    case 'ADJUST_CURRENCY':
    case 'MOVE_CURRENCY':
    case 'EQUIP_ITEM':
    case 'UNEQUIP_ITEM':
    case 'SWAP_HELD_ITEMS':
    case 'ATTUNE_ITEM':
    case 'UNATTUNE_ITEM':
    case 'ADD_SHEET_EXTRA':
    case 'REMOVE_SHEET_EXTRA':
      return
    case 'SET_HIT_POINTS':
      if (command.maxOverride === undefined) return
      break
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
      if (command.notes === undefined) return
      break
    case 'UPDATE_SHEET_EXTRA':
      if (command.extra.notes === undefined) return
      break
  }
  throw new CharacterSheetCommandError(
    `Campaign owners cannot apply ${command.type} to a player's Character.`
  )
}
