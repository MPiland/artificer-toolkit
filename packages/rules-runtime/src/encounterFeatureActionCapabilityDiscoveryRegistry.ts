import { createEncounterFeatureActionCapabilityDiscoveryRegistry } from './encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eEncounterFeatureActionCapabilityAdapter } from './systems/dnd5e/encounterFeatureActionCapabilityDiscovery.js'

const registry = createEncounterFeatureActionCapabilityDiscoveryRegistry([
  dnd5eEncounterFeatureActionCapabilityAdapter
])

/** Every action of a Creature: the ones it can take, and the unavailable ones with their reason. */
export function discoverEncounterFeatureActions(input: Parameters<typeof registry.discover>[0]) {
  return registry.discover(input)
}

/** The System bindings of one compiled Effect, shared by every action source; null without an adapter. */
export function bindEncounterEffect(input: Parameters<typeof registry.bind>[0]) {
  return registry.bind(input)
}

/** The actions a Creature can take; an action with invalid authored mechanics is left out. */
export function discoverEncounterFeatureActionCapabilities(
  input: Parameters<typeof registry.discover>[0]
) {
  return registry.discover(input).available
}
