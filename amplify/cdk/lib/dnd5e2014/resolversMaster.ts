import { Stack } from 'aws-cdk-lib'
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync'
import { createTables } from './tablesMaster'
import * as masterSystemResolvers from './system/resolvers/masterSystemResolvers'
import * as systemResolvers from './system/resolvers/systemResolvers'
import * as masterSpellResolvers from './spell/resolvers/masterSpellResolvers'
import * as spellResolvers from './spell/resolvers/spellResolvers'
import * as masterRaceResolvers from './race/resolvers/masterRaceResolvers'
import * as raceResolvers from './race/resolvers/raceResolvers'
import * as masterEquipmentResolvers from './equipment/resolvers/masterEquipmentResolvers'
import * as equipmentResolvers from './equipment/resolvers/equipmentResolvers'
import * as masterClassResolvers from './class/resolvers/masterClassResolvers'
import * as classResolvers from './class/resolvers/classResolvers'
import * as masterBackgroundResolvers from './background/resolvers/masterBackgroundResolvers'
import * as backgroundResolvers from './background/resolvers/backgroundResolvers'
import * as masterFeatResolvers from './feat/resolvers/masterFeatResolvers'
import * as featResolvers from './feat/resolvers/featResolvers'
import * as characterResolvers from './character/resolvers/characterResolvers'

export function createResolvers(api: GraphqlApi, stack: Stack) {
  const tables = createTables(stack)

  masterSystemResolvers.addResolvers(api, tables.masterSystems)
  systemResolvers.addResolvers(api, tables.systems)
  masterSpellResolvers.addResolvers(api, tables.masterSpells)
  spellResolvers.addResolvers(api, tables.spells)
  masterRaceResolvers.addResolvers(api, tables.masterRaces)
  raceResolvers.addResolvers(api, tables.races)
  masterEquipmentResolvers.addResolvers(api, tables.masterEquipment)
  equipmentResolvers.addResolvers(api, tables.equipment)
  masterClassResolvers.addResolvers(api, tables.masterClasses)
  classResolvers.addResolvers(api, tables.classes)
  masterBackgroundResolvers.addResolvers(api, tables.masterBackgrounds)
  backgroundResolvers.addResolvers(api, tables.backgrounds)
  masterFeatResolvers.addResolvers(api, tables.masterFeats)
  featResolvers.addResolvers(api, tables.feats)
  characterResolvers.addResolvers(api, tables.characters)
}
