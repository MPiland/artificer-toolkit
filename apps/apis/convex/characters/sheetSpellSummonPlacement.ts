import {
  compileCharacterSpellCasts,
  type CharacterSpellCastActions
} from '@artificer-toolkit/rules-runtime/character/characterSpellCastActions'
import { sheetSpellCastSummonPlacement } from '@artificer-toolkit/rules-runtime/character/sheetSpellSummon'
import { characterTotalLevel } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { loadCharacterSheet } from './sheetPreparation'

type LoadedCharacterSheet = NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>

// One compile per loaded Sheet: its command and every Spell panel derived from it share it.
const compiledCasts = new WeakMap<LoadedCharacterSheet, CharacterSpellCastActions>()

/**
 * The summon plan of the Sheet cast of `spellId` at `castLevel`, from the compile an Encounter offers
 * its casts from (D190).
 */
export function readSheetSpellSummonPlacement(
  current: LoadedCharacterSheet,
  cast: { spellId: string; castLevel: number }
) {
  let casts = compiledCasts.get(current)
  if (!casts) {
    casts = compileCharacterSpellCasts({
      gameSystemId: current.character.systemId,
      character: current.character,
      ruleEvaluation: current.ruleEvaluation,
      policyOutput: current.ruleEvaluation.output,
      spellsById: current.spellsById,
      characterLevel: characterTotalLevel(current),
      conditionDefinitionIds: (current.resolution.registry.system?.conditionTypes ?? []).map(
        (condition) => condition.id
      ),
      firstSequence: current.ruleEvaluation.facts.actionCandidates.length
    })
    compiledCasts.set(current, casts)
  }
  return sheetSpellCastSummonPlacement({
    casts,
    spellCastCandidates: current.ruleEvaluation.facts.spellCastCandidates,
    ...cast
  })
}
