import { Stack } from 'aws-cdk-lib'
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync'
import { createTables } from './tables'
import { createTableResolvers } from './resolverFactory'

export type Prefix =
  | 'MasterSystem'
  | 'System'
  | 'MasterSpell'
  | 'Spell'
  | 'MasterRace'
  | 'Race'
  | 'MasterEquipment'
  | 'Equipment'
  | 'MasterClass'
  | 'Class'
  | 'MasterBackground'
  | 'Background'
  | 'MasterFeat'
  | 'Feat'
  | 'Character'

export function createResolvers(api: GraphqlApi, stack: Stack) {
  const tables = createTables(stack)

  createTableResolvers(api, tables.masterSystems, 'MasterSystem')
  createTableResolvers(api, tables.systems, 'System')
  createTableResolvers(api, tables.masterSpells, 'MasterSpell')
  createTableResolvers(api, tables.spells, 'Spell')
  createTableResolvers(api, tables.masterRaces, 'MasterRace')
  createTableResolvers(api, tables.races, 'Race')
  createTableResolvers(api, tables.masterEquipment, 'MasterEquipment')
  createTableResolvers(api, tables.equipment, 'Equipment')
  createTableResolvers(api, tables.masterClasses, 'MasterClass')
  createTableResolvers(api, tables.classes, 'Class')
  createTableResolvers(api, tables.masterBackgrounds, 'MasterBackground')
  createTableResolvers(api, tables.backgrounds, 'Background')
  createTableResolvers(api, tables.masterFeats, 'MasterFeat')
  createTableResolvers(api, tables.feats, 'Feat')
  createTableResolvers(api, tables.characters, 'Character')
}
