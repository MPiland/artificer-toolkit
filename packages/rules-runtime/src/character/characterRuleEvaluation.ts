import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { evaluateInstalledCharacterPolicy } from '../platformCharacterPolicy.js'
import {
  composeCharacterRulePolicyFacts,
  type CharacterRulePolicyFactsInput,
  type CharacterRulePolicyFactsResult
} from './characterRulePolicyFacts.js'
import {
  assembleCharacterRuleSnapshot,
  type prepareCharacterRuleSources
} from './characterRuleSnapshot.js'
import { resolveCharacterRulePolicyRollModes } from './characterRuleRollProjection.js'
import {
  buildCharacterSpellRuleFacts,
  collectCharacterRuleInputSpellIds
} from './characterSpellRuleFacts.js'

export interface CharacterRuleEvaluationResult extends CharacterRulePolicyFactsResult {
  output: CharacterRulePolicyOutput
}

/** Evaluates trusted current sources; the calling backend owns source visibility and persistence. */
export function evaluateCharacterRules(
  input: Omit<CharacterRulePolicyFactsInput, 'spellsWithEffects'> & {
    spellsById?: ReadonlyMap<string, CompiledSpell>
    referenceSpellIds?: readonly string[]
  },
  sources?: ReturnType<typeof prepareCharacterRuleSources>
): CharacterRuleEvaluationResult {
  const assembled = assembleCharacterRuleSnapshot(input, sources)
  const spellFacts = buildCharacterSpellRuleFacts(assembled.snapshot, assembled.registry)
  const spellIds = collectCharacterRuleInputSpellIds({
    referenceSpellIds: input.referenceSpellIds,
    spellAccessCandidates: spellFacts.spellAccessCandidates,
    spellSources: assembled.snapshot.spellSources
  })
  const spellsWithEffects = [...spellIds].map((id) => {
    const spell = input.spellsById?.get(id)
    if (!spell || spell.id !== id)
      throw new Error(`Character rule evaluation could not hydrate spell "${id}".`)
    return spell
  })
  const composed = composeCharacterRulePolicyFacts(
    { ...input, spellsWithEffects },
    { assembled, spellFacts }
  )
  return {
    ...composed,
    output: resolveCharacterRulePolicyRollModes(
      evaluateInstalledCharacterPolicy({
        gameSystemId: input.character.systemId,
        facts: composed.facts
      }),
      input.context.vocabularySnapshot
    )
  }
}
