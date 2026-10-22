import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemVocabularyCode'
import type {
  RollModeCapabilityAdapter,
  RollModeResolution
} from '../../rollModeCapabilityRegistry.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import { DND5E_ROLL_INFLUENCES, DND5E_ROLL_MODES, type Dnd5eRollMode } from './vocabulary.js'

/** The face a roll mode keeps of two d20s: advantage the higher, disadvantage the lower. */
export const DND5E_KEEP_BY_ROLL_MODE = {
  NORMAL: 'FIRST',
  ADVANTAGE: 'HIGHER',
  DISADVANTAGE: 'LOWER'
} as const satisfies Record<Dnd5eRollMode, RollModeKeep>

/**
 * Resolves already-qualified d20 contributors: any advantage and any disadvantage cancel to a
 * normal roll; otherwise the one influence present sets the mode. Qualification stays with the
 * contributor's producer; an influence code D&D does not define is refused.
 */
export function resolveDnd5eRollMode<TContributor extends { influence: string }>(
  contributors: readonly TContributor[]
): RollModeResolution & { rollMode: Dnd5eRollMode } {
  const unknown = contributors.find(
    ({ influence }) => !DND5E_ROLL_INFLUENCES.some(({ code }) => code === influence)
  )
  if (unknown)
    throw new Error(`D&D does not define the roll-mode influence "${unknown.influence}".`)
  const hasAdvantage = contributors.some(({ influence }) => influence === 'ADVANTAGE')
  const hasDisadvantage = contributors.some(({ influence }) => influence === 'DISADVANTAGE')
  const rollMode: Dnd5eRollMode =
    hasAdvantage === hasDisadvantage ? 'NORMAL' : hasAdvantage ? 'ADVANTAGE' : 'DISADVANTAGE'
  return { rollMode, keep: DND5E_KEEP_BY_ROLL_MODE[rollMode] }
}

const DND5E_PASSIVE_ADJUSTMENT_BY_ROLL_MODE = {
  NORMAL: 0,
  ADVANTAGE: 5,
  DISADVANTAGE: -5
} as const satisfies Record<Dnd5eRollMode, number>

const isDnd5eRollMode = (rollMode: string): rollMode is Dnd5eRollMode =>
  DND5E_ROLL_MODES.some(({ code }) => code === rollMode)

function requireDnd5eRollMode(rollMode: string): Dnd5eRollMode {
  if (!isDnd5eRollMode(rollMode))
    throw new Error(`D&D does not define the roll mode "${rollMode}".`)
  return rollMode
}

export const dnd5eRollModeCapabilityAdapter: RollModeCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  resolveRollMode: (influences) =>
    resolveDnd5eRollMode(influences.map((influence) => ({ influence }))),
  keepFor: (rollMode) => DND5E_KEEP_BY_ROLL_MODE[requireDnd5eRollMode(rollMode)],
  /** 10 plus the skill's check modifier, 5 more with advantage and 5 less with disadvantage. */
  passiveScore: (skillModifier, rollMode) =>
    10 + skillModifier + DND5E_PASSIVE_ADJUSTMENT_BY_ROLL_MODE[requireDnd5eRollMode(rollMode)]
}
