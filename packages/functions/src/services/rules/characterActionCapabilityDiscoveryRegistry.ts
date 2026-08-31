import { createCharacterActionCapabilityDiscoveryRegistry } from './characterActionCapabilityDiscovery.js'
import { dnd5eCharacterActionCapabilityAdapter } from './systems/dnd5e/characterActionCapabilityDiscovery.js'

const registry = createCharacterActionCapabilityDiscoveryRegistry([
  dnd5eCharacterActionCapabilityAdapter
])

export function discoverCharacterActionCapabilities(
  input: Parameters<typeof registry.discover>[0]
) {
  return registry.discover(input)
}
