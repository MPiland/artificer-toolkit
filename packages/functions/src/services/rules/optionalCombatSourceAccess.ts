import { createReusableDefinitionRepository, type DBLike } from '@artificer-toolkit/db'
import {
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY,
  type Dnd5eOptionalCombatReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { requireInstalledGameSystemPolicyModule } from './platformRulesRuntime.js'

export class OptionalCombatSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OptionalCombatSourceError'
  }
}

export interface ResolvedOptionalCombatDefinition {
  current: ReusableDefinitionCurrentDto
  document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
}

function requireExactCurrentOptionalCombatDefinition(input: {
  current: ReusableDefinitionCurrentDto
  gameSystemId: string
}): ResolvedOptionalCombatDefinition {
  const parsed = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse(
    input.current.document
  )
  if (!parsed.success) {
    throw new OptionalCombatSourceError('Optional combat definition document is invalid.')
  }
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

/** Resolves the bounded Campaign selection without allowing labels or codes to select mechanics. */
export async function resolveCurrentOptionalCombatSources(input: {
  db: DBLike
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
  if (definitionIds.length !== input.definitionIds.length) {
    throw new OptionalCombatSourceError('Optional combat definition IDs must be unique.')
  }
  if (definitionIds.length > 14) {
    throw new OptionalCombatSourceError('A Campaign may select at most 14 optional combat rules.')
  }
  if (definitionIds.length === 0) return []
  const definitions = createReusableDefinitionRepository(input.db)
  const resolved = await Promise.all(
    definitionIds.map(async (definitionId) => {
      try {
        return requireExactCurrentOptionalCombatDefinition({
          current: await definitions.requireCurrent(definitionId),
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
    if (kinds.has(definition.document.kind)) {
      throw new OptionalCombatSourceError(
        'Optional combat selection contains a duplicate rule kind.'
      )
    }
    const group = definition.document.mutuallyExclusiveGroup
    if (group !== null && groups.has(group)) {
      throw new OptionalCombatSourceError('Optional combat selection contains incompatible rules.')
    }
    kinds.add(definition.document.kind)
    if (group !== null) groups.add(group)
  }
  return resolved
}
