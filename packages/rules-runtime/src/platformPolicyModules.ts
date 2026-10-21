import { createRollModeCapabilityRegistry } from './rollModeCapabilityRegistry.js'
import { dnd5ePolicyModuleRegistration } from './systems/dnd5e/policyModuleRegistration.js'
import { dnd5eRollModeCapabilityAdapter } from './systems/dnd5e/rollModePolicy.js'

const installedRuntimeModules = [dnd5ePolicyModuleRegistration] as const

export const rollModeCapabilityRegistry = createRollModeCapabilityRegistry([
  dnd5eRollModeCapabilityAdapter
])

export function requireInstalledGameSystemPolicyModule(input: {
  gameSystemId: string
  policyModule: { key: string; contractVersion: number }
}): void {
  const registration = installedRuntimeModules.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (
    !registration ||
    !registration.policyModules.some(
      (module) =>
        module.key === input.policyModule.key &&
        module.contractVersion === input.policyModule.contractVersion
    )
  ) {
    throw new Error(`No policy module is registered for Game System "${input.gameSystemId}".`)
  }
}
