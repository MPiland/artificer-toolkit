import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characters'

export type CharacterSheetCommandRuleResponsibility = 'CHARACTER_POLICY' | 'COMMITTED_SNAPSHOT'

export function classifyCharacterSheetCommandRuleResponsibility(
  command: CharacterSheetCommandInputDto
): CharacterSheetCommandRuleResponsibility {
  switch (command.type) {
    case 'SET_HIT_POINTS':
      return command.maxOverride === undefined ? 'COMMITTED_SNAPSHOT' : 'CHARACTER_POLICY'
    case 'UPDATE_SHEET_EXTRA':
      return command.extra.isActive === undefined &&
        command.extra.equipmentItemIds === undefined &&
        (!('hitDice' in command.extra) || command.extra.hitDice === undefined)
        ? 'COMMITTED_SNAPSHOT'
        : 'CHARACTER_POLICY'
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
    case 'USE_SHEET_RESOURCE':
    case 'RECOVER_SHEET_RESOURCE':
    case 'SET_INSPIRATION':
    case 'ADJUST_HIT_POINTS':
    case 'USE_HIT_DIE':
    case 'USE_RESOURCE':
    case 'RESTORE_RESOURCE':
    case 'USE_SPELL_SLOT':
    case 'RESTORE_SPELL_SLOT':
    case 'CAST_SPELL':
    case 'ADJUST_CURRENCY':
    case 'MOVE_CURRENCY':
    case 'CREATE_NOTE':
    case 'UPDATE_NOTE':
    case 'DELETE_NOTE':
    case 'CREATE_NOTE_GROUP':
    case 'UPDATE_NOTE_GROUP':
    case 'DELETE_NOTE_GROUP':
      return 'COMMITTED_SNAPSHOT'
    case 'UPGRADE_RULE_PACK':
    case 'UPSERT_SHEET_ADJUSTMENT':
    case 'REMOVE_SHEET_ADJUSTMENT':
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
    case 'ADD_SHEET_EXTRA':
    case 'REMOVE_SHEET_EXTRA':
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
    case 'COMPLETE_REST':
    case 'SET_EXHAUSTION':
    case 'ADD_CONDITION':
    case 'REMOVE_CONDITION':
    case 'SET_PREPARED_SPELLS':
    case 'SET_KNOWN_SPELLS':
    case 'ADD_INVENTORY_ITEM':
    case 'REMOVE_INVENTORY_ITEM':
    case 'UPDATE_INVENTORY_ITEM':
    case 'EQUIP_ITEM':
    case 'UNEQUIP_ITEM':
    case 'ATTUNE_ITEM':
    case 'UNATTUNE_ITEM':
      return 'CHARACTER_POLICY'
    default: {
      const unhandledCommand: never = command
      return unhandledCommand
    }
  }
}

export function canReuseCommittedCharacterRuleEvaluation(
  command: CharacterSheetCommandInputDto
): boolean {
  switch (command.type) {
    case 'SET_HIT_POINTS':
      return command.maxOverride === undefined
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
    case 'USE_SHEET_RESOURCE':
    case 'RECOVER_SHEET_RESOURCE':
    case 'USE_RESOURCE':
    case 'RESTORE_RESOURCE':
    case 'USE_SPELL_SLOT':
    case 'RESTORE_SPELL_SLOT':
    case 'CAST_SPELL':
    case 'SET_INSPIRATION':
    case 'ADJUST_HIT_POINTS':
    case 'USE_HIT_DIE':
    case 'ADJUST_CURRENCY':
    case 'MOVE_CURRENCY':
    case 'CREATE_NOTE':
    case 'UPDATE_NOTE':
    case 'DELETE_NOTE':
    case 'CREATE_NOTE_GROUP':
    case 'UPDATE_NOTE_GROUP':
    case 'DELETE_NOTE_GROUP':
      return true
    default:
      return false
  }
}
