import type { EncounterRecord } from '@artificer-toolkit/db'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

export interface EncounterSceneGridPolicyAdapter {
  readonly gameSystemId: string
  resolveEffectiveGrid(input: {
    readonly encounter: Pick<
      EncounterRecord,
      | 'automationMode'
      | 'gameSystemId'
      | 'optionalCombatSnapshot'
      | 'optionalCombatSnapshotChecksum'
    >
    readonly sceneGrid: SceneGrid
  }): SceneGrid
}

export interface EncounterSceneGridPolicyRegistry {
  resolveEffectiveGrid(input: {
    readonly encounter: Pick<
      EncounterRecord,
      | 'automationMode'
      | 'gameSystemId'
      | 'optionalCombatSnapshot'
      | 'optionalCombatSnapshotChecksum'
    >
    readonly sceneGrid: SceneGrid
  }): SceneGrid
}

function canonicalSystemId(value: string): string {
  const parsed = postgresUuidSchema.safeParse(value)
  if (!parsed.success)
    throw new Error('Scene-grid policy System identity must be a PostgreSQL UUID.')
  return parsed.data
}

export function createEncounterSceneGridPolicyRegistry(
  adapters: readonly EncounterSceneGridPolicyAdapter[]
): EncounterSceneGridPolicyRegistry {
  const bySystemId = new Map<string, EncounterSceneGridPolicyAdapter>()
  for (const adapter of adapters) {
    const systemId = canonicalSystemId(adapter.gameSystemId)
    if (bySystemId.has(systemId))
      throw new Error(`Duplicate Scene-grid policy System adapter: ${systemId}.`)
    bySystemId.set(systemId, adapter)
  }
  return {
    resolveEffectiveGrid(input): SceneGrid {
      const parsed = postgresUuidSchema.safeParse(input.encounter.gameSystemId)
      if (!parsed.success) return input.sceneGrid
      return bySystemId.get(parsed.data)?.resolveEffectiveGrid(input) ?? input.sceneGrid
    }
  }
}
