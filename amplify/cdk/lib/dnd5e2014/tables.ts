import { Stack } from 'aws-cdk-lib'
import { createTable } from './tableFactory'
import { Table } from 'aws-cdk-lib/aws-dynamodb'

export function createEntityTable(stack: Stack, prefix: string): Table {
  const isMaster = prefix.includes('Master')
  const tableName = `${prefix}Table`

  // Add owner index only for non-master tables
  return createTable(stack, {
    name: tableName,
    addOwnerIndex: !isMaster,
  })
}

export function createTables(stack: Stack) {
  return {
    masterSystems: createEntityTable(stack, 'MasterSystem'),
    systems: createEntityTable(stack, 'System'),
    masterSpells: createEntityTable(stack, 'MasterSpell'),
    spells: createEntityTable(stack, 'Spell'),
    masterRaces: createEntityTable(stack, 'MasterRace'),
    races: createEntityTable(stack, 'Race'),
    masterEquipment: createEntityTable(stack, 'MasterEquipment'),
    equipment: createEntityTable(stack, 'Equipment'),
    masterClasses: createEntityTable(stack, 'MasterClass'),
    classes: createEntityTable(stack, 'Class'),
    masterBackgrounds: createEntityTable(stack, 'MasterBackground'),
    backgrounds: createEntityTable(stack, 'Background'),
    masterFeats: createEntityTable(stack, 'MasterFeat'),
    feats: createEntityTable(stack, 'Feat'),
    characters: createEntityTable(stack, 'Character'),
  }
}
