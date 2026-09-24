import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'

import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import { dnd5eCharacterRuleActionSystemAdapter } from './systems/dnd5e/effectActionCompiler.js'

export interface CharacterRuleActionSystemAdapterRegistry {
  get(gameSystemId: string): CharacterRuleActionSystemAdapter | undefined
}

function canonicalSystemId(value: string): string {
  const parsed = postgresUuidSchema.safeParse(value)
  if (!parsed.success)
    throw new Error('Character rule-action System identity must be a PostgreSQL UUID.')
  return parsed.data
}

export function createCharacterRuleActionSystemAdapterRegistry(
  adapters: readonly CharacterRuleActionSystemAdapter[]
): CharacterRuleActionSystemAdapterRegistry {
  const bySystemId = new Map<string, CharacterRuleActionSystemAdapter>()
  for (const adapter of adapters) {
    const id = canonicalSystemId(adapter.gameSystemId)
    if (bySystemId.has(id))
      throw new Error(`Duplicate Character rule-action System adapter: ${id}.`)
    bySystemId.set(id, adapter)
  }
  return {
    get(gameSystemId: string): CharacterRuleActionSystemAdapter | undefined {
      return bySystemId.get(canonicalSystemId(gameSystemId))
    }
  }
}

export const characterRuleActionSystemAdapterRegistry =
  createCharacterRuleActionSystemAdapterRegistry([dnd5eCharacterRuleActionSystemAdapter])
