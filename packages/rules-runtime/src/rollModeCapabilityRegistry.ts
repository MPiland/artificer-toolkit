import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import type { D20Roll } from '@artificer-toolkit/shared/rolls'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import type { SystemCoreCodeRegistry } from './systemCoreCodeCapability.js'

export interface RollModeResolution {
  /** A code from the System's `rollMode` vocabulary. */
  rollMode: string
  keep: RollModeKeep
}

/**
 * A situation the Encounter Kernel measures on its own, for which a System may name a d20
 * contributor: an attack beyond its normal range or within its close range, an attacker its target
 * cannot see, and a target its attacker cannot see.
 */
export type RollModeRuleTrigger =
  | 'BEYOND_NORMAL_RANGE'
  | 'WITHIN_CLOSE_RANGE'
  | 'ATTACKER_UNSEEN'
  | 'TARGET_UNSEEN'

/**
 * A System's d20 contributor for a Kernel trigger: the rule id its contributors persist under
 * (`rule:<id>`), the reason label a roller reads and its `rollInfluence` code. A trigger the
 * System's rules give nothing has no entry.
 */
export interface RollModeRuleContributor {
  trigger: RollModeRuleTrigger
  id: string
  label: string
  influence: string
}

/**
 * System-owned roll-mode policy: how the influence codes of a test's contributors resolve to one
 * roll mode. The codes are the System's `rollInfluence` vocabulary; the Encounter layer never assigns
 * meaning to one.
 */
export interface RollModeCapabilityAdapter {
  gameSystemId: string
  /** Pure: the roll mode the influences of a test's contributors resolve to. */
  resolveRollMode(influences: readonly string[]): RollModeResolution
  /** Pure: the face a roll mode keeps. The one place a System derives `keep`. */
  keepFor(rollMode: string): RollModeKeep
  /** Pure: the passive score a skill modifier gives under a roll mode. */
  passiveScore(skillModifier: number, rollMode: string): number
  /** The contributors the System's rules give the Kernel triggers, at most one per trigger. */
  ruleContributors: readonly RollModeRuleContributor[]
}

export function createRollModeCapabilityRegistry(
  adapters: readonly RollModeCapabilityAdapter[],
  vocabulary: SystemCoreCodeRegistry
) {
  const registry = createSystemCapabilityRegistry('roll-mode', adapters, (adapter) => {
    const { gameSystemId, ruleContributors } = adapter
    for (const [index, contributor] of ruleContributors.entries()) {
      if (
        ruleContributors.some(
          (other, otherIndex) =>
            otherIndex < index &&
            (other.trigger === contributor.trigger || other.id === contributor.id)
        )
      )
        throw new Error(
          `The roll-mode rule contributor "${contributor.id}" repeats a trigger or rule id.`
        )
      vocabulary.requireCode(gameSystemId, 'rollInfluence', contributor.influence)
    }
  })
  const rollModeKeep = (input: { gameSystemId: string; rollMode: string }): RollModeKeep => {
    const adapter = registry.require(input.gameSystemId)
    vocabulary.requireCode(input.gameSystemId, 'rollMode', input.rollMode)
    return adapter.keepFor(input.rollMode)
  }
  return {
    resolveRollMode(input: {
      gameSystemId: string
      contributors: readonly { influence: string }[]
    }): RollModeResolution {
      const adapter = registry.require(input.gameSystemId)
      const influences = input.contributors.map(({ influence }) => influence)
      for (const influence of influences)
        vocabulary.requireCode(input.gameSystemId, 'rollInfluence', influence)
      return adapter.resolveRollMode(influences)
    },
    /** The face a roll mode keeps, for a mode the roller chose rather than one contributors derived. */
    rollModeKeep,
    /** The System-governed d20 roll a roll mode makes: its code, label and the face it keeps. */
    d20Roll(input: { gameSystemId: string; rollMode: string }): D20Roll {
      return {
        mode: input.rollMode,
        label: vocabulary.requireCode(input.gameSystemId, 'rollMode', input.rollMode).label,
        keep: rollModeKeep(input)
      }
    },
    /** The roll modes a roller may pick for a System's d20 request, each with the face it keeps. */
    offeredRollModes(gameSystemId: string): { code: string; label: string; keep: RollModeKeep }[] {
      const adapter = registry.require(gameSystemId)
      return vocabulary
        .entries(gameSystemId, 'rollMode')
        .map(({ code, label }) => ({ code, label, keep: adapter.keepFor(code) }))
    },
    /** Refuses a d20 whose `keep` is not the one its System derives from its roll mode. */
    requireKeep(input: { gameSystemId: string; rollMode: string; keep: RollModeKeep }) {
      if (rollModeKeep(input) !== input.keep)
        throw new Error(`The roll mode "${input.rollMode}" does not keep the ${input.keep} face.`)
    },
    passiveScore(input: { gameSystemId: string; skillModifier: number; rollMode: string }) {
      const adapter = registry.require(input.gameSystemId)
      vocabulary.requireCode(input.gameSystemId, 'rollMode', input.rollMode)
      return adapter.passiveScore(input.skillModifier, input.rollMode)
    },
    /** The d20 contributors a System's rules give the Kernel triggers. */
    ruleContributors(gameSystemId: string): readonly RollModeRuleContributor[] {
      return registry.require(gameSystemId).ruleContributors
    }
  }
}
