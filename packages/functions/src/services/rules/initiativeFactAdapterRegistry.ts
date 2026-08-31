import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'

import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import { dnd5eInitiativeFactAdapter } from './systems/dnd5e/initiativeFactAdapter.js'

export interface InitiativeFactAdapterRegistry {
  get(gameSystemId: string): InitiativeFactAdapter | undefined
}

function canonicalSystemId(value: string): string {
  const parsed = postgresUuidSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error('Initiative System identity must be a PostgreSQL UUID.')
  }
  return parsed.data
}

export function createInitiativeFactAdapterRegistry(
  adapters: readonly InitiativeFactAdapter[]
): InitiativeFactAdapterRegistry {
  const bySystemId = new Map<string, InitiativeFactAdapter>()
  for (const adapter of adapters) {
    const id = canonicalSystemId(adapter.gameSystemId)
    if (bySystemId.has(id)) {
      throw new Error(`Duplicate initiative System adapter: ${id}.`)
    }
    bySystemId.set(id, adapter)
  }
  return {
    get(gameSystemId: string): InitiativeFactAdapter | undefined {
      return bySystemId.get(canonicalSystemId(gameSystemId))
    }
  }
}

export const initiativeFactAdapterRegistry = createInitiativeFactAdapterRegistry([
  dnd5eInitiativeFactAdapter
])
