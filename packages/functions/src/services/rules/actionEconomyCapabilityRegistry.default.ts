import { createActionEconomyCapabilityRegistry } from './actionEconomyCapabilityRegistry.js'
import { dnd5eActionEconomyCapabilityAdapter } from './systems/dnd5e/actionEconomyPolicy.js'

export const actionEconomyCapabilityRegistry = createActionEconomyCapabilityRegistry([
  dnd5eActionEconomyCapabilityAdapter
])
