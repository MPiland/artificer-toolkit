import type { RollMode } from '@artificer-toolkit/shared/rolls'

import type {
  RollModeCapabilityAdapter,
  RollModeKeep,
  RollModeResolution
} from '../../rollModeCapabilityRegistry.js'
import { DND5E_SYSTEM_ID } from './identity.js'

const DND5E_ROLL_MODE_INFLUENCES: readonly string[] = ['ADVANTAGE', 'DISADVANTAGE']

/** The face a roll mode keeps of two d20s: advantage the higher, disadvantage the lower. */
export const DND5E_KEEP_BY_ROLL_MODE = {
  NORMAL: 'FIRST',
  ADVANTAGE: 'HIGHER',
  DISADVANTAGE: 'LOWER'
} as const satisfies Record<RollMode, RollModeKeep>

/**
 * Resolves already-qualified d20 contributors: any advantage and any disadvantage cancel to a
 * normal roll; otherwise the one influence present sets the mode. Qualification stays with the
 * contributor's producer; an influence code D&D does not define is refused.
 */
export function resolveDnd5eRollMode<TContributor extends { influence: string }>(
  contributors: readonly TContributor[]
): RollModeResolution {
  const unknown = contributors.find(
    ({ influence }) => !DND5E_ROLL_MODE_INFLUENCES.includes(influence)
  )
  if (unknown)
    throw new Error(`D&D does not define the roll-mode influence "${unknown.influence}".`)
  const hasAdvantage = contributors.some(({ influence }) => influence === 'ADVANTAGE')
  const hasDisadvantage = contributors.some(({ influence }) => influence === 'DISADVANTAGE')
  const rollMode: RollMode =
    hasAdvantage === hasDisadvantage ? 'NORMAL' : hasAdvantage ? 'ADVANTAGE' : 'DISADVANTAGE'
  return { rollMode, keep: DND5E_KEEP_BY_ROLL_MODE[rollMode] }
}

export const dnd5eRollModeCapabilityAdapter: RollModeCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  influences: DND5E_ROLL_MODE_INFLUENCES,
  resolveRollMode: (influences) =>
    resolveDnd5eRollMode(influences.map((influence) => ({ influence })))
}
