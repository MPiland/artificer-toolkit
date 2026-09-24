import { createCharacterActionCapabilityDiscoveryRegistry } from './characterActionCapabilityDiscovery.js'
import { dnd5eCharacterActionCapabilityAdapter } from './systems/dnd5e/characterActionCapabilityDiscovery.js'

const registry = createCharacterActionCapabilityDiscoveryRegistry([
  dnd5eCharacterActionCapabilityAdapter
])

/** Discovers sealed current Character action sources from current rule facts. */
export function discoverEncounterCharacterActionCapabilities(
  input: Parameters<typeof registry.discover>[0]
) {
  return registry.discover(input)
}
