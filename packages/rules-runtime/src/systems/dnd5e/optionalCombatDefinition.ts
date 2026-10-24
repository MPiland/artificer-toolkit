import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type {
  OptionalCombatD20Contributor,
  OptionalCombatPolicyInput,
  OptionalCombatPolicyPin
} from '../../optionalCombatPolicyCapability.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'

export type OptionalCombatPolicyDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]

/**
 * The one active definition of an optional rule kind the Run's verified snapshot pins to this
 * policy module's key and contract version; null when the rule is off, ambiguous or tampered with.
 */
export function exactOptionalCombatDefinition(
  input: OptionalCombatPolicyInput & {
    readonly kind: Dnd5eOptionalCombatRuleKindDto
    readonly module: { readonly key: string; readonly contractVersion: number }
  }
): OptionalCombatPolicyDefinition | null {
  if (
    input.automationMode === 'MANUAL' ||
    input.gameSystemId !== DND5E_SYSTEM_ID ||
    input.optionalCombatSnapshot === null ||
    input.optionalCombatSnapshotChecksum === null
  ) {
    return null
  }
  const parsed = encounterOptionalCombatSnapshotDtoSchema.safeParse(input.optionalCombatSnapshot)
  if (
    !parsed.success ||
    parsed.data.gameSystemId !== input.gameSystemId ||
    checksumCanonicalJson(parsed.data) !== input.optionalCombatSnapshotChecksum
  ) {
    return null
  }
  const matches = activeOptionalCombatDefinitions({
    automationMode: input.automationMode,
    snapshot: parsed.data
  }).filter(
    (definition) =>
      definition.document.kind === input.kind &&
      checksumRuleDocument(definition.document) === definition.definitionChecksum &&
      definition.document.module.policyModuleKey === input.module.key &&
      definition.document.module.contractVersion === input.module.contractVersion
  )
  return matches.length === 1 ? matches[0]! : null
}

/** A d20 contributor the definition itself adds, keyed by the policy's reason for it. */
export function optionalCombatContributor(input: {
  readonly definition: OptionalCombatPolicyDefinition
  readonly influence: 'ADVANTAGE' | 'DISADVANTAGE'
  readonly reason: string
}): OptionalCombatD20Contributor {
  return {
    sourceId: checksumRuleDocument({
      definitionChecksum: input.definition.definitionChecksum,
      definitionId: input.definition.definitionId,
      definitionVersion: input.definition.definitionVersion,
      reason: input.reason
    }),
    grantId: null,
    domainKey: input.reason,
    influence: input.influence,
    source: { kind: 'AUTHORED', id: input.definition.definitionId, holderActorId: null }
  }
}

export function optionalCombatPolicyPin(
  definition: OptionalCombatPolicyDefinition
): OptionalCombatPolicyPin {
  return {
    definitionId: definition.definitionId,
    definitionVersion: definition.definitionVersion,
    definitionChecksum: definition.definitionChecksum,
    moduleContractVersion: definition.document.module.contractVersion,
    moduleKey: definition.document.module.policyModuleKey
  }
}
