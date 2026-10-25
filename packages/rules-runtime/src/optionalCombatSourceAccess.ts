import {
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
  DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
  DND5E_CLEAVING_OPERATION_KEY,
  DND5E_DISARM_OPERATION_KEY,
  DND5E_FACING_OPERATION_KEY,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY,
  DND5E_FLANKING_OPERATION_KEY,
  DND5E_MORALE_OPERATION_KEY,
  DND5E_OVERRUN_OPERATION_KEY,
  DND5E_SHOVE_ASIDE_OPERATION_KEY,
  DND5E_TUMBLE_OPERATION_KEY,
  type Dnd5eOptionalCombatReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { requireInstalledGameSystemPolicyModule } from './platformPolicyModules.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'

class OptionalCombatSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OptionalCombatSourceError'
  }
}
interface ResolvedOptionalCombatDefinition {
  current: ReusableDefinitionCurrentDto
  document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
}
const INTEGRATED_OPTIONAL_COMBAT_RULE_MODULES = {
  FLANKING: { key: DND5E_FLANKING_OPERATION_KEY, contractVersion: 1 },
  ALTERNATING_DIAGONALS: { key: DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY, contractVersion: 1 },
  DISARM: { key: DND5E_DISARM_OPERATION_KEY, contractVersion: 1 },
  OVERRUN: { key: DND5E_OVERRUN_OPERATION_KEY, contractVersion: 1 },
  SHOVE_ASIDE: { key: DND5E_SHOVE_ASIDE_OPERATION_KEY, contractVersion: 1 },
  TUMBLE: { key: DND5E_TUMBLE_OPERATION_KEY, contractVersion: 1 },
  CLEAVING: { key: DND5E_CLEAVING_OPERATION_KEY, contractVersion: 1 },
  MORALE: { key: DND5E_MORALE_OPERATION_KEY, contractVersion: 1 },
  FACING: { key: DND5E_FACING_OPERATION_KEY, contractVersion: 1 }
} as const
export function isIntegratedOptionalCombatRule(
  document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
): boolean {
  const expected =
    INTEGRATED_OPTIONAL_COMBAT_RULE_MODULES[
      document.kind as keyof typeof INTEGRATED_OPTIONAL_COMBAT_RULE_MODULES
    ]
  return (
    expected !== undefined &&
    document.module.policyModuleKey === expected.key &&
    document.module.contractVersion === expected.contractVersion
  )
}
function requireExactCurrentOptionalCombatDefinition(input: {
  current: ReusableDefinitionCurrentDto
  gameSystemId: string
}): ResolvedOptionalCombatDefinition {
  const parsed = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse(
    input.current.document
  )
  if (!parsed.success)
    throw new OptionalCombatSourceError('Optional combat definition document is invalid.')
  const document = parsed.data
  if (
    input.current.definitionFamilyKey !== DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY ||
    input.current.gameSystemId !== input.gameSystemId ||
    input.current.id !== document.id ||
    document.gameSystemId !== input.gameSystemId ||
    input.current.contractVersion !== 1 ||
    checksumRuleDocument(document) !== input.current.checksum
  ) {
    throw new OptionalCombatSourceError(
      'Optional combat definition does not match its current published definition.'
    )
  }
  return { current: input.current, document }
}
export async function resolveCurrentOptionalCombatSources(input: {
  definitions: CurrentReusableDefinitionSource
  readSystemVocabulary: (gameSystemId: string) => Promise<unknown>
  validateCheckDefinitions: (input: {
    document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
    systemVocabulary: unknown
  }) => void
  gameSystemId: string
  definitionIds: readonly string[]
  requirePolicyModule?: (input: {
    gameSystemId: string
    policyModule: { key: string; contractVersion: number }
  }) => void
}): Promise<readonly ResolvedOptionalCombatDefinition[]> {
  const definitionIds = [...new Set(input.definitionIds)].sort((left, right) =>
    left.localeCompare(right)
  )
  if (definitionIds.length !== input.definitionIds.length)
    throw new OptionalCombatSourceError('Optional combat definition IDs must be unique.')
  if (definitionIds.length > 14)
    throw new OptionalCombatSourceError('A Campaign may select at most 14 optional combat rules.')
  if (definitionIds.length === 0) return []
  let systemVocabulary: unknown
  try {
    systemVocabulary = await input.readSystemVocabulary(input.gameSystemId)
  } catch {
    throw new OptionalCombatSourceError(
      'Encounter Game System vocabulary is not currently available.'
    )
  }
  const resolved = await Promise.all(
    definitionIds.map(async (definitionId) => {
      try {
        return requireExactCurrentOptionalCombatDefinition({
          current: await input.definitions.requireCurrent(definitionId),
          gameSystemId: input.gameSystemId
        })
      } catch (error) {
        if (error instanceof OptionalCombatSourceError) throw error
        throw new OptionalCombatSourceError(
          'Optional combat definition is not currently available.'
        )
      }
    })
  )
  const kinds = new Set<string>()
  const groups = new Set<string>()
  for (const definition of resolved) {
    if (!isIntegratedOptionalCombatRule(definition.document))
      throw new OptionalCombatSourceError(
        'Optional combat rule is not available for Encounter execution.'
      )
    try {
      input.validateCheckDefinitions({ document: definition.document, systemVocabulary })
    } catch {
      throw new OptionalCombatSourceError(
        'Optional combat check definitions are not available in the current Game System vocabulary.'
      )
    }
    try {
      ;(input.requirePolicyModule ?? requireInstalledGameSystemPolicyModule)({
        gameSystemId: input.gameSystemId,
        policyModule: {
          key: definition.document.module.policyModuleKey,
          contractVersion: definition.document.module.contractVersion
        }
      })
    } catch {
      throw new OptionalCombatSourceError(
        'Optional combat module is not supported by the current Game System policy registry.'
      )
    }
    if (kinds.has(definition.document.kind))
      throw new OptionalCombatSourceError(
        'Optional combat selection contains a duplicate rule kind.'
      )
    const group = definition.document.mutuallyExclusiveGroup
    if (group !== null && groups.has(group))
      throw new OptionalCombatSourceError('Optional combat selection contains incompatible rules.')
    kinds.add(definition.document.kind)
    if (group !== null) groups.add(group)
  }
  return resolved
}
