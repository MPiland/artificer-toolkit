import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import type {
  RollModeCapabilityAdapter,
  RollModeResolution
} from '../../rollModeCapabilityRegistry.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import { DND5E_ROLL_INFLUENCES, DND5E_ROLL_MODES, type Dnd5eRollMode } from './coreCodes.js'

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
    10 + skillModifier + DND5E_PASSIVE_ADJUSTMENT_BY_ROLL_MODE[requireDnd5eRollMode(rollMode)],
  // A ranged attack beyond its normal range (D62) or a target within its close range (a Lance,
  // D217) has disadvantage; an attacker its target cannot see has advantage, and a target its
  // attacker cannot see gives disadvantage (SRD).
  ruleContributors: [
    {
      trigger: 'BEYOND_NORMAL_RANGE',
      id: 'long-range',
      label: 'Long range',
      influence: 'DISADVANTAGE'
    },
    {
      trigger: 'WITHIN_CLOSE_RANGE',
      id: 'close-range',
      label: 'Close range',
      influence: 'DISADVANTAGE'
    },
    {
      trigger: 'ATTACKER_UNSEEN',
      id: 'unseen-attacker',
      label: 'Unseen attacker',
      influence: 'ADVANTAGE'
    },
    {
      trigger: 'TARGET_UNSEEN',
      id: 'unseen-target',
      label: 'Unseen target',
      influence: 'DISADVANTAGE'
    }
  ]
}
