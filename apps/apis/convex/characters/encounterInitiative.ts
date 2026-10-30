import {
  characterEncounterInitiativeInputSchema,
  characterEncounterInitiativeResultSchema,
  type CharacterEncounterInitiativeInput,
  type CharacterEncounterInitiativeResult
} from '@artificer-toolkit/schema/api/characterEncounterInitiative'
import { toCharacterInitiativeActorFacts } from '@artificer-toolkit/rules-runtime/character/characterInitiativeFacts'
import { evaluateCharacterActiveGrantRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import type { QueryCtx } from '../_generated/server'
import { loadCharacterSheetFacts } from './sheetFacts'

/** Native aggregate callers supply authority derived from the current Campaign, never client input. */
export async function loadCharacterEncounterInitiative(
  ctx: QueryCtx,
  userId: string,
  args: CharacterEncounterInitiativeInput
): Promise<CharacterEncounterInitiativeResult> {
  const input = characterEncounterInitiativeInputSchema.parse(args)
  const loaded = await loadCharacterSheetFacts(ctx, userId, input.characterId, input.campaignId)
  if (!loaded || loaded.active.id !== input.characterId)
    throw new Error('Character initiative source is unavailable.')
  if (loaded.character.systemId !== input.systemId)
    throw new Error('Character initiative source is stale.')
  // Initiative reads the Character's active grants, as its Sheet does (a held Stealth bonus).
  const { snapshot, registry, output } = evaluateCharacterActiveGrantRules({
    gameSystemId: input.systemId,
    evaluation: loaded.ruleEvaluation,
    activeEffects: loaded.activeEffects,
    vocabularySnapshot: loaded.prepared.context.vocabularySnapshot
  })
  if (snapshot.characterId !== input.characterId || snapshot.systemId !== input.systemId)
    throw new Error('Character initiative source identity does not match the actor.')
  return characterEncounterInitiativeResultSchema.parse({
    streamVersion: loaded.active.play.streamVersion,
    initiativeActorFacts: toCharacterInitiativeActorFacts({
      snapshot,
      registry,
      rulePolicyOutput: output
    }),
    rulePolicyOutput: output
  })
}
