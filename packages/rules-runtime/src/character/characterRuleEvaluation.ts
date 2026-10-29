import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import type { CharacterGrantFoldSource } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import { evaluateInstalledCharacterPolicy } from '../platformCharacterPolicy.js'
import { listActiveEffectGrants } from './activeEffectGrantTotals.js'
import { normalizeCharacterGrantRestrictions } from './characterGrantFoldRestrictionFacts.js'
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

/**
 * The Character's policy facts with the holder's Active Effect grants folded as `ACTIVE_EFFECT`
 * sources; the same facts object when the holder carries none and none were folded before.
 */
export function withCharacterActiveGrants(
  facts: CharacterRulePolicyInput,
  effects: readonly ActiveRuleEffectRecord[]
): CharacterRulePolicyInput {
  const activeEffects = listActiveEffectGrants(effects).map(
    ({ effectId, modifiers, senses, boundItem }): CharacterGrantFoldSource => {
      const mechanicSource = { kind: 'ACTIVE_EFFECT', activeEffectId: effectId } as const
      return {
        sourceId: createCharacterMechanicSourceKey(mechanicSource),
        mechanicSource,
        ...(boundItem && { boundSourceId: createCharacterMechanicSourceKey(boundItem) }),
        sourceState: null,
        restrictions: normalizeCharacterGrantRestrictions(undefined),
        proficiencies: [],
        senses: [...senses],
        // A held hit point maximum grant stays out of the evaluated maximum: every reader
        // layers it, with maximum reductions, through `effectiveHitPointMaximum`.
        modifiers: modifiers.filter(({ valueDomainCode }) => valueDomainCode !== 'HIT_POINTS_MAX'),
        feats: [],
        spells: []
      }
    }
  )
  // Re-folding replaces earlier grants, so facts folded once fold again to the holder's current set.
  return activeEffects.length || facts.grantFoldFacts.activeEffects.length
    ? { ...facts, grantFoldFacts: { ...facts.grantFoldFacts, activeEffects } }
    : facts
}

/**
 * The evaluation with the holder's Active Effect grants folded in and the policy re-run, the one
 * fold the Sheet and the room both read (SPELLS-8.6). `adjustFacts` applies the room's own fact
 * changes (reduced ability scores) before the re-run; the evaluation comes back as it was when
 * neither changes the facts.
 */
export function evaluateCharacterActiveGrantRules<
  TEvaluation extends { facts: CharacterRulePolicyInput; output: CharacterRulePolicyOutput }
>(input: {
  gameSystemId: string
  evaluation: TEvaluation
  activeEffects: readonly ActiveRuleEffectRecord[]
  vocabularySnapshot: Pick<SystemVocabularySnapshot, 'document'> | undefined
  adjustFacts?: (facts: CharacterRulePolicyInput) => CharacterRulePolicyInput
}): TEvaluation {
  const { evaluation } = input
  const withGrants = withCharacterActiveGrants(evaluation.facts, input.activeEffects)
  const facts = input.adjustFacts ? input.adjustFacts(withGrants) : withGrants
  if (facts === evaluation.facts) return evaluation
  return {
    ...evaluation,
    facts,
    output: resolveCharacterRulePolicyRollModes(
      evaluateInstalledCharacterPolicy({ gameSystemId: input.gameSystemId, facts }),
      input.vocabularySnapshot
    )
  }
}
