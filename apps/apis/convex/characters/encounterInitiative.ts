import {
  characterEncounterInitiativeInputSchema,
  characterEncounterInitiativeResultSchema,
  type CharacterEncounterInitiativeInput,
  type CharacterEncounterInitiativeResult
} from '@artificer-toolkit/schema/api/characterEncounterInitiative'
import { toCharacterInitiativeActorFacts } from '@artificer-toolkit/rules-runtime/character/characterInitiativeFacts'
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
  const { snapshot, registry, output } = loaded.ruleEvaluation
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
