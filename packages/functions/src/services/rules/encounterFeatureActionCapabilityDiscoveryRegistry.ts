import { createEncounterFeatureActionCapabilityDiscoveryRegistry } from './encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eEncounterFeatureActionCapabilityAdapter } from './systems/dnd5e/encounterFeatureActionCapabilityDiscovery.js'

const registry = createEncounterFeatureActionCapabilityDiscoveryRegistry([
  dnd5eEncounterFeatureActionCapabilityAdapter
])

export function discoverEncounterFeatureActionCapabilities(
  input: Parameters<typeof registry.discover>[0]
) {
  return registry.discover(input)
}
