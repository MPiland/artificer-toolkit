import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemVocabularyCode'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import type { SystemVocabularyRegistry } from './systemVocabularyCapability.js'

export interface RollModeResolution {
  /** A code from the System's `rollMode` vocabulary. */
  rollMode: string
  keep: RollModeKeep
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
}

export function createRollModeCapabilityRegistry(
  adapters: readonly RollModeCapabilityAdapter[],
  vocabulary: SystemVocabularyRegistry
) {
  const registry = createSystemCapabilityRegistry('roll-mode', adapters)
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
    }
  }
}
