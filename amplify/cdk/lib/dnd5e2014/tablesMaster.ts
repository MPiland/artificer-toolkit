import { Stack } from 'aws-cdk-lib'
import { createMasterSystemTable, createSystemTable } from './system/tables'
import { createMasterSpellTable, createSpellTable } from './spell/tables'
import { createMasterRaceTable, createRaceTable } from './race/tables'
import { createMasterEquipmentTable, createEquipmentTable } from './equipment/tables'
import { createMasterClassTable, createClassTable } from './class/tables'
import { createMasterBackgroundTable, createBackgroundTable } from './background/tables'
import { createMasterFeatTable, createFeatTable } from './feat/tables'
import { createCharacterTable } from './character/table'

export function createTables(stack: Stack) {
  return {
    masterSystems: createMasterSystemTable(stack),
    systems: createSystemTable(stack),
    masterSpells: createMasterSpellTable(stack),
    spells: createSpellTable(stack),
    masterRaces: createMasterRaceTable(stack),
    races: createRaceTable(stack),
    masterEquipment: createMasterEquipmentTable(stack),
    equipment: createEquipmentTable(stack),
    masterClasses: createMasterClassTable(stack),
    classes: createClassTable(stack),
    masterBackgrounds: createMasterBackgroundTable(stack),
    backgrounds: createBackgroundTable(stack),
    masterFeats: createMasterFeatTable(stack),
    feats: createFeatTable(stack),
    characters: createCharacterTable(stack),
  }
}
