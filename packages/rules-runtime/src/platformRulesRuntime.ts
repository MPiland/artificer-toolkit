import {
  coreRuleOperations,
  type GameSystemRuleCapabilityContract,
  type RuleOperationContract
} from '@artificer-toolkit/shared/rules'
import {
  gameSystemRuleCapabilityDtoSchema,
  type GameSystemRuleCapabilityDto
} from '@artificer-toolkit/schema/api/rulesRuntime'
import type { EncounterCreatureRuleFactsSnapshot } from '@artificer-toolkit/schema/api/encounterActorRules'

import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  createRulesRuntimeService,
  type PublishedRuleDefinitionSource,
  type RulesRuntimeService
} from './rulesRuntimeService.js'
import { dnd5eRulesRuntimeRegistration } from './systems/dnd5e/characterActionRuntime.js'

export { evaluateInstalledCharacterPolicy } from './platformCharacterPolicy.js'
export { evaluateInstalledEncounterActors } from './platformEncounterPolicy.js'

/**
 * Platform-owned registry of installed System runtime modules. Encounter and
 * transport code receives the resulting generic runtime, never a System
 * selector. Character preparation uses the focused platformCharacterPolicy module.
 */
const installedRuntimeModules = [dnd5eRulesRuntimeRegistration] as const

export const installedGameSystemRuleCapabilities: readonly GameSystemRuleCapabilityContract[] =
  installedRuntimeModules.flatMap((module) => module.capabilities)

export const installedGameSystemRuleOperations: readonly RuleOperationContract[] = [
  ...coreRuleOperations,
  ...installedRuntimeModules.flatMap((module) => module.operations)
]

/**
 * Selects the installed System's compiler by immutable System identity. The
 * Encounter service owns snapshot persistence, not System mechanics.
 */
export function compileInstalledCreatureRuleFacts(input: {
  creature: CreatureAuthored
  vocabulary: SystemVocabularySnapshot
}): EncounterCreatureRuleFactsSnapshot {
  if (input.creature.systemId !== input.vocabulary.systemId) {
    throw new Error('Creature and System vocabulary identities do not match.')
  }
  const registration = installedRuntimeModules.find(
    (module) => module.gameSystemId === input.vocabulary.systemId
  )
  if (!registration || !('compileCreatureRuleFacts' in registration)) {
    throw new Error(
      `No Creature rule-fact compiler is registered for Game System "${input.vocabulary.systemId}".`
    )
  }
  return registration.compileCreatureRuleFacts(input)
}

function requireInstalledRuntimeModule(gameSystemId: string) {
  const registration = installedRuntimeModules.find(
    (module) => module.gameSystemId === gameSystemId
  )
  if (!registration) {
    throw new Error(`No rules runtime module is installed for Game System "${gameSystemId}".`)
  }
  return registration
}

/** The System's published Concentration maintenance rule, by the Run's Game System. */
export function requireInstalledConcentrationMaintenanceDefinitionId(gameSystemId: string): string {
  return requireInstalledRuntimeModule(gameSystemId).concentrationMaintenanceDefinitionId
}

/** Whether the System counts an action trigger as a melee attack (flanking, Cleaving). */
export function isInstalledMeleeAttackTrigger(gameSystemId: string, triggerCode: string): boolean {
  return requireInstalledRuntimeModule(gameSystemId).isMeleeAttackTrigger(triggerCode)
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

/**
 * Derives the continuation seal key from the dedicated `RULES_CONTINUATION_SECRET` shared by Convex
 * and the Session Worker. The versioned label keeps continuations sealed under earlier key sources
 * from verifying.
 */
export async function deriveRulesContinuationKey(secret: string | undefined): Promise<Uint8Array> {
  if (!secret || new TextEncoder().encode(secret).byteLength < 32)
    throw new Error('RULES_CONTINUATION_SECRET must be configured with at least 32 bytes.')
  return new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`artificer-toolkit:rules-continuation:v2\0${secret}`)
    )
  )
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
    capabilities: installedGameSystemRuleCapabilities,
    continuationIntegrityKey: input.continuationIntegrityKey,
    definitions: input.definitions,
    operations: installedGameSystemRuleOperations
  })
}
