import type { RollMode } from '@artificer-toolkit/shared/rolls'

import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'

/** Which of two rolled faces a test keeps: the first, the higher or the lower. */
export type RollModeKeep = 'FIRST' | 'HIGHER' | 'LOWER'

export interface RollModeResolution {
  rollMode: RollMode
  keep: RollModeKeep
}

/**
 * System-owned roll-mode policy: the influence codes a System's contributors carry and how a set of
 * them resolves to one roll mode. The Encounter layer never assigns meaning to an influence code.
 */
export interface RollModeCapabilityAdapter {
  gameSystemId: string
  influences: readonly string[]
  /** Pure: the roll mode the influences of a test's contributors resolve to. */
  resolveRollMode(influences: readonly string[]): RollModeResolution
}

export function createRollModeCapabilityRegistry(adapters: readonly RollModeCapabilityAdapter[]) {
  const registry = createSystemCapabilityRegistry('roll-mode', adapters)
  return {
    resolveRollMode(input: {
      gameSystemId: string
      contributors: readonly { influence: string }[]
    }): RollModeResolution {
      const adapter = registry.require(input.gameSystemId)
      const influences = input.contributors.map(({ influence }) => influence)
      const unknown = influences.find((influence) => !adapter.influences.includes(influence))
      if (unknown !== undefined) {
        throw new Error(`The Game System does not define the roll-mode influence "${unknown}".`)
      }
      return adapter.resolveRollMode(influences)
    }
  }
}
