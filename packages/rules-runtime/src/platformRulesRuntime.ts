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
import { maintenanceLinkCapabilityRegistry } from './platformPolicyModules.js'
import {
  installedAttackTriggers,
  installedCreatureRuleFactCompilers,
  installedRuleCapabilities,
  installedRuleOperations
} from './systems/installedGameSystems/runtime.js'

export { evaluateInstalledCharacterPolicy } from './platformCharacterPolicy.js'
export { evaluateInstalledEncounterActors } from './platformEncounterPolicy.js'

/**
 * One installed System's rules runtime tier (D195). Encounter and transport code receives the
 * resulting generic runtime, never a System selector. Character preparation uses the focused
 * platformCharacterPolicy module.
 */
export interface GameSystemRuntimeTier {
  readonly gameSystemId: string
  readonly capabilities: readonly GameSystemRuleCapabilityContract[]
  readonly operations: readonly RuleOperationContract[]
  readonly isMeleeAttackTrigger: (triggerCode: string) => boolean
  readonly isSpellAttackTrigger: (triggerCode: string) => boolean
  readonly compileCreatureRuleFacts?: (input: {
    creature: CreatureAuthored
    vocabulary: SystemVocabularySnapshot
  }) => EncounterCreatureRuleFactsSnapshot
}

export const installedGameSystemRuleCapabilities: readonly GameSystemRuleCapabilityContract[] =
  /* @__PURE__ */ installedRuleCapabilities.flat()

export const installedGameSystemRuleOperations: readonly RuleOperationContract[] = /* @__PURE__ */ [
  coreRuleOperations,
  ...installedRuleOperations
].flat()

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
  const registration = installedCreatureRuleFactCompilers.find(
    (module) => module.gameSystemId === input.vocabulary.systemId
  )
  if (!registration) {
    throw new Error(
      `No Creature rule-fact compiler is registered for Game System "${input.vocabulary.systemId}".`
    )
  }
  return registration.compileCreatureRuleFacts(input)
}

/** Every runtime tier classifies attack triggers, so their list names the installed runtime Systems. */
function requireInstalledRuntimeModule(gameSystemId: string) {
  const registration = installedAttackTriggers.find(
    (module) => module.gameSystemId === gameSystemId
  )
  if (!registration) {
    throw new Error(`No rules runtime module is installed for Game System "${gameSystemId}".`)
  }
  return registration
}

/** The System's published Concentration maintenance rule, by the Run's Game System. */
export function requireInstalledConcentrationMaintenanceDefinitionId(gameSystemId: string): string {
  requireInstalledRuntimeModule(gameSystemId)
  return maintenanceLinkCapabilityRegistry.require(gameSystemId).maintenanceDefinitionId
}

/** Whether the System counts an action trigger as a melee attack (flanking, Cleaving). */
export function isInstalledMeleeAttackTrigger(gameSystemId: string, triggerCode: string): boolean {
  return requireInstalledRuntimeModule(gameSystemId).isMeleeAttackTrigger(triggerCode)
}

/** Whether the System counts an action trigger as a spell attack, which casts a spell. */
export function isInstalledSpellAttackTrigger(gameSystemId: string, triggerCode: string): boolean {
  return requireInstalledRuntimeModule(gameSystemId).isSpellAttackTrigger(triggerCode)
}

/** Returns the current installed System contract without selecting behavior by label or edition. */
export function findInstalledGameSystemRuleCapability(
  gameSystemId: string
): GameSystemRuleCapabilityDto | null {
  return (
    installedGameSystemRuleCapabilities
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

export function createPlatformRulesRuntime(input: {
  definitions: PublishedRuleDefinitionSource
}): RulesRuntimeService {
  return createRulesRuntimeService({
    capabilities: installedGameSystemRuleCapabilities,
    definitions: input.definitions,
    operations: installedGameSystemRuleOperations
  })
}
