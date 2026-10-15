import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import { compileEncounterFeatureActionPlan } from './encounterActionEntryPointCompiler.js'
import {
  createEncounterFeatureActionCapabilityDiscoveryRegistry,
  type EncounterFeatureActionCapabilityDescriptor,
  type EncounterFeatureActionDiscovery
} from './encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eEncounterFeatureActionCapabilityAdapter } from './systems/dnd5e/encounterFeatureActionCapabilityDiscovery.js'

const registry = createEncounterFeatureActionCapabilityDiscoveryRegistry([
  dnd5eEncounterFeatureActionCapabilityAdapter
])

/**
 * Every action of a Creature: the ones it can take, and the unavailable ones with their reason. An
 * action whose shape its System cannot execute is unavailable too, so no caller offers it.
 */
export function discoverEncounterFeatureActions(
  input: Parameters<typeof registry.discover>[0]
): EncounterFeatureActionDiscovery {
  const discovered = registry.discover(input)
  const available: EncounterFeatureActionCapabilityDescriptor[] = []
  const unavailable = [...discovered.unavailable]
  for (const capability of discovered.available) {
    const adapter = characterRuleActionSystemAdapterRegistry.get(capability.gameSystemId)
    if (!adapter) throw new Error('The Creature Game System cannot execute this action.')
    try {
      compileEncounterFeatureActionPlan(adapter, capability)
      available.push(capability)
    } catch (error) {
      if (!(error instanceof CharacterRuleActionUnsupportedCompilationError)) throw error
      unavailable.push({
        actionId: capability.actionId,
        ownerFeatureId: capability.ownerFeatureId,
        label: capability.label,
        reason: error.message
      })
    }
  }
  return { available, unavailable }
}

/** The System bindings of one compiled Effect, shared by every action source; null without an adapter. */
export function bindEncounterEffect(input: Parameters<typeof registry.bind>[0]) {
  return registry.bind(input)
}

/** The actions a Creature can take; an action with invalid authored mechanics is left out. */
export function discoverEncounterFeatureActionCapabilities(
  input: Parameters<typeof registry.discover>[0]
) {
  return discoverEncounterFeatureActions(input).available
}
