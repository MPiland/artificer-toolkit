import { createHash } from 'node:crypto'

import { coreRuleOperations } from '@artificer-toolkit/shared/rules'
import {
  gameSystemRuleCapabilityDtoSchema,
  type GameSystemRuleCapabilityDto
} from '@artificer-toolkit/schema/api/rulesRuntime'

import {
  createRulesRuntimeService,
  type PublishedRuleDefinitionSource,
  type RulesRuntimeService
} from './rulesRuntimeService.js'
import {
  createReusableDefinitionService,
  type ReusableDefinitionStore
} from './reusableDefinitionService.js'
import { dnd5eRulesRuntimeRegistration } from './systems/dnd5e/characterActionRuntime.js'

/**
 * Platform-owned registry of installed System runtime modules. Encounter and
 * transport code receives the resulting generic runtime, never a System
 * selector. New Systems add one registration here.
 */
const installedRuntimeModules = [dnd5eRulesRuntimeRegistration] as const

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

/** Returns the current installed System contract without selecting behavior by label or edition. */
export function findInstalledGameSystemRuleCapability(
  gameSystemId: string
): GameSystemRuleCapabilityDto | null {
  return (
    installedRuntimeModules
      .flatMap((module) => module.capabilities)
      .map((candidate) => gameSystemRuleCapabilityDtoSchema.parse(candidate))
      .find((candidate) => candidate.gameSystemId === gameSystemId) ?? null
  )
}

/** Returns the current installed System contract without selecting behavior by label or edition. */
export function requireInstalledGameSystemRuleCapability(
  gameSystemId: string
): GameSystemRuleCapabilityDto {
  const capability = findInstalledGameSystemRuleCapability(gameSystemId)
  if (!capability) {
    throw new Error(`No capability contract is registered for Game System "${gameSystemId}".`)
  }
  return capability
}

export function deriveRulesRuntimeContinuationIntegrityKey(secret: string): Uint8Array {
  return createHash('sha256')
    .update('artificer-toolkit:session-host:rules-continuation:v1\0')
    .update(secret)
    .digest()
}

export function createPlatformRulesRuntime(input: {
  continuationIntegrityKey: Uint8Array
  definitions: PublishedRuleDefinitionSource
}): RulesRuntimeService {
  const registrations = installedRuntimeModules.map((module) => module.gameSystemId)
  if (new Set(registrations).size !== registrations.length) {
    throw new Error('Each installed System may register only one rules runtime module.')
  }

  return createRulesRuntimeService({
    capabilities: installedRuntimeModules.flatMap((module) => module.capabilities),
    continuationIntegrityKey: input.continuationIntegrityKey,
    definitions: input.definitions,
    operations: [
      ...coreRuleOperations,
      ...installedRuntimeModules.flatMap((module) => module.operations)
    ]
  })
}

export function createPlatformReusableDefinitionService(store: ReusableDefinitionStore) {
  return createReusableDefinitionService({
    store,
    capabilities: installedRuntimeModules.flatMap((module) => module.capabilities),
    operations: [
      ...coreRuleOperations,
      ...installedRuntimeModules.flatMap((module) => module.operations)
    ]
  })
}
